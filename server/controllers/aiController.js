const mongoose = require('mongoose');
const aiService = require('../services/ai.service');
const AiConversation = require('../models/AiConversation');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const PocketItem = require('../models/PocketItem');
const Comment = require('../models/Comment');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');

/**
 * 1. AI Tab: Create a new AI conversation
 * POST /api/ai/chats
 */
exports.createConversation = asyncHandler(async (req, res) => {
  const { title = 'New Chat', systemPrompt = '' } = req.body;

  const conversation = await AiConversation.create({
    user: req.user._id,
    title: title.trim() || 'New Chat',
    systemPrompt: systemPrompt.trim(),
    messages: []
  });

  res.status(201).json({
    success: true,
    data: conversation
  });
});

/**
 * 2. AI Tab: List AI conversations for the user
 * GET /api/ai/chats
 */
exports.getConversations = asyncHandler(async (req, res) => {
  const conversations = await AiConversation.find({ user: req.user._id })
    .sort({ isPinned: -1, updatedAt: -1 })
    .select('_id title isPinned updatedAt createdAt')
    .lean();

  res.json({
    success: true,
    data: conversations
  });
});

/**
 * 3. AI Tab: Get single AI conversation with messages
 * GET /api/ai/chats/:id
 */
exports.getConversationById = asyncHandler(async (req, res) => {
  const conversation = await AiConversation.findOne({
    _id: req.params.id,
    user: req.user._id
  });

  if (!conversation) {
    return res.status(404).json({ success: false, message: 'AI Conversation not found.' });
  }

  res.json({
    success: true,
    data: conversation
  });
});

/**
 * 4. AI Tab: Update AI conversation (rename, pin)
 * PATCH /api/ai/chats/:id
 */
exports.updateConversation = asyncHandler(async (req, res) => {
  const { title, isPinned } = req.body;
  const updates = {};
  if (typeof title === 'string' && title.trim()) updates.title = title.trim();
  if (typeof isPinned === 'boolean') updates.isPinned = isPinned;

  const conversation = await AiConversation.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { $set: updates },
    { new: true }
  );

  if (!conversation) {
    return res.status(404).json({ success: false, message: 'AI Conversation not found.' });
  }

  res.json({
    success: true,
    data: conversation
  });
});

/**
 * 5. AI Tab: Delete AI conversation
 * DELETE /api/ai/chats/:id
 */
exports.deleteConversation = asyncHandler(async (req, res) => {
  const conversation = await AiConversation.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id
  });

  if (!conversation) {
    return res.status(404).json({ success: false, message: 'AI Conversation not found.' });
  }

  res.json({
    success: true,
    message: 'AI conversation deleted successfully.'
  });
});

/**
 * 5b. AI Tab: Delete ALL AI conversations
 * DELETE /api/ai/chats
 */
exports.deleteAllConversations = asyncHandler(async (req, res) => {
  await AiConversation.deleteMany({
    user: req.user._id
  });

  res.json({
    success: true,
    message: 'All AI conversations deleted successfully.'
  });
});

/**
 * 6. AI Tab: Send message & stream answer via Server-Sent Events (SSE)
 * POST /api/ai/chats/:id/messages
 */
