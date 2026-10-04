const logger = require('../utils/logger');

/**
 * Middleware: Verify user has globally enabled AI features
 */
const requireAiEnabled = (req, res, next) => {
  if (req.user?.aiSettings && req.user.aiSettings.aiEnabled === false) {
    return res.status(403).json({
      success: false,
      code: 'AI_DISABLED',
      message: 'AI features are currently disabled in your profile privacy settings.'
    });
  }
  next();
};

/**
 * Middleware: Verify user has allowed AI in chats
 */
const requireAiInChats = (req, res, next) => {
  if (req.user?.aiSettings && req.user.aiSettings.aiInChats === false) {
    return res.status(403).json({
      success: false,
      code: 'AI_CHATS_DISABLED',
      message: 'AI chat enhancements (summaries, smart replies) are disabled in your settings.'
    });
  }
  next();
};

/**
 * Middleware: Verify user has explicitly opted-in to AI accessing Pocket vault items
 */
const requireAiUsesPocket = (req, res, next) => {
  if (!req.user?.aiSettings || req.user.aiSettings.aiUsesPocket !== true) {
    return res.status(403).json({
      success: false,
      code: 'AI_POCKET_OPT_IN_REQUIRED',
      message: 'You must opt-in to "Allow AI to search your Pocket" in Settings > Privacy to use this feature.'
    });
  }
  next();
};

module.exports = {
  requireAiEnabled,
  requireAiInChats,
  requireAiUsesPocket
};
