const express = require("express");
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/search", authMiddleware, userController.searchUsers);
router.get("/ai-bot", authMiddleware, userController.getAIBotUser);

// E2EE Public Key Routes
router.put("/public-key", authMiddleware, userController.updatePublicKey);
router.get("/:userId/public-key", authMiddleware, userController.getUserPublicKey);
router.post("/public-keys/batch", authMiddleware, userController.getBatchPublicKeys);

// Active Sessions Routes
router.get("/sessions", authMiddleware, userController.getActiveSessions);
router.delete("/sessions/:sessionId", authMiddleware, userController.revokeSession);
router.delete("/sessions/other", authMiddleware, userController.revokeAllOtherSessions);

module.exports = router;