exports.streamAiMessage = async (req, res) => {
  const userId = req.user._id;
  const conversationId = req.params.id;
  const { message, attachments = [] } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Message cannot be empty.' });
  }

  const conversation = await AiConversation.findOne({ _id: conversationId, user: userId });
  if (!conversation) {
    return res.status(404).json({ success: false, message: 'AI Conversation not found.' });
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Abort controller when client closes connection
  const abortController = new AbortController();
  req.on('close', () => {
    abortController.abort();
  });

  // Save user's message to conversation
  const userMsgObj = {
    role: 'user',
    text: message.trim(),
    attachments: attachments.map((a) => ({
      url: a.url || '',
      mimeType: a.mimeType || 'image/jpeg',
      name: a.name || ''
    })),
    createdAt: new Date()
  };
  conversation.messages.push(userMsgObj);

  // If first message and title is default, auto-generate title from message snippet
  if (conversation.title === 'New Chat' || !conversation.title) {
    conversation.title = message.trim().slice(0, 35) + (message.length > 35 ? '...' : '');
  }
  await conversation.save();

  let assistantText = '';

  try {
    const stream = aiService.chatStream({
      history: conversation.messages.slice(0, -1),
      message: message.trim(),
      attachments,
      systemPrompt: conversation.systemPrompt,
      userId,
      signal: abortController.signal
    });

    for await (const chunk of stream) {
      if (abortController.signal.aborted) break;

      if (chunk.token) {
        assistantText += chunk.token;
        res.write(`event: token\ndata: ${JSON.stringify({ token: chunk.token })}\n\n`);
      }

      if (chunk.done) {
        res.write(`event: done\ndata: ${JSON.stringify({ text: assistantText })}\n\n`);
      }
    }

    // Save assistant response message
    if (assistantText.trim()) {
      conversation.messages.push({
        role: 'model',
        text: assistantText,
        tokens: Math.ceil(assistantText.length / 4),
        createdAt: new Date()
      });
      await conversation.save();
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Error in streamAiMessage SSE handler');
    res.write(`event: error\ndata: ${JSON.stringify({ message: err.message || 'AI streaming error' })}\n\n`);
  } finally {
    res.end();
  }
};

/**
 * 7. Chats: Smart Replies for conversation
 * POST /api/ai/chat/smart-replies
 */
exports.getSmartReplies = asyncHandler(async (req, res) => {
  const { conversationId, lastN = 10 } = req.body;
  const userId = req.user._id;

  const conversation = await Conversation.findOne({
    _id: conversationId,
    'members.user': userId
  });

  if (!conversation) {
    return res.status(404).json({ success: false, message: 'Conversation not found.' });
  }

  // Fetch recent visible messages
  const messages = await Message.find({
    conversation: conversationId,
    deletedForEveryone: false,
    deletedFor: { $ne: userId }
  })
    .sort({ createdAt: -1 })
    .limit(Math.min(lastN, 20))
    .populate('sender', 'name username')
    .lean();

  const formattedHistory = messages
    .reverse()
    .map((m) => `${m.sender?.name || m.sender?.username || 'User'}: ${m.text || `[${m.type}]`}`)
    .join('\n');

  const replies = await aiService.generate({
    task: 'smartReplies',
    input: { messages: formattedHistory },
    userId
  });

  res.json({
    success: true,
    data: Array.isArray(replies) ? replies : ['Sounds good!', 'Got it 👍', 'Will do!']
  });
});

/**
 * 8. Chats: Summarize conversation
 * POST /api/ai/chat/summarize
 */
exports.summarizeChat = asyncHandler(async (req, res) => {
  const { conversationId, range = 'last50' } = req.body;
  const userId = req.user._id;

  const conversation = await Conversation.findOne({
    _id: conversationId,
    'members.user': userId
  });

  if (!conversation) {
    return res.status(404).json({ success: false, message: 'Conversation not found.' });
  }

  const query = {
    conversation: conversationId,
    deletedForEveryone: false,
    deletedFor: { $ne: userId }
  };

  if (range === 'today') {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    query.createdAt = { $gte: startOfToday };
  } else if (range === 'unread') {
    const member = conversation.members.find((m) => String(m.user) === String(userId));
    if (member?.lastReadMessage) {
      const lastMsg = await Message.findById(member.lastReadMessage);
      if (lastMsg) {
        query.createdAt = { $gt: lastMsg.createdAt };
      }
    }
  }

  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(range === 'last50' ? 50 : 100)
    .populate('sender', 'name username')
    .lean();

  if (messages.length === 0) {
    return res.json({
      success: true,
      data: 'No messages found in the selected range to summarize.'
    });
  }

  const formattedMessages = messages
    .reverse()
    .map((m) => `${m.sender?.name || 'User'}: ${m.text || `[${m.type}]`}`)
    .join('\n');

  const summary = await aiService.generate({
    task: 'summarizeChat',
    input: { messages: formattedMessages, rangeLabel: range },
    userId
  });

  res.json({
    success: true,
    data: summary
  });
});

/**
 * 9. Chats: Translate Message
 * POST /api/ai/chat/translate
 */
exports.translateMessage = asyncHandler(async (req, res) => {
  const { messageId, text, targetLang = 'English' } = req.body;
  const userId = req.user._id;

  let sourceText = text;
  if (messageId) {
    const msg = await Message.findById(messageId);
    if (!msg) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }
    sourceText = msg.text;
  }

  if (!sourceText || !sourceText.trim()) {
    return res.status(400).json({ success: false, message: 'No text provided for translation.' });
  }

  const translated = await aiService.generate({
    task: 'translate',
    input: { text: sourceText, targetLang },
    userId
  });

  res.json({
    success: true,
    data: {
      originalText: sourceText,
      translatedText: translated,
      targetLang
    }
  });
});

/**
 * 10. Chats: Rewrite Text (Tone adjustment)
 * POST /api/ai/chat/rewrite
 */
