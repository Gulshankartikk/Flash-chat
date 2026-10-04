const mongoose = require('mongoose');

const supportCannedReplySchema = new mongoose.Schema(
  {
    shortcut: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    category: {
      type: String,
      enum: ['greeting', 'troubleshooting', 'escalation', 'closing', 'general'],
      default: 'general'
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('SupportCannedReply', supportCannedReplySchema);
