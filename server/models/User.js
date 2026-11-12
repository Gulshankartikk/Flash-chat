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
    role: {
      type: String,
      enum: ['user', 'support', 'admin'],
      default: 'user',
      index: true
    },
    discoverableByPhone: {
      type: Boolean,
      default: true
    },
    discoverableByEmail: {
      type: Boolean,
      default: true
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
    aiSettings: {
      aiEnabled: { type: Boolean, default: true },
      aiInChats: { type: Boolean, default: true },
      aiUsesPocket: { type: Boolean, default: false }
    },
    pushSettings: {
      pushEnabled: { type: Boolean, default: true },
      pushMessages: { type: Boolean, default: true },
      pushCalls: { type: Boolean, default: true },
      pushSocial: { type: Boolean, default: true },
      pushPreview: { type: Boolean, default: true },
      quietHours: {
        enabled: { type: Boolean, default: false },
        start: { type: String, default: '22:00' },
        end: { type: String, default: '07:00' },
        timezone: { type: String, default: 'UTC' }
      }
    },
    notificationPreferences: {
      inApp: {
        messages: { type: Boolean, default: true },
        calls: { type: Boolean, default: true },
        social: { type: Boolean, default: true },
        mentions: { type: Boolean, default: true }
      },
      push: {
        enabled: { type: Boolean, default: true },
        messages: { type: Boolean, default: true },
        calls: { type: Boolean, default: true },
        social: { type: Boolean, default: true }
      },
      email: {
        securityAlerts: { type: Boolean, default: true },
        missedCalls: { type: Boolean, default: true },
        digest: { type: Boolean, default: false }
      },
      sms: {
        securityAlerts: { type: Boolean, default: false }
      }
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
        ipAddress: { type: String, default: '' },
        lastActiveAt: { type: Date, default: Date.now },
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  {
    timestamps: true
  }
);

userSchema.index({ name: 'text', username: 'text' });
userSchema.index({ isOnline: 1, lastSeen: -1 });

module.exports = mongoose.model('User', userSchema);
