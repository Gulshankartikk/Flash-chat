const express = require("express");
const conversationController = require("../controllers/conversationController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/direct", authMiddleware, conversationController.startDirectConversation);

module.exports = router;
