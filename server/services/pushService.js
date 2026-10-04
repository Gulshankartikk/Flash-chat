const webpush = require('web-push');
const config = require('../config/env');
const User = require('../models/User');
const PushSubscription = require('../models/PushSubscription');
const logger = require('../utils/logger');
const redisClient = require('../config/redis');

// In-memory rate limiting map: userId -> [timestamps]
const pushRateLimitMap = new Map();

// Initialize web-push if VAPID keys are configured
let isPushConfigured = false;
if (config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      config.VAPID_SUBJECT || 'mailto:support@flashchat.io',
      config.VAPID_PUBLIC_KEY,
      config.VAPID_PRIVATE_KEY
    );
    isPushConfigured = true;
    logger.info('Web Push (VAPID) service initialized successfully');
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to initialize Web Push with provided VAPID keys');
  }
} else {
  logger.info('VAPID keys not configured. Web Push running in simulation mode.');
}

/**
 * Check if current time falls within user's quiet hours
 */
const isQuietHours = (quietHours) => {
  if (!quietHours || !quietHours.enabled) return false;

  try {
    const now = new Date();
    // Use user timezone if valid, otherwise UTC
    const userTimeStr = now.toLocaleTimeString('en-US', {
      timeZone: quietHours.timezone || 'UTC',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });

    const [curHour, curMin] = userTimeStr.split(':').map(Number);
    const [startHour, startMin] = quietHours.start.split(':').map(Number);
    const [endHour, endMin] = quietHours.end.split(':').map(Number);

    const curTotal = curHour * 60 + curMin;
    const startTotal = startHour * 60 + startMin;
    const endTotal = endHour * 60 + endMin;

    if (startTotal <= endTotal) {
      return curTotal >= startTotal && curTotal < endTotal;
    } else {
      // Crosses midnight (e.g. 22:00 to 07:00)
      return curTotal >= startTotal || curTotal < endTotal;
    }
  } catch (e) {
    return false;
  }
};

/**
 * Rate limit push notifications per user (max 30 per minute)
 */
const isPushRateLimited = async (userId) => {
  const windowMs = 60 * 1000;
  const maxPushes = 30;

  if (redisClient && redisClient.status === 'ready') {
    try {
      const key = `ratelimit:push:${userId}`;
      const count = await redisClient.incr(key);
      if (count === 1) {
        await redisClient.expire(key, 60);
      }
      return count > maxPushes;
    } catch (e) {
      // Fallback to memory
    }
  }

  const now = Date.now();
  let timestamps = pushRateLimitMap.get(String(userId)) || [];
  timestamps = timestamps.filter((t) => now - t < windowMs);

  if (timestamps.length >= maxPushes) {
    return true;
  }

  timestamps.push(now);
  pushRateLimitMap.set(String(userId), timestamps);
  return false;
};

class PushService {
  getPublicKey() {
    return config.VAPID_PUBLIC_KEY || '';
  }

