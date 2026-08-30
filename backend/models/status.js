const mongoose = require("mongoose");

const statusSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    content: {
      type: String,
      trim: true,
      default: "",
    },

    mediaUrl: {
      type: String,
      default: null,
    },

    contentType: {
      type: String,
      enum: ["image", "video", "text"],
      default: "text",
    },

    viewers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // WhatsApp-style 24-hour auto-expiry. Set explicitly on creation
    // (controller does `expiresAt = now + 24h`) rather than relying
    // purely on createdAt math, so it survives even if the expiry
    // window logic changes later.
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// TTL index — MongoDB automatically deletes the document once
// expiresAt has passed, so expired statuses don't pile up and don't
// rely solely on the application-level query filter.
statusSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Prevent OverwriteModelError
module.exports =
  mongoose.models.Status || mongoose.model("Status", statusSchema);