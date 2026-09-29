const jwt = require('jsonwebtoken');
const config = require('../config/env');
const User = require('../models/User');
const logger = require('../utils/logger');

// In-memory active sockets map: userId -> Set of socket IDs
const onlineUserSockets = new Map();

const initSocketIO = (io) => {
  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token;

      // Also support cookie parsing if handshake headers have cookie
      if (!token && socket.handshake.headers.cookie) {
        const cookieHeader = socket.handshake.headers.cookie;
        const match = cookieHeader.match(/token=([^;]+)/);
        if (match) {
          token = match[1];
        }
      }

      if (!token) {
        return next(new Error('Authentication required for socket connection'));
      }

      const decoded = jwt.verify(token, config.JWT_SECRET);
      const user = await User.findById(decoded.id).select('_id name email avatar').lean();

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      logger.warn({ error: err.message }, 'Socket authentication failed');
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    logger.info({ userId, socketId: socket.id }, 'User connected to socket');

    // Add socket to user's set of active connections
    if (!onlineUserSockets.has(userId)) {
      onlineUserSockets.set(userId, new Set());
    }
    onlineUserSockets.get(userId).add(socket.id);

    // Join personal room for targeted alerts (e.g. `user:<id>`)
    socket.join(`user:${userId}`);

    // If this is the user's first active connection, broadcast online status
    if (onlineUserSockets.get(userId).size === 1) {
      await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });
      io.emit('user:presence', { userId, isOnline: true, lastSeen: new Date() });
    }

    // Send currently online user IDs to the newly connected socket
    const onlineUserList = Array.from(onlineUserSockets.keys());
    socket.emit('users:online_list', onlineUserList);

    // Join a chat room
    socket.on('chat:join', (chatId) => {
      if (chatId) {
        socket.join(`chat:${chatId}`);
        logger.debug({ userId, chatId }, 'User joined chat room');
      }
    });

    // Leave a chat room
    socket.on('chat:leave', (chatId) => {
      if (chatId) {
        socket.leave(`chat:${chatId}`);
        logger.debug({ userId, chatId }, 'User left chat room');
      }
    });

    // Typing indicators (throttled on client, broadcast to chat room)
    socket.on('typing:start', ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit('typing:status', {
        chatId,
        userId,
        userName: socket.user.name,
        isTyping: true
      });
    });

    socket.on('typing:stop', ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit('typing:status', {
        chatId,
        userId,
        userName: socket.user.name,
        isTyping: false
      });
    });

    // Mark message as delivered
    socket.on('message:delivered', ({ messageId, chatId }) => {
      socket.to(`chat:${chatId}`).emit('message:delivered_receipt', {
        messageId,
        userId
      });
    });

    // Handle Disconnect
    socket.on('disconnect', async () => {
      logger.info({ userId, socketId: socket.id }, 'User disconnected from socket');
      const userSockets = onlineUserSockets.get(userId);

      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUserSockets.delete(userId);
          const lastSeen = new Date();
          await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });
          io.emit('user:presence', { userId, isOnline: false, lastSeen });
        }
      }
    });
  });

  return io;
};

module.exports = {
  initSocketIO,
  onlineUserSockets
};
