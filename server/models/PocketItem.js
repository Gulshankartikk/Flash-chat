const mongoose = require('mongoose');

const pocketMediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    thumbnail: { type: String, default: '' }
  },
  { _id: false }
);

const pocketItemSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: [
        'note',
        'link',
        'image',
        'video',
        'audio',
        'document',
        'snippet',
        'message',
        'post',
        'reel',
        'ai_answer'
      ],
      required: true,
      index: true
    },
    title: {
      type: String,
      trim: true,
      default: '',
      maxlength: 300
    },
    content: {
      type: String,
      default: '',
      maxlength: 1048576 // 1MB text limit per item
    },
    url: {
      type: String,
      trim: true,
      default: ''
    },
    linkPreview: {
      title: { type: String, default: '' },
      description: { type: String, default: '' },
      image: { type: String, default: '' },
      favicon: { type: String, default: '' },
      siteName: { type: String, default: '' }
    },
    media: [pocketMediaSchema],
    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PocketFolder',
      default: null,
      index: true
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true
      }
    ],
    isFavorite: {
      type: Boolean,
      default: false,
      index: true
    },
    isPinned: {
      type: Boolean,
      default: false,
      index: true
    },
    isLocked: {
      type: Boolean,
      default: false,
      index: true
    },
    isEncrypted: {
      type: Boolean,
      default: false
    },
    encryption: {
      iv: { type: String, default: '' },
      salt: { type: String, default: '' }
    },
    source: {
      kind: {
        type: String,
        enum: ['chat_message', 'social_post', 'social_reel', 'ai', 'manual', 'upload'],
        default: 'manual'
      },
      refId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
      },
      snapshot: {
        type: mongoose.Schema.Types.Mixed,
        default: null
      }
    },
    aiSummary: {
      type: String,
      default: ''
    },
    aiTags: [
      {
        type: String,
        trim: true,
        lowercase: true
      }
    ],
    deletedAt: {
      type: Date,
      default: null,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// High performance compound indexes
pocketItemSchema.index({ owner: 1, deletedAt: 1, createdAt: -1 });
pocketItemSchema.index({ owner: 1, folder: 1, deletedAt: 1 });
pocketItemSchema.index({ owner: 1, tags: 1, deletedAt: 1 });
pocketItemSchema.index({ owner: 1, isFavorite: 1, deletedAt: 1 });
pocketItemSchema.index({ owner: 1, isPinned: 1, deletedAt: 1 });

// Full text search index over active unencrypted items
pocketItemSchema.index(
  { title: 'text', content: 'text', tags: 'text' },
  { weights: { title: 5, tags: 3, content: 1 } }
);

module.exports = mongoose.model('PocketItem', pocketItemSchema);