  /**
   * Send push notification to all subscriptions of a specific user
   */
  async sendToUser(userId, payload) {
    try {
      if (!userId) return { success: false, reason: 'missing_user_id' };

      // 1. Fetch user push settings
      const user = await User.findById(userId).select('pushSettings isOnline').lean();
      if (!user) return { success: false, reason: 'user_not_found' };

      const settings = user.pushSettings || {};
      if (settings.pushEnabled === false) {
        return { success: false, reason: 'push_disabled_by_user' };
      }

      // Check category-specific opt-out
      if (payload.category === 'chat' && settings.pushMessages === false) {
        return { success: false, reason: 'message_push_disabled' };
      }
      if (payload.category === 'call' && settings.pushCalls === false) {
        return { success: false, reason: 'call_push_disabled' };
      }
      if (payload.category === 'social' && settings.pushSocial === false) {
        return { success: false, reason: 'social_push_disabled' };
      }

      // Check quiet hours (calls bypass quiet hours)
      if (payload.category !== 'call' && isQuietHours(settings.quietHours)) {
        return { success: false, reason: 'quiet_hours_active' };
      }

      // Check rate limits
      if (await isPushRateLimited(userId)) {
        logger.warn({ userId }, 'Push notification dropped due to per-user rate limit');
        return { success: false, reason: 'rate_limited' };
      }

      // 2. Fetch all registered subscriptions for the user
      const subscriptions = await PushSubscription.find({ user: userId });
      if (!subscriptions || subscriptions.length === 0) {
        return { success: false, reason: 'no_subscriptions' };
      }

      // 3. Format payload
      const notificationData = {
        title: payload.title || 'Flash Chat',
        body: payload.body || '',
        icon: payload.icon || '/icons/icon-192.png',
        badge: payload.badge || '/icons/badge-72.png',
        tag: payload.tag || 'flash-chat-default',
        renotify: payload.renotify !== false,
        data: {
          url: payload.data?.url || '/chats',
          type: payload.data?.type || 'general',
          timestamp: Date.now(),
          ...payload.data
        }
      };

      const payloadString = JSON.stringify(notificationData);

      // If running without real VAPID keys, log simulation and return
      if (!isPushConfigured) {
        logger.debug(
          { userId, subsCount: subscriptions.length, tag: notificationData.tag },
          'Simulated Web Push notification sent'
        );
        return { success: true, deliveredCount: subscriptions.length, simulated: true };
      }

      // 4. Send to all endpoints concurrently
      const results = await Promise.allSettled(
        subscriptions.map(async (sub) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: sub.keys
              },
              payloadString,
              {
                TTL: payload.category === 'call' ? 60 : 24 * 3600, // Calls expire after 60s
                urgency: payload.category === 'call' ? 'high' : 'normal'
              }
            );
            await PushSubscription.updateOne({ _id: sub._id }, { lastUsedAt: new Date() });
            return { endpoint: sub.endpoint, success: true };
          } catch (err) {
            // Handle dead/expired subscriptions (404 Not Found or 410 Gone)
            if (err.statusCode === 404 || err.statusCode === 410) {
              logger.info({ endpoint: sub.endpoint }, 'Cleaning up expired push subscription');
              await PushSubscription.deleteOne({ _id: sub._id });
            }
            throw err;
          }
        })
      );

      const successful = results.filter((r) => r.status === 'fulfilled').length;
      return { success: successful > 0, deliveredCount: successful };
    } catch (error) {
      logger.error({ err: error.message, userId }, 'Error in PushService.sendToUser');
      return { success: false, error: error.message };
    }
  }

  /**
   * Helper: Send push for new chat message
   */
  async sendChatMessagePush({ recipientId, sender, conversation, message, isOnline = false }) {
    // Suppress push if user is currently online on websocket
    if (isOnline) {
      return { success: false, reason: 'user_online' };
    }

    // Check conversation-level mute
    const memberSetting = conversation?.members?.find(
      (m) => String(m.user) === String(recipientId)
    );
    if (memberSetting?.isMuted) {
      return { success: false, reason: 'conversation_muted' };
    }

    const isGroup = conversation?.isGroup;
    const title = isGroup
      ? `${conversation.name || 'Group'} • ${sender.name || sender.username}`
      : sender.name || sender.username || 'New Message';

    // Privacy check: message previews
    let body = 'Sent a message';
    if (message.type === 'text' && message.text) {
      body = message.text.length > 80 ? message.text.substring(0, 80) + '...' : message.text;
    } else if (message.type === 'image') {
      body = '📷 Photo';
    } else if (message.type === 'video') {
      body = '🎥 Video';
    } else if (message.type === 'voice' || message.type === 'audio') {
      body = '🎤 Voice message';
    } else if (message.type === 'document') {
      body = '📄 Document';
    } else if (message.type === 'location') {
      body = '📍 Location shared';
    } else if (message.type.startsWith('shared_')) {
      body = '🔗 Shared content';
    }

    return this.sendToUser(recipientId, {
      category: 'chat',
      title,
      body,
      tag: `conv_${conversation._id}`,
      data: {
        url: `/chats/${conversation._id}`,
        type: 'chat_message',
        conversationId: String(conversation._id),
        senderId: String(sender._id)
      }
    });
  }

  /**
   * Helper: Send push for incoming WebRTC call
   */
  async sendCallPush({ recipientId, caller, callId, callType = 'video' }) {
    return this.sendToUser(recipientId, {
      category: 'call',
      title: `📞 Incoming ${callType === 'video' ? 'Video' : 'Audio'} Call`,
      body: `${caller.name || caller.username || 'Someone'} is calling you...`,
      tag: 'call_incoming',
      renotify: true,
      data: {
        url: `/chats?callId=${callId}`,
        type: 'incoming_call',
        callId,
        callerId: String(caller._id)
      }
    });
  }

  /**
   * Helper: Send push for social actions (follow, comment, mention)
   */
  async sendSocialPush({ recipientId, actor, type, previewText = '', url = '/social' }) {
    let title = 'Flash Social';
    let body = `${actor.name || actor.username} interacted with you`;

    if (type === 'follow') {
      title = 'New Follower';
      body = `${actor.name || actor.username} started following you.`;
    } else if (type === 'follow_request') {
      title = 'Follow Request';
      body = `${actor.name || actor.username} requested to follow you.`;
    } else if (type === 'follow_accept') {
      title = 'Follow Accepted';
      body = `${actor.name || actor.username} accepted your follow request.`;
    } else if (type === 'like_post') {
      title = 'New Like';
      body = `${actor.name || actor.username} liked your post.`;
    } else if (type === 'comment') {
      title = 'New Comment';
      body = `${actor.name || actor.username}: "${previewText.substring(0, 60)}"`;
    } else if (type === 'mention') {
      title = 'Mention in Comment';
      body = `${actor.name || actor.username} mentioned you in a comment.`;
    }

    return this.sendToUser(recipientId, {
      category: 'social',
      title,
      body,
      tag: `social_${type}_${actor._id}`,
      data: {
        url,
        type: 'social_notification'
      }
    });
  }
}

module.exports = new PushService();
