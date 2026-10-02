const mongoose = require('mongoose');

const postMediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: '' },
    type: { type: String, enum: ['image', 'video'], default: 'image' },
    width: { type: Number, default: 1080 },
    height: { type: Number, default: 1080 },
    duration: { type: Number, default: 0 }
  },
  { _id: false }
);

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    caption: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2200
    },
    media: {
      type: [postMediaSchema],
      validate: [(val) => val.length > 0, 'Post must contain at least one media item.']
    },
    hashtags: [{ type: String, lowercase: true, trim: true }],
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    location: {
      type: String,
      trim: true,
      default: ''
    },
    likesCount: {
      type: Number,
      default: 0
    },
    commentsCount: {
      type: Number,
      default: 0
    },
    savesCount: {
      type: Number,
      default: 0
    },
    allowComments: {
      type: Boolean,
      default: true
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ hashtags: 1 });
postSchema.index({ caption: 'text' });
postSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);
