const SupportTicket = require('../models/SupportTicket');
const SupportFaq = require('../models/SupportFaq');
const SupportCannedReply = require('../models/SupportCannedReply');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const chatService = require('./chatService');
const pushService = require('./pushService');
const logger = require('../utils/logger');
const { stripHtml } = require('../utils/sanitize');

const sanitizeText = (str) => {
  if (!str || typeof str !== 'string') return '';
  return stripHtml(str);
};

class SupportService {
  /**
   * Get or create the official Flash Support bot user
   */
  async getOrCreateSupportBotUser() {
    let supportUser = await User.findOne({ username: 'flash_support' });
    if (!supportUser) {
      supportUser = await User.create({
        username: 'flash_support',
        name: 'Flash Support',
        email: 'support@flashchat.internal',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=FlashSupport&backgroundColor=f97316',
        bio: 'Official Flash Chat Customer Support & Help Desk.',
        role: 'support',
        isVerified: true,
        isOnboarded: true
      });
    }
    return supportUser;
  }

  /**
   * Get or create the unique support conversation for a user
   */
  async getOrCreateSupportConversation(userId) {
    const supportBot = await this.getOrCreateSupportBotUser();

    let conv = await Conversation.findOne({
      type: 'support',
      'members.user': userId
    });

    if (!conv) {
      conv = await Conversation.create({
        type: 'support',
        name: 'Flash Support',
        avatar: supportBot.avatar,
        description: 'Direct support conversation with Flash Chat Help Desk',
        createdBy: userId,
        members: [
          { user: userId, role: 'member', unreadCount: 0 },
          { user: supportBot._id, role: 'admin', unreadCount: 0 }
        ]
      });
    }

    return conv;
  }

