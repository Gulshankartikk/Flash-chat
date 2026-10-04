const express = require('express');
const router = express.Router();
const { z } = require('zod');
const protect = require('../middleware/authMiddleware');
const {
  requireAiEnabled,
  requireAiInChats,
  requireAiUsesPocket
} = require('../middleware/aiMiddleware');
const aiController = require('../controllers/aiController');

// Input validation middleware helper
const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`)
    });
  }
  req.body = result.data;
  next();
};

// All AI endpoints require authentication & global AI enabled check
router.use(protect);
router.use(requireAiEnabled);

// ---------------------------------------------------------------------------
// 1. Dedicated AI Assistant Tab Routes (/api/ai/chats)
// ---------------------------------------------------------------------------
router.post(
  '/chats',
  validateBody(
    z.object({
      title: z.string().optional(),
      systemPrompt: z.string().optional()
    })
  ),
  aiController.createConversation
);

router.get('/chats', aiController.getConversations);

router.get('/chats/:id', aiController.getConversationById);

router.patch(
  '/chats/:id',
  validateBody(
    z.object({
      title: z.string().optional(),
      isPinned: z.boolean().optional()
    })
  ),
  aiController.updateConversation
);

router.delete('/chats', aiController.deleteAllConversations);

router.delete('/chats/:id', aiController.deleteConversation);

router.post(
  '/chats/:id/messages',
  validateBody(
    z.object({
      message: z.string().min(1),
      attachments: z
        .array(
          z.object({
            url: z.string().optional(),
            mimeType: z.string().optional(),
            name: z.string().optional(),
            base64: z.string().optional()
          })
        )
        .optional()
    })
  ),
  aiController.streamAiMessage
);

// ---------------------------------------------------------------------------
// 2. Chat Feature AI Enhancements (/api/ai/chat)
// ---------------------------------------------------------------------------
router.post(
  '/chat/smart-replies',
  requireAiInChats,
  validateBody(
    z.object({
      conversationId: z.string().min(1),
      lastN: z.number().optional()
    })
  ),
  aiController.getSmartReplies
);

router.post(
  '/chat/summarize',
  requireAiInChats,
  validateBody(
    z.object({
      conversationId: z.string().min(1),
      range: z.enum(['unread', 'today', 'last50']).optional()
    })
  ),
  aiController.summarizeChat
);

router.post(
  '/chat/translate',
  requireAiInChats,
  validateBody(
    z.object({
      messageId: z.string().optional(),
      text: z.string().optional(),
      targetLang: z.string().optional()
    })
  ),
  aiController.translateMessage
);

router.post(
  '/chat/rewrite',
  requireAiInChats,
  validateBody(
    z.object({
      text: z.string().min(1),
      tone: z.enum(['formal', 'friendly', 'short']).optional()
    })
  ),
  aiController.rewriteText
);

// ---------------------------------------------------------------------------
// 3. Social Media AI Enhancements (/api/ai/social)
// ---------------------------------------------------------------------------
router.post(
  '/social/caption',
  validateBody(
    z.object({
      description: z.string().optional(),
      tone: z.string().optional(),
      mediaUrl: z.string().optional()
    })
  ),
  aiController.generateCaption
);

router.post(
  '/social/hashtags',
  validateBody(
    z.object({
      caption: z.string().min(1)
    })
  ),
  aiController.suggestHashtags
);

router.post(
  '/social/comment-replies',
  validateBody(
    z.object({
      commentId: z.string().optional(),
      commentText: z.string().optional(),
      postCaption: z.string().optional()
    })
  ),
  aiController.suggestCommentReplies
);

router.post(
  '/social/moderate',
  validateBody(
    z.object({
      text: z.string().optional(),
      mediaUrl: z.string().optional()
    })
  ),
  aiController.moderateContent
);

router.post(
  '/social/describe',
  validateBody(
    z.object({
      mediaUrl: z.string().optional(),
      prompt: z.string().optional()
    })
  ),
  aiController.describeImage
);

// ---------------------------------------------------------------------------
// 4. Pocket Private Vault AI Enhancements (/api/ai/pocket)
// ---------------------------------------------------------------------------
router.post(
  '/pocket/summarize',
  validateBody(
    z.object({
      itemId: z.string().min(1)
    })
  ),
  aiController.summarizePocketItem
);

router.post(
  '/pocket/auto-tag',
  validateBody(
    z.object({
      itemId: z.string().min(1)
    })
  ),
  aiController.autoTagPocketItem
);

router.post(
  '/pocket/ask',
  requireAiUsesPocket,
  validateBody(
    z.object({
      question: z.string().min(1)
    })
  ),
  aiController.askPocket
);

// ---------------------------------------------------------------------------
// 5. Common & Feedback Routes (/api/ai)
// ---------------------------------------------------------------------------
router.get('/usage', aiController.getUsage);
router.get('/disclosure', aiController.getDisclosure);

router.post(
  '/feedback',
  validateBody(
    z.object({
      conversationId: z.string().optional(),
      messageId: z.string().optional(),
      rating: z.enum(['thumbs_up', 'thumbs_down', 'none'])
    })
  ),
  aiController.submitFeedback
);

module.exports = router;
