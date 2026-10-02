const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['ringing', 'joined', 'declined', 'missed', 'left'],
      default: 'ringing'
    },
    joinedAt: {
      type: Date,
      default: null
    },
    leftAt: {
      type: Date,
      default: null
    }
  },
  { _id: false }
);

const callSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true
    },
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    participants: [participantSchema],
    type: {
      type: String,
      enum: ['audio', 'video'],
      default: 'audio',
      index: true
    },
    isGroup: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['ringing', 'ongoing', 'ended', 'missed', 'declined', 'busy'],
      default: 'ringing',
      index: true
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    answeredAt: {
      type: Date,
      default: null
    },
    endedAt: {
      type: Date,
      default: null
    },
    duration: {
      type: Number,
      default: 0 // Duration in seconds
    },
    endReason: {
      type: String,
      enum: [
        'completed',
        'declined',
        'missed',
        'busy',
        'offline',
        'canceled',
        'disconnected',
        'error'
      ],
      default: null
    },
    // Users who have deleted this call from their personal call log
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ]
  },
  {
    timestamps: true
  }
);

// Indexes for fast history queries per participant
callSchema.index({ 'participants.user': 1, createdAt: -1 });
callSchema.index({ conversation: 1, createdAt: -1 });

module.exports = mongoose.model('Call', callSchema);
