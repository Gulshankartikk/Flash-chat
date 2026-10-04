const mongoose = require('mongoose');

const contactInviteSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    identifier: {
      type: String, // E.164 phone or lowercase email
      required: true,
      trim: true,
      index: true
    },
    type: {
      type: String,
      enum: ['phone', 'email'],
      required: true
    },
    invitedAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

contactInviteSchema.index({ sender: 1, identifier: 1, invitedAt: -1 });

module.exports = mongoose.model('ContactInvite', contactInviteSchema);
