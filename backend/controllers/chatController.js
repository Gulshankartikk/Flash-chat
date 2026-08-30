const mongoose = require("mongoose");
const { uploadFileCloudinary } = require("../config/cloudinaryConfig");
const Conversation = require("../models/Conversation");
const Message = require("../models/message");
const User = require("../models/user");
const response = require("../utils/responseHandler");
const { generateAIResponse } = require("../services/aiService");

let supportsTransactions = null;

async function checkTransactionSupport() {
  if (supportsTransactions !== null) return supportsTransactions;
  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    await User.findOne().session(session);
    await session.commitTransaction();
    session.endSession();
    supportsTransactions = true;
  } catch (e) {
    supportsTransactions = false;
    console.warn("[MongoDB] Transactions are not supported on this MongoDB server configuration (Replica Set is not configured). Running in non-transactional mode.");
  }
  return supportsTransactions;
}

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes, like WhatsApp
const DELETE_FOR_EVERYONE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Small helper so we don't repeat the "find other participant" logic everywhere.
// NOTE: this assumes 1:1 conversations (sender/receiver). If group chat is ever
// added, this helper (and the schema) will need to change to participants[].
function getOtherUserId(message, userId) {
  const senderId = String(message.sender?._id || message.sender);
  const receiverId = String(message.receiver?._id || message.receiver);
  return senderId === String(userId) ? receiverId : senderId;
}

function emitToUser(req, userId, event, payload) {
  if (!req.io || !req.socketUserMap) return;
  const socketId = req.socketUserMap.get(String(userId));
  if (socketId) {
    req.io.to(socketId).emit(event, payload);
  }
}

// Background handler for AI chatbot replies
async function handleAIResponse(req, senderId, receiverId, conversationId, userMessageContent) {
  try {
    // 1. Send typing indicator from AI Bot
    emitToUser(req, senderId, "user_typing", {
      userId: receiverId, // AI Bot is the typing user
      conversationId,
      isTyping: true,
    });

    // 2. Fetch recent conversation history for context
    const history = await Message.find({ conversation: conversationId })
      .sort({ createdAt: -1 })
      .limit(10);
    // reverse to chronological order
    history.reverse();

    // 3. Generate response
    const aiReply = await generateAIResponse(userMessageContent, history);

    // 4. Simulate typing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 5. Save AI's response in DB
    const aiMessage = new Message({
      conversation: conversationId,
      sender: receiverId, // AI is sender
      receiver: senderId,
      content: aiReply,
      contentType: "text",
      messageStatus: "seen",
    });

    await aiMessage.save();

    const populatedAIResponse = await Message.findById(aiMessage._id)
      .populate("sender", "username profilePicture")
      .populate("receiver", "username profilePicture")
      .populate("conversation", "participants lastMessage");

    // Update conversation's lastMessage
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: aiMessage._id,
    });

    // 6. Stop typing and emit the message
    emitToUser(req, senderId, "user_typing", {
      userId: receiverId,
      conversationId,
      isTyping: false,
    });

    emitToUser(req, senderId, "receive_message", populatedAIResponse);

  } catch (err) {
    console.error("Error in AI response handler:", err);
  }
}

