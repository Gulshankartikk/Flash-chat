const mongoose = require('mongoose');

const aiAttachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    mimeType: { type: String, default: 'image/jpeg' },
    name: { type: String, default: '' },
    size: { type: Number, default: 0 }
  },
  { _id: false }
);

const aiMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'model', 'system'],
      required: true,
      default: 'user'
    },
    text: {
      type: String,
      required: true,
      default: ''
    },
    attachments: [aiAttachmentSchema],
    tokens: {
      type: Number,
      default: 0
    },
    rating: {
      type: String,
      enum: ['thumbs_up', 'thumbs_down', 'none'],
      default: 'none'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const aiConversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      trim: true,
      default: 'New Chat',
      maxlength: 120
    },
    messages: [aiMessageSchema],
    isPinned: {
      type: Boolean,
      default: false,
      index: true
    },
    systemPrompt: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// High-performance compound index for user's conversation list
aiConversationSchema.index({ user: 1, isPinned: -1, updatedAt: -1 });

module.exports = mongoose.model('AiConversation', aiConversationSchema);
