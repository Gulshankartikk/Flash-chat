const express = require("express");
const conversationController = require("../controllers/conversationController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/direct", authMiddleware, conversationController.startDirectConversation);
router.get("/:id/invite-link", authMiddleware, conversationController.getGroupInviteLink);
router.post("/join/:inviteCode", authMiddleware, conversationController.joinGroupByInvite);
router.patch("/:id/permissions", authMiddleware, conversationController.toggleGroupPermissions);
router.post("/:id/leave", authMiddleware, conversationController.leaveGroup);

module.exports = router;