// ================= SEND MESSAGE =================
exports.sendMessage = async (req, res) => {
  let { senderId, receiverId, conversationId, content, messageStatus } = req.body;

  if (!senderId && req.user) {
    senderId = req.user.userId;
  }

  if (!senderId) {
    return response(res, 400, "senderId is required");
  }

  let isPrivate = true;
  let isReceiverBlockedByMe = false;
  let hasReceiverBlockedMe = false;

  if (conversationId) {
    // Checked inside transaction
  } else if (!receiverId) {
    return response(res, 400, "receiverId or conversationId is required");
  }

  const file = req.file;

  if (receiverId && String(senderId) === String(receiverId)) {
    return response(res, 400, "Cannot send a message to yourself");
  }

  if (!content?.trim() && !file) {
    return response(res, 400, "Message content or media is required");
  }

  // Upload BEFORE opening the transaction. Cloudinary isn't transactional and
  // we don't want a DB session held open during a slow external network call.
  let imageOrVideoUrl = null;
  let contentType = null;

  if (file) {
    let uploadFile;
    try {
      uploadFile = await uploadFileCloudinary(file);
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      return response(res, 400, "Failed to upload media");
    }

    if (!uploadFile?.secure_url) {
      return response(res, 400, "Failed to upload media");
    }

    imageOrVideoUrl = uploadFile.secure_url;

    if (file.mimetype.startsWith("image")) contentType = "image";
    else if (file.mimetype.startsWith("video")) contentType = "video";
    else if (file.mimetype.startsWith("audio")) contentType = "audio";
    else contentType = "document";
  } else {
    contentType = "text";
  }

  let session = null;
  const useTx = await checkTransactionSupport();
  if (useTx) {
    session = await mongoose.startSession();
  }

  try {
    let newMessage;
    let populatedMessage;
    let wasDeliveredImmediately = false;
    let isReceiverAIBot = false;
    let conversationDoc;

    const executeOperations = async (sess) => {
      if (conversationId) {
        conversationDoc = await Conversation.findById(conversationId).session(sess);
        if (!conversationDoc) {
          throw { statusCode: 404, message: "Conversation not found" };
        }
        if (!conversationDoc.participants.map(String).includes(String(senderId))) {
          throw { statusCode: 403, message: "You are not a participant in this conversation" };
        }
        isPrivate = conversationDoc.conversationType === "private";
        if (isPrivate) {
          receiverId = conversationDoc.participants.find(p => String(p) !== String(senderId));
        }
      } else {
        const participants = [senderId, receiverId].sort();
        conversationDoc = await Conversation.findOne({ participants }).session(sess);
        if (!conversationDoc) {
          conversationDoc = new Conversation({
            participants,
            participantsKey: participants.join("_"),
            unreadCounts: new Map(),
          });
        }
      }

      // Check block status for private conversations
      if (isPrivate && receiverId) {
        const senderUser = await User.findById(senderId).session(sess);
        const receiverUser = await User.findById(receiverId).session(sess);

        if (!senderUser || !receiverUser) {
          throw { statusCode: 404, message: "User not found" };
        }

        isReceiverAIBot = receiverUser.isAIBot || false;

        isReceiverBlockedByMe = (senderUser.blockedUsers || []).map(String).includes(String(receiverId));
        hasReceiverBlockedMe = (receiverUser.blockedUsers || []).map(String).includes(String(senderId));

        if (isReceiverBlockedByMe) {
          throw { statusCode: 400, message: "You have blocked this user" };
        }

        if (hasReceiverBlockedMe) {
          throw { statusCode: 400, message: "Message delivery failed" };
        }
      }

      newMessage = new Message({
        conversation: conversationDoc._id,
        sender: senderId,
        receiver: isPrivate ? receiverId : undefined,
        content: content?.trim() || "",
        imageOrVideoUrl,
        contentType,
        messageStatus: messageStatus || "sent",
      });

      if (isPrivate) {
        if (isReceiverAIBot) {
          newMessage.messageStatus = "seen";
          newMessage.seenBy.push({ user: receiverId });
          wasDeliveredImmediately = true;
        } else {
          // Mark delivered immediately if the receiver is currently online.
          const receiverSocketId = req.socketUserMap?.get(String(receiverId));
          if (receiverSocketId) {
            newMessage.messageStatus = "delivered";
            newMessage.deliveredTo.push({ user: receiverId });
            wasDeliveredImmediately = true;
          }
        }

        if (!isReceiverAIBot) {
          if (!conversationDoc.unreadCounts) conversationDoc.unreadCounts = new Map();
          const currentUnread = conversationDoc.unreadCounts.get(String(receiverId)) || 0;
          conversationDoc.unreadCounts.set(String(receiverId), currentUnread + 1);
        }
      } else {
        // Group chat unread counts update for all other participants
        if (!conversationDoc.unreadCounts) conversationDoc.unreadCounts = new Map();
        conversationDoc.participants.forEach(p => {
          const pIdStr = String(p);
          if (pIdStr !== String(senderId)) {
            const currentUnread = conversationDoc.unreadCounts.get(pIdStr) || 0;
            conversationDoc.unreadCounts.set(pIdStr, currentUnread + 1);
          }
        });
      }

      await newMessage.save({ session: sess });

      conversationDoc.lastMessage = newMessage._id;
      await conversationDoc.save({ session: sess });
    };

    if (session) {
      await session.withTransaction(async () => {
        await executeOperations(session);
      });
    } else {
      await executeOperations(null);
    }

    populatedMessage = await Message.findById(newMessage._id)
      .populate("sender", "username profilePicture")
      .populate("receiver", "username profilePicture")
      .populate("conversation", "participants lastMessage");

    if (isPrivate) {
      if (isReceiverAIBot) {
        // Trigger background AI response
        handleAIResponse(req, senderId, receiverId, newMessage.conversation, content?.trim() || "");
      } else {
        const receiverSocketId = req.socketUserMap?.get(String(receiverId));
        if (receiverSocketId) {
          emitToUser(req, receiverId, "receive_message", populatedMessage);

          if (wasDeliveredImmediately) {
            emitToUser(req, senderId, "message_status_update", {
              messageId: newMessage._id,
              messageStatus: "delivered",
            });
          }
        }
      }
    } else {
      // Group message broadcast to all online participants except sender
      conversationDoc.participants.forEach(p => {
        const pIdStr = String(p);
        if (pIdStr !== String(senderId)) {
          const receiverSocketId = req.socketUserMap?.get(pIdStr);
          if (receiverSocketId) {
            emitToUser(req, pIdStr, "receive_message", populatedMessage);
          }
          // Emit socket notifications to offline/inactive users too
          emitToUser(req, pIdStr, "new_notification", {
            type: "message",
            from: senderId,
            conversationId: conversationDoc._id,
            title: conversationDoc.groupName || "Group Message",
            preview: `${populatedMessage.sender?.username || "Someone"}: ${content || "Sent an attachment"}`,
            avatar: conversationDoc.groupPhoto || "",
          });
        }
      });
    }

    return response(res, 200, "Message sent successfully", populatedMessage);
  } catch (error) {
    if (error.statusCode) {
      return response(res, error.statusCode, error.message);
    }
    console.error(error);
    return response(res, 500, "Internal server error");
  } finally {
    if (session) session.endSession();
  }
};

