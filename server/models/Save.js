const mongoose = require('mongoose');

const saveSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    targetType: {
      type: String,
      enum: ['post', 'reel'],
      required: true,
      index: true
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    collectionName: {
      type: String,
      default: 'All Posts',
      trim: true
    }
  },
  {
    timestamps: true
  }
);

saveSchema.index({ user: 1, targetType: 1, targetId: 1 }, { unique: true });
saveSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Save', saveSchema);
