const mongoose = require('mongoose');

const reelSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    video: {
      url: { type: String, required: true },
      publicId: { type: String, default: '' },
      duration: { type: Number, default: 0 },
      width: { type: Number, default: 1080 },
      height: { type: Number, default: 1920 }
    },
    thumbnail: {
      type: String,
      default: ''
    },
    caption: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2200
    },
    audioName: {
      type: String,
      trim: true,
      default: 'Original Audio'
    },
    hashtags: [{ type: String, lowercase: true, trim: true }],
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    likesCount: {
      type: Number,
      default: 0
    },
    commentsCount: {
      type: Number,
      default: 0
    },
    sharesCount: {
      type: Number,
      default: 0
    },
    viewsCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

reelSchema.index({ author: 1, createdAt: -1 });
reelSchema.index({ hashtags: 1 });
reelSchema.index({ createdAt: -1 });
reelSchema.index({ viewsCount: -1 });

module.exports = mongoose.model('Reel', reelSchema);