// ================= EXPORT BACKUP =================
exports.exportBackup = async (req, res) => {
  try {
    const userId = req.user.userId;

    const conversations = await Conversation.find({ participants: userId })
      .populate("participants", "username email phoneNumber phoneSuffix profilePicture about isAIBot");

    const conversationIds = conversations.map(c => c._id);

    const messages = await Message.find({
      conversation: { $in: conversationIds },
      deletedFor: { $ne: userId }
    }).populate("sender", "username email phoneNumber phoneSuffix isAIBot")
      .populate("receiver", "username email phoneNumber phoneSuffix isAIBot");

    const backupData = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      conversations,
      messages
    };

    return response(res, 200, "Backup exported successfully", backupData);
  } catch (error) {
    console.error("Export backup error:", error);
    return response(res, 500, "Failed to export backup");
  }
};

// ================= IMPORT BACKUP =================
exports.importBackup = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { backupData, mergeStrategy = "merge" } = req.body;

    if (!backupData || !Array.isArray(backupData.conversations) || !Array.isArray(backupData.messages)) {
      return response(res, 400, "Invalid backup data format");
    }

    const conversationIdMap = {};

    // 1. Restore conversations
    for (const oldConv of backupData.conversations) {
      if (!oldConv.participants || oldConv.participants.length === 0) continue;

      const participantIds = [];
      for (const p of oldConv.participants) {
        let userDoc = null;
        if (p.email) {
          userDoc = await User.findOne({ email: p.email.toLowerCase() });
        } else if (p.phoneNumber) {
          userDoc = await User.findOne({ phoneNumber: p.phoneNumber });
        }
        
        if (userDoc) {
          participantIds.push(userDoc._id.toString());
        } else {
          if (p.isAIBot || p.email === "ai@flashchat.com") {
            const aiBot = await User.findOne({ isAIBot: true });
            if (aiBot) participantIds.push(aiBot._id.toString());
          }
        }
      }

      if (!participantIds.includes(userId.toString())) {
        participantIds.push(userId.toString());
      }

      participantIds.sort();

      const convType = oldConv.conversationType || "private";
      let existingConv = null;

      if (convType === "private") {
        const participantsKey = participantIds.join("_");
        existingConv = await Conversation.findOne({ participantsKey });
        
        if (!existingConv) {
          existingConv = new Conversation({
            participants: participantIds,
            participantsKey,
            conversationType: "private",
            unreadCounts: new Map()
          });
          await existingConv.save();
        }
      } else {
        existingConv = await Conversation.findOne({
          conversationType: "group",
          groupName: oldConv.groupName,
          participants: { $all: participantIds }
        });

        if (!existingConv) {
          existingConv = new Conversation({
            participants: participantIds,
            conversationType: "group",
            groupName: oldConv.groupName || "Restored Group",
            groupAvatar: oldConv.groupAvatar,
            groupAdmins: [userId],
            unreadCounts: new Map()
          });
          await existingConv.save();
        }
      }

      conversationIdMap[oldConv._id] = existingConv._id.toString();
    }

    // If overwrite strategy requested, purge existing messages in these conversations
    if (mergeStrategy === "overwrite") {
      const targetConvIds = Object.values(conversationIdMap);
      await Message.deleteMany({ conversation: { $in: targetConvIds } });
    }

    // 2. Restore messages
    let restoredCount = 0;
    for (const oldMsg of backupData.messages) {
      const newConvId = conversationIdMap[oldMsg.conversation?._id || oldMsg.conversation];
      if (!newConvId) continue;

      let newSenderId = userId;
      if (oldMsg.sender) {
        const senderEmail = oldMsg.sender.email;
        const senderPhone = oldMsg.sender.phoneNumber;
        let senderDoc = null;
        
        if (senderEmail) {
          senderDoc = await User.findOne({ email: senderEmail.toLowerCase() });
        } else if (senderPhone) {
          senderDoc = await User.findOne({ phoneNumber: senderPhone });
        }

        if (senderDoc) {
          newSenderId = senderDoc._id;
        } else if (oldMsg.sender.isAIBot || senderEmail === "ai@flashchat.com") {
          const aiBot = await User.findOne({ isAIBot: true });
          if (aiBot) newSenderId = aiBot._id;
        }
      }

      let newReceiverId = null;
      if (oldMsg.receiver) {
        const receiverEmail = oldMsg.receiver.email;
        const receiverPhone = oldMsg.receiver.phoneNumber;
        let receiverDoc = null;

        if (receiverEmail) {
          receiverDoc = await User.findOne({ email: receiverEmail.toLowerCase() });
        } else if (receiverPhone) {
          receiverDoc = await User.findOne({ phoneNumber: receiverPhone });
        }

        if (receiverDoc) {
          newReceiverId = receiverDoc._id;
        } else if (oldMsg.receiver.isAIBot || receiverEmail === "ai@flashchat.com") {
          const aiBot = await User.findOne({ isAIBot: true });
          if (aiBot) newReceiverId = aiBot._id;
        }
      }

      const msgExists = await Message.findOne({
        conversation: newConvId,
        sender: newSenderId,
        content: oldMsg.content,
        createdAt: oldMsg.createdAt
      });

      if (!msgExists) {
        const newMsg = new Message({
          conversation: newConvId,
          sender: newSenderId,
          receiver: newReceiverId,
          content: oldMsg.content,
          contentType: oldMsg.contentType || "text",
          imageOrVideoUrl: oldMsg.imageOrVideoUrl,
          messageStatus: oldMsg.messageStatus || "seen",
          isDeletedForEveryone: oldMsg.isDeletedForEveryone || false,
          isEdited: oldMsg.isEdited || false,
          isPinned: oldMsg.isPinned || false,
          createdAt: oldMsg.createdAt,
          updatedAt: oldMsg.updatedAt
        });
        await newMsg.save();
        restoredCount++;

        await Conversation.findByIdAndUpdate(newConvId, {
          lastMessage: newMsg._id
        });
      }
    }

    return response(res, 200, `Backup restored successfully. Restored ${restoredCount} new messages.`, { restoredCount });
  } catch (error) {
    console.error("Import backup error:", error);
    return response(res, 500, "Failed to restore backup");
  }
};

