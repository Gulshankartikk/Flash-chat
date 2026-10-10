const crypto = require('crypto');
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const Contact = require('../models/Contact');

class ChatService {
  /**
   * Helper: generate direct chat member key "minId_maxId"
   */
  getMemberKey(id1, id2) {
    const s1 = String(id1);
    const s2 = String(id2);
    return s1 < s2 ? `${s1}_${s2}` : `${s2}_${s1}`;
  }

  /**
   * Get or create a 1-to-1 direct conversation
   */
  async createDirectConversation(userIdA, userIdB) {
    if (String(userIdA) === String(userIdB)) {
      throw new Error('Cannot start a direct conversation with yourself.');
    }

    const memberKey = this.getMemberKey(userIdA, userIdB);
    let conversation = await Conversation.findOne({ memberKey })
      .populate('members.user', '_id name username avatar isOnline lastSeen privacy')
      .populate('lastMessage');

    if (!conversation) {
      conversation = await Conversation.create({
        type: 'direct',
        memberKey,
        createdBy: userIdA,
        members: [
          { user: userIdA, role: 'member', unreadCount: 0 },
          { user: userIdB, role: 'member', unreadCount: 0 }
        ]
      });

      conversation = await Conversation.findById(conversation._id)
        .populate('members.user', '_id name username avatar isOnline lastSeen privacy')
        .populate('lastMessage');
    }

    return conversation;
  }

