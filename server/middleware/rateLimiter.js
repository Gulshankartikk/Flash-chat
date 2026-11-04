const rateLimit = require('express-rate-limit');

/**
 * Standard key generator: per user ID if authenticated, otherwise per IP address
 */
const keyGenerator = (req) => {
  return req.user?._id ? `user_${req.user._id}` : req.ip;
};

/**
 * Standard handler for 429 rate limit exceeded
 */
const createHandler = (message) => (req, res, next, options) => {
  const retryAfterSeconds = Math.ceil((options.windowMs) / 1000);
  res.set('Retry-After', String(retryAfterSeconds));
  res.status(options.statusCode || 429).json({
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message,
    retryAfter: retryAfterSeconds
  });
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 300 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: createHandler('Too many requests. Please slow down.')
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 20 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: createHandler('Too many authentication attempts. Please try again after 15 minutes.')
});

const mailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 OTP emails/SMS per hour
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: createHandler('OTP request limit exceeded. Please wait before requesting additional verification codes.')
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 uploads per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: createHandler('Upload rate limit reached. Please wait before uploading more media.')
});

const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 exports per hour
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: createHandler('Export limit exceeded. You can request up to 5 vault exports per hour.')
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 AI calls per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: createHandler('AI request rate limit reached. Please wait a moment before sending more queries.')
});

const pushLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 subscription actions per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: createHandler('Push subscription rate limit exceeded.')
});

const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 search queries per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: createHandler('Search rate limit reached. Please slow down.')
});

const pocketPinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: createHandler('Too many PIN verification attempts. Please try again after 15 minutes.')
});

const pocketExportLimiter = exportLimiter;

const chatByPhoneLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 phone lookups/chats per hour
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: createHandler('You have reached the limit of 30 phone lookups per hour. Please wait a while before trying again.')
});

const dailyLookupLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 100, // 100 lookups per day
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: createHandler('Daily lookup cap reached (100 lookups/day). Please try again tomorrow.')
});

module.exports = {
  apiLimiter,
  authLimiter,
  mailLimiter,
  uploadLimiter,
  exportLimiter,
  aiLimiter,
  pushLimiter,
  searchLimiter,
  pocketPinLimiter,
  pocketExportLimiter,
  chatByPhoneLimiter,
  dailyLookupLimiter
};