exports.rewriteText = asyncHandler(async (req, res) => {
  const { text, tone = 'friendly' } = req.body;
  const userId = req.user._id;

  if (!text || !text.trim()) {
    return res.status(400).json({ success: false, message: 'Text cannot be empty.' });
  }

  const rewritten = await aiService.generate({
    task: 'rewrite',
    input: { text: text.trim(), tone },
    userId
  });

  res.json({
    success: true,
    data: {
      original: text,
      rewritten,
      tone
    }
  });
});

/**
 * 11. Social: Caption & Hashtags Generator
 * POST /api/ai/social/caption
 */
exports.generateCaption = asyncHandler(async (req, res) => {
  const { description = '', tone = 'engaging' } = req.body;
  const userId = req.user._id;

  const result = await aiService.generate({
    task: 'captionGenerator',
    input: { description, tone },
    userId
  });

  res.json({
    success: true,
    data: result
  });
});

/**
 * 12. Social: Hashtags Suggestions
 * POST /api/ai/social/hashtags
 */
exports.suggestHashtags = asyncHandler(async (req, res) => {
  const { caption = '' } = req.body;
  const userId = req.user._id;

  const result = await aiService.generate({
    task: 'hashtagSuggestions',
    input: { text: caption },
    userId
  });

  res.json({
    success: true,
    data: Array.isArray(result) ? result : ['#FlashChat', '#Trending', '#Explore']
  });
});

/**
 * 13. Social: Comment Reply Suggestions
 * POST /api/ai/social/comment-replies
 */
exports.suggestCommentReplies = asyncHandler(async (req, res) => {
  const { commentId, commentText = '', postCaption = '' } = req.body;
  const userId = req.user._id;

  let textToReply = commentText;
  if (commentId) {
    const comment = await Comment.findById(commentId);
    if (comment) textToReply = comment.text;
  }

  if (!textToReply) {
    return res.status(400).json({ success: false, message: 'Comment text is required.' });
  }

  const result = await aiService.generate({
    task: 'commentReplySuggestions',
    input: { commentText: textToReply, postCaption },
    userId
  });

  res.json({
    success: true,
    data: Array.isArray(result) ? result : ['Thank you! ❤️', 'Appreciate the feedback! 🙌', 'Thanks for watching! ✨']
  });
});

/**
 * 14. Social: Moderation Check
 * POST /api/ai/social/moderate
 */
exports.moderateContent = asyncHandler(async (req, res) => {
  const { text = '' } = req.body;
  const userId = req.user._id;

  const result = await aiService.generate({
    task: 'moderationCheck',
    input: { text },
    userId
  });

  res.json({
    success: true,
    data: result || { flagged: false, categories: [], reason: '' }
  });
});

/**
 * 14b. Social: Image Description (Alt-text / accessibility)
 * POST /api/ai/social/describe
 */
exports.describeImage = asyncHandler(async (req, res) => {
  const { mediaUrl, prompt } = req.body;
  const userId = req.user._id;

  const result = await aiService.generate({
    task: 'imageDescribe',
    input: { prompt: prompt || 'Describe this image clearly in 1-2 sentences for alt text accessibility.' },
    mediaUrl,
    userId
  });

  res.json({
    success: true,
    data: { description: typeof result === 'string' ? result : result?.description || '' }
  });
});

/**
 * 15. Pocket: Summarize item
 * POST /api/ai/pocket/summarize
 */
exports.summarizePocketItem = asyncHandler(async (req, res) => {
  const { itemId } = req.body;
  const userId = req.user._id;

  const item = await PocketItem.findOne({ _id: itemId, owner: userId, deletedAt: null });
  if (!item) {
    return res.status(404).json({ success: false, message: 'Pocket item not found.' });
  }

  if (item.isEncrypted) {
    return res.status(400).json({
      success: false,
      code: 'ENCRYPTED_ITEM_BLOCKED',
      message: 'Encrypted items cannot be processed by AI to preserve zero-knowledge privacy.'
    });
  }

  const summary = await aiService.generate({
    task: 'summarizeItem',
    input: { title: item.title, content: item.content || item.url, type: item.type },
    userId
  });

  // Save AI summary on item
  item.aiSummary = summary;
  await item.save();

  res.json({
    success: true,
    data: {
      itemId: item._id,
      aiSummary: summary
    }
  });
});

/**
 * 16. Pocket: Auto-tag item
 * POST /api/ai/pocket/auto-tag
 */
