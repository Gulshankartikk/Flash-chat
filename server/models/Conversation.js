const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastReadMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    mutedUntil: {
      type: Date,
      default: null
    },
    isPinned: {
      type: Boolean,
      default: false
    },
    isArchived: {
      type: Boolean,
      default: false
    },
    unreadCount: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['direct', 'group'],
      required: true,
      index: true
    },
    members: [memberSchema],
    name: {
      type: String,
      trim: true,
      maxlength: 100,
      default: ''
    },
    avatar: {
      type: String,
      default: ''
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },
    inviteCode: {
      type: String,
      unique: true,
      sparse: true
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    disappearAfter: {
      type: Number, // in seconds (e.g. 86400 for 24h, 604800 for 7d), null for off
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    // Sorted member key "idA_idB" prevents duplicate direct conversations
    memberKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
conversationSchema.index({ 'members.user': 1, updatedAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