  /**
   * Create or reopen a support ticket (rate limited to 5 tickets/day/user)
   */
  async createTicket(userId, { subject, category = 'other', message, diagnostics }, io = null) {
    const cleanSubject = sanitizeText(subject);
    const cleanMessage = sanitizeText(message);

    if (!cleanSubject) {
      const err = new Error('Ticket subject is required.');
      err.statusCode = 400;
      throw err;
    }

    if (!cleanMessage) {
      const err = new Error('Initial message description is required.');
      err.statusCode = 400;
      throw err;
    }

    // Rate Limit: max 5 tickets per user in 24 hours
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTicketsCount = await SupportTicket.countDocuments({
      user: userId,
      createdAt: { $gte: dayAgo }
    });

    if (recentTicketsCount >= 5) {
      const err = new Error('Daily ticket creation limit reached (maximum 5 tickets per day).');
      err.statusCode = 429;
      throw err;
    }

    const conversation = await this.getOrCreateSupportConversation(userId);
    const supportBot = await this.getOrCreateSupportBotUser();

    // Check if an open/pending ticket already exists
    let ticket = await SupportTicket.findOne({
      user: userId,
      status: { $in: ['open', 'pending'] }
    });

    if (ticket) {
      // Reopen / append to existing open ticket
      ticket.subject = cleanSubject || ticket.subject;
      ticket.category = category || ticket.category;
      ticket.lastMessageAt = new Date();
      await ticket.save();
    } else {
      ticket = await SupportTicket.create({
        user: userId,
        conversation: conversation._id,
        subject: cleanSubject,
        category,
        status: 'open',
        priority: 'medium',
        lastMessageAt: new Date(),
        diagnostics: diagnostics || {
          appVersion: '1.0.0',
          platform: 'web',
          browser: 'browser'
        }
      });
    }

    // 1. Send the user's initial message
    const userMsg = await chatService.sendMessage(userId, {
      conversationId: conversation._id,
      text: cleanMessage,
      type: 'text'
    });

    // 2. Automated Flash AI First Response
    let aiResponseText = `Hi there! 👋 Thanks for reaching out to Flash Support. Our automated Flash AI assistant has received your ticket regarding **${cleanSubject}**.\n\nWe're reviewing your request and will get back to you shortly. You can also explore our FAQ guide or tap "Talk to a human" below at any time to connect with a support specialist.`;

    // Attempt intelligent matching against FAQ database
    try {
      const matchedFaq = await SupportFaq.findOne({
        isActive: true,
        $or: [
          { category: category },
          { keywords: { $in: cleanSubject.toLowerCase().split(/\s+/) } }
        ]
      });

      if (matchedFaq) {
        aiResponseText = `Hi there! 👋 Here is some helpful information from our Flash Help Desk regarding **${cleanSubject}**:\n\n${matchedFaq.answer}\n\n*If this does not resolve your issue, tap "Talk to a human" below and an agent will assist you shortly.*`;
      }
    } catch (faqErr) {
      logger.warn({ err: faqErr.message }, 'FAQ lookup skipped for automated reply');
    }

    const aiMsg = await Message.create({
      conversation: conversation._id,
      chatId: conversation._id,
      sender: supportBot._id,
      type: 'ai',
      text: aiResponseText,
      replyTo: userMsg._id,
      deliveredTo: [{ user: userId, at: new Date() }],
      readBy: []
    });

    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessage: aiMsg._id,
      updatedAt: new Date()
    });

    const populatedAiMsg = await Message.findById(aiMsg._id)
      .populate('sender', '_id name username avatar isVerified')
      .lean();

    if (io) {
      io.to(`conv:${conversation._id}`).emit('message:new', populatedAiMsg);
      io.to('support:agents').emit('support:ticket-updated', {
        ticketId: ticket._id,
        status: ticket.status,
        subject: ticket.subject
      });
    }

    return SupportTicket.findById(ticket._id)
      .populate('user', '_id name username email avatar')
      .populate('conversation')
      .lean();
  }

  /**
   * Request human agent handoff (sets status to 'pending')
   */
  async requestHumanHandoff(ticketId, userId, io = null) {
    const ticket = await SupportTicket.findOne({ _id: ticketId, user: userId });
    if (!ticket) {
      const err = new Error('Support ticket not found.');
      err.statusCode = 404;
      throw err;
    }

    ticket.status = 'pending';
    ticket.lastMessageAt = new Date();
    await ticket.save();

    const supportBot = await this.getOrCreateSupportBotUser();

    // Post handoff confirmation message
    const handoffMsg = await Message.create({
      conversation: ticket.conversation,
      chatId: ticket.conversation,
      sender: supportBot._id,
      type: 'system',
      text: '🔔 You have requested to speak with a human support agent. A team specialist has been notified and will assist you shortly.',
      deliveredTo: [{ user: userId, at: new Date() }],
      readBy: []
    });

    await Conversation.findByIdAndUpdate(ticket.conversation, {
      lastMessage: handoffMsg._id,
      updatedAt: new Date()
    });

    const populatedMsg = await Message.findById(handoffMsg._id)
      .populate('sender', '_id name username avatar isVerified')
      .lean();

    if (io) {
      io.to(`conv:${ticket.conversation}`).emit('message:new', populatedMsg);
      io.to('support:agents').emit('support:ticket-updated', {
        ticketId: ticket._id,
        status: 'pending',
        subject: ticket.subject
      });
    }

    return ticket;
  }

  /**
   * Submit ticket rating (1-5 stars, only once after resolved)
   */
  async rateTicket(ticketId, userId, { rating, comment = '' }) {
    const ticket = await SupportTicket.findOne({ _id: ticketId, user: userId });
    if (!ticket) {
      const err = new Error('Support ticket not found.');
      err.statusCode = 404;
      throw err;
    }

    if (ticket.status !== 'resolved') {
      const err = new Error('Ratings can only be submitted for resolved tickets.');
      err.statusCode = 400;
      throw err;
    }

    if (ticket.rating !== null && ticket.rating !== undefined) {
      const err = new Error('A rating has already been submitted for this ticket.');
      err.statusCode = 400;
      throw err;
    }

    const numericRating = Math.max(1, Math.min(5, parseInt(rating, 10)));
    ticket.rating = numericRating;
    ticket.ratingComment = sanitizeText(comment);
    await ticket.save();

    return {
      success: true,
      message: 'Thank you for your rating!',
      rating: ticket.rating,
      comment: ticket.ratingComment
    };
  }

  /**
   * Close / Resolve support ticket
   */
  async closeTicket(ticketId, userId, io = null) {
    const query = { _id: ticketId };
    // Normal users can only close their own ticket
    if (userId) {
      query.user = userId;
    }

    const ticket = await SupportTicket.findOne(query);
    if (!ticket) {
      const err = new Error('Support ticket not found.');
      err.statusCode = 404;
      throw err;
    }

    ticket.status = 'resolved';
    ticket.resolvedAt = new Date();
    await ticket.save();

    if (io) {
      io.to(`conv:${ticket.conversation}`).emit('support:ticket-updated', {
        ticketId: ticket._id,
        status: 'resolved'
      });
      io.to('support:agents').emit('support:ticket-updated', {
        ticketId: ticket._id,
        status: 'resolved'
      });
    }

    return { success: true, message: 'Support ticket resolved successfully.', ticket };
  }

  /**
   * Agent sends reply in support conversation
   */
  async agentReply(agentId, ticketId, { text, type = 'text', media = null }, io = null) {
    const ticket = await SupportTicket.findById(ticketId).populate('user', '_id name email isOnline');
    if (!ticket) {
      const err = new Error('Support ticket not found.');
      err.statusCode = 404;
      throw err;
    }

    const conv = await Conversation.findById(ticket.conversation);
    if (conv && !conv.members.some((m) => String(m.user) === String(agentId))) {
      conv.members.push({
        user: agentId,
        role: 'admin',
        joinedAt: new Date(),
        unreadCount: 0
      });
      await conv.save();
    }

    if (!ticket.assignedTo) {
      ticket.assignedTo = agentId;
    }

    const msg = await chatService.sendMessage(agentId, {
      conversationId: ticket.conversation,
      text: sanitizeText(text),
      type,
      media
    });

    ticket.lastMessageAt = new Date();
    if (ticket.status === 'open') {
      ticket.status = 'pending';
    }
    await ticket.save();

    // If user is offline, dispatch push notification and email fallback
    if (ticket.user && !ticket.user.isOnline) {
      pushService.sendToUser(ticket.user._id, {
        title: 'Flash Support',
        body: text.length > 80 ? text.slice(0, 77) + '...' : text,
        category: 'chat',
        data: { url: '/support/chat' }
      }).catch((e) => logger.warn({ err: e.message }, 'Support push notification skipped'));
    }

    if (io) {
      io.to(`conv:${ticket.conversation}`).emit('message:new', msg);
    }

    return msg;
  }

  /**
   * Get user tickets
   */
  async getUserTickets(userId) {
    return SupportTicket.find({ user: userId })
      .sort({ updatedAt: -1 })
      .populate('assignedTo', '_id name avatar')
      .lean();
  }

  /**
   * Get ticket details (Customer view)
   */
  async getTicketDetail(ticketId, userId) {
    const ticket = await SupportTicket.findOne({ _id: ticketId, user: userId })
      .populate('assignedTo', '_id name avatar')
      .lean();
    if (!ticket) {
      const err = new Error('Support ticket not found.');
      err.statusCode = 404;
      throw err;
    }
    return ticket;
  }

  /**
   * List tickets for agents/admins
   */
  async getAdminTickets({ status, category, assignedTo, search, page = 1, limit = 50 }) {
    const query = {};
    if (status) query.status = status;
    if (category) query.category = category;
    if (assignedTo) query.assignedTo = assignedTo;

    if (search && search.trim()) {
      query.subject = { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));
    const take = Math.min(100, parseInt(limit, 10));

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query)
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(take)
        .populate('user', '_id name username email avatar')
        .populate('assignedTo', '_id name username avatar')
        .lean(),
      SupportTicket.countDocuments(query)
    ]);

    return { tickets, total, page: parseInt(page, 10), limit: take };
  }

  /**
   * Update ticket status / assignment / priority (Agent/Admin)
   */
  async updateAdminTicket(ticketId, updates) {
    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      const err = new Error('Support ticket not found.');
      err.statusCode = 404;
      throw err;
    }

    if (updates.status) ticket.status = updates.status;
    if (updates.priority) ticket.priority = updates.priority;
    if (updates.assignedTo !== undefined) ticket.assignedTo = updates.assignedTo || null;

    if (updates.status === 'resolved' && !ticket.resolvedAt) {
      ticket.resolvedAt = new Date();
    }

    await ticket.save();

    return SupportTicket.findById(ticket._id)
      .populate('user', '_id name username email avatar')
      .populate('assignedTo', '_id name username avatar')
      .lean();
  }

  /**
   * Get Support Policy
   */
  getSupportPolicy() {
    return {
      averageResponseTime: '< 15 minutes',
      privacyStatement: 'Support agents can only view your support conversation and diagnostic details submitted with your ticket. Support staff have zero access to your private chats, contacts, or encrypted Pocket vault.',
      operatingHours: '24/7 Global Support'
    };
  }
}

module.exports = new SupportService();
