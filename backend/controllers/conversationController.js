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