exports.autoTagPocketItem = asyncHandler(async (req, res) => {
  const { itemId } = req.body;
  const userId = req.user._id;

  const item = await PocketItem.findOne({ _id: itemId, owner: userId, deletedAt: null });
  if (!item) {
    return res.status(404).json({ success: false, message: 'Pocket item not found.' });
  }

  if (item.isEncrypted) {
    return res.status(400).json({
      success: false,
      code: 'ENCRYPTED_ITEM_BLOCKED',
      message: 'Encrypted items cannot be auto-tagged by AI.'
    });
  }

  const tags = await aiService.generate({
    task: 'autoTag',
    input: { title: item.title, content: item.content || item.url, type: item.type },
    userId
  });

  const parsedTags = Array.isArray(tags) ? tags : ['saved', 'reference'];
  item.aiTags = parsedTags;
  // Merge into existing tags
  const combined = Array.from(new Set([...(item.tags || []), ...parsedTags]));
  item.tags = combined;
  await item.save();

  res.json({
    success: true,
    data: {
      itemId: item._id,
      aiTags: parsedTags,
      tags: item.tags
    }
  });
});

/**
 * 17. Pocket: Ask My Pocket (RAG-lite Q&A)
 * POST /api/ai/pocket/ask
 */
exports.askPocket = asyncHandler(async (req, res) => {
  const { question } = req.body;
  const userId = req.user._id;

  if (!question || !question.trim()) {
    return res.status(400).json({ success: false, message: 'Question cannot be empty.' });
  }

  // Find top relevant unencrypted, active items owned by user using text search
  let items = await PocketItem.find(
    {
      owner: userId,
      deletedAt: null,
      isEncrypted: false,
      $text: { $search: question }
    },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .limit(8)
    .lean();

  // Fallback if text search yields fewer than 3 items: fetch recent items
  if (items.length < 3) {
    const recent = await PocketItem.find({
      owner: userId,
      deletedAt: null,
      isEncrypted: false
    })
      .sort({ updatedAt: -1 })
      .limit(8)
      .lean();

    const seenIds = new Set(items.map((i) => String(i._id)));
    for (const r of recent) {
      if (!seenIds.has(String(r._id))) {
        items.push(r);
      }
    }
  }

  if (items.length === 0) {
    return res.json({
      success: true,
      data: {
        answer: "I couldn't find any relevant unencrypted items in your Pocket to answer that question.",
        citations: []
      }
    });
  }

  // Build items context with citations
  const itemsContext = items
    .map((item, idx) => `[Item #${idx + 1}] Title: ${item.title || 'Untitled'} | Type: ${item.type}\nContent:\n${(item.content || item.url || '').slice(0, 800)}`)
    .join('\n\n---\n\n');

  const answer = await aiService.generate({
    task: 'answerFromPocket',
    input: { question: question.trim(), itemsContext },
    userId
  });

  const citations = items.map((item, idx) => ({
    citationIndex: idx + 1,
    itemId: item._id,
    title: item.title || 'Untitled',
    type: item.type
  }));

  res.json({
    success: true,
    data: {
      answer,
      citations
    }
  });
});

/**
 * 18. Common: Get AI usage & daily limits
 * GET /api/ai/usage
 */
exports.getUsage = asyncHandler(async (req, res) => {
  const usage = await aiService.getDailyUsage(req.user._id);
  res.json({
    success: true,
    data: usage
  });
});

/**
 * 19. Common: Submit message rating feedback
 * POST /api/ai/feedback
 */
exports.submitFeedback = asyncHandler(async (req, res) => {
  const { conversationId, messageId, rating } = req.body;
  if (!['thumbs_up', 'thumbs_down', 'none'].includes(rating)) {
    return res.status(400).json({ success: false, message: 'Invalid rating.' });
  }

  if (conversationId && messageId) {
    await AiConversation.updateOne(
      { _id: conversationId, user: req.user._id, 'messages._id': messageId },
      { $set: { 'messages.$.rating': rating } }
    );
  }

  res.json({
    success: true,
    message: 'Feedback submitted.'
  });
});

const AI_PROVIDER_DISCLOSURE = "Flash AI is powered by Google Gemini. Selected content is processed by Google to generate results.";

exports.AI_PROVIDER_DISCLOSURE = AI_PROVIDER_DISCLOSURE;

/**
 * 20. Common: Get AI provider disclosure
 * GET /api/ai/disclosure
 */
exports.getDisclosure = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    disclosure: AI_PROVIDER_DISCLOSURE,
    provider: 'Google Gemini'
  });
});

