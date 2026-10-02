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
      url: { type: String, required: true },
      publicId: { type: String, default: '' },
      type: { type: String, enum: ['image', 'video'], default: 'image' },
      duration: { type: Number, default: 5 } // 5s for photos, video duration for videos
    },
    text: {
      type: String,
      default: '',
      maxlength: 500
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
