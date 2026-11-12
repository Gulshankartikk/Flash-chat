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
        user: { $eq: user },
        actor: { $eq: actor },
        type: { $eq: type },
        'target.refId': { $eq: target?.refId }
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
        const unreadCount = await this.getUnreadCount(user);
        io.to(`user:${user}`).emit('notification:unread_count', { count: unreadCount });
      }

      // Check offline email notification for missed calls (strictly never for ordinary messages)
      if (type === 'missed_call') {
        try {
          const User = require('../models/User');
          const recipient = await User.findById(user).select('email name notificationPreferences isOnline');
          if (recipient && !recipient.isOnline && recipient.email) {
            const emailAllowed = recipient.notificationPreferences?.email?.missedCalls !== false;
            if (emailAllowed) {
              const mailer = require('./mailer/mailerService');
              mailer.sendAsync({
                to: recipient.email,
                subject: `Flash Chat: Missed call from ${populated?.actor?.name || 'someone'}`,
                html: `<p>Hi ${recipient.name || 'there'},</p><p>You missed a call on Flash Chat from <strong>${populated?.actor?.name || 'someone'}</strong> (@${populated?.actor?.username || 'user'}).</p>`,
                text: `You missed a call on Flash Chat from ${populated?.actor?.name || 'someone'}.`
              });
            }
          }
        } catch (e) {
          logger.warn({ err: e.message }, 'Missed call email notification dispatch failed');
        }
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
        const unreadCount = await this.getUnreadCount(user);
        io.to(`user:${user}`).emit('notification:unread_count', { count: unreadCount });
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
  async markAsRead(userId, notifId, io = null) {
    const updated = await Notification.findOneAndUpdate(
      { _id: notifId, user: userId },
      { isRead: true },
      { new: true }
    );
    if (io) {
      const count = await this.getUnreadCount(userId);
      io.to(`user:${userId}`).emit('notification:unread_count', { count });
    }
    return updated;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId, io = null) {
    const result = await Notification.updateMany({ user: userId, isRead: false }, { isRead: true });
    if (io) {
      io.to(`user:${userId}`).emit('notification:unread_count', { count: 0 });
    }
    return result;
  }
}

module.exports = new NotificationService();