// ================= GET ALL CONVERSATIONS =================
exports.getConversation = async (req, res) => {
  const userId = req.user.userId;

  try {
    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate("participants", "username profilePicture isOnline lastSeen")
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender receiver",
          select: "username profilePicture",
        },
      })
      .sort({ updatedAt: -1 });

    const formatted = conversations.map((conv) => {
      const obj = conv.toObject();
      obj.unreadCount = conv.unreadCounts?.get(String(userId)) || 0;
      delete obj.unreadCounts;
      return obj;
    });

    return response(res, 200, "Conversations fetched successfully", formatted);
  } catch (error) {
    console.error(error);
    return response(res, 500, "Internal server error");
  }
};

// ================= GET MESSAGES (paginated) =================
exports.getMessage = async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user.userId;
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  const before = req.query.before;

  try {
    const conversationDoc = await Conversation.findById(conversationId);

    if (!conversationDoc) {
      return response(res, 404, "Conversation not found");
    }

    if (!conversationDoc.participants.map(String).includes(String(userId))) {
      return response(res, 403, "Unauthorized");
    }

    const query = { conversation: conversationId, deletedFor: { $ne: userId } };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate("sender", "username profilePicture")
      .populate("receiver", "username profilePicture")
      .sort({ createdAt: -1 })
      .limit(limit);

    // Mark incoming, unseen messages as seen.
    const toMarkSeen = messages.filter(
      (m) =>
        String(m.sender?._id || m.sender) !== String(userId) &&
        !m.seenBy.some((s) => String(s.user) === String(userId))
    );

    if (toMarkSeen.length > 0) {
      const ids = toMarkSeen.map((m) => m._id);

      await Message.updateMany(
        { _id: { $in: ids } },
        {
          $set: { messageStatus: "seen" },
          $push: { seenBy: { user: userId, at: new Date() } },
        }
      );

      // Only emit seen status update to sender if viewer has read receipts enabled
      const viewer = await User.findById(userId).select("privacySettings");
      const hasReadReceipts = viewer?.privacySettings?.readReceipts !== false;

      if (hasReadReceipts) {
        for (const msg of toMarkSeen) {
          emitToUser(req, msg.sender._id || msg.sender, "message_status_update", {
            messageId: msg._id,
            messageStatus: "seen",
          });
        }
      }
    }

    // Only reset unread count when the viewer is looking at the latest page
    // (no `before` cursor). Paginating backward into history shouldn't zero
    // out unread state for messages the viewer hasn't actually reached yet.
    if (!before && conversationDoc.unreadCounts?.get(String(userId))) {
      conversationDoc.unreadCounts.set(String(userId), 0);
      await conversationDoc.save();
    }

    return response(res, 200, "Messages fetched successfully", messages.reverse());
  } catch (error) {
    console.error(error);
    return response(res, 500, "Internal server error");
  }
};

