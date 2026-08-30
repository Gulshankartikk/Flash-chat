const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    // Canonical, order-independent identifier for a private chat's pair
    // of participants (e.g. "<idA>_<idB>" with ids sorted as strings).
    // Array fields can't be uniquely indexed the way we need — MongoDB
    // indexes each array element separately, not the array as a whole —
    // so we derive this single string field and put the uniqueness
    // constraint on it instead. Left undefined for group conversations,
    // which can legitimately share a participant set across multiple
    // group chats.
    participantsKey: {
      type: String,
    },

    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },

    // Per-user unread count — required since each participant needs
    // their own count (a 1-on-1 chat's "unread" is different for each
    // side, and a group has one count per member).
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },

    conversationType: {
      type: String,
      enum: ["private", "group"],
      default: "private",
    },

    // Group-chat fields — unused for private chats but needed once
    // conversationType is "group".
    groupName: {
      type: String,
      trim: true,
    },

    groupAvatar: {
      type: String,
    },

    groupAdmins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    groupPhoto: {
      type: String,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // flash chat "mute" toggle, per-user — left as a flat array of
    // userIds with an optional mutedUntil, simplest version.
    mutedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Pinned conversations, per-user
    pinnedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Archived conversations, per-user
    archivedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Group invite link unique token
    inviteCode: {
      type: String,
      unique: true,
      sparse: true,
    },

    // Group permission: allow only admins to send messages
    onlyAdminsCanMessage: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Prevent duplicate 1-on-1 conversations between the same two users.
// Only enforced for private chats — groups can share the same pair
// of participants across multiple group conversations. This is a
// sparse index: documents where participantsKey is undefined (all
// group chats) are simply excluded from the uniqueness check.
conversationSchema.index(
  { participantsKey: 1 },
  {
    unique: true,
    partialFilterExpression: { conversationType: "private" },
  }
);

conversationSchema.index({ participants: 1, updatedAt: -1 });

module.exports =
  mongoose.models.Conversation ||
  mongoose.model("Conversation", conversationSchema);