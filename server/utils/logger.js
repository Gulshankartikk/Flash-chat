const pino = require('pino');
const config = require('../config/env');

const isDev = config.NODE_ENV === 'development';

const logger = pino({
  level: config.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-pocket-token"]',
      'password',
      'passwordHash',
      'pocketPinHash',
      'pin',
      'otp',
      'passphrase',
      'refreshToken',
      'accessToken',
      'clientSecret',
      'GEMINI_API_KEY',
      'CLOUDINARY_API_SECRET',
      'VAPID_PRIVATE_KEY',
      'GMAIL_APP_PASSWORD',
      'JWT_SECRET',
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET'
    ],
    censor: '***REDACTED***'
  },
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname'
        }
      }
    : undefined
});

/**
 * Mask email address for safe logging: "j***e@domain.com"
 * @param {string} email
 * @returns {string}
 */
logger.maskEmail = (email) => {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return '***';
  }
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
};

module.exports = logger;