// ================= MARK AS READ (SEEN) =================
exports.markAsRead = async (req, res) => {
  const { messageIds } = req.body;
  const userId = req.user.userId;

  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return response(res, 400, "messageIds must be a non-empty array");
  }

  try {
    const messages = await Message.find({
      _id: { $in: messageIds },
      sender: { $ne: userId },
      "seenBy.user": { $ne: userId },
    });

    if (messages.length === 0) {
      return response(res, 200, "No messages to update");
    }

    await Message.updateMany(
      { _id: { $in: messages.map((m) => m._id) } },
      {
        $set: { messageStatus: "seen" },
        $push: { seenBy: { user: userId, at: new Date() } },
      }
    );

    // Only emit status updates to sender if viewer has read receipts enabled
    const viewer = await User.findById(userId).select("privacySettings");
    const hasReadReceipts = viewer?.privacySettings?.readReceipts !== false;

    if (hasReadReceipts) {
      for (const msg of messages) {
        emitToUser(req, msg.sender, "message_status_update", {
          messageId: msg._id,
          messageStatus: "seen",
        });
      }
    }

    // Keep the conversation list's unread badge in sync. Without this, a
    // client that calls markAsRead directly (without hitting getMessage)
    // would leave a stale unread count on the conversation.
    const conversationIds = [...new Set(messages.map((m) => String(m.conversation)))];
    for (const convId of conversationIds) {
      const conversationDoc = await Conversation.findById(convId);
      if (conversationDoc?.unreadCounts?.get(String(userId))) {
        conversationDoc.unreadCounts.set(String(userId), 0);
        await conversationDoc.save();
      }
    }

    return response(res, 200, "Messages marked as seen");
  } catch (error) {
    console.error(error);
    return response(res, 500, "Internal server error");
  }
};

// ================= DELETE MESSAGE =================
exports.deleteMessage = async (req, res) => {
  const { messageId } = req.params;
  const { deleteForEveryone } = req.body;
  const userId = req.user.userId;

  try {
    const messageDoc = await Message.findById(messageId);

    if (!messageDoc) {
      return response(res, 404, "Message not found");
    }

    const isParticipant =
      String(messageDoc.sender) === String(userId) ||
      String(messageDoc.receiver) === String(userId);

    if (!isParticipant) {
      return response(res, 403, "Unauthorized");
    }

    if (deleteForEveryone) {
      if (String(messageDoc.sender) !== String(userId)) {
        return response(res, 403, "Only the sender can delete this message for everyone");
      }

      if (messageDoc.isDeletedForEveryone) {
        return response(res, 400, "Message already deleted");
      }

      const age = Date.now() - messageDoc.createdAt.getTime();
      if (age > DELETE_FOR_EVERYONE_WINDOW_MS) {
        return response(res, 400, "Too late to delete this message for everyone");
      }

      messageDoc.content = "";
      messageDoc.imageOrVideoUrl = null;
      messageDoc.isDeletedForEveryone = true;
      await messageDoc.save();

      const otherUserId = getOtherUserId(messageDoc, userId);
      emitToUser(req, otherUserId, "message_deleted", {
        messageId: messageDoc._id,
        deleteForEveryone: true,
      });

      return response(res, 200, "Message deleted for everyone");
    }

    if (!messageDoc.deletedFor.map(String).includes(String(userId))) {
      messageDoc.deletedFor.push(userId);
      await messageDoc.save();
    }

    // Sync "delete for me" across the deleter's own other sessions/devices.
    emitToUser(req, userId, "message_deleted", {
      messageId: messageDoc._id,
      deleteForEveryone: false,
    });

    return response(res, 200, "Message deleted for you");
  } catch (error) {
    console.error(error);
    return response(res, 500, "Internal server error");
  }
};

// ================= ADD / REMOVE / UPDATE REACTION =================
exports.reactToMessage = async (req, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body;
  const userId = req.user.userId;

  if (!emoji) {
    return response(res, 400, "emoji is required");
  }

  try {
    const messageDoc = await Message.findById(messageId);

    if (!messageDoc) {
      return response(res, 404, "Message not found");
    }

    const isParticipant =
      String(messageDoc.sender) === String(userId) ||
      String(messageDoc.receiver) === String(userId);

    if (!isParticipant) {
      return response(res, 403, "Unauthorized");
    }

    const existingIndex = messageDoc.reactions.findIndex(
      (r) => String(r.user) === String(userId)
    );
    let action;

    if (existingIndex !== -1) {
      if (messageDoc.reactions[existingIndex].emoji === emoji) {
        // Tapping the same emoji again removes it, like WhatsApp.
        messageDoc.reactions.splice(existingIndex, 1);
        action = "removed";
      } else {
        messageDoc.reactions[existingIndex].emoji = emoji;
        action = "updated";
      }
    } else {
      messageDoc.reactions.push({ user: userId, emoji });
      action = "added";
    }

    await messageDoc.save();

    const otherUserId = getOtherUserId(messageDoc, userId);
    emitToUser(req, otherUserId, "message_reaction", {
      messageId: messageDoc._id,
      userId,
      emoji: action === "removed" ? null : emoji,
      action,
    });

    return response(res, 200, "Reaction updated", messageDoc.reactions);
  } catch (error) {
    console.error(error);
    return response(res, 500, "Internal server error");
  }
};

