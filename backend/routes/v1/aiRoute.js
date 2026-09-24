const express = require("express");
const aiService = require("../../services/ai/ai.service");
const authMiddleware = require("../../middleware/authMiddleware");
const response = require("../../utils/responseHandler");

const router = express.Router();

router.post("/chat", authMiddleware, async (req, res) => {
  try {
    const { message, history, organizationId } = req.body;
    if (!message || !message.trim()) {
      return response(res, 400, "Message is required");
    }

    const answer = await aiService.chat(
      message.trim(),
      history || [],
      req.user._id,
      organizationId || req.user.currentOrganization
    );

    return response(res, 200, "AI response generated", { response: answer });
  } catch (err) {
    console.error("[AIRoute] /chat error:", err);
    return response(res, 500, "Failed to generate AI response", null, err.message);
  }
});

router.post("/summarize", authMiddleware, async (req, res) => {
  try {
    const { messages, organizationId } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return response(res, 400, "Messages array is required");
    }

    const summary = await aiService.summarize(
      messages,
      req.user._id,
      organizationId || req.user.currentOrganization
    );

    return response(res, 200, "Summary generated successfully", { summary });
  } catch (err) {
    console.error("[AIRoute] /summarize error:", err);
    return response(res, 500, "Failed to summarize messages", null, err.message);
  }
});

router.post("/rewrite", authMiddleware, async (req, res) => {
  try {
    const { text, style, organizationId } = req.body;
    if (!text || !text.trim()) {
      return response(res, 400, "Text is required");
    }

    const rewritten = await aiService.rewrite(
      text.trim(),
      style || "professional",
      req.user._id,
      organizationId || req.user.currentOrganization
    );

    return response(res, 200, "Message rewritten successfully", { rewritten });
  } catch (err) {
    console.error("[AIRoute] /rewrite error:", err);
    return response(res, 500, "Failed to rewrite message", null, err.message);
  }
});

router.post("/suggestions", authMiddleware, async (req, res) => {
  try {
    const { message, context, organizationId } = req.body;
    const suggestions = await aiService.smartReplies(
      message || "",
      context || [],
      req.user._id,
      organizationId || req.user.currentOrganization
    );

    return response(res, 200, "Smart reply suggestions generated", { suggestions });
  } catch (err) {
    console.error("[AIRoute] /suggestions error:", err);
    return response(res, 500, "Failed to generate suggestions", null, err.message);
  }
});

module.exports = router;
