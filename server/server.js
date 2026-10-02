const http = require('http');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const { Server } = require('socket.io');

const config = require('./config/env');
const connectDB = require('./config/db');
const logger = require('./utils/logger');
const loggerMiddleware = require('./middleware/loggerMiddleware');
const { apiLimiter } = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');
const mailer = require('./services/mailer/mailerService');
const { initSocketIO } = require('./sockets/socketHandler');

// Route imports
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const messageRoutes = require('./routes/messageRoutes');
const userRoutes = require('./routes/userRoutes');
const mailRoutes = require('./routes/mailRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const callRoutes = require('./routes/callRoutes');
const followRoutes = require('./routes/followRoutes');
const postRoutes = require('./routes/postRoutes');
const reelRoutes = require('./routes/reelRoutes');
const storyRoutes = require('./routes/storyRoutes');
const commentRoutes = require('./routes/commentRoutes');
const exploreRoutes = require('./routes/exploreRoutes');
const shareRoutes = require('./routes/shareRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const pocketRoutes = require('./routes/pocketRoutes');
const pocketService = require('./services/pocketService');
const redisService = require('./services/redisService');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with perMessageDeflate tuning and CORS
const io = new Server(server, {
  cors: {
    origin: [config.CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
  },
  perMessageDeflate: {
    threshold: 1024, // only compress messages > 1KB
    zlibDeflateOptions: {
      chunkSize: 8 * 1024
    }
  },
  pingTimeout: 20000,
  pingInterval: 25000
});

initSocketIO(io);

// Pass io to Express requests
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Security & Performance Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

app.use(
  cors({
    origin: [config.CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Gzip / Brotli compression
app.use(compression());

// Body Parsers & Cookie Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Express Mongo Sanitize (prevent NoSQL injection)
app.use(mongoSanitize());

// HTTP Request Logger
app.use(loggerMiddleware);

// Static uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health Check Endpoint (Item 7 Requirement)
app.get('/api/health', (req, res) => {
  const memory = process.memoryUsage();
  res.status(200).json({
    status: 'healthy',
    service: 'Flash Chat Server',
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
    mailer: {
      mode: mailer.authMode,
      ready: mailer.isReady
    },
    memory: {
      rssMB: Math.round(memory.rss / 1024 / 1024),
      heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024)
    }
  });
});

// API Routes with rate limiter
app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/mail', mailRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/follow', followRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/reels', reelRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/pocket', pocketRoutes);
app.use('/api', exploreRoutes); // mounts /api/explore, /api/hashtags/:tag, /api/search

// Centralized Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

// Scheduled 30-day Pocket trash automated cleanup with distributed Redis lock
const schedulePocketTrashCleanup = () => {
  const runCleanup = async () => {
    try {
      const lockKey = 'pocket:trash:cleanup_lock';
      const acquired = await redisService.set(lockKey, '1', 'EX', 3600);
      if (acquired) {
        await pocketService.cleanupOldTrash();
      }
    } catch (err) {
      logger.error({ err: err.message }, 'Scheduled Pocket trash cleanup failed');
    }
  };

  // Initial pass after 30 seconds, recurring every 6 hours
  setTimeout(runCleanup, 30000);
  setInterval(runCleanup, 6 * 60 * 60 * 1000);
};

// Server Startup Function
const startServer = async () => {
  try {
    // 1. Connect MongoDB
    await connectDB();

    // 2. Verify Nodemailer SMTP at server startup (Item 4 Requirement)
    await mailer.verifyConnection();

    // 3. Start Scheduled Pocket Trash Cleanup
    schedulePocketTrashCleanup();

    // 4. Start HTTP + Socket.IO Server
    server.listen(config.PORT, () => {
      logger.info(
        `⚡ Flash Chat Server is actively listening on http://localhost:${config.PORT} [${config.NODE_ENV}]`
      );
      logger.info(`🌐 Allowed Client URL: ${config.CLIENT_URL}`);
    });
  } catch (error) {
    logger.fatal({ err: error.message }, 'Server failed to start');
    process.exit(1);
  }
};

startServer();

// Graceful Shutdown (Item 5 Requirement: close server, DB, and mailer pool)
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Gracefully shutting down...`);

  server.close(async () => {
    logger.info('HTTP & Socket.IO server closed.');
    await mailer.close();
    const mongoose = require('mongoose');
    await mongoose.connection.close(false);
    logger.info('MongoDB connection closed.');
    process.exit(0);
  });

  // Force exit after 10s if hung
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, server, io };
