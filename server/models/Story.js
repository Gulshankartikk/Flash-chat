const mongoose = require('mongoose');

const storySchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    media: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
      type: { type: String, enum: ['image', 'video', 'text'], default: 'image' },
      duration: { type: Number, default: 5 } // 5s for photos/text, video duration for videos
    },
    text: {
      type: String,
      default: '',
      maxlength: 1000
    },
    backgroundColor: {
      type: String,
      default: '#10B981' // WhatsApp green default
    },
    fontStyle: {
      type: String,
      enum: ['sans', 'serif', 'mono', 'cursive'],
      default: 'sans'
    },
    textAlign: {
      type: String,
      enum: ['left', 'center', 'right'],
      default: 'center'
    },
    stickers: [
      {
        type: { type: String, default: 'text' },
        content: { type: String },
        x: { type: Number, default: 50 },
        y: { type: Number, default: 50 }
      }
    ],
    viewers: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now }
      }
    ],
    reactions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        emoji: { type: String, required: true },
        at: { type: Date, default: Date.now }
      }
    ],
    audience: {
      type: String,
      enum: ['public', 'followers', 'close_friends', 'contacts', 'custom'],
      default: 'followers'
    },
    hiddenFrom: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    customAudience: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    closeFriendsOnly: {
      type: Boolean,
      default: false
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 } // Auto-purge expired 24h stories
    }
  },
  {
    timestamps: true
  }
);

storySchema.index({ author: 1, expiresAt: 1 });

module.exports = mongoose.model('Story', storySchema);
