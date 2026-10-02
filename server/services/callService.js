const crypto = require('crypto');
const Call = require('../models/Call');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const redisService = require('./redisService');
const chatService = require('./chatService');
const config = require('../config/env');
const logger = require('../utils/logger');

class CallService {
  /**
   * Set user's currently active call in Redis with 2h TTL
   */
  async setActiveCall(userId, callId) {
    try {
      if (!userId || !callId) return;
      await redisService.set(`call:active:${userId}`, String(callId), 'EX', 7200);
    } catch (err) {
      logger.warn({ err: err.message, userId, callId }, 'Failed to set active call in Redis');
    }
  }

  /**
   * Get user's currently active call ID from Redis
   */
  async getActiveCall(userId) {
    try {
      if (!userId) return null;
      return await redisService.get(`call:active:${userId}`);
    } catch (err) {
      logger.warn({ err: err.message, userId }, 'Failed to get active call from Redis');
      return null;
    }
  }

  /**
   * Clear active call for a user
   */
  async clearActiveCall(userId) {
    try {
      if (!userId) return;
      await redisService.del(`call:active:${userId}`);
    } catch (err) {
      logger.warn({ err: err.message, userId }, 'Failed to clear active call in Redis');
    }
  }

  /**
   * Start a new call record
   */
  async createCall({ conversationId, callerId, type = 'audio' }) {
    const conv = await Conversation.findById(conversationId)
      .populate('members.user', '_id name username avatar isOnline lastSeen privacy')
      .lean();

    if (!conv) {
      throw new Error('Conversation not found.');
    }

    const isMember = conv.members.some((m) => String(m.user._id || m.user) === String(callerId));
    if (!isMember) {
      throw new Error('You are not a member of this conversation.');
    }

    const isGroup = conv.type === 'group';

    // Build participants list
    const participants = conv.members.map((m) => {
      const uid = m.user._id ? m.user._id : m.user;
      const isCaller = String(uid) === String(callerId);
      return {
        user: uid,
        status: isCaller ? 'joined' : 'ringing',
        joinedAt: isCaller ? new Date() : null,
        leftAt: null
      };
    });

    const call = await Call.create({
      conversation: conversationId,
      caller: callerId,
      participants,
      type,
      isGroup,
      status: 'ringing',
      startedAt: new Date(),
      endReason: null
    });

    // Mark caller as active in Redis
    await this.setActiveCall(callerId, call._id);

    return await Call.findById(call._id)
      .populate('caller', '_id name username avatar')
      .populate('participants.user', '_id name username avatar isOnline lastSeen')
      .populate('conversation', '_id name avatar type');
  }

  /**
   * Accept an incoming call
   */
  async acceptCall(callId, userId) {
    const call = await Call.findById(callId);
    if (!call) throw new Error('Call not found.');

    if (call.status === 'ended' || call.status === 'declined' || call.status === 'missed') {
      throw new Error(`Call has already ${call.status}.`);
    }

    const participant = call.participants.find(
      (p) => String(p.user) === String(userId)
    );

    if (!participant) {
      throw new Error('User is not a participant in this call.');
    }

    participant.status = 'joined';
    participant.joinedAt = new Date();

    if (!call.answeredAt) {
      call.answeredAt = new Date();
      call.status = 'ongoing';
    }

    await call.save();
    await this.setActiveCall(userId, call._id);

    return await Call.findById(call._id)
      .populate('caller', '_id name username avatar')
      .populate('participants.user', '_id name username avatar isOnline lastSeen')
      .populate('conversation', '_id name avatar type');
  }

  /**
   * Decline an incoming call
   */
  async declineCall(callId, userId, reason = 'declined') {
    const call = await Call.findById(callId);
    if (!call) throw new Error('Call not found.');

    const participant = call.participants.find(
      (p) => String(p.user) === String(userId)
    );

    if (participant) {
      participant.status = reason === 'busy' ? 'declined' : 'declined';
      participant.leftAt = new Date();
    }

    // In 1:1 call, if callee declines or is busy, call ends immediately
    if (!call.isGroup) {
      call.status = reason === 'busy' ? 'busy' : 'declined';
      call.endedAt = new Date();
      call.endReason = reason;

      // Clear caller active state
      await this.clearActiveCall(call.caller);
      await this.clearActiveCall(userId);

      // Insert system message for declined/busy call
      await this.insertCallSystemMessage(call, reason);
    } else {
      // In group call, check if everyone declined or left
      const remaining = call.participants.filter(
        (p) => p.status === 'ringing' || p.status === 'joined'
      );
      if (remaining.length <= 1) {
        call.status = 'ended';
        call.endedAt = new Date();
        call.endReason = 'declined';
        for (const p of call.participants) {
          await this.clearActiveCall(p.user);
        }
        await this.insertCallSystemMessage(call, 'declined');
      }
    }

    await call.save();

    return await Call.findById(call._id)
      .populate('caller', '_id name username avatar')
      .populate('participants.user', '_id name username avatar isOnline lastSeen')
      .populate('conversation', '_id name avatar type');
  }

