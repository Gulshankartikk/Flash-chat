const mongoose = require('mongoose');

const aiUsageSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    date: {
      type: String, // format: "YYYY-MM-DD"
      required: true,
      index: true
    },
    requestCount: {
      type: Number,
      default: 0
    },
    tokenCount: {
      type: Number,
      default: 0
    },
    lastRequestAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index so one record exists per user per day
aiUsageSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('AiUsage', aiUsageSchema);
