const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      maxlength: 60,
      default: ''
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      index: true
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      index: true
    },
    phoneNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true
    },
    passwordHash: {
      type: String,
      select: false
    },
    avatar: {
      type: String,
      default: 'https://api.dicebear.com/7.x/bottts/svg?seed=Flash'
    },
    bio: {
      type: String,
      default: '⚡ Hey there! I am using Flash Chat.',
      maxlength: 160
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    isOnboarded: {
      type: Boolean,
      default: false
    },
    isPrivateAccount: {
      type: Boolean,
      default: false
    },
    isPrivate: {
      type: Boolean,
      default: false
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'light'
    },
    privacy: {
      lastSeen: {
        type: String,
        enum: ['everyone', 'contacts', 'nobody'],
        default: 'everyone'
      },
      profilePhoto: {
        type: String,
        enum: ['everyone', 'contacts', 'nobody'],
        default: 'everyone'
      },
      readReceipts: {
        type: Boolean,
        default: true
      }
    },
    privacySettings: {
      lastSeen: { type: String, enum: ['everyone', 'contacts', 'nobody'], default: 'everyone' },
      profilePhoto: { type: String, enum: ['everyone', 'contacts', 'nobody'], default: 'everyone' },
      readReceipts: { type: Boolean, default: true }
    },
    followersCount: {
      type: Number,
      default: 0
    },
    followingCount: {
      type: Number,
      default: 0
    },
    postsCount: {
      type: Number,
      default: 0
    },
    isOnline: {
      type: Boolean,
      default: false,
      index: true
    },
    lastSeen: {
      type: Date,
      default: Date.now
    },
    pocketPinHash: {
      type: String,
      select: false
    },
    refreshTokens: [
      {
        token: { type: String, required: true },
        deviceId: { type: String },
        deviceInfo: { type: String },
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  {
    timestamps: true
  }
);

userSchema.index({ name: 'text', username: 'text' });

module.exports = mongoose.model('User', userSchema);
