const jwt = require('jsonwebtoken');
const config = require('../config/env');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      const parts = req.headers.authorization.split(' ');
      if (parts[1] && parts[1] !== 'null' && parts[1] !== 'undefined') {
        token = parts[1];
      }
    } else if (req.cookies && (req.cookies.token || req.cookies.refreshToken)) {
      token = req.cookies.token || req.cookies.refreshToken;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        message: 'Authentication required. No token provided.'
      });
    }

    let decoded = null;
    const accessSecret = config.JWT_ACCESS_SECRET || config.JWT_SECRET;
    const refreshSecret = config.JWT_REFRESH_SECRET || (config.JWT_SECRET + '_refresh');

    // Try verifying with access secret first, then refresh secret / legacy secret
    try {
      decoded = jwt.verify(token, accessSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          code: 'TOKEN_EXPIRED',
          message: 'Access token expired. Please refresh token.'
        });
      }
      try {
        decoded = jwt.verify(token, refreshSecret);
      } catch (err2) {
        decoded = jwt.verify(token, config.JWT_SECRET);
      }
    }

    const user = await User.findById(decoded.id).select('-passwordHash').lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session: User not found.'
      });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Session expired. Please log in again.'
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid authorization token.'
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      const parts = req.headers.authorization.split(' ');
      if (parts[1] && parts[1] !== 'null' && parts[1] !== 'undefined') {
        token = parts[1];
      }
    } else if (req.cookies && (req.cookies.token || req.cookies.refreshToken)) {
      token = req.cookies.token || req.cookies.refreshToken;
    }

    if (!token) {
      return next();
    }

    let decoded = null;
    const accessSecret = config.JWT_ACCESS_SECRET || config.JWT_SECRET;
    const refreshSecret = config.JWT_REFRESH_SECRET || (config.JWT_SECRET + '_refresh');

    try {
      decoded = jwt.verify(token, accessSecret);
    } catch (_) {
      try {
        decoded = jwt.verify(token, refreshSecret);
      } catch (_) {
        try {
          decoded = jwt.verify(token, config.JWT_SECRET);
        } catch (_) {}
      }
    }

    if (decoded?.id) {
      const user = await User.findById(decoded.id).select('-passwordHash').lean();
      if (user) {
        req.user = user;
        req.token = token;
      }
    }

    next();
  } catch (_) {
    next();
  }
};

authMiddleware.optional = optionalAuth;
module.exports = authMiddleware;
