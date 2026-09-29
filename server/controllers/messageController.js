const { z } = require('zod');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const User = require('../models/User');
const chatService = require('../services/chat/chatService');
const mailer = require('../services/mailer/mailerService');
const logger = require('../utils/logger');

const sendMessageSchema = z.object({
  chatId: z.string().min(1, 'Chat ID is required'),
  content: z.string().optional().default(''),
  replyTo: z.string().optional().nullable()
});

const editMessageSchema = z.object({
  content: z.string().min(1, 'Updated content cannot be empty')
});

/**
 * Fetch messages for a chat with cursor pagination
 */
const getMessages = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { before, limit } = req.query;

    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user._id
    }).lean();

    if (!chat) {
      return res.status(403).json({ success: false, message: 'Access to this chat is denied.' });
    }

    const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10), 5), 100) : 30;
    const result = await chatService.getMessagesCursor(chatId, before, parsedLimit);

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send a message (text and/or file/image)
 */
const sendMessage = async (req, res, next) => {
  try {
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    }

    const { chatId, content, replyTo } = parsed.data;
    const currentUserId = req.user._id;

    // Verify chat membership
    const chat = await Chat.findOne({
      _id: chatId,
      participants: currentUserId
    });

    if (!chat) {
      return res.status(403).json({ success: false, message: 'Cannot send message to this chat.' });
    }

    let mediaUrl = '';
    let mediaType = 'text';
    let fileName = '';
    let fileSize = 0;

    if (req.file) {
      mediaUrl = `/uploads/${req.file.filename}`;
      fileName = req.file.originalname;
      fileSize = req.file.size;

      if (req.file.mimetype.startsWith('image/')) {
        mediaType = 'image';
      } else if (req.file.mimetype.startsWith('audio/')) {
        mediaType = 'audio';
      } else {
        mediaType = 'file';
      }
    }

    if (!content && !mediaUrl) {
      return res.status(400).json({
        success: false,
        message: 'Message must contain either text content or an attachment.'
      });
    }

    let message = await Message.create({
      chatId,
      sender: currentUserId,
      content,
      mediaUrl,
      mediaType,
      fileName,
      fileSize,
      replyTo: replyTo || undefined,
      deliveredTo: [currentUserId],
      readBy: [currentUserId]
    });

    message = await Message.findById(message._id)
      .populate('sender', '_id name avatar')
      .populate('replyTo', '_id content sender mediaType isDeleted');

    // Update chat latestMessage and increment unread count for other participants
    chat.latestMessage = message._id;
    chat.participants.forEach((pId) => {
      const pidStr = pId.toString();
      if (pidStr !== currentUserId.toString()) {
        const currentCount = chat.unreadCounts.get(pidStr) || 0;
        chat.unreadCounts.set(pidStr, currentCount + 1);
      }
    });

    await chat.save();
    await chatService.invalidateChatCache(chat.participants);

    // Emit via Socket.IO
    if (req.io) {
      req.io.to(`chat:${chatId}`).emit('message:new', message);
      chat.participants.forEach((pId) => {
        req.io.to(`user:${pId}`).emit('chat:updated', {
          chatId,
          latestMessage: message
        });
      });
    }

    // Check offline participants for offline email digest if needed
    setImmediate(async () => {
      try {
        const offlineParticipants = await User.find({
          _id: { $in: chat.participants, $ne: currentUserId },
          isOnline: false
        }).lean();

        for (const offlineUser of offlineParticipants) {
          const unread = chat.unreadCounts.get(offlineUser._id.toString()) || 1;
          // Send digest email on 5 unread messages threshold to avoid spamming
          if (unread === 5) {
            mailer.sendOfflineDigest(offlineUser.email, {
              name: offlineUser.name,
              senderName: req.user.name,
              count: unread
            });
          }
        }
      } catch (err) {
        logger.warn({ err: err.message }, 'Offline digest notification check error');
      }
    });

    res.status(201).json({
      success: true,
      message
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Edit a message
 */
const editMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const parsed = editMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Cannot edit another user\'s message.' });
    }

    if (message.isDeleted) {
      return res.status(400).json({ success: false, message: 'Cannot edit a deleted message.' });
    }

    message.content = parsed.data.content;
    message.isEdited = true;
    await message.save();

    const populated = await Message.findById(message._id)
      .populate('sender', '_id name avatar')
      .populate('replyTo', '_id content sender mediaType isDeleted');

    if (req.io) {
      req.io.to(`chat:${message.chatId}`).emit('message:edited', populated);
    }

    res.status(200).json({
      success: true,
      message: populated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Soft delete a message
 */
const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Cannot delete another user\'s message.' });
    }

    message.isDeleted = true;
    message.content = 'This message was deleted';
    message.mediaUrl = '';
    await message.save();

    if (req.io) {
      req.io.to(`chat:${message.chatId}`).emit('message:deleted', {
        messageId: message._id,
        chatId: message.chatId
      });
    }

    res.status(200).json({
      success: true,
      message: 'Message deleted'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark messages in a chat as read by authenticated user
 */
const markAsRead = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    // Reset unread count for user in Chat document
    await Chat.findByIdAndUpdate(chatId, {
      $set: { [`unreadCounts.${userId}`]: 0 }
    });

    // Add user to readBy array for unread messages
    await Message.updateMany(
      {
        chatId,
        readBy: { $ne: userId }
      },
      {
        $addToSet: { readBy: userId }
      }
    );

    if (req.io) {
      req.io.to(`chat:${chatId}`).emit('message:read_receipt', {
        chatId,
        readByUserId: userId
      });
    }

    res.status(200).json({
      success: true,
      message: 'Chat marked as read'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  markAsRead
};
