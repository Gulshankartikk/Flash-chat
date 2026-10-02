const { z } = require('zod');
const chatService = require('../services/chatService');
const Message = require('../models/Message');

const sendMessageSchema = z.object({
  conversationId: z.string().min(1, 'conversationId is required'),
  clientId: z.string().optional(),
  type: z
    .enum([
      'text',
      'image',
      'video',
      'audio',
      'voice',
      'document',
      'location',
      'contact',
      'system',
      'shared_post',
      'shared_reel',
      'shared_story'
    ])
    .optional()
    .default('text'),
  text: z.string().optional().default(''),
  media: z
    .array(
      z.object({
        url: z.string().url(),
        publicId: z.string().optional(),
        mimeType: z.string().optional(),
        size: z.number().optional(),
        duration: z.number().optional(),
        thumbnail: z.string().optional()
      })
    )
    .optional()
    .default([]),
  location: z
    .object({
      lat: z.number(),
      lng: z.number(),
      label: z.string().optional()
    })
    .optional(),
  contact: z
    .object({
      name: z.string(),
      phone: z.string()
    })
    .optional(),
  replyTo: z.string().optional(),
  forwardedFrom: z.string().optional()
});

const editMessageSchema = z.object({
  text: z.string().min(1, 'Updated message text cannot be empty')
});

const reactMessageSchema = z.object({
  emoji: z.string().min(1, 'Emoji is required')
});

const forwardMessageSchema = z.object({
  messageId: z.string().min(1, 'messageId is required'),
  conversationIds: z.array(z.string()).min(1, 'At least one target conversation is required')
});

/**
 * POST /api/messages
 */
const sendMessage = async (req, res, next) => {
  try {
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    }

    const message = await chatService.sendMessage(req.user._id, parsed.data);

    // Broadcast to room if Socket.IO is attached
    if (req.io) {
      req.io.to(`conv:${parsed.data.conversationId}`).emit('message:new', message);
    }

    return res.status(201).json({ success: true, message });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/messages/:id
 */
const editMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = editMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    }

    const updated = await chatService.editMessage(req.user._id, id, parsed.data.text);

    if (req.io) {
      req.io.to(`conv:${updated.conversation}`).emit('message:updated', updated);
    }

    return res.status(200).json({ success: true, message: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/messages/:id?scope=me|everyone
 */
const deleteMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const scope = req.query.scope === 'everyone' ? 'everyone' : 'me';

    const result = await chatService.deleteMessage(req.user._id, id, scope);

    if (req.io && scope === 'everyone') {
      req.io.to(`conv:${result.conversationId}`).emit('message:deleted', {
        messageId: id,
        conversationId: result.conversationId
      });
    }

    return res.status(200).json({ success: true, result });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/messages/:id/react
 */
const reactMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = reactMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    }

    const updated = await chatService.reactToMessage(req.user._id, id, parsed.data.emoji);

    if (req.io) {
      req.io.to(`conv:${updated.conversation}`).emit('message:updated', updated);
    }

    return res.status(200).json({ success: true, message: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/messages/:id/star
 */
const starMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await chatService.toggleStar(req.user._id, id);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/messages/forward
 */
const forwardMessage = async (req, res, next) => {
  try {
    const parsed = forwardMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    }

    const { messageId, conversationIds } = parsed.data;
    const forwardedMessages = await chatService.forwardMessage(req.user._id, messageId, conversationIds);

    if (req.io) {
      forwardedMessages.forEach((msg) => {
        req.io.to(`conv:${msg.conversation}`).emit('message:new', msg);
      });
    }

    return res.status(200).json({ success: true, messages: forwardedMessages });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/messages/read/:chatId
 */
const markChatAsRead = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { upToMessageId } = req.body;

    await chatService.markRead(req.user._id, chatId, upToMessageId);

    if (req.io) {
      req.io.to(`conv:${chatId}`).emit('message:status', {
        conversationId: chatId,
        readByUserId: req.user._id,
        status: 'read'
      });
    }

    return res.status(200).json({ success: true, message: 'Chat marked as read' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendMessage,
  editMessage,
  deleteMessage,
  reactMessage,
  starMessage,
  forwardMessage,
  markChatAsRead
};