// ================= EDIT MESSAGE =================
exports.editMessage = async (req, res) => {
  const { messageId } = req.params;
  const { content } = req.body;
  const userId = req.user.userId;

  if (!content?.trim()) {
    return response(res, 400, "Content is required to edit a message");
  }

  try {
    const message = await Message.findById(messageId);
    if (!message) return response(res, 404, "Message not found");

    if (String(message.sender) !== String(userId)) {
      return response(res, 403, "You can only edit your own messages");
    }

    if (message.isDeletedForEveryone) {
      return response(res, 400, "Cannot edit a deleted message");
    }

    if (message.contentType !== "text") {
      return response(res, 400, "Only text messages can be edited");
    }

    const age = Date.now() - message.createdAt.getTime();
    if (age > EDIT_WINDOW_MS) {
      return response(res, 400, "Too late to edit this message");
    }

    message.content = content.trim();
    message.isEdited = true;
    await message.save();

    const populated = await Message.findById(message._id)
      .populate("sender", "username profilePicture")
      .populate("receiver", "username profilePicture");

    const otherUserId = getOtherUserId(populated, userId);
    emitToUser(req, otherUserId, "message_edited", {
      messageId: populated._id,
      content: populated.content,
      isEdited: true,
    });

    return response(res, 200, "Message edited successfully", populated);
  } catch (error) {
    console.error(error);
    return response(res, 500, "Internal server error");
  }
};

// ================= BULK DELETE MESSAGES =================
exports.bulkDeleteMessages = async (req, res) => {
  const { messageIds, deleteFor } = req.body;
  const userId = req.user.userId;

  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return response(res, 400, "messageIds is required and must be an array");
  }

  try {
    if (deleteFor === "everyone") {
      const cutoff = new Date(Date.now() - DELETE_FOR_EVERYONE_WINDOW_MS);

      // Only the sender can wipe a message, and only within the time window.
      const messages = await Message.find({
        _id: { $in: messageIds },
        sender: userId,
        isDeletedForEveryone: { $ne: true },
        createdAt: { $gte: cutoff },
      });

      const idsToWipe = messages.map((m) => m._id);

      if (idsToWipe.length > 0) {
        await Message.updateMany(
          { _id: { $in: idsToWipe } },
          {
            $set: {
              content: "",
              imageOrVideoUrl: null,
              isDeletedForEveryone: true,
            },
          }
        );
      }

      messages.forEach((msg) => {
        const otherUserId = getOtherUserId(msg, userId);
        emitToUser(req, otherUserId, "message_deleted", {
          messageId: msg._id,
          deleteForEveryone: true,
        });
      });

      const skipped = messageIds.length - idsToWipe.length;
      return response(
        res,
        200,
        skipped > 0
          ? `${idsToWipe.length} message(s) deleted, ${skipped} skipped (not yours or too old)`
          : "Messages deleted successfully"
      );
    } else {
      // "Delete for me"
      await Message.updateMany(
        { _id: { $in: messageIds } },
        { $addToSet: { deletedFor: userId } }
      );

      emitToUser(req, userId, "messages_deleted", {
        messageIds,
        deleteForEveryone: false,
      });

      return response(res, 200, "Messages deleted successfully");
    }
  } catch (error) {
    console.error(error);
    return response(res, 500, "Internal server error");
  }
};

