const Contact = require("../models/Contact");
const User = require("../models/user");
const Conversation = require("../models/Conversation");
const response = require("../utils/responseHandler");

function emitToUser(req, userId, event, payload) {
  if (!req.io || !req.socketUserMap) return;
  const socketId = req.socketUserMap.get(String(userId));
  if (socketId) {
    req.io.to(socketId).emit(event, payload);
  }
}

// 1. SEND CONTACT REQUEST
exports.sendContactRequest = async (req, res) => {
  const currentUserId = req.user.userId;
  const { userId: targetUserId } = req.body;

  if (!targetUserId) {
    return response(res, 400, "Target userId is required");
  }

  if (String(currentUserId) === String(targetUserId)) {
    return response(res, 400, "You cannot send a contact request to yourself");
  }

  try {
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return response(res, 404, "User not found");
    }

    const currentUser = await User.findById(currentUserId);

    // Check if there is an existing relationship in either direction
    let contact = await Contact.findOne({
      $or: [
        { sender: currentUserId, receiver: targetUserId },
        { sender: targetUserId, receiver: currentUserId }
      ]
    });

    if (contact) {
      if (contact.status === "accepted") {
        return response(res, 400, "You are already contacts");
      }
      if (contact.status === "pending") {
        if (String(contact.sender) === String(currentUserId)) {
          return response(res, 400, "Contact request is already pending");
        } else {
          return response(res, 400, "This user has already sent you a contact request");
        }
      }
      if (contact.status === "blocked") {
        return response(res, 400, "You cannot send a contact request to this user");
      }
      
      // If rejected, reset it to pending
      if (contact.status === "rejected") {
        contact.sender = currentUserId;
        contact.receiver = targetUserId;
        contact.status = "pending";
        await contact.save();
      }
    } else {
      contact = new Contact({
        sender: currentUserId,
        receiver: targetUserId,
        status: "pending"
      });
      await contact.save();
    }

    // Populate contact sender details to send in socket
    const populatedContact = await Contact.findById(contact._id)
      .populate("sender", "username profilePicture about isOnline lastSeen")
      .populate("receiver", "username profilePicture about isOnline lastSeen");

    // Real-time socket updates
    emitToUser(req, targetUserId, "contact_request_received", populatedContact);
    
    // Send in-app notification to receiver
    emitToUser(req, targetUserId, "new_notification", {
      type: "contact_request",
      from: currentUserId,
      title: "New Contact Request",
      preview: `${currentUser.username || "Someone"} sent you a contact request.`,
      avatar: currentUser.profilePicture || "",
    });

    return response(res, 200, "Contact request sent successfully", populatedContact);
  } catch (error) {
    console.error("sendContactRequest error:", error);
    return response(res, 500, "Internal server error");
  }
};

// 2. GET ACCEPTED CONTACTS
exports.getContacts = async (req, res) => {
  const currentUserId = req.user.userId;

  try {
    const contacts = await Contact.find({
      $or: [{ sender: currentUserId }, { receiver: currentUserId }],
      status: "accepted"
    })
      .populate("sender", "username profilePicture about isOnline lastSeen")
      .populate("receiver", "username profilePicture about isOnline lastSeen")
      .lean();

    // Fetch existing private conversations to map them
    const conversations = await Conversation.find({
      participants: currentUserId,
      conversationType: "private"
    })
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender receiver",
          select: "username profilePicture"
        }
      })
      .lean();

    const conversationMap = {};
    for (const convo of conversations) {
      const otherId = convo.participants
        .find(p => String(p) !== String(currentUserId))
        ?.toString();
      if (otherId) conversationMap[otherId] = convo;
    }

    const formatted = contacts.map(c => {
      const isSender = String(c.sender._id) === String(currentUserId);
      const otherUser = isSender ? c.receiver : c.sender;
      
      const convo = conversationMap[String(otherUser._id)] || null;
      
      return {
        _id: c._id,
        user: otherUser,
        conversation: convo,
        status: c.status,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      };
    });

    return response(res, 200, "Contacts fetched successfully", formatted);
  } catch (error) {
    console.error("getContacts error:", error);
    return response(res, 500, "Internal server error");
  }
};

