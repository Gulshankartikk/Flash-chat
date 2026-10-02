const Notification = require('../models/Notification');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * GET /api/notifications - Cursor paginated notifications for current user
 */
const getNotifications = async (req, res, next) => {
  try {
    const { cursor, limit = 20 } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

    const query = { user: req.user._id };
    if (cursor) {
      query._id = { $lt: cursor };
    }

    const notifications = await Notification.find(query)
      .sort({ _id: -1 })
      .limit(parsedLimit + 1)
      .populate('actor', '_id name username avatar isVerified isOnline')
      .lean();

    const hasMore = notifications.length > parsedLimit;
    const paginated = hasMore ? notifications.slice(0, parsedLimit) : notifications;
    const nextCursor = hasMore ? paginated[paginated.length - 1]._id : null;

    return res.status(200).json({
      success: true,
      data: paginated,
      nextCursor,
      hasMore
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Error in getNotifications');
    next(err);
  }
};

/**
 * GET /api/notifications/unread-count
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const count = await notificationService.getUnreadCount(req.user._id);
    return res.status(200).json({ success: true, count });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/notifications/:id/read - Mark notification as read
 */
const markRead = async (req, res, next) => {
  try {
    const notif = await notificationService.markAsRead(req.user._id, req.params.id);
    return res.status(200).json({ success: true, data: notif });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/notifications/read-all - Mark all as read
 */
const markAllRead = async (req, res, next) => {
  try {
    await notificationService.markAllAsRead(req.user._id);
    return res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead
};