// ================= PIN MESSAGE =================
exports.pinMessage = async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.userId;

  let session = null;
  const useTx = await checkTransactionSupport();
  if (useTx) {
    session = await mongoose.startSession();
  }

  try {
    let populated;

    const executeOperations = async (sess) => {
      const message = await Message.findById(messageId).session(sess);
      if (!message) {
        throw Object.assign(new Error("Message not found"), { statusCode: 404 });
      }

      const isParticipant =
        String(message.sender) === String(userId) ||
        String(message.receiver) === String(userId);

      if (!isParticipant) {
        throw Object.assign(new Error("Unauthorized"), { statusCode: 403 });
      }

      message.isPinned = !message.isPinned;
      await message.save({ session: sess });

      // WhatsApp only allows one pinned message per chat. Unpinning the
      // others happens inside the same transaction as the toggle above, so
      // two near-simultaneous pin requests can't both end up pinned.
      if (message.isPinned) {
        await Message.updateMany(
          { conversation: message.conversation, _id: { $ne: messageId } },
          { $set: { isPinned: false } },
          { session: sess }
        );
      }

      populated = await Message.findById(message._id)
        .session(sess)
        .populate("sender", "username profilePicture")
        .populate("receiver", "username profilePicture");
    };

    if (session) {
      await session.withTransaction(async () => {
        await executeOperations(session);
      });
    } else {
      await executeOperations(null);
    }

    const otherUserId = getOtherUserId(populated, userId);
    emitToUser(req, otherUserId, "message_pinned", {
      messageId: populated._id,
      isPinned: populated.isPinned,
      conversationId: populated.conversation,
    });

    return response(res, 200, "Message pin toggled successfully", populated);
  } catch (error) {
    if (error.statusCode) {
      return response(res, error.statusCode, error.message);
    }
    console.error(error);
    return response(res, 500, "Internal server error");
  } finally {
    session.endSession();
  }
};

// Helper to emit group update
const emitGroupUpdate = (req, conversation) => {
  if (!req.io || !req.socketUserMap) return;
  conversation.participants.forEach(member => {
    const memberId = String(member._id || member);
    const socketId = req.socketUserMap.get(memberId);
    if (socketId) {
      req.io.to(socketId).emit("group_updated", conversation);
    }
  });
};

// CREATE GROUP
exports.createGroup = async (req, res) => {
  const { groupName, members: membersRaw } = req.body;
  const creatorId = req.user.userId;

  if (!groupName || !groupName.trim()) {
    return response(res, 400, "Group name is required");
  }

  let members = [];
  if (membersRaw) {
    try {
      members = Array.isArray(membersRaw) ? membersRaw : JSON.parse(membersRaw);
    } catch (e) {
      members = [];
    }
  }

  // Ensure unique member IDs, remove the creator (added explicitly later)
  const uniqueMembers = [...new Set(members.map(String))].filter(id => id !== String(creatorId));

  try {
    let groupPhotoUrl = "";
    if (req.file) {
      const uploadResult = await uploadFileCloudinary(req.file);
      groupPhotoUrl = uploadResult?.secure_url || "";
    }

    const conversation = new Conversation({
      participants: [creatorId, ...uniqueMembers],
      conversationType: "group",
      groupName: groupName.trim(),
      groupAvatar: groupPhotoUrl,
      groupPhoto: groupPhotoUrl,
      groupAdmins: [creatorId],
      createdBy: creatorId,
      unreadCounts: new Map()
    });

    await conversation.save();

    const populated = await Conversation.findById(conversation._id)
      .populate("participants", "username profilePicture isOnline lastSeen");

    // Emit group update so other members get notified
    emitGroupUpdate(req, populated.toObject());

    return response(res, 201, "Group created successfully", populated);
  } catch (error) {
    console.error("createGroup error:", error);
    return response(res, 500, "Internal server error");
  }
};

// ADD GROUP MEMBERS
exports.addGroupMembers = async (req, res) => {
  const { id } = req.params;
  const { members } = req.body;
  const userId = req.user.userId;

  if (!Array.isArray(members) || members.length === 0) {
    return response(res, 400, "Members array is required");
  }

  try {
    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.conversationType !== "group") {
      return response(res, 404, "Group not found");
    }

    // Only admins can add members
    if (!conversation.groupAdmins.map(String).includes(String(userId))) {
      return response(res, 403, "Only admins can add members to the group");
    }

    const existingParticipants = conversation.participants.map(String);
    const newMembers = members.filter(m => !existingParticipants.includes(String(m)));

    if (newMembers.length > 0) {
      conversation.participants.push(...newMembers);
      await conversation.save();
    }

    const populated = await Conversation.findById(conversation._id)
      .populate("participants", "username profilePicture isOnline lastSeen")
      .populate("lastMessage");

    emitGroupUpdate(req, populated.toObject());

    return response(res, 200, "Members added successfully", populated);
  } catch (error) {
    console.error("addGroupMembers error:", error);
    return response(res, 500, "Internal server error");
  }
};

