const Conversation = require("../models/Conversation");
const User = require("../models/user");
const response = require("../utils/responseHandler");

function emitToUser(req, userId, event, payload) {
  if (!req.io || !req.socketUserMap) return;
  const socketId = req.socketUserMap.get(String(userId));
  if (socketId) {
    req.io.to(socketId).emit(event, payload);
  }
}

exports.startDirectConversation = async (req, res) => {
  const currentUserId = req.user.userId;
  const { userId: contactUserId } = req.body;

  if (!contactUserId) {
    return response(res, 400, "userId is required");
  }

  if (String(currentUserId) === String(contactUserId)) {
    return response(res, 400, "You cannot start a direct conversation with yourself");
  }

  try {
    const contactUser = await User.findById(contactUserId);
    if (!contactUser) {
      return response(res, 404, "Target user not found");
    }

    const participantIds = [String(currentUserId), String(contactUserId)].sort();
    const participantsKey = participantIds.join("_");

    // Enforce E2EE compatibility by using the existing "private" type
    let conversation = await Conversation.findOne({ participantsKey });

    if (!conversation) {
      conversation = new Conversation({
        participants: participantIds,
        participantsKey,
        conversationType: "private",
        unreadCounts: new Map()
      });
      await conversation.save();

      // Trigger socket event for real-time UI creation on the other user's client
      const populatedForEmit = await Conversation.findById(conversation._id)
        .populate("participants", "username profilePicture isOnline lastSeen")
        .populate("lastMessage");
      
      const formattedForEmit = populatedForEmit.toObject();
      formattedForEmit.unreadCount = 0;
      
      emitToUser(req, contactUserId, "conversation_created", formattedForEmit);
    }

    const populated = await Conversation.findById(conversation._id)
      .populate("participants", "username profilePicture isOnline lastSeen")
      .populate("lastMessage");

    const formatted = populated.toObject();
    formatted.unreadCount = populated.unreadCounts?.get(String(currentUserId)) || 0;
    delete formatted.unreadCounts;

    return response(res, 200, "Direct conversation opened successfully", formatted);
  } catch (error) {
    console.error("startDirectConversation error:", error);
    return response(res, 500, "Internal server error");
  }
};

// ================= GROUP INVITE & PERMISSIONS =================

const crypto = require("crypto");

exports.getGroupInviteLink = async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.user.userId;

  try {
    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.conversationType !== "group") {
      return response(res, 404, "Group conversation not found");
    }

    if (!conversation.participants.map(String).includes(String(currentUserId))) {
      return response(res, 403, "You are not a member of this group");
    }

    if (!conversation.inviteCode) {
      conversation.inviteCode = crypto.randomBytes(6).toString("hex");
      await conversation.save();
    }

    const inviteLink = `${process.env.FRONTEND_URL || "http://localhost:3000"}/join/${conversation.inviteCode}`;

    return response(res, 200, "Invite link generated", {
      inviteCode: conversation.inviteCode,
      inviteLink,
      groupName: conversation.groupName,
    });
  } catch (error) {
    console.error("getGroupInviteLink error:", error);
    return response(res, 500, "Internal server error");
  }
};

exports.joinGroupByInvite = async (req, res) => {
  const { inviteCode } = req.params;
  const currentUserId = req.user.userId;

  try {
    const conversation = await Conversation.findOne({
      inviteCode,
      conversationType: "group",
    });

    if (!conversation) {
      return response(res, 404, "Invalid or expired group invite link");
    }

    if (conversation.participants.map(String).includes(String(currentUserId))) {
      const populated = await Conversation.findById(conversation._id)
        .populate("participants", "username profilePicture isOnline lastSeen")
        .populate("lastMessage");
      return response(res, 200, "You are already a member of this group", populated);
    }

    conversation.participants.push(currentUserId);
    await conversation.save();

    const populated = await Conversation.findById(conversation._id)
      .populate("participants", "username profilePicture isOnline lastSeen")
      .populate("lastMessage");

    // Notify all participants
    if (req.io && req.socketUserMap) {
      conversation.participants.forEach((p) => {
        const socketId = req.socketUserMap.get(String(p._id || p));
        if (socketId) {
          req.io.to(socketId).emit("group_updated", populated.toObject());
        }
      });
    }

    return response(res, 200, "Joined group successfully", populated);
  } catch (error) {
    console.error("joinGroupByInvite error:", error);
    return response(res, 500, "Internal server error");
  }
};

exports.toggleGroupPermissions = async (req, res) => {
  const { id } = req.params;
  const { onlyAdminsCanMessage } = req.body;
  const currentUserId = req.user.userId;

  try {
    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.conversationType !== "group") {
      return response(res, 404, "Group not found");
    }

    if (!conversation.groupAdmins.map(String).includes(String(currentUserId))) {
      return response(res, 403, "Only admins can change group settings");
    }

    conversation.onlyAdminsCanMessage = !!onlyAdminsCanMessage;
    await conversation.save();

    const populated = await Conversation.findById(conversation._id)
      .populate("participants", "username profilePicture isOnline lastSeen")
      .populate("lastMessage");

    if (req.io && req.socketUserMap) {
      conversation.participants.forEach((p) => {
        const socketId = req.socketUserMap.get(String(p._id || p));
        if (socketId) {
          req.io.to(socketId).emit("group_updated", populated.toObject());
        }
      });
    }

    return response(res, 200, "Group permissions updated", populated);
  } catch (error) {
    console.error("toggleGroupPermissions error:", error);
    return response(res, 500, "Internal server error");
  }
};

exports.leaveGroup = async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.user.userId;

  try {
    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.conversationType !== "group") {
      return response(res, 404, "Group not found");
    }

    const originalParticipants = [...conversation.participants];
    conversation.participants = conversation.participants.filter(
      (p) => String(p) !== String(currentUserId)
    );
    conversation.groupAdmins = conversation.groupAdmins.filter(
      (a) => String(a) !== String(currentUserId)
    );

    // Promote next member if no admin remaining
    if (conversation.participants.length > 0 && conversation.groupAdmins.length === 0) {
      conversation.groupAdmins.push(conversation.participants[0]);
    }

    await conversation.save();

    const populated = await Conversation.findById(conversation._id)
      .populate("participants", "username profilePicture isOnline lastSeen")
      .populate("lastMessage");

    if (req.io && req.socketUserMap) {
      originalParticipants.forEach((p) => {
        const socketId = req.socketUserMap.get(String(p._id || p));
        if (socketId) {
          req.io.to(socketId).emit("group_updated", populated.toObject());
        }
      });
    }

    return response(res, 200, "Left group successfully");
  } catch (error) {
    console.error("leaveGroup error:", error);
    return response(res, 500, "Internal server error");
  }
};

