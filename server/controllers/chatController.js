const { z } = require('zod');
const Chat = require('../models/Chat');
const User = require('../models/User');
const chatService = require('../services/chat/chatService');
const logger = require('../utils/logger');

const privateChatSchema = z.object({
  recipientId: z.string().min(1, 'Recipient ID is required')
});

const groupChatSchema = z.object({
  name: z.string().min(2, 'Group name must be at least 2 characters').max(100),
  participantIds: z.array(z.string()).min(1, 'At least 1 participant required')
});

/**
 * Get all chats for authenticated user
 */
const getChats = async (req, res, next) => {
  try {
    const chats = await chatService.getUserChats(req.user._id);
    res.status(200).json({
      success: true,
      chats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create or retrieve an existing 1-on-1 private chat
 */
const createPrivateChat = async (req, res, next) => {
  try {
    const parsed = privateChatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    }

    const { recipientId } = parsed.data;
    const currentUserId = req.user._id.toString();

    if (recipientId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot start a private conversation with yourself.'
      });
    }

    const recipient = await User.findById(recipientId).lean();
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient user not found.' });
    }

    // Check if 1-to-1 chat already exists between these 2 users
    let chat = await Chat.findOne({
      isGroup: false,
      participants: { $all: [currentUserId, recipientId], $size: 2 }
    })
      .populate('participants', '_id name email avatar isOnline lastSeen bio')
      .populate('latestMessage');

    if (!chat) {
      chat = await Chat.create({
        isGroup: false,
        participants: [currentUserId, recipientId],
        unreadCounts: {
          [currentUserId]: 0,
          [recipientId]: 0
        }
      });

      chat = await Chat.findById(chat._id)
        .populate('participants', '_id name email avatar isOnline lastSeen bio');
    }

    await chatService.invalidateChatCache([currentUserId, recipientId]);

    res.status(200).json({
      success: true,
      chat
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new group chat
 */
const createGroupChat = async (req, res, next) => {
  try {
    const parsed = groupChatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    }

    const { name, participantIds } = parsed.data;
    const currentUserId = req.user._id.toString();

    // Ensure creator is included without duplicates
    const allParticipants = Array.from(new Set([...participantIds, currentUserId]));

    const unreadCounts = {};
    allParticipants.forEach((id) => {
      unreadCounts[id] = 0;
    });

    let group = await Chat.create({
      name,
      isGroup: true,
      groupAdmin: currentUserId,
      participants: allParticipants,
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name)}`,
      unreadCounts
    });

    group = await Chat.findById(group._id)
      .populate('participants', '_id name email avatar isOnline lastSeen bio')
      .populate('groupAdmin', '_id name email avatar');

    await chatService.invalidateChatCache(allParticipants);

    // Notify socket if IO is attached
    if (req.io) {
      allParticipants.forEach((userId) => {
        req.io.to(`user:${userId}`).emit('chat:new_group', group);
      });
    }

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      chat: group
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get chat by ID
 */
const getChatById = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user._id
    })
      .populate('participants', '_id name email avatar isOnline lastSeen bio')
      .populate('groupAdmin', '_id name email avatar')
      .populate('latestMessage')
      .lean();

    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found or access denied.' });
    }

    res.status(200).json({
      success: true,
      chat
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getChats,
  createPrivateChat,
  createGroupChat,
  getChatById
};
