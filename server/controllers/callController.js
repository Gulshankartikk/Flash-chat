const callService = require('../services/callService');
const Call = require('../models/Call');
const logger = require('../utils/logger');

/**
 * GET /api/calls - Paginated call history for current user
 */
const getCallHistory = async (req, res, next) => {
  try {
    const { cursor, limit } = req.query;
    const result = await callService.getCallHistory(req.user._id, { cursor, limit });
    return res.status(200).json({
      success: true,
      data: result.calls,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore
    });
  } catch (err) {
    logger.error({ err: err.message, userId: req.user?._id }, 'Error getting call history');
    next(err);
  }
};

/**
 * GET /api/calls/:id - Get single call by ID
 */
const getCallById = async (req, res, next) => {
  try {
    const call = await Call.findById(req.params.id)
      .populate('caller', '_id name username avatar isOnline lastSeen')
      .populate('participants.user', '_id name username avatar isOnline lastSeen')
      .populate('conversation', '_id name avatar type');

    if (!call) {
      return res.status(404).json({ success: false, message: 'Call not found' });
    }

    const isParticipant = call.participants.some(
      (p) => String(p.user._id || p.user) === String(req.user._id)
    );

    if (!isParticipant) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    return res.status(200).json({ success: true, data: call });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/calls/:id - Remove call from user's history
 */
const deleteCallHistoryItem = async (req, res, next) => {
  try {
    const result = await callService.deleteCallFromHistory(req.params.id, req.user._id);
    return res.status(200).json({ success: true, message: 'Call removed from history', data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/calls/ice-config - Return STUN and TURN server configs
 */
const getIceConfig = async (req, res, next) => {
  try {
    const iceServers = callService.getIceServers(req.user?._id);
    return res.status(200).json({
      success: true,
      data: {
        iceServers
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCallHistory,
  getCallById,
  deleteCallHistoryItem,
  getIceConfig
};
