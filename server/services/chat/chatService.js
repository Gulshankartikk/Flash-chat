const Chat = require('../../models/Chat');
const Message = require('../../models/Message');
const User = require('../../models/User');
const redisClient = require('../../config/redis');
const logger = require('../../utils/logger');

class ChatService {
  /**
   * Fetch chats for a user with lean query and populated minimal user fields
   * @param {string} userId
   */
  async getUserChats(userId) {
    const cacheKey = `user:${userId}:chats`;

    if (redisClient) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (err) {
        logger.warn({ err: err.message }, 'Redis get chat cache failed');
      }
    }

    const chats = await Chat.find({ participants: userId })
      .populate('participants', '_id name email avatar isOnline lastSeen bio')
      .populate('groupAdmin', '_id name email avatar')
      .populate({
        path: 'latestMessage',
        select: 'content mediaUrl mediaType sender createdAt readBy deliveredTo isDeleted',
        populate: {
          path: 'sender',
          select: '_id name avatar'
        }
      })
      .sort({ updatedAt: -1 })
      .lean();

    if (redisClient && chats.length > 0) {
      try {
        // Cache for 30 seconds
        await redisClient.setex(cacheKey, 30, JSON.stringify(chats));
      } catch (err) {
        logger.warn({ err: err.message }, 'Redis set chat cache failed');
      }
    }

    return chats;
  }

  /**
   * Invalidate chat cache for participants
   * @param {Array<string>} userIds
   */
  async invalidateChatCache(userIds) {
    if (!redisClient || !userIds || userIds.length === 0) return;
    try {
      const keys = userIds.map((id) => `user:${id}:chats`);
      await redisClient.del(...keys);
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to invalidate chat cache');
    }
  }

  /**
   * Fetch messages with cursor-based pagination
   * Cursor is the `createdAt` timestamp or `_id` of the oldest message currently on client.
   * @param {string} chatId
   * @param {string|null} before - ISO date or timestamp cursor
   * @param {number} limit
   */
  async getMessagesCursor(chatId, before = null, limit = 30) {
    const query = { chatId, isDeleted: false };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    // Retrieve newest first up to limit + 1 to detect hasMore
    const messages = await Message.find(query)
      .populate('sender', '_id name avatar')
      .populate('replyTo', '_id content sender mediaType isDeleted')
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;

    // Return in chronological order (oldest to newest) for UI rendering
    items.reverse();

    const nextCursor = items.length > 0 ? items[0].createdAt.toISOString() : null;

    return {
      messages: items,
      hasMore,
      nextCursor
    };
  }
}

module.exports = new ChatService();