// REMOVE GROUP MEMBER
exports.removeGroupMember = async (req, res) => {
  const { id } = req.params;
  const { userId: targetUserId } = req.body;
  const userId = req.user.userId;

  if (!targetUserId) {
    return response(res, 400, "User ID to remove is required");
  }

  try {
    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.conversationType !== "group") {
      return response(res, 404, "Group not found");
    }

    const isSelf = String(userId) === String(targetUserId);
    const isAdmin = conversation.groupAdmins.map(String).includes(String(userId));

    // Only admins can remove members, but users can leave the group themselves
    if (!isSelf && !isAdmin) {
      return response(res, 403, "Only admins can remove members");
    }

    // Capture original participants
    const originalParticipants = [...conversation.participants];

    conversation.participants = conversation.participants.filter(p => String(p) !== String(targetUserId));
    conversation.groupAdmins = conversation.groupAdmins.filter(a => String(a) !== String(targetUserId));

    // If no admins left but group still has participants, promote the first participant
    if (conversation.participants.length > 0 && conversation.groupAdmins.length === 0) {
      conversation.groupAdmins.push(conversation.participants[0]);
    }

    await conversation.save();

    const populated = await Conversation.findById(conversation._id)
      .populate("participants", "username profilePicture isOnline lastSeen")
      .populate("lastMessage");

    // Emit group update to original participants
    if (req.io && req.socketUserMap) {
      originalParticipants.forEach(member => {
        const memberId = String(member._id || member);
        const socketId = req.socketUserMap.get(memberId);
        if (socketId) {
          req.io.to(socketId).emit("group_updated", populated.toObject());
        }
      });
    }

    return response(res, 200, "Member removed successfully", populated);
  } catch (error) {
    console.error("removeGroupMember error:", error);
    return response(res, 500, "Internal server error");
  }
};

// PROMOTE GROUP ADMIN
exports.promoteGroupAdmin = async (req, res) => {
  const { id } = req.params;
  const { userId: targetUserId } = req.body;
  const userId = req.user.userId;

  if (!targetUserId) {
    return response(res, 400, "User ID to promote is required");
  }

  try {
    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.conversationType !== "group") {
      return response(res, 404, "Group not found");
    }

    // Only admins can promote
    if (!conversation.groupAdmins.map(String).includes(String(userId))) {
      return response(res, 403, "Only admins can promote other members");
    }

    // Check target is a participant
    if (!conversation.participants.map(String).includes(String(targetUserId))) {
      return response(res, 400, "User is not a participant of this group");
    }

    if (!conversation.groupAdmins.map(String).includes(String(targetUserId))) {
      conversation.groupAdmins.push(targetUserId);
      await conversation.save();
    }

    const populated = await Conversation.findById(conversation._id)
      .populate("participants", "username profilePicture isOnline lastSeen")
      .populate("lastMessage");

    emitGroupUpdate(req, populated.toObject());

    return response(res, 200, "Member promoted to admin successfully", populated);
  } catch (error) {
    console.error("promoteGroupAdmin error:", error);
    return response(res, 500, "Internal server error");
  }
};

// UPDATE GROUP INFO
exports.updateGroupInfo = async (req, res) => {
  const { id } = req.params;
  const { groupName } = req.body;
  const userId = req.user.userId;

  try {
    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.conversationType !== "group") {
      return response(res, 404, "Group not found");
    }

    // Only admins can update info
    if (!conversation.groupAdmins.map(String).includes(String(userId))) {
      return response(res, 403, "Only admins can update group info");
    }

    if (groupName && groupName.trim()) {
      conversation.groupName = groupName.trim();
    }

    if (req.file) {
      const uploadResult = await uploadFileCloudinary(req.file);
      conversation.groupAvatar = uploadResult?.secure_url || conversation.groupAvatar;
      conversation.groupPhoto = uploadResult?.secure_url || conversation.groupPhoto;
    }

    await conversation.save();

    const populated = await Conversation.findById(conversation._id)
      .populate("participants", "username profilePicture isOnline lastSeen")
      .populate("lastMessage");

    emitGroupUpdate(req, populated.toObject());

    return response(res, 200, "Group info updated successfully", populated);
  } catch (error) {
    console.error("updateGroupInfo error:", error);
    return response(res, 500, "Internal server error");
  }
};

// ================= AI ASSISTANT EXTENSIONS =================

const { summarizeChat, rewriteMessage } = require("../services/aiService");

exports.summarizeChatMessages = async (req, res) => {
  const { conversationId } = req.body;
  const userId = req.user.userId;

  try {
    const messages = await Message.find({
      conversation: conversationId,
      isDeletedForEveryone: false,
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate("sender", "username");

    if (!messages || messages.length === 0) {
      return response(res, 400, "No messages available to summarize in this conversation");
    }

    const summary = await summarizeChat(messages.reverse(), userId);
    return response(res, 200, "Summary generated successfully", { summary });
  } catch (error) {
    console.error("summarizeChatMessages error:", error);
    return response(res, 500, error.message || "Failed to generate AI summary");
  }
};

exports.rewriteMessageDraft = async (req, res) => {
  const { text, style } = req.body;
  const userId = req.user.userId;

  if (!text || !text.trim()) {
    return response(res, 400, "Text is required to rewrite");
  }

  try {
    const rewritten = await rewriteMessage(text.trim(), style || "professional", userId);
    return response(res, 200, "Text rewritten successfully", { rewritten });
  } catch (error) {
    console.error("rewriteMessageDraft error:", error);
    return response(res, 500, error.message || "Failed to rewrite message");
  }
};