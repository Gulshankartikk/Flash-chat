const mongoose = require('mongoose');

const queuedMessageSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const pendingConversationSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    phoneHash: {
      type: String,
      required: true,
      index: true
    },
    rawPhoneMasked: {
      type: String,
      default: ''
    },
    contact: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      default: null
    },
    name: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ''
    },
    queuedMessages: {
      type: [queuedMessageSchema],
      validate: [
        (val) => val.length <= 5,
        'Cannot queue more than 5 messages for an unregistered contact'
      ],
      default: []
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  },
  {
    timestamps: true
  }
);

// Unique compound index: one pending conversation per owner + phoneHash
pendingConversationSchema.index({ owner: 1, phoneHash: 1 }, { unique: true });

// TTL index for automatic 30-day expiry
pendingConversationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PendingConversation', pendingConversationSchema);
