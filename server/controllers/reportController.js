const Report = require('../models/Report');
const logger = require('../utils/logger');

/**
 * POST /api/reports - File a report against a post, reel, story, comment, or user
 */
const createReport = async (req, res, next) => {
  try {
    const { targetType, targetId, reason } = req.body;

    if (!targetType || !targetId || !reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'targetType, targetId, and reason are required.'
      });
    }

    const report = await Report.create({
      reporter: req.user._id,
      targetType,
      targetId,
      reason: reason.trim()
    });

    return res.status(201).json({
      success: true,
      message: 'Report submitted successfully. Our team will review it.',
      data: report
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Error creating report');
    next(err);
  }
};

module.exports = {
  createReport
};
