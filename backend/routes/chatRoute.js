const express = require("express");
const chatController = require("../controllers/chatController");
const authMiddleware = require("../middleware/authMiddleware");
const { multerMiddleware } = require("../config/cloudinaryConfig");

const router = express.Router();

router.post(
  "/send-message",
  authMiddleware,
  multerMiddleware,
  chatController.sendMessage
);

router.get(
  "/conversation",
  authMiddleware,
  chatController.getConversation
);

router.get(
  "/conversation/:conversationId/message",
  authMiddleware,
  chatController.getMessage
);

router.put(
  "/message/read",
  authMiddleware,
  chatController.markAsRead
);

router.delete(
  "/message/:messageId",
  authMiddleware,
  chatController.deleteMessage
);

router.put(
  "/message/:messageId",
  authMiddleware,
  chatController.editMessage
);

router.post(
  "/message/bulk-delete",
  authMiddleware,
  chatController.bulkDeleteMessages
);

router.post(
  "/message/:messageId/react",
  authMiddleware,
  chatController.reactToMessage
);

router.put(
  "/message/:messageId/pin",
  authMiddleware,
  chatController.pinMessage
);

router.get(
  "/backup",
  authMiddleware,
  chatController.exportBackup
);

router.post(
  "/restore",
  authMiddleware,
  chatController.importBackup
);

router.post(
  "/group/create",
  authMiddleware,
  multerMiddleware,
  chatController.createGroup
);

router.put(
  "/group/:id/add-members",
  authMiddleware,
  chatController.addGroupMembers
);
router.post(
  "/group/:id/add-members",
  authMiddleware,
  chatController.addGroupMembers
);

router.put(
  "/group/:id/remove-member",
  authMiddleware,
  chatController.removeGroupMember
);
router.post(
  "/group/:id/remove-member",
  authMiddleware,
  chatController.removeGroupMember
);

router.put(
  "/group/:id/promote-admin",
  authMiddleware,
  chatController.promoteGroupAdmin
);
router.post(
  "/group/:id/promote-admin",
  authMiddleware,
  chatController.promoteGroupAdmin
);

router.put(
  "/group/:id/info",
  authMiddleware,
  multerMiddleware,
  chatController.updateGroupInfo
);

router.post(
  "/ai/summarize",
  authMiddleware,
  chatController.summarizeChatMessages
);

router.post(
  "/ai/rewrite",
  authMiddleware,
  chatController.rewriteMessageDraft
);

module.exports = router;