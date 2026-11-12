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
const { initScheduler, stopScheduler } = require('./services/schedulerService');

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
const aiRoutes = require('./routes/aiRoutes');
const contactRoutes = require('./routes/contactRoutes');
const supportRoutes = require('./routes/supportRoutes');
const adminSupportRoutes = require('./routes/adminSupportRoutes');
const pocketService = require('./services/pocketService');
const redisService = require('./services/redisService');

const app = express();
const server = http.createServer(app);

// Trust reverse proxies (Render, Cloudflare, Vercel, AWS ALB) for correct client IP & HTTPS detection
app.set('trust proxy', 1);

// Parse allowed client origins from environment with local dev fallbacks
const getAllowedOrigins = () => {
  const configured = (config.CLIENT_URL || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);

  const localDefaults = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000'
  ];

  return Array.from(new Set([...configured, ...localDefaults]));
};

const isOriginAllowed = (origin) => {
  if (!origin) return true; // Allow mobile apps, curl, server-to-server health checks

  const allowed = getAllowedOrigins().map((u) => {
    try {
      return new URL(u).origin;
    } catch (_) {
      return u;
    }
  });

  try {
    const originUrl = new URL(origin);
    if (allowed.includes(originUrl.origin)) {
      return true;
    }
    // Automatically allow Vercel preview & production deployments
    if (originUrl.hostname.endsWith('.vercel.app')) {
      return true;
    }
    // Allow Render deployments
    if (originUrl.hostname.endsWith('.onrender.com')) {
      return true;
    }
  } catch (_) {
    return false;
  }
  return false;
};

// Initialize Socket.IO with perMessageDeflate tuning and CORS
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Socket.IO: Origin not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
  },
  transports: ['websocket', 'polling'],
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
initScheduler(io);

// Pass io to Express requests
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Security & Performance Middlewares with CSP Policy
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://res.cloudinary.com',
          'https://api.dicebear.com',
          'https://*.googleusercontent.com'
        ],
        mediaSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
        connectSrc: ["'self'", 'ws:', 'wss:', 'http:', 'https:'],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"]
      }
    }
  })
);

// Explicit Permissions-Policy for WebRTC calling & device features
app.use((req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(self), microphone=(self), geolocation=(self), payment=()'
  );
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        logger.warn({ origin }, 'CORS: Blocked unauthorized origin');
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Pocket-Token']
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

// CSRF Protection on mutating requests
const csrfProtection = (req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const origin = req.headers.origin || req.headers.referer;
    if (!origin && req.cookies?.refreshToken) {
      return res.status(403).json({
        success: false,
        code: 'CSRF_ORIGIN_REQUIRED',
        message: 'Cross-site request blocked.'
      });
    }
    if (origin && !isOriginAllowed(origin)) {
      logger.warn({ origin }, 'CSRF: Blocked cross-origin request');
      return res.status(403).json({
        success: false,
        code: 'CSRF_ORIGIN_MISMATCH',
        message: 'Cross-site request blocked.'
      });
    }
  }
  next();
};

app.use(csrfProtection);

// HTTP Request Logger
app.use(loggerMiddleware);

// Static uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health Check Endpoint (Render, Docker, AWS ALB & K8s probes)
const healthCheckHandler = (req, res) => {
  const mongoose = require('mongoose');
  const redisClient = require('./config/redis');
  const memory = process.memoryUsage();

  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const redisStatus = redisClient && redisClient.status === 'ready' ? 'connected' : 'disconnected';

  const pkg = require('./package.json');
  res.status(200).json({
    status: 'healthy',
    service: 'Flash Chat Server',
    version: pkg.version || '1.1.0',
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
    services: {
      mongodb: mongoStatus,
      redis: redisStatus,
      mailer: {
        mode: mailer.authMode,
        ready: mailer.isReady
      }
    },
    memory: {
      rssMB: Math.round(memory.rss / 1024 / 1024),
      heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024)
    }
  });
};

app.get('/health', healthCheckHandler);
app.get('/api/health', healthCheckHandler);

// Readiness Probe Endpoint
app.get('/api/ready', (req, res) => {
  const mongoose = require('mongoose');
  const isMongoReady = mongoose.connection.readyState === 1;

  if (isMongoReady) {
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({
      status: 'not_ready',
      message: 'Database is connecting'
    });
  }
});

const pushRoutes = require('./routes/pushRoutes');

// API Routes with rate limiter
app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/conversations', chatRoutes);
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
app.use('/api/ai', aiRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/admin/support', adminSupportRoutes);
app.use('/api/push', pushRoutes);
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

    // Clean up any stale online presence flags from previous crashes/restarts
    try {
      const User = require('./models/User');
      await User.updateMany({ isOnline: true }, { isOnline: false });
      logger.info('Cleaned up stale online presence flags on server start');
    } catch (e) {
      logger.warn({ err: e.message }, 'Failed to reset stale online flags');
    }

    // 2. Verify Nodemailer SMTP at server startup (Item 4 Requirement)
    await mailer.verifyConnection();

    // 3. Start Scheduled Pocket Trash Cleanup
    schedulePocketTrashCleanup();

    // 4. Start HTTP + Socket.IO Server
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${config.PORT} is currently in use. Please ensure previous instances are terminated.`);
      } else {
        logger.fatal({ err: err.message }, 'Server encountered an unexpected error');
      }
    });

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

// Graceful Shutdown (Item 5 Requirement: close server, DB, mailer, and redis)
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Gracefully shutting down...`);

  server.close(async () => {
    logger.info('HTTP & Socket.IO server closed.');
    try {
      stopScheduler();
      await mailer.close();
      const mongoose = require('mongoose');
      await mongoose.connection.close(false);
      logger.info('MongoDB connection closed.');

      const redisClient = require('./config/redis');
      if (redisClient && typeof redisClient.quit === 'function') {
        await redisClient.quit();
        logger.info('Redis connection closed.');
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'Error during graceful cleanup');
    }
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
