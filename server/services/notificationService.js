const Notification = require('../models/Notification');
const logger = require('../utils/logger');

class NotificationService {
  /**
   * Create and deliver notification
   */
  async createNotification({ user, actor, type, target, message = '' }, io = null) {
    try {
      // 1. Never notify self
      if (String(user) === String(actor)) {
        return null;
      }

      // 2. De-duplicate similar active notifications (e.g. repeated like on same post)
      const existing = await Notification.findOne({
        user,
        actor,
        type,
        'target.refId': target?.refId
      });

      if (existing) {
        existing.isRead = false;
        existing.createdAt = new Date();
        await existing.save();
        return existing;
      }

      const notif = await Notification.create({
        user,
        actor,
        type,
        target,
        message,
        isRead: false
      });

      const populated = await Notification.findById(notif._id)
        .populate('actor', '_id name username avatar isVerified')
        .lean();

      // Emit realtime socket event if io is provided
      if (io) {
        io.to(`user:${user}`).emit('notification:new', populated);
      }

      return populated;
    } catch (err) {
      logger.warn({ err: err.message, user, actor, type }, 'Error creating notification');
      return null;
    }
  }

  /**
   * Delete notification when an action is reverted (e.g. unlike, unfollow)
   */
  async deleteNotification({ user, actor, type, target }, io = null) {
    try {
      const query = { user, actor, type };
      if (target?.refId) {
        query['target.refId'] = target.refId;
      }
      const deleted = await Notification.findOneAndDelete(query);
      if (deleted && io) {
        io.to(`user:${user}`).emit('notification:deleted', { notificationId: deleted._id });
      }
      return deleted;
    } catch (err) {
      logger.warn({ err: err.message }, 'Error deleting notification');
      return null;
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId) {
    return await Notification.countDocuments({ user: userId, isRead: false });
  }

  /**
   * Mark single notification as read
   */
  async markAsRead(userId, notifId) {
    return await Notification.findOneAndUpdate(
      { _id: notifId, user: userId },
      { isRead: true },
      { new: true }
    );
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId) {
    return await Notification.updateMany({ user: userId, isRead: false }, { isRead: true });
  }
}

module.exports = new NotificationService();
