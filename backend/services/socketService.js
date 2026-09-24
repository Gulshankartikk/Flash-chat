/*
 * SOCKET.IO SERVER ARCHITECTURE & EVENT ROUTING
 *
 * Socket.io Server (socketService.js)
 *   ├── Connection Management & Presence:
 *   │     ├── "user_connected" -> Sets isOnline: true, joins room, broadcasts "user_status"
 *   │     ├── "disconnect"     -> Cleans active calls, clears typing, broadcasts "user_status" (offline)
 *   │     └── "get_user_status"-> Instant status inquiry callback
 *   ├── Messaging & Read Receipts:
 *   │     ├── "send_message"   -> Delivers to recipient socket, emits notification, triggers delivery receipt
 *   │     └── "message_read"   -> Marks messages read, sends status update to sender
 *   ├── Typing State Coordination:
 *   │     └── "typing_start" / "typing_stop" -> Relays typing indicators with auto-cancel timers
 *   └── WebRTC Signaling Pipeline:
 *         ├── "call_user"    -> Validates busy/offline, tracks active call, forwards SDP offer
 *         ├── "accept_call"  -> Relays SDP answer to caller, transitions status to connected
 *         ├── "reject_call"  -> Notifies caller, tears down call state
 *         ├── "cancel_call"  -> Caller cancelled before answer
 *         ├── "ice_candidate"-> Relays network candidates peer-to-peer
 *         └── "end_call"     -> Cleans up both sides
 *
 * Centralized Event Contract: backend/constants/socketEvents.js
 */

const { Server } = require("socket.io");
const User = require("../models/user");
const Message = require("../models/message");
const Conversation = require("../models/Conversation");
const SOCKET_EVENTS = require("../constants/socketEvents");

// Map to store online users: userId -> socketId (legacy compatibility)
const onlineUsers = new Map();
// Enhanced map to track all socket IDs for a given user: userId -> Set<socketId>
const userSockets = new Map();
const socketToUser = new Map();
const typingUsers = new Map();
// Active calls tracking: callId -> { callId, callerId, receiverId, roomId, callType, callerName, callerAvatar, status }
const activeCalls = new Map();
// Fast lookup: userId -> callId
const userToCall = new Map();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:80",
  "http://localhost",
].filter(Boolean);

const initilizeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    },
    pingTimeout: 6000,
  });

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);
    let userId = null;

    // ─── User comes online ───────────────────────────────────────────────────
    socket.on("user_connected", async (connectingUserId) => {
      try {
        if (!connectingUserId) return;
        userId = String(connectingUserId);
        socketToUser.set(socket.id, userId);

        if (!userSockets.has(userId)) {
          userSockets.set(userId, new Set());
        }
        userSockets.get(userId).add(socket.id);
        onlineUsers.set(userId, socket.id);
        socket.join(userId);

        await User.findByIdAndUpdate(userId, {
          isOnline: true,
          lastSeen: new Date(),
        });

        io.emit("user_status", { userId, isOnline: true });
      } catch (error) {
        console.error("Error handling user connection:", error);
      }
    });

    // ─── Online status check ─────────────────────────────────────────────────
    
    socket.on("get_user_status", async (requestedUserId, callback) => {
      try {
        const isOnline = onlineUsers.has(requestedUserId);
        if (isOnline) {
          callback({ userId: requestedUserId, isOnline: true, lastSeen: null });
          return;
        }
        const user = await User.findById(requestedUserId).select("lastSeen");
        callback({
          userId: requestedUserId,
          isOnline: false,
          lastSeen: user?.lastSeen || null,
        });
      } catch (error) {
        console.error("Error fetching user status:", error);
        callback({ userId: requestedUserId, isOnline: false, lastSeen: null });
      }
    });

    // ─── Forward message to receiver ─────────────────────────────────────────
   
    socket.on("send_message", async (message) => {
      try {
        if (!userId) return;

        const conversationId = message.conversation?._id || message.conversation || message.conversationId;
        if (!conversationId) return;

        const conversationDoc = await Conversation.findById(conversationId);
        if (!conversationDoc) return;

        const isPrivate = conversationDoc.conversationType === "private";

        if (isPrivate) {
          const receiverId = message.receiver?._id || message.receiverId || conversationDoc.participants.find(p => String(p) !== String(userId));
          if (!receiverId) return;

          // Check block status
          const senderUser = await User.findById(userId);
          const receiverUser = await User.findById(receiverId);
          if (!senderUser || !receiverUser) return;

          const isReceiverBlockedByMe = (senderUser.blockedUsers || []).map(String).includes(String(receiverId));
          const hasReceiverBlockedMe = (receiverUser.blockedUsers || []).map(String).includes(String(userId));

          if (isReceiverBlockedByMe || hasReceiverBlockedMe) {
            console.log(`Message blocked/dropped between ${userId} and ${receiverId}`);
            return; // Silently drop
          }

          const isReceiverOnline = onlineUsers.has(String(receiverId)) || (userSockets.get(String(receiverId))?.size > 0);
          if (isReceiverOnline) {
            io.to(String(receiverId)).emit("receive_message", message);

            // Emit notification to receiver (all active tabs/devices)
            io.to(String(receiverId)).emit("new_notification", {
              type: "message",
              from: userId,
              title: senderUser?.username || "New Message",
              preview: message.content || message.message || "Sent an attachment",
              avatar: senderUser?.profilePicture || "",
            });

            if (message._id) {
              await Message.findByIdAndUpdate(message._id, {
                messageStatus: "delivered",
              });
            }
            io.to(String(userId)).emit("message_status_update", {
              messageId: message._id,
              messageStatus: "delivered",
            });
          }
        } else {
          // Group messaging: broadcast to online members except sender
          const senderUser = await User.findById(userId).select("username profilePicture");
          conversationDoc.participants.forEach((p) => {
            const pIdStr = String(p);
            if (pIdStr !== String(userId)) {
              io.to(pIdStr).emit("receive_message", message);
              io.to(pIdStr).emit("new_notification", {
                type: "message",
                from: userId,
                conversationId: conversationDoc._id,
                title: conversationDoc.groupName || "Group Message",
                preview: `${senderUser?.username || "Someone"}: ${message.content || "Sent an attachment"}`,
                avatar: conversationDoc.groupPhoto || "",
              });
            }
          });
        }
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("message_error", { error: "Failed to send message" });
      }
    });

    // ─── Mark messages as read ───────────────────────────────────────────────
    socket.on("message_read", async ({ messageIds, senderId }) => {
      try {
        if (!messageIds?.length) return;

        // Check if the reader has read receipts enabled
        const reader = await User.findById(userId).select("privacySettings");
        const hasReadReceipts = reader?.privacySettings?.readReceipts !== false;

        await Message.updateMany(
          { _id: { $in: messageIds } },
          { $set: { messageStatus: "read" } }
        );

        if (hasReadReceipts && senderId) {
          messageIds.forEach((messageId) => {
            io.to(String(senderId)).emit("message_status_update", {
              messageId,
              messageStatus: "read",
            });
          });
        }
      } catch (error) {
        console.error("Error updating message read status:", error);
      }
    });

    // ─── Typing start ────────────────────────────────────────────────────────
    socket.on("typing_start", ({ conversationId, receiverId }) => {
      if (!userId || !conversationId || !receiverId) return;

      if (!typingUsers.has(userId)) typingUsers.set(userId, {});
      const userTyping = typingUsers.get(userId);

      // Track which receiver to notify, not just a boolean, so we can
      // still reach them later (e.g. on disconnect cleanup below).
      userTyping[conversationId] = { active: true, receiverId };

      // Clear any existing auto-stop timeout
      if (userTyping[`${conversationId}_timeout`]) {
        clearTimeout(userTyping[`${conversationId}_timeout`]);
      }

      // Auto-stop after 3s
      userTyping[`${conversationId}_timeout`] = setTimeout(() => {
        if (userTyping[conversationId]) userTyping[conversationId].active = false;
        socket.to(receiverId).emit("user_typing", {
          userId,
          conversationId,
          isTyping: false,
        });
      }, 3000);

      // Notify receiver
      socket.to(receiverId).emit("user_typing", {
        userId,
        conversationId,
        isTyping: true,
      });
    });

    // ─── Typing stop ─────────────────────────────────────────────────────────
    socket.on("typing_stop", ({ conversationId, receiverId }) => {
      if (!userId || !conversationId || !receiverId) return;

      if (typingUsers.has(userId)) {
        const userTyping = typingUsers.get(userId);
        if (userTyping[conversationId]) userTyping[conversationId].active = false;

        if (userTyping[`${conversationId}_timeout`]) {
          clearTimeout(userTyping[`${conversationId}_timeout`]);
          delete userTyping[`${conversationId}_timeout`];
        }
      }

      socket.to(receiverId).emit("user_typing", {
        userId,
        conversationId,
        isTyping: false,
      });
    });

    // ─── Add / update reaction ───────────────────────────────────────────────
   
    socket.on("add_reaction", async ({ messageId, emoji }) => {
      try {
        if (!userId) return;
        const message = await Message.findById(messageId);
        if (!message) return;

        const existingIndex = message.reactions.findIndex(
          (r) => r.user.toString() === userId
        );

        if (existingIndex > -1) {
          const existing = message.reactions[existingIndex];
          if (existing.emoji === emoji) {
            // Same emoji — remove (toggle off)
            message.reactions.splice(existingIndex, 1);
          } else {
            // Different emoji — update
            message.reactions[existingIndex].emoji = emoji;
          }
        } else {
          message.reactions.push({ user: userId, emoji });
        }

        await message.save();

        const populatedMessage = await Message.findById(message._id)
          .populate("sender", "username profilePicture")
          .populate("receiver", "username profilePicture")
          .populate("reactions.user", "username");

        const reactionUpdated = {
          messageId,
          reactions: populatedMessage.reactions,
        };

        if (populatedMessage.sender?._id) {
          io.to(String(populatedMessage.sender._id)).emit("reaction_update", reactionUpdated);
        }
        if (populatedMessage.receiver?._id) {
          io.to(String(populatedMessage.receiver._id)).emit("reaction_update", reactionUpdated);
        }
      } catch (error) {
        console.error("Error handling reaction:", error);
      }
    });

    // ─── Video & Voice Call Signaling ─────────────────────────────────────────
    // ─── Video & Voice Call Signaling ─────────────────────────────────────────
    socket.on("call_user", ({ to, offer, from, roomId, callType, callerName, callerAvatar }) => {
      const targetUserId = String(to);
      const callerId = String(from || userId);

      // Check if target user is online
      const targetSockets = userSockets.get(targetUserId);
      if (!targetSockets || targetSockets.size === 0) {
        socket.emit("call_user_offline", {
          to: targetUserId,
          message: "User is currently offline.",
        });
        return;
      }

      // Check if target user is already in another call
      if (userToCall.has(targetUserId)) {
        socket.emit("call_user_busy", {
          to: targetUserId,
          message: "User is currently busy on another call.",
        });
        return;
      }

      // Check if caller is already recorded in a call
      if (userToCall.has(callerId)) {
        const prevCallId = userToCall.get(callerId);
        activeCalls.delete(prevCallId);
        userToCall.delete(callerId);
      }

      const callId = roomId || `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      activeCalls.set(callId, {
        callId,
        callerId,
        receiverId: targetUserId,
        roomId: callId,
        callType: callType || "video",
        callerName,
        callerAvatar,
        status: "ringing",
      });
      userToCall.set(callerId, callId);
      userToCall.set(targetUserId, callId);

      io.to(targetUserId).emit("incoming_call", {
        from: callerId,
        offer,
        roomId: callId,
        callType: callType || "video",
        callerName,
        callerAvatar,
      });

      io.to(targetUserId).emit("new_notification", {
        type: "call",
        from: callerId,
        title: `Incoming ${callType === "voice" ? "Voice" : "Video"} Call`,
        preview: `${callerName || "Someone"} is calling you`,
        avatar: callerAvatar || "",
      });
    });

    socket.on("cancel_call", ({ to }) => {
      const targetUserId = String(to);
      const callerId = String(userId);
      const callId = userToCall.get(callerId);
      if (callId) {
        activeCalls.delete(callId);
        userToCall.delete(callerId);
        userToCall.delete(targetUserId);
      }
      io.to(targetUserId).emit("call_cancelled", { from: callerId });
    });

    socket.on("accept_call", ({ to, answer }) => {
      const targetUserId = String(to);
      const callerId = String(userId);
      const callId = userToCall.get(callerId);
      if (callId && activeCalls.has(callId)) {
        activeCalls.get(callId).status = "connected";
      }
      io.to(targetUserId).emit("call_accepted", { answer, from: callerId });
    });

    socket.on("reject_call", ({ to }) => {
      const targetUserId = String(to);
      const callerId = String(userId);
      const callId = userToCall.get(callerId);
      if (callId) {
        activeCalls.delete(callId);
        userToCall.delete(callerId);
        userToCall.delete(targetUserId);
      }
      io.to(targetUserId).emit("call_rejected", { from: callerId });
    });

    socket.on("ice_candidate", ({ to, candidate }) => {
      const targetUserId = String(to);
      io.to(targetUserId).emit("ice_candidate", { candidate, from: userId });
    });

    socket.on("media_state_changed", ({ to, type, enabled }) => {
      const targetUserId = String(to);
      io.to(targetUserId).emit("media_state_changed", {
        from: userId,
        type, // "audio" | "video"
        enabled: !!enabled,
      });
    });

    socket.on("end_call", ({ to }) => {
      const targetUserId = String(to);
      const callerId = String(userId);
      const callId = userToCall.get(callerId);
      if (callId) {
        activeCalls.delete(callId);
        userToCall.delete(callerId);
        userToCall.delete(targetUserId);
      }
      io.to(targetUserId).emit("call_ended", { from: callerId, reason: "Call ended by peer" });
    });

    // ─── User Status System ───────────────────────────────────────────────────
    socket.on("set_status", async ({ userId: statusUserId, status }) => {
      try {
        const uId = statusUserId || userId;
        if (!uId) return;

        const isOnline = status === "online" || status === "away" || status === "busy";
        await User.findByIdAndUpdate(uId, {
          isOnline,
          lastSeen: isOnline ? null : new Date(),
        });
        io.emit("contact_status_change", { userId: uId, status, lastSeen: isOnline ? null : new Date() });
      } catch (error) {
        console.error("Error setting status:", error);
      }
    });

    // ─── Disconnect ──────────────────────────────────────────────────────────
    const handleDisconnected = async () => {
      if (!userId) return;

      try {
        // 1. If user was in an active call, immediately notify peer and cleanup
        const callId = userToCall.get(userId);
        if (callId) {
          const call = activeCalls.get(callId);
          if (call) {
            const peerId = String(call.callerId) === String(userId) ? String(call.receiverId) : String(call.callerId);
            io.to(peerId).emit("call_ended", {
              reason: "Participant disconnected from network.",
              from: userId,
            });
            userToCall.delete(peerId);
          }
          activeCalls.delete(callId);
          userToCall.delete(userId);
        }

        // 2. Remove socket from multi-socket set
        if (userSockets.has(userId)) {
          const userSet = userSockets.get(userId);
          userSet.delete(socket.id);

          if (userSet.size === 0) {
            userSockets.delete(userId);
            onlineUsers.delete(userId);

            if (typingUsers.has(userId)) {
              const userTyping = typingUsers.get(userId);
              Object.keys(userTyping).forEach((key) => {
                if (key.endsWith("_timeout")) {
                  clearTimeout(userTyping[key]);
                } else if (userTyping[key]?.active) {
                  const conversationId = key;
                  const { receiverId } = userTyping[key];
                  io.to(String(receiverId)).emit("user_typing", {
                    userId,
                    conversationId,
                    isTyping: false,
                  });
                }
              });
              typingUsers.delete(userId);
            }

            await User.findByIdAndUpdate(userId, {
              isOnline: false,
              lastSeen: new Date(),
            });

            io.emit("user_status", {
              userId,
              isOnline: false,
              lastSeen: new Date(),
            });
          } else {
            // Pick next active socket for onlineUsers map
            const nextSocket = userSet.values().next().value;
            onlineUsers.set(userId, nextSocket);
          }
        }

        socket.leave(userId);
        socketToUser.delete(socket.id);
        console.log(`User ${userId} disconnected (socket: ${socket.id})`);
      } catch (error) {
        console.error("Error handling disconnection:", error);
      }
    };

    socket.on("disconnect", handleDisconnected);
  });

  // Expose online user map for external use
  io.socketUserMap = onlineUsers;

  return io;
};

module.exports = initilizeSocket;