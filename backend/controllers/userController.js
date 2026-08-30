const User = require("../models/user");
const Contact = require("../models/Contact");
const response = require("../utils/responseHandler");

exports.searchUsers = async (req, res) => {
  const currentUserId = req.user.userId;
  const q = req.query.q ? String(req.query.q).trim() : "";

  if (!q) {
    return response(res, 200, "Search query is empty", []);
  }

  try {
    // 1. Get blocked users and users who blocked me
    const loggedInUserDoc = await User.findById(currentUserId).select("blockedUsers");
    const blockedUserIds = loggedInUserDoc?.blockedUsers || [];

    const usersWhoBlockedMe = await User.find({ blockedUsers: currentUserId }).select("_id");
    const blockedMeIds = usersWhoBlockedMe.map((u) => u._id.toString());
    const allBlockIds = [...blockedUserIds.map((id) => id.toString()), ...blockedMeIds];

    // 2. Perform search query on Username, Email, Phone number
    const regex = new RegExp(q, "i");
    const searchQuery = {
      _id: { $ne: currentUserId, $nin: allBlockIds },
      $or: [
        { username: { $regex: regex } },
        { email: { $regex: regex } },
        { phoneNumber: { $regex: regex } }
      ]
    };

    const users = await User.find(searchQuery)
      .select("username profilePicture email phoneNumber phoneSuffix about lastSeen isOnline")
      .lean();

    // 3. For each user, find their relationship status with currentUserId
    const userIds = users.map((u) => u._id);
    const relationships = await Contact.find({
      $or: [
        { sender: currentUserId, receiver: { $in: userIds } },
        { sender: { $in: userIds }, receiver: currentUserId }
      ]
    }).lean();

    // Map relationships by other user's ID
    const relationshipMap = {};
    for (const rel of relationships) {
      const otherId = String(rel.sender) === String(currentUserId) ? String(rel.receiver) : String(rel.sender);
      relationshipMap[otherId] = rel;
    }

    const formattedUsers = users.map((u) => {
      const rel = relationshipMap[String(u._id)];
      let relationshipStatus = "none"; // Default "Add Contact"
      let contactId = null;

      if (rel) {
        contactId = rel._id;
        if (rel.status === "accepted") {
          relationshipStatus = "accepted"; // "Contact"
        } else if (rel.status === "pending") {
          if (String(rel.sender) === String(currentUserId)) {
            relationshipStatus = "request_sent"; // "Request Sent"
          } else {
            relationshipStatus = "pending_incoming"; // "Accept" / "Pending"
          }
        } else if (rel.status === "rejected") {
          relationshipStatus = "rejected"; 
        } else if (rel.status === "blocked") {
          relationshipStatus = "blocked"; // "Blocked"
        }
      }

      return {
        _id: u._id,
        username: u.username,
        profilePicture: u.profilePicture,
        about: u.about,
        isOnline: u.isOnline,
        lastSeen: u.lastSeen,
        relationshipStatus,
        contactId
      };
    });

    return response(res, 200, "Users searched successfully", formattedUsers);
  } catch (error) {
    console.error("searchUsers error:", error);
    return response(res, 500, "Internal server error");
  }
};

// ================= E2EE PUBLIC KEY MANAGEMENT =================

exports.updatePublicKey = async (req, res) => {
  const currentUserId = req.user.userId;
  const { publicKey } = req.body;

  if (!publicKey || typeof publicKey !== "string") {
    return response(res, 400, "Valid publicKey string (JWK format) is required");
  }

  try {
    const user = await User.findByIdAndUpdate(
      currentUserId,
      { publicKey },
      { new: true }
    ).select("_id username publicKey");

    if (!user) {
      return response(res, 404, "User not found");
    }

    return response(res, 200, "Public key updated successfully", {
      userId: user._id,
      publicKey: user.publicKey,
    });
  } catch (error) {
    console.error("updatePublicKey error:", error);
    return response(res, 500, "Internal server error");
  }
};

exports.getUserPublicKey = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId).select("_id username publicKey");
    if (!user) {
      return response(res, 404, "User not found");
    }

    return response(res, 200, "Public key fetched successfully", {
      userId: user._id,
      username: user.username,
      publicKey: user.publicKey || null,
    });
  } catch (error) {
    console.error("getUserPublicKey error:", error);
    return response(res, 500, "Internal server error");
  }
};

exports.getBatchPublicKeys = async (req, res) => {
  const { userIds } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return response(res, 400, "userIds array is required");
  }

  try {
    const users = await User.find({ _id: { $in: userIds } }).select("_id username publicKey");
    const keyMap = {};
    users.forEach((u) => {
      keyMap[u._id.toString()] = {
        userId: u._id,
        username: u.username,
        publicKey: u.publicKey || null,
      };
    });

    return response(res, 200, "Batch public keys fetched successfully", keyMap);
  } catch (error) {
    console.error("getBatchPublicKeys error:", error);
    return response(res, 500, "Internal server error");
  }
};

// ================= SESSION MANAGEMENT =================

exports.getActiveSessions = async (req, res) => {
  const currentUserId = req.user.userId;

  try {
    const user = await User.findById(currentUserId).select("activeSessions");
    if (!user) return response(res, 404, "User not found");

    return response(res, 200, "Active sessions fetched", user.activeSessions || []);
  } catch (error) {
    console.error("getActiveSessions error:", error);
    return response(res, 500, "Internal server error");
  }
};

exports.revokeSession = async (req, res) => {
  const currentUserId = req.user.userId;
  const { sessionId } = req.params;

  try {
    const user = await User.findById(currentUserId);
    if (!user) return response(res, 404, "User not found");

    user.activeSessions = (user.activeSessions || []).filter(
      (s) => s.sessionId !== sessionId
    );
    await user.save();

    return response(res, 200, "Session revoked successfully");
  } catch (error) {
    console.error("revokeSession error:", error);
    return response(res, 500, "Internal server error");
  }
};

exports.revokeAllOtherSessions = async (req, res) => {
  const currentUserId = req.user.userId;
  const currentSessionId = req.user.sessionId;

  try {
    const user = await User.findById(currentUserId);
    if (!user) return response(res, 404, "User not found");

    if (currentSessionId) {
      user.activeSessions = (user.activeSessions || []).filter(
        (s) => s.sessionId === currentSessionId
      );
    } else {
      user.activeSessions = [];
    }
    await user.save();

    return response(res, 200, "All other sessions revoked successfully");
  } catch (error) {
    console.error("revokeAllOtherSessions error:", error);
    return response(res, 500, "Internal server error");
  }
};

exports.getAIBotUser = async (req, res) => {
  try {
    let aiUser = await User.findOne({ isAIBot: true });
    if (!aiUser) {
      aiUser = await User.findOne({ email: "ai@flashchat.com" });
    }
    if (!aiUser) {
      aiUser = await User.create({
        username: "Flash AI",
        email: "ai@flashchat.com",
        about: "Your AI Chat Assistant. Ask me anything!",
        isVerified: true,
        isOnline: true,
        isAIBot: true,
        profilePicture: "https://robohash.org/flash-ai.png?set=set4",
      });
    }
    return response(res, 200, "AI Bot fetched successfully", aiUser);
  } catch (error) {
    console.error("getAIBotUser error:", error);
    return response(res, 500, "Failed to fetch AI bot");
  }
};

