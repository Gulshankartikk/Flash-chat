const mongoose = require('mongoose');

const pocketSettingsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    pinHash: {
      type: String,
      select: false,
      default: null
    },
    pinSetAt: {
      type: Date,
      default: null
    },
    failedPinAttempts: {
      type: Number,
      default: 0
    },
    lockedUntil: {
      type: Date,
      default: null
    },
    autoLockMinutes: {
      type: Number,
      default: 5,
      min: 1,
      max: 60
    },
    storageUsedBytes: {
      type: Number,
      default: 0
    },
    storageLimitBytes: {
      type: Number,
      default: 1073741824 // 1 GB default limit
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('PocketSettings', pocketSettingsSchema);
