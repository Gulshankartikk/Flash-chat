const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Kept for 1-on-1 convenience (quick lookups, notifications) even
    // though delivery/seen status is tracked per-participant below.
    // For group chats this can be left unset.
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    content: {
      type: String,
      trim: true,
    },

    imageOrVideoUrl: {
      type: String,
    },

    contentType: {
      type: String,
      enum: ["text", "image", "video", "audio", "document", "gif"],
      default: "text",
    },

    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        emoji: {
          type: String,
        },
      },
    ],

    // Overall status — for a 1-on-1 chat this is the single source of
    // truth. For groups, use deliveredTo/seenBy below instead, and let
    // this reflect the "weakest" status (sent until everyone has it).
    messageStatus: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
    },

    // Per-participant tracking — required for groups, and gives 1-on-1
    // chats accurate "delivered"/"seen" timestamps too.
    deliveredTo: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        at: { type: Date, default: Date.now },
      },
    ],

    seenBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        at: { type: Date, default: Date.now },
      },
    ],

    // WhatsApp's "delete for me" — hides the message for specific
    // users without affecting anyone else's copy.
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // flashchats "delete for everyone" — message stays in the thread
    // as a placeholder ("This message was deleted") but content/media
    // is wiped.
    isDeletedForEveryone: {
      type: Boolean,
      default: false,
    },

    isEdited: {
      type: Boolean,
      default: false,
    },

    isPinned: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// High performance compound indexes for fast message fetching and ordering
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, messageStatus: 1 });
messageSchema.index({ conversation: 1, isPinned: 1 });

module.exports =
  mongoose.models.Message ||
  mongoose.model("Message", messageSchema);