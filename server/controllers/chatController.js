const crypto = require('crypto');
const { z } = require('zod');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const chatService = require('../services/chatService');

// Zod schemas
const createDirectSchema = z.object({
  userId: z.string().min(1, 'Target user ID is required')
});

const createGroupSchema = z.object({
  name: z.string().min(2, 'Group name must be at least 2 characters').max(100),
  memberIds: z.array(z.string()).min(1, 'At least one group member is required'),
  avatar: z.string().url().optional().or(z.literal('')),
  description: z.string().max(500).optional().default('')
});

const updateChatSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  avatar: z.string().url().optional().or(z.literal('')),
  description: z.string().max(500).optional(),
  disappearAfter: z.number().nullable().optional()
});

const chatSettingsSchema = z.object({
  pin: z.boolean().optional(),
  archive: z.boolean().optional(),
  muteUntil: z.string().datetime().nullable().optional()
});

/**
 * POST /api/chats/direct
 */
const createOrGetDirectChat = async (req, res, next) => {
  try {
    const parsed = createDirectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    }

    const conversation = await chatService.createDirectConversation(req.user._id, parsed.data.userId);
    return res.status(200).json({ success: true, conversation });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/chats/group
 */
const createGroupChat = async (req, res, next) => {
  try {
    const parsed = createGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    }

    const conversation = await chatService.createGroupConversation(req.user._id, parsed.data);
    return res.status(201).json({ success: true, conversation });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/chats
 */
const getUserChats = async (req, res, next) => {
  try {
    const conversations = await chatService.getUserConversations(req.user._id);
    return res.status(200).json({ success: true, conversations });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/chats/:id
 */
const getChatById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findOne({
      _id: id,
      'members.user': req.user._id
    })
      .populate('members.user', '_id name username avatar isOnline lastSeen privacy')
      .populate('createdBy', '_id name username')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: '_id name username' }
      })
      .lean();

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Chat room not found or access denied.' });
    }

    return res.status(200).json({ success: true, conversation });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/chats/:id
 */
const updateChat = async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = updateChatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    }

    const conv = await Conversation.findById(id);
    if (!conv) return res.status(404).json({ success: false, message: 'Chat not found' });

    // Group updates require admin role
    if (conv.type === 'group') {
      const myMember = conv.members.find((m) => String(m.user) === String(req.user._id));
      if (myMember?.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only group admins can modify group details.' });
      }
    }

    const updated = await Conversation.findByIdAndUpdate(
      id,
      { $set: parsed.data },
      { new: true }
    ).populate('members.user', '_id name username avatar isOnline lastSeen');

    return res.status(200).json({ success: true, conversation: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/chats/:id/members (Admin add member)
 */
const addMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'userId is required.' });

    const conv = await Conversation.findById(id);
    if (!conv || conv.type !== 'group') {
      return res.status(400).json({ success: false, message: 'Can only add members to a group.' });
    }

    const myMember = conv.members.find((m) => String(m.user) === String(req.user._id));
    if (myMember?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only group admins can add members.' });
    }

    const alreadyMember = conv.members.some((m) => String(m.user) === String(userId));
    if (alreadyMember) {
      return res.status(400).json({ success: false, message: 'User is already a group member.' });
    }

    conv.members.push({ user: userId, role: 'member', joinedAt: new Date() });
    await conv.save();

    const updated = await Conversation.findById(id).populate('members.user', '_id name username avatar isOnline lastSeen');
    return res.status(200).json({ success: true, conversation: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/chats/:id/members/:userId (Admin remove member)
 */
const removeMember = async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    const conv = await Conversation.findById(id);
    if (!conv || conv.type !== 'group') {
      return res.status(400).json({ success: false, message: 'Can only remove members from a group.' });
    }

    const myMember = conv.members.find((m) => String(m.user) === String(req.user._id));
    if (myMember?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only group admins can remove members.' });
    }

    conv.members = conv.members.filter((m) => String(m.user) !== String(userId));
    await conv.save();

    return res.status(200).json({ success: true, message: 'Member removed successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/chats/:id/members/:userId/role (Admin change role)
 */
const updateMemberRole = async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;
    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role.' });
    }

    const conv = await Conversation.findById(id);
    const myMember = conv?.members.find((m) => String(m.user) === String(req.user._id));
    if (myMember?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only group admins can modify member roles.' });
    }

    const target = conv.members.find((m) => String(m.user) === String(userId));
    if (!target) return res.status(404).json({ success: false, message: 'Member not found in group.' });

    target.role = role;
    await conv.save();

    return res.status(200).json({ success: true, message: 'Role updated successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/chats/:id/leave
 */
const leaveGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const conv = await Conversation.findById(id);
    if (!conv || conv.type !== 'group') {
      return res.status(400).json({ success: false, message: 'Invalid group operation.' });
    }

    conv.members = conv.members.filter((m) => String(m.user) !== String(req.user._id));

    // If no members remain, clean up or appoint next admin
    if (conv.members.length > 0 && !conv.members.some((m) => m.role === 'admin')) {
      conv.members[0].role = 'admin';
    }
    await conv.save();

    return res.status(200).json({ success: true, message: 'Left group successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/chats/join/:inviteCode & POST /api/chats/join/:inviteCode
 */
const joinByInvite = async (req, res, next) => {
  try {
    const { inviteCode } = req.params;
    const conv = await Conversation.findOne({ inviteCode }).populate('members.user', '_id name username avatar');
    if (!conv) {
      return res.status(404).json({ success: false, message: 'Invalid or expired invite link.' });
    }

    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        group: {
          id: conv._id,
          name: conv.name,
          avatar: conv.avatar,
          memberCount: conv.members.length,
          description: conv.description
        }
      });
    }

    // POST: Join group
    const alreadyIn = conv.members.some((m) => String(m.user?._id || m.user) === String(req.user._id));
    if (!alreadyIn) {
      conv.members.push({ user: req.user._id, role: 'member', joinedAt: new Date() });
      await conv.save();
    }

    return res.status(200).json({ success: true, conversation: conv });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/chats/:id/invite/reset
 */
const resetInviteCode = async (req, res, next) => {
  try {
    const { id } = req.params;
    const conv = await Conversation.findById(id);
    const myMember = conv?.members.find((m) => String(m.user) === String(req.user._id));
    if (myMember?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admins can reset the invite link.' });
    }

    conv.inviteCode = crypto.randomBytes(6).toString('hex');
    await conv.save();

    return res.status(200).json({ success: true, inviteCode: conv.inviteCode });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/chats/:id/settings (pin, archive, mute)
 */
const updateChatSettings = async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = chatSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0].message });
    }

    const conv = await Conversation.findById(id);
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found.' });

    const member = conv.members.find((m) => String(m.user) === String(req.user._id));
    if (!member) return res.status(403).json({ success: false, message: 'Not a member.' });

    if (parsed.data.pin !== undefined) member.isPinned = parsed.data.pin;
    if (parsed.data.archive !== undefined) member.isArchived = parsed.data.archive;
    if (parsed.data.muteUntil !== undefined) {
      member.mutedUntil = parsed.data.muteUntil ? new Date(parsed.data.muteUntil) : null;
    }

    await conv.save();
    return res.status(200).json({ success: true, settings: member });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/chats/:id/messages?cursor=&limit=30
 */
const getMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cursor, limit = 30 } = req.query;

    const result = await chatService.getMessages(id, req.user._id, { cursor, limit });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/chats/:id/media?type=
 */
const getChatMedia = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type } = req.query;

    const isMember = await chatService.isMember(id, req.user._id);
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const query = {
      conversation: id,
      deletedForEveryone: false,
      'media.0': { $exists: true }
    };

    if (type) {
      query.type = type;
    }

    const messages = await Message.find(query)
      .select('type media createdAt sender')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const mediaList = messages.flatMap((m) =>
      m.media.map((med) => ({ ...med, messageId: m._id, createdAt: m.createdAt }))
    );

    return res.status(200).json({ success: true, media: mediaList });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/chats/search/messages?q=&conversationId=
 */
const searchMessages = async (req, res, next) => {
  try {
    const { q, conversationId } = req.query;
    if (!q || !q.trim()) {
      return res.status(200).json({ success: true, messages: [] });
    }

    const query = {
      deletedForEveryone: false,
      deletedFor: { $ne: req.user._id },
      text: { $regex: q.trim(), $options: 'i' }
    };

    if (conversationId) {
      const isMember = await chatService.isMember(conversationId, req.user._id);
      if (!isMember) return res.status(403).json({ success: false, message: 'Access denied.' });
      query.conversation = conversationId;
    } else {
      // Find conversations user is a part of
      const userConvs = await Conversation.find({ 'members.user': req.user._id }).select('_id');
      query.conversation = { $in: userConvs.map((c) => c._id) };
    }

    const messages = await Message.find(query)
      .populate('sender', '_id name username avatar')
      .populate('conversation', '_id name type')
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    return res.status(200).json({ success: true, messages });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrGetDirectChat,
  createGroupChat,
  getUserChats,
  getChatById,
  updateChat,
  addMember,
  removeMember,
  updateMemberRole,
  leaveGroup,
  joinByInvite,
  resetInviteCode,
  updateChatSettings,
  getMessages,
  getChatMedia,
  searchMessages
};
