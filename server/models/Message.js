const mongoose = require('mongoose');

const mediaItemSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 },
    duration: { type: Number, default: 0 }, // For audio/voice/video in seconds
    thumbnail: { type: String, default: '' }
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true
    },
    // Backwards compatibility alias
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation'
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: [
        'text',
        'image',
        'video',
        'audio',
        'voice',
        'document',
        'location',
        'contact',
        'system',
        'shared_post',
        'shared_reel',
        'shared_story'
      ],
      default: 'text',
      index: true
    },
    text: {
      type: String,
      trim: true,
      default: ''
    },
    media: [mediaItemSchema],
    location: {
      lat: { type: Number },
      lng: { type: Number },
      label: { type: String, default: '' }
    },
    contact: {
      name: { type: String },
      phone: { type: String }
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    forwardedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    reactions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        emoji: { type: String }
      }
    ],
    starredBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    editedAt: {
      type: Date,
      default: null
    },
    deletedForEveryone: {
      type: Boolean,
      default: false
    },
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    deliveredTo: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now }
      }
    ],
    readBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now }
      }
    ],
    expiresAt: {
      type: Date,
      default: null
    },
    sharedRef: {
      kind: { type: String, enum: ['post', 'reel', 'story', 'profile'] },
      refId: { type: mongoose.Schema.Types.ObjectId }
    },
    snapshot: {
      thumbnail: { type: String, default: '' },
      authorUsername: { type: String, default: '' },
      authorName: { type: String, default: '' },
      authorAvatar: { type: String, default: '' },
      captionSnippet: { type: String, default: '' },
      mediaType: { type: String, default: '' }
    },
    clientId: {
      type: String,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// High performance cursor pagination index
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ chatId: 1, createdAt: -1 });

// Full text search index
messageSchema.index({ text: 'text' });

// TTL Index for disappearing messages (automatically purged by MongoDB when expiresAt is passed)
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save hook to ensure chatId is synced with conversation
messageSchema.pre('save', function (next) {
  if (this.conversation && !this.chatId) {
    this.chatId = this.conversation;
  }
  next();
});

module.exports = mongoose.model('Message', messageSchema);