  /**
   * End a call
   */
  async endCall(callId, userId, reason = 'completed') {
    const call = await Call.findById(callId);
    if (!call) return null;

    if (call.status === 'ended') {
      return call;
    }

    // Calculate duration in seconds
    let duration = 0;
    if (call.answeredAt) {
      duration = Math.max(0, Math.floor((Date.now() - new Date(call.answeredAt).getTime()) / 1000));
    }

    call.status = 'ended';
    call.endedAt = new Date();
    call.duration = duration;
    call.endReason = reason;

    // Update participants
    call.participants.forEach((p) => {
      if (p.status === 'joined' || p.status === 'ringing') {
        p.status = 'left';
        p.leftAt = new Date();
      }
    });

    await call.save();

    // Clear active call state in Redis for all participants
    for (const p of call.participants) {
      await this.clearActiveCall(p.user);
    }
    await this.clearActiveCall(call.caller);

    // Insert system message into conversation
    await this.insertCallSystemMessage(call, reason, duration);

    return await Call.findById(call._id)
      .populate('caller', '_id name username avatar')
      .populate('participants.user', '_id name username avatar isOnline lastSeen')
      .populate('conversation', '_id name avatar type');
  }

  /**
   * Format and insert a system message for the call event into the conversation
   */
  async insertCallSystemMessage(call, reason, duration = 0) {
    try {
      const isVideo = call.type === 'video';
      const callLabel = isVideo ? 'Video call' : 'Voice call';
      let text = '';

      if (duration > 0) {
        const mins = Math.floor(duration / 60).toString().padStart(2, '0');
        const secs = (duration % 60).toString().padStart(2, '0');
        text = `📞 ${callLabel} · ${mins}:${secs}`;
      } else if (reason === 'missed') {
        text = `📵 Missed ${isVideo ? 'video call' : 'voice call'}`;
      } else if (reason === 'declined') {
        text = `📵 Declined ${isVideo ? 'video call' : 'voice call'}`;
      } else if (reason === 'busy') {
        text = `📵 ${callLabel} · Busy`;
      } else if (reason === 'offline') {
        text = `📵 Missed ${isVideo ? 'video call' : 'voice call'} (Offline)`;
      } else if (reason === 'canceled') {
        text = `📵 Canceled ${isVideo ? 'video call' : 'voice call'}`;
      } else {
        text = `📞 ${callLabel}`;
      }

      await chatService.sendMessage(call.caller, {
        conversationId: call.conversation,
        type: 'system',
        text
      });
    } catch (err) {
      logger.warn({ err: err.message, callId: call._id }, 'Failed to insert call system message');
    }
  }

  /**
   * Generate STUN and TURN server credentials
   */
  getIceServers(userId = 'guest') {
    const iceServers = [];

    // Parse STUN servers
    if (config.STUN_URLS) {
      const urls = config.STUN_URLS.split(',')
        .map((u) => u.trim())
        .filter(Boolean);
      if (urls.length > 0) {
        iceServers.push({ urls });
      }
    }

    // Check if time-limited HMAC-SHA1 TURN secret is provided
    if (config.TURN_SECRET && config.TURN_URL) {
      try {
        const expiry = Math.floor(Date.now() / 1000) + 24 * 3600; // 24 hours
        const username = `${expiry}:${userId}`;
        const credential = crypto
          .createHmac('sha1', config.TURN_SECRET)
          .update(username)
          .digest('base64');

        iceServers.push({
          urls: [config.TURN_URL],
          username,
          credential
        });
      } catch (err) {
        logger.warn({ err: err.message }, 'Failed to compute TURN time-limited HMAC credential');
      }
    } else if (config.TURN_URL && config.TURN_USERNAME && config.TURN_CREDENTIAL) {
      // Static long-term TURN credentials
      iceServers.push({
        urls: [config.TURN_URL],
        username: config.TURN_USERNAME,
        credential: config.TURN_CREDENTIAL
      });
    }

    return iceServers;
  }

  /**
   * Get user call history with cursor pagination
   */
  async getCallHistory(userId, { cursor, limit = 30 }) {
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
    const query = {
      'participants.user': userId,
      deletedFor: { $ne: userId }
    };

    if (cursor) {
      query._id = { $lt: cursor };
    }

    const calls = await Call.find(query)
      .sort({ _id: -1 })
      .limit(parsedLimit + 1)
      .populate('caller', '_id name username avatar isOnline lastSeen')
      .populate('participants.user', '_id name username avatar isOnline lastSeen')
      .populate('conversation', '_id name avatar type')
      .lean();

    const hasMore = calls.length > parsedLimit;
    const paginatedCalls = hasMore ? calls.slice(0, parsedLimit) : calls;
    const nextCursor = hasMore ? paginatedCalls[paginatedCalls.length - 1]._id : null;

    return {
      calls: paginatedCalls,
      nextCursor,
      hasMore
    };
  }

  /**
   * Soft-delete call from user's history
   */
  async deleteCallFromHistory(callId, userId) {
    const call = await Call.findById(callId);
    if (!call) throw new Error('Call not found.');

    if (!call.deletedFor.some((id) => String(id) === String(userId))) {
      call.deletedFor.push(userId);
      await call.save();
    }

    return { success: true };
  }
}

module.exports = new CallService();