// 3. GET PENDING REQUESTS
exports.getPendingRequests = async (req, res) => {
  const currentUserId = req.user.userId;

  try {
    const requests = await Contact.find({
      receiver: currentUserId,
      status: "pending"
    })
      .populate("sender", "username profilePicture about isOnline lastSeen")
      .lean();

    return response(res, 200, "Pending requests fetched successfully", requests);
  } catch (error) {
    console.error("getPendingRequests error:", error);
    return response(res, 500, "Internal server error");
  }
};

// 4. ACCEPT CONTACT REQUEST
exports.acceptContactRequest = async (req, res) => {
  const currentUserId = req.user.userId;
  const { contactId } = req.params;

  try {
    const contact = await Contact.findById(contactId);
    if (!contact) {
      return response(res, 404, "Contact request not found");
    }

    if (String(contact.receiver) !== String(currentUserId)) {
      return response(res, 403, "You are not authorized to accept this request");
    }

    if (contact.status === "accepted") {
      return response(res, 400, "Request already accepted");
    }

    contact.status = "accepted";
    await contact.save();

    // Sync with User model contacts arrays
    await User.findByIdAndUpdate(contact.sender, { $addToSet: { contacts: contact.receiver } });
    await User.findByIdAndUpdate(contact.receiver, { $addToSet: { contacts: contact.sender } });

    const populated = await Contact.findById(contact._id)
      .populate("sender", "username profilePicture about isOnline lastSeen")
      .populate("receiver", "username profilePicture about isOnline lastSeen");

    const currentUser = await User.findById(currentUserId);

    // Socket notify both
    emitToUser(req, contact.sender, "contact_request_accepted", populated);
    emitToUser(req, contact.receiver, "contact_request_accepted", populated);

    // Notification toast to sender
    emitToUser(req, contact.sender, "new_notification", {
      type: "contact_request_accepted",
      from: currentUserId,
      title: "Contact Request Accepted",
      preview: `${currentUser.username || "Someone"} accepted your contact request.`,
      avatar: currentUser.profilePicture || "",
    });

    return response(res, 200, "Contact request accepted successfully", populated);
  } catch (error) {
    console.error("acceptContactRequest error:", error);
    return response(res, 500, "Internal server error");
  }
};

// 5. REJECT CONTACT REQUEST
exports.rejectContactRequest = async (req, res) => {
  const currentUserId = req.user.userId;
  const { contactId } = req.params;

  try {
    const contact = await Contact.findById(contactId);
    if (!contact) {
      return response(res, 404, "Contact request not found");
    }

    if (String(contact.receiver) !== String(currentUserId)) {
      return response(res, 403, "You are not authorized to reject this request");
    }

    contact.status = "rejected";
    await contact.save();

    const populated = await Contact.findById(contact._id)
      .populate("sender", "username profilePicture about isOnline lastSeen")
      .populate("receiver", "username profilePicture about isOnline lastSeen");

    // Socket notify both
    emitToUser(req, contact.sender, "contact_request_rejected", populated);
    emitToUser(req, contact.receiver, "contact_request_rejected", populated);

    return response(res, 200, "Contact request rejected successfully", populated);
  } catch (error) {
    console.error("rejectContactRequest error:", error);
    return response(res, 500, "Internal server error");
  }
};

// 6. BLOCK CONTACT
exports.blockContact = async (req, res) => {
  const currentUserId = req.user.userId;
  const { contactId } = req.params;

  try {
    const contact = await Contact.findById(contactId);
    if (!contact) {
      return response(res, 404, "Contact not found");
    }

    const isParticipant =
      String(contact.sender) === String(currentUserId) ||
      String(contact.receiver) === String(currentUserId);

    if (!isParticipant) {
      return response(res, 403, "Unauthorized");
    }

    const targetUserId = String(contact.sender) === String(currentUserId) ? contact.receiver : contact.sender;

    contact.status = "blocked";
    await contact.save();

    // Sync with User model blockedUsers
    await User.findByIdAndUpdate(currentUserId, { $addToSet: { blockedUsers: targetUserId } });

    // Remove from contacts array
    await User.findByIdAndUpdate(currentUserId, { $pull: { contacts: targetUserId } });
    await User.findByIdAndUpdate(targetUserId, { $pull: { contacts: currentUserId } });

    return response(res, 200, "Contact blocked successfully");
  } catch (error) {
    console.error("blockContact error:", error);
    return response(res, 500, "Internal server error");
  }
};
