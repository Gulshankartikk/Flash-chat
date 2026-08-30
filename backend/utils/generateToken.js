const jwt = require('jsonwebtoken');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Generates a short-lived access token (15 minutes).
 */
const generateAccessToken = (userId, sessionId) => {
  return jwt.sign(
    { userId, sessionId },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

/**
 * Generates a rotating refresh token (7 days).
 */
const generateRefreshToken = (userId, sessionId) => {
  return jwt.sign(
    { userId, sessionId, type: 'refresh' },
    process.env.REFRESH_TOKEN_SECRET || process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET + '_refresh'),
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
};

const crypto = require('crypto');

/**
 * Generates a unique secure session ID.
 */
const generateSessionId = () => {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
};

// Legacy compatibility
const generateToken = (userId, sessionId) => generateAccessToken(userId, sessionId);

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateToken,
  generateSessionId,
};
