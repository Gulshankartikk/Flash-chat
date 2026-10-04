const mongoose = require('mongoose');

const supportFaqSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['account', 'bug', 'feature', 'billing', 'security', 'pocket', 'ai', 'calls', 'general'],
      default: 'general',
      index: true
    },
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300
    },
    answer: {
      type: String,
      required: true,
      trim: true
    },
    keywords: [
      {
        type: String,
        lowercase: true,
        trim: true
      }
    ],
    order: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

supportFaqSchema.index({ category: 1, order: 1 });
supportFaqSchema.index({ question: 'text', answer: 'text', keywords: 'text' });

module.exports = mongoose.model('SupportFaq', supportFaqSchema);
