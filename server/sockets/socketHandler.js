const jwt = require('jsonwebtoken');
const { createAdapter } = require('@socket.io/redis-adapter');
const config = require('../config/env');
const redisClient = require('../config/redis');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const chatService = require('../services/chatService');
const { registerCallHandlers, handleCallDisconnect } = require('./callSocket');
const logger = require('../utils/logger');

// In-memory active sockets map: userId -> Set of socket IDs
const onlineUserSockets = new Map();

// Per-user rate limiting map: userId -> [timestamp]
const userMessageRateMap = new Map();

const isRateLimited = (userId) => {
  const now = Date.now();
  const windowMs = 5000;
  const maxMessages = 15; // Max 15 messages per 5 seconds

  let timestamps = userMessageRateMap.get(userId) || [];
  timestamps = timestamps.filter((t) => now - t < windowMs);

  if (timestamps.length >= maxMessages) {
    return true;
  }

  timestamps.push(now);
  userMessageRateMap.set(userId, timestamps);
  return false;
};

const initSocketIO = (io) => {
  // Attach Redis adapter if Redis is connected
  if (redisClient && redisClient.status === 'ready') {
    try {
      const pubClient = redisClient;
      const subClient = pubClient.duplicate();
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Socket.IO Redis adapter enabled for horizontal clustering');
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to attach Redis adapter. Running in memory mode.');
    }
  }

  // Socket Authentication Middleware
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token;

      // Extract from Authorization header
      if (!token && socket.handshake.headers.authorization) {
        const parts = socket.handshake.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
          token = parts[1];
        }
      }

      // Extract from Cookie header
      if (!token && socket.handshake.headers.cookie) {
        const cookieHeader = socket.handshake.headers.cookie;
        const match =
          cookieHeader.match(/refreshToken=([^;]+)/) ||
          cookieHeader.match(/token=([^;]+)/);
        if (match) token = match[1];
      }

      if (!token) {
        return next(new Error('Authentication required for socket connection.'));
      }

      let decoded;
      const accessSecret = config.JWT_ACCESS_SECRET || config.JWT_SECRET;
      const refreshSecret = config.JWT_REFRESH_SECRET || (config.JWT_SECRET + '_refresh');

      try {
        decoded = jwt.verify(token, accessSecret);
      } catch (e1) {
        try {
          decoded = jwt.verify(token, refreshSecret);
        } catch (e2) {
          decoded = jwt.verify(token, config.JWT_SECRET);
        }
      }

      const user = await User.findById(decoded.id)
        .select('_id name username avatar isOnline lastSeen privacy')
        .lean();

      if (!user) {
        return next(new Error('User not found.'));
      }

      socket.user = user;
      next();
    } catch (err) {
      logger.warn({ err: err.message }, 'Socket.IO authentication failed');
      next(new Error('Invalid authorization token.'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    logger.info({ userId, socketId: socket.id }, 'Socket connected');

    // Track active connection
    if (!onlineUserSockets.has(userId)) {
      onlineUserSockets.set(userId, new Set());
    }
    onlineUserSockets.get(userId).add(socket.id);

    // 1. Join personal room "user:<id>"
    socket.join(`user:${userId}`);

    // 2. Join all user conversation rooms "conv:<id>"
    try {
      const userConvs = await Conversation.find({ 'members.user': userId }).select('_id');
      userConvs.forEach((c) => {
        socket.join(`conv:${c._id}`);
      });
    } catch (err) {
      logger.warn({ err: err.message }, 'Error auto-joining conversation rooms');
    }

    // 3. Update presence if first active connection
    if (onlineUserSockets.get(userId).size === 1) {
      await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });

      // Respect lastSeen privacy when broadcasting
      const shouldBroadcast = socket.user.privacy?.lastSeen !== 'nobody';
      if (shouldBroadcast) {
        io.emit('presence:update', {
          userId,
          isOnline: true,
          lastSeen: new Date()
        });
      }
    }

    // Send online users list to connecting client
    const onlineList = Array.from(onlineUserSockets.keys());
    socket.emit('users:online_list', onlineList);

    // Register Call & WebRTC signaling handlers
    registerCallHandlers(io, socket, { onlineUserSockets });

    // -------------------------------------------------------------------------
    // Event: message:send
    // -------------------------------------------------------------------------
    socket.on('message:send', async (payload, ack) => {
      try {
        if (isRateLimited(userId)) {
          if (ack) ack({ success: false, message: 'Message rate limit exceeded. Slow down.' });
          return;
        }

        const message = await chatService.sendMessage(userId, payload);

        // Broadcast to conversation room
        io.to(`conv:${payload.conversationId}`).emit('message:new', message);

        // Check if recipient is online in direct chats and auto-mark delivered
        const conv = await Conversation.findById(payload.conversationId).lean();
        if (conv) {
          conv.members.forEach((m) => {
            const memberIdStr = String(m.user);
            if (memberIdStr !== userId) {
              // Notify user's personal room for conversation list update
              io.to(`user:${memberIdStr}`).emit('conversation:updated', {
                conversationId: conv._id,
                lastMessage: message
              });

              // If recipient online, mark delivered
              if (onlineUserSockets.has(memberIdStr)) {
                chatService.markDelivered(memberIdStr, conv._id, message._id);
                io.to(`conv:${conv._id}`).emit('message:status', {
                  conversationId: conv._id,
                  messageId: message._id,
                  status: 'delivered',
                  userId: memberIdStr
                });
              }
            }
          });
        }

        if (ack) ack({ success: true, message });
      } catch (err) {
        logger.error({ err: err.message }, 'Socket message:send error');
        if (ack) ack({ success: false, message: err.message });
      }
    });

    // -------------------------------------------------------------------------
    // Event: message:delivered
    // -------------------------------------------------------------------------
    socket.on('message:delivered', async ({ conversationId, messageId }) => {
      try {
        await chatService.markDelivered(userId, conversationId, messageId);
        socket.to(`conv:${conversationId}`).emit('message:status', {
          conversationId,
          messageId,
          status: 'delivered',
          userId
        });
      } catch (err) {
        logger.warn({ err: err.message }, 'Socket message:delivered error');
      }
    });

    // -------------------------------------------------------------------------
    // Event: message:read
    // -------------------------------------------------------------------------
    socket.on('message:read', async ({ conversationId, upToMessageId }) => {
      try {
        await chatService.markRead(userId, conversationId, upToMessageId);

        // Check user read receipt privacy
        const userDoc = await User.findById(userId).select('privacy privacySettings').lean();
        const allowsReceipts =
          userDoc?.privacy?.readReceipts ?? userDoc?.privacySettings?.readReceipts ?? true;

        if (allowsReceipts) {
          socket.to(`conv:${conversationId}`).emit('message:status', {
            conversationId,
            upToMessageId,
            status: 'read',
            userId
          });
        }
      } catch (err) {
        logger.warn({ err: err.message }, 'Socket message:read error');
      }
    });

    // -------------------------------------------------------------------------
    // Event: typing:start & typing:stop
    // -------------------------------------------------------------------------
    socket.on('typing:start', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing', {
        conversationId,
        userId,
        userName: socket.user.name || socket.user.username,
        isTyping: true
      });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conv:${conversationId}`).emit('typing', {
        conversationId,
        userId,
        isTyping: false
      });
    });

    // -------------------------------------------------------------------------
    // Event: message:edit
    // -------------------------------------------------------------------------
    socket.on('message:edit', async ({ conversationId, messageId, text }, ack) => {
      try {
        const updated = await chatService.editMessage(userId, messageId, text);
        io.to(`conv:${conversationId}`).emit('message:updated', updated);
        if (ack) ack({ success: true, message: updated });
      } catch (err) {
        if (ack) ack({ success: false, message: err.message });
      }
    });

    // -------------------------------------------------------------------------
    // Event: message:delete
    // -------------------------------------------------------------------------
    socket.on('message:delete', async ({ conversationId, messageId, scope }, ack) => {
      try {
        const result = await chatService.deleteMessage(userId, messageId, scope);
        if (scope === 'everyone') {
          io.to(`conv:${conversationId}`).emit('message:deleted', {
            conversationId,
            messageId
          });
        }
        if (ack) ack({ success: true, result });
      } catch (err) {
        if (ack) ack({ success: false, message: err.message });
      }
    });

    // -------------------------------------------------------------------------
    // Event: message:react
    // -------------------------------------------------------------------------
    socket.on('message:react', async ({ conversationId, messageId, emoji }, ack) => {
      try {
        const updated = await chatService.reactToMessage(userId, messageId, emoji);
        io.to(`conv:${conversationId}`).emit('message:updated', updated);
        if (ack) ack({ success: true, message: updated });
      } catch (err) {
        if (ack) ack({ success: false, message: err.message });
      }
    });

    // -------------------------------------------------------------------------
    // Disconnect
    // -------------------------------------------------------------------------
    socket.on('disconnect', async () => {
      const userSockets = onlineUserSockets.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUserSockets.delete(userId);
          const lastSeen = new Date();
          await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });

          // Start 15s grace period for any active call
          handleCallDisconnect(io, userId);

          const shouldBroadcast = socket.user.privacy?.lastSeen !== 'nobody';
          if (shouldBroadcast) {
            io.emit('presence:update', { userId, isOnline: false, lastSeen });
          }
        }
      }
      logger.info({ userId, socketId: socket.id }, 'Socket disconnected');
    });
  });

  return io;
};

module.exports = {
  initSocketIO,
  onlineUserSockets
};
