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
