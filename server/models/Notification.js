const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: [
        'like',
        'comment',
        'reply',
        'follow',
        'follow_request',
        'follow_accepted',
        'mention',
        'story_reply',
        'share'
      ],
      required: true,
      index: true
    },
    target: {
      kind: {
        type: String,
        enum: ['post', 'reel', 'story', 'comment', 'user'],
        default: 'post'
      },
      refId: {
        type: mongoose.Schema.Types.ObjectId
      }
    },
    message: {
      type: String,
      default: ''
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