  /**
   * Create a new group conversation
   */
  async createGroupConversation(creatorId, { name, memberIds = [], avatar = '', description = '' }) {
    if (!name || name.trim().length < 2) {
      throw new Error('Group name must be at least 2 characters.');
    }

    const uniqueMembers = Array.from(new Set([String(creatorId), ...memberIds.map(String)]));
    const inviteCode = crypto.randomBytes(6).toString('hex');

    const members = uniqueMembers.map((uid) => ({
      user: uid,
      role: String(uid) === String(creatorId) ? 'admin' : 'member',
      joinedAt: new Date(),
      unreadCount: 0
    }));

    const conversation = await Conversation.create({
      type: 'group',
      name: name.trim(),
      avatar: avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name)}`,
      description: description.trim(),
      createdBy: creatorId,
      inviteCode,
      members
    });

    return Conversation.findById(conversation._id)
      .populate('members.user', '_id name username avatar isOnline lastSeen privacy')
      .populate('createdBy', '_id name username');
  }

  /**
   * Check if a user is a member of a conversation
   */
  async isMember(conversationId, userId) {
    const conv = await Conversation.findOne({
      _id: conversationId,
      'members.user': userId
    }).select('_id');
    return !!conv;
  }

  /**
   * Send message into conversation
   */
  async sendMessage(senderId, payload) {
    const {
      conversationId,
      clientId,
      type = 'text',
      text = '',
      media = [],
      location,
      contact,
      replyTo,
      forwardedFrom,
      sharedRef,
      snapshot
    } = payload;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found.');
    }

    const isUserMember = conversation.members.some(
      (m) => String(m.user) === String(senderId)
    );
    if (!isUserMember) {
      throw new Error('You are not a member of this conversation.');
    }

    // Deduplicate by clientId if present
    if (clientId) {
      const existingMsg = await Message.findOne({ conversation: conversationId, clientId });
      if (existingMsg) {
        return existingMsg;
      }
    }

    // Handle disappearing messages
    let expiresAt = null;
    if (conversation.disappearAfter && conversation.disappearAfter > 0) {
      expiresAt = new Date(Date.now() + conversation.disappearAfter * 1000);
    }

    // Create message document
    const message = await Message.create({
      conversation: conversationId,
      chatId: conversationId,
      sender: senderId,
      type,
      text: text ? text.trim() : '',
      media: Array.isArray(media) ? media : [],
      location: location || undefined,
      contact: contact || undefined,
      replyTo: replyTo || undefined,
      forwardedFrom: forwardedFrom || undefined,
      sharedRef: sharedRef || undefined,
      snapshot: snapshot || undefined,
      clientId: clientId || undefined,
      expiresAt,
      deliveredTo: [{ user: senderId, at: new Date() }],
      readBy: [{ user: senderId, at: new Date() }]
    });

    // Update conversation's lastMessage and increment unread for all other members
    const memberUpdates = {};
    conversation.members.forEach((m, idx) => {
      if (String(m.user) !== String(senderId)) {
        memberUpdates[`members.${idx}.unreadCount`] = (m.unreadCount || 0) + 1;
      }
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      updatedAt: new Date(),
      $set: memberUpdates
    });

    // Return populated message
    return Message.findById(message._id)
      .populate('sender', '_id name username avatar')
      .populate('replyTo', '_id sender text type media')
      .lean();
  }

  /**
   * Mark messages as delivered for a user
   */
  async markDelivered(userId, conversationId, messageId) {
    const query = {
      conversation: conversationId,
      sender: { $ne: userId },
      'deliveredTo.user': { $ne: userId }
    };
    if (messageId) {
      query._id = messageId;
    }

    await Message.updateMany(query, {
      $push: { deliveredTo: { user: userId, at: new Date() } }
    });
  }

  /**
   * Mark messages as read up to a message
   */
  async markRead(userId, conversationId, upToMessageId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return;

    // Reset unread count for this user
    await Conversation.updateOne(
      { _id: conversationId, 'members.user': userId },
      { $set: { 'members.$.unreadCount': 0, 'members.$.lastReadMessage': upToMessageId || undefined } }
    );

    // Update readBy on messages
    const query = {
      conversation: conversationId,
      sender: { $ne: userId },
      'readBy.user': { $ne: userId }
    };
    if (upToMessageId) {
      query._id = { $lte: upToMessageId };
    }

    await Message.updateMany(query, {
      $push: { readBy: { user: userId, at: new Date() } }
    });
  }

  /**
   * Get user's conversation list with sorted pinning
   */
  async getUserConversations(userId) {
    const conversations = await Conversation.find({
      'members.user': userId
    })
      .populate('members.user', '_id name username avatar isOnline lastSeen privacy')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: '_id name username' }
      })
      .sort({ updatedAt: -1 })
      .lean();

    // Retrieve owner's saved contact names to map linkedUser -> saved contact name
    const savedContacts = await Contact.find({
      owner: userId,
      linkedUser: { $ne: null }
    }).select('name linkedUser').lean();

    const contactMap = {};
    for (const c of savedContacts) {
      if (c.linkedUser) contactMap[String(c.linkedUser)] = c.name;
    }

    // Map conversation with member-specific metadata (isPinned, isArchived, unreadCount, otherUser, contactName)
    const formatted = conversations.map((conv) => {
      const myMember = conv.members.find((m) => String(m.user?._id) === String(userId));
      const otherMember = conv.members.find((m) => String(m.user?._id) !== String(userId));
      const otherUserId = otherMember?.user?._id ? String(otherMember.user._id) : null;
      const contactName = otherUserId && contactMap[otherUserId] ? contactMap[otherUserId] : null;

      let displayName = 'Flash User';
      if (conv.type === 'group') {
        displayName = conv.name;
      } else if (conv.type === 'support') {
        displayName = 'Flash Support';
      } else if (contactName) {
        displayName = contactName;
      } else if (otherMember?.user?.name) {
        displayName = otherMember.user.name;
      }

      let displayAvatar = '';
      if (conv.type === 'group') {
        displayAvatar = conv.avatar;
      } else if (conv.type === 'support') {
        displayAvatar = conv.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=FlashSupport&backgroundColor=f97316';
      } else {
        displayAvatar = otherMember?.user?.avatar || '';
      }

      return {
        ...conv,
        isPinned: myMember?.isPinned || false,
        isArchived: myMember?.isArchived || false,
        isMuted: myMember?.mutedUntil && new Date(myMember.mutedUntil) > new Date(),
        unreadCount: myMember?.unreadCount || 0,
        otherUser: conv.type === 'direct' ? otherMember?.user || null : null,
        contactName: contactName || undefined,
        displayName,
        displayAvatar
      };
    });

    // Pinned conversations appear first, then sorted by updatedAt
    return formatted.sort((a, b) => {
      if (a.isPinned === b.isPinned) return 0;
      return a.isPinned ? -1 : 1;
    });
  }

  /**
   * Get messages with cursor pagination
   */
  async getMessages(conversationId, userId, { cursor, limit = 30 }) {
    const isMember = await this.isMember(conversationId, userId);
    if (!isMember) {
      throw new Error('Not authorized to access messages in this conversation.');
    }

    const savedContacts = await Contact.find({
      owner: userId,
      linkedUser: { $ne: null }
    }).select('name linkedUser').lean();

    const contactMap = {};
    for (const c of savedContacts) {
      if (c.linkedUser) contactMap[String(c.linkedUser)] = c.name;
    }

    const query = {
      conversation: conversationId,
      deletedFor: { $ne: userId },
      deletedForEveryone: false
    };

    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate('sender', '_id name username avatar')
      .populate('replyTo', '_id sender text type media')
      .lean();

    // Attach saved contactName to message sender if available
    const mapped = messages.map((m) => {
      const senderId = m.sender?._id ? String(m.sender._id) : null;
      if (senderId && contactMap[senderId]) {
        return {
          ...m,
          sender: {
            ...m.sender,
            contactName: contactMap[senderId]
          }
        };
      }
      return m;
    });

    // Oldest to newest for frontend display
    const ordered = mapped.reverse();
    const nextCursor = messages.length === Number(limit) ? messages[0].createdAt : null;

    return {
      messages: ordered,
      nextCursor
    };
  }

  /**
   * Edit message content (within 15 minutes limit)
   */
  async editMessage(userId, messageId, newText) {
    const message = await Message.findById(messageId);
    if (!message) throw new Error('Message not found.');
    if (String(message.sender) !== String(userId)) {
      throw new Error('You can only edit your own messages.');
    }

    // 15-minute edit window check
    const diffMin = (Date.now() - new Date(message.createdAt).getTime()) / (1000 * 60);
    if (diffMin > 15) {
      throw new Error('Messages can only be edited within 15 minutes of sending.');
    }

    message.text = newText.trim();
    message.editedAt = new Date();
    await message.save();

    return Message.findById(message._id)
      .populate('sender', '_id name username avatar')
      .populate('replyTo', '_id sender text type media')
      .lean();
  }

  /**
   * Delete message (scope: 'me' | 'everyone')
   */
  async deleteMessage(userId, messageId, scope = 'me') {
    const message = await Message.findById(messageId);
    if (!message) throw new Error('Message not found.');

    if (scope === 'everyone') {
      if (String(message.sender) !== String(userId)) {
        throw new Error('Only the sender can delete a message for everyone.');
      }
      message.deletedForEveryone = true;
      message.text = 'This message was deleted';
      message.media = [];
      await message.save();
    } else {
      if (!message.deletedFor.includes(userId)) {
        message.deletedFor.push(userId);
        await message.save();
      }
    }

    return { messageId, conversationId: message.conversation, scope };
  }

  /**
   * React to message with emoji
   */
  async reactToMessage(userId, messageId, emoji) {
    const message = await Message.findById(messageId);
    if (!message) throw new Error('Message not found.');

    const existingIndex = message.reactions.findIndex(
      (r) => String(r.user) === String(userId)
    );

    if (existingIndex > -1) {
      if (message.reactions[existingIndex].emoji === emoji) {
        // Toggle off reaction
        message.reactions.splice(existingIndex, 1);
      } else {
        // Update emoji
        message.reactions[existingIndex].emoji = emoji;
      }
    } else {
      message.reactions.push({ user: userId, emoji });
    }

    await message.save();
    return Message.findById(message._id)
      .populate('sender', '_id name username avatar')
      .populate('replyTo', '_id sender text type media')
      .lean();
  }

  /**
   * Star / Unstar message
   */
  async toggleStar(userId, messageId) {
    const message = await Message.findById(messageId);
    if (!message) throw new Error('Message not found.');

    const index = message.starredBy.indexOf(userId);
    let isStarred = false;
    if (index > -1) {
      message.starredBy.splice(index, 1);
    } else {
      message.starredBy.push(userId);
      isStarred = true;
    }

    await message.save();
    return { messageId, isStarred };
  }

  /**
   * Helper: Get or create Flash AI system bot user
   */
  async getOrCreateAiBotUser() {
    let aiUser = await User.findOne({ username: 'flash_ai' });
    if (!aiUser) {
      aiUser = await User.create({
        username: 'flash_ai',
        name: 'Flash AI',
        email: 'ai@flashchat.internal',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=FlashAI',
        bio: '⚡ Intelligent AI assistant built directly into Flash Chat.',
        isVerified: true,
        isOnboarded: true
      });
    }
    return aiUser;
  }

  /**
   * Handle @ai mentions in conversation
   */
  async handleAiMention(io, conversationId, userMessage, senderId) {
    try {
      const conv = await Conversation.findById(conversationId);
      if (!conv || conv.allowAi === false) {
        return null;
      }

      const rawPrompt = userMessage.text.replace(/^@ai\s*/i, '').trim();
      if (!rawPrompt) return null;

      const aiBot = await this.getOrCreateAiBotUser();

      // Emit typing indicator for AI bot
      if (io) {
        io.to(`conv:${conversationId}`).emit('typing:status', {
          conversationId,
          userId: String(aiBot._id),
          isTyping: true
        });
      }

      const aiService = require('./ai.service');

      // Fetch recent 5 messages for conversation context
      const recentMessages = await Message.find({
        conversation: conversationId,
        deletedForEveryone: false,
        _id: { $ne: userMessage._id }
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('sender', 'name username')
        .lean();

      const contextSnippet = recentMessages
        .reverse()
        .map((m) => `${m.sender?.name || 'User'}: ${m.text || `[${m.type}]`}`)
        .join('\n');

      const aiResponseText = await aiService.generate({
        task: 'askAi',
        input: { question: rawPrompt, context: contextSnippet },
        userId: senderId
      });

      // Stop typing indicator
      if (io) {
        io.to(`conv:${conversationId}`).emit('typing:status', {
          conversationId,
          userId: String(aiBot._id),
          isTyping: false
        });
      }

      // Create AI response message
      const aiMessage = await Message.create({
        conversation: conversationId,
        chatId: conversationId,
        sender: aiBot._id,
        type: 'ai',
        text: typeof aiResponseText === 'string' ? aiResponseText : JSON.stringify(aiResponseText),
        replyTo: userMessage._id,
        deliveredTo: [{ user: senderId, at: new Date() }],
        readBy: []
      });

      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: aiMessage._id,
        updatedAt: new Date()
      });

      const populatedAiMsg = await Message.findById(aiMessage._id)
        .populate('sender', '_id name username avatar isVerified')
        .populate('replyTo', '_id sender text type')
        .lean();

      if (io) {
        io.to(`conv:${conversationId}`).emit('message:new', populatedAiMsg);
      }

      return populatedAiMsg;
    } catch (err) {
      const logger = require('../utils/logger');
      logger.error({ err: err.message }, 'Failed to handle @ai mention in chat');
      return null;
    }
  }

  /**
   * Forward message to target conversations
   */
  async forwardMessage(userId, messageId, targetConversationIds = []) {
    const original = await Message.findById(messageId);
    if (!original) throw new Error('Original message not found.');

    const forwardedMessages = [];
    for (const convId of targetConversationIds) {
      const isMember = await this.isMember(convId, userId);
      if (isMember) {
        const msg = await this.sendMessage(userId, {
          conversationId: convId,
          type: original.type,
          text: original.text,
          media: original.media,
          location: original.location,
          contact: original.contact,
          forwardedFrom: original._id
        });
        forwardedMessages.push(msg);
      }
    }
    return forwardedMessages;
  }

  /**
   * Helper: Hash phone number with HMAC secret for secure privacy-preserving pending matching
   */
  getPhoneHash(phone) {
    const secret = process.env.PHONE_HASH_SECRET || 'flash_chat_super_secure_phone_hmac_secret_32_chars_min';
    return crypto.createHmac('sha256', secret).update(phone.trim()).digest('hex');
  }

  /**
   * Helper: Mask phone number for UI display (e.g. +91 ••••• •43210)
   */
  maskPhone(phone) {
    if (!phone || phone.length < 6) return phone || '';
    const clean = phone.trim();
    const prefix = clean.slice(0, 3);
    const suffix = clean.slice(-4);
    return `${prefix} ••••• •${suffix}`;
  }

  /**
   * Start chat by phone number: direct resolution or pending queue
   */
  async startChatByPhone(userId, { phone, name = '', saveContact = true }) {
    if (!phone || typeof phone !== 'string') {
      const err = new Error('Phone number is required');
      err.statusCode = 400;
      throw err;
    }

    const cleanPhone = phone.trim();
    // Validate E.164: + followed by 8-15 digits
    if (!/^\+[1-9]\d{7,14}$/.test(cleanPhone)) {
      const err = new Error('Please enter a valid international phone number in E.164 format (e.g. +1234567890)');
      err.statusCode = 400;
      throw err;
    }

    // Reject chatting with own phone number
    const currentUser = await User.findById(userId);
    if (currentUser && currentUser.phoneNumber === cleanPhone) {
      const err = new Error('Cannot start a chat with your own phone number.');
      err.statusCode = 400;
      throw err;
    }

    const Block = require('../models/Block');
    const PendingConversation = require('../models/PendingConversation');

    // Look for existing registered user with this phone number
    const candidate = await User.findOne({ phoneNumber: cleanPhone });

    let isEligible = false;
    if (candidate) {
      // Check discoverability
      const isDiscoverable = candidate.discoverableByPhone !== false;
      // Check blocks in both directions
      const hasBlock = await Block.findOne({
        $or: [
          { blocker: userId, blocked: candidate._id },
          { blocker: candidate._id, blocked: userId }
        ]
      });

      if (isDiscoverable && !hasBlock) {
        isEligible = true;
      }
    }

    // CASE 1: Registered & Discoverable user on Flash Chat
    if (isEligible && candidate) {
      const conversation = await this.createDirectConversation(userId, candidate._id);

      let contactRecord = null;
      if (saveContact || name) {
        contactRecord = await Contact.findOneAndUpdate(
          { owner: userId, phone: cleanPhone },
          {
            $set: {
              owner: userId,
              name: (name && name.trim()) || candidate.name || 'Contact',
              phone: cleanPhone,
              linkedUser: candidate._id
            }
          },
          { upsert: true, new: true }
        );
      }

      return {
        status: 'ready',
        conversationId: conversation._id,
        contactId: contactRecord?._id || null,
        isRegistered: true,
        user: {
          _id: candidate._id,
          name: candidate.name,
          username: candidate.username,
          avatar: candidate.avatar
        }
      };
    }

    // CASE 2: Unregistered (or non-discoverable / blocked) -> Create/Reuse PendingConversation
    const phoneHash = this.getPhoneHash(cleanPhone);
    const masked = this.maskPhone(cleanPhone);

    let contactRecord = null;
    if (saveContact || name) {
      contactRecord = await Contact.findOneAndUpdate(
        { owner: userId, phone: cleanPhone },
        {
          $set: {
            owner: userId,
            name: (name && name.trim()) || 'Contact',
            phone: cleanPhone,
            linkedUser: null
          }
        },
        { upsert: true, new: true }
      );
    }

    // Check cap of 20 pending invitations per owner
    const pendingCount = await PendingConversation.countDocuments({ owner: userId });
    let pending = await PendingConversation.findOne({ owner: userId, phoneHash });

    if (!pending && pendingCount >= 20) {
      const err = new Error('Maximum limit of 20 pending invitations reached.');
      err.statusCode = 400;
      throw err;
    }

    if (!pending) {
      pending = await PendingConversation.create({
        owner: userId,
        phoneHash,
        rawPhoneMasked: masked,
        contact: contactRecord?._id || null,
        name: (name && name.trim()) || 'Contact',
        queuedMessages: [],
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    } else if (name || contactRecord) {
      pending.name = (name && name.trim()) || pending.name;
      if (contactRecord) pending.contact = contactRecord._id;
      await pending.save();
    }

    return {
      status: 'pending',
      pendingId: pending._id,
      canInvite: true,
      contactId: contactRecord?._id || null,
      isRegistered: false,
      maskedPhone: masked
    };
  }

  /**
   * Queue text message for an unregistered contact
   */
  async queuePendingMessage(userId, pendingId, text) {
    const PendingConversation = require('../models/PendingConversation');
    const pending = await PendingConversation.findOne({ _id: pendingId, owner: userId });

    if (!pending) {
      const err = new Error('Pending conversation not found or access denied.');
      err.statusCode = 404;
      throw err;
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      const err = new Error('Message text is required');
      err.statusCode = 400;
      throw err;
    }

    const cleanText = text.trim();
    if (cleanText.length > 500) {
      const err = new Error('Pending messages are limited to 500 characters');
      err.statusCode = 400;
      throw err;
    }

    if (pending.queuedMessages.length >= 5) {
      const err = new Error('Cannot queue more than 5 messages for an unregistered contact');
      err.statusCode = 400;
      throw err;
    }

    pending.queuedMessages.push({
      text: cleanText,
      createdAt: new Date()
    });

    await pending.save();

    return {
      success: true,
      pendingId: pending._id,
      queuedCount: pending.queuedMessages.length,
      message: 'Message queued for delivery when recipient joins Flash Chat.'
    };
  }

  /**
   * Get all pending conversations for an owner
   */
  async getPendingConversations(userId) {
    const PendingConversation = require('../models/PendingConversation');
    return PendingConversation.find({ owner: userId })
      .populate('contact')
      .sort({ updatedAt: -1 })
      .lean();
  }

  /**
   * Delete / Cancel a pending conversation
   */
  async deletePendingConversation(userId, pendingId) {
    const PendingConversation = require('../models/PendingConversation');
    const result = await PendingConversation.findOneAndDelete({ _id: pendingId, owner: userId });
    if (!result) {
      const err = new Error('Pending conversation not found.');
      err.statusCode = 404;
      throw err;
    }
    return { success: true, message: 'Pending conversation removed.' };
  }

  /**
   * Deliver pending messages upon user signup / phone verification
   */
  async deliverPendingConversationsOnSignup(newUser) {
    if (!newUser || !newUser.phoneNumber) return 0;
    if (newUser.discoverableByPhone === false) return 0;

    const PendingConversation = require('../models/PendingConversation');
    const Block = require('../models/Block');

    const phoneHash = this.getPhoneHash(newUser.phoneNumber);
    const pendingList = await PendingConversation.find({ phoneHash });

    let deliveredCount = 0;

    for (const pending of pendingList) {
      try {
        // Check blocks in either direction
        const isBlocked = await Block.findOne({
          $or: [
            { blocker: pending.owner, blocked: newUser._id },
            { blocker: newUser._id, blocked: pending.owner }
          ]
        });

        if (isBlocked) {
          await PendingConversation.findByIdAndDelete(pending._id);
          continue;
        }

        // Link contact if exists
        await Contact.updateMany(
          { owner: pending.owner, phone: newUser.phoneNumber },
          { $set: { linkedUser: newUser._id } }
        );

        // Create direct conversation with 'request' status if queued messages exist
        const hasQueued = pending.queuedMessages && pending.queuedMessages.length > 0;
        const conv = await this.createDirectConversation(pending.owner, newUser._id);

        if (hasQueued) {
          conv.status = 'request';
          conv.requestedBy = pending.owner;

          for (const qm of pending.queuedMessages) {
            const msg = await Message.create({
              conversation: conv._id,
              chatId: conv._id,
              sender: pending.owner,
              text: qm.text,
              type: 'text',
              deliveredTo: [],
              readBy: []
            });
            conv.lastMessage = msg._id;
          }
          await conv.save();
        }

        await PendingConversation.findByIdAndDelete(pending._id);
        deliveredCount++;
      } catch (err) {
        const logger = require('../utils/logger');
        logger.error({ err: err.message }, 'Error delivering pending conversation on signup');
      }
    }

    return deliveredCount;
  }

  /**
   * Accept incoming message request
   */
  async acceptMessageRequest(userId, conversationId) {
    const conv = await Conversation.findOne({
      _id: conversationId,
      'members.user': userId
    });

    if (!conv) {
      const err = new Error('Conversation not found or access denied.');
      err.statusCode = 404;
      throw err;
    }

    conv.status = 'active';
    conv.requestedBy = null;
    await conv.save();

    return Conversation.findById(conv._id)
      .populate('members.user', '_id name username avatar isOnline lastSeen privacy')
      .populate('lastMessage')
      .lean();
  }

  /**
   * Reject / Decline incoming message request
   */
  async rejectMessageRequest(userId, conversationId) {
    const conv = await Conversation.findOne({
      _id: conversationId,
      'members.user': userId
    });

    if (!conv) {
      const err = new Error('Conversation not found or access denied.');
      err.statusCode = 404;
      throw err;
    }

    await Message.deleteMany({ conversation: conversationId });
    await Conversation.findByIdAndDelete(conversationId);

    return { success: true, message: 'Message request declined and removed.' };
  }
}

module.exports = new ChatService();

