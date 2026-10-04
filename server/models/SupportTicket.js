const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    category: {
      type: String,
      enum: ['account', 'bug', 'feature', 'billing', 'other'],
      default: 'other',
      index: true
    },
    status: {
      type: String,
      enum: ['open', 'pending', 'resolved'],
      default: 'open',
      index: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    ratingComment: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },
    diagnostics: {
      appVersion: { type: String, default: '1.0.0' },
      platform: { type: String, default: 'web' },
      browser: { type: String, default: 'browser' },
      screenResolution: { type: String, default: '' }
    },
    resolvedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

supportTicketSchema.index({ user: 1, status: 1 });
supportTicketSchema.index({ status: 1, lastMessageAt: -1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
