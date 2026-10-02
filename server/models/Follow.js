const mongoose = require('mongoose');

const followSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['accepted', 'pending'],
      default: 'accepted',
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate follow relations
followSchema.index({ follower: 1, following: 1 }, { unique: true });
followSchema.index({ following: 1, status: 1 });
followSchema.index({ follower: 1, status: 1 });

module.exports = mongoose.model('Follow', followSchema);
