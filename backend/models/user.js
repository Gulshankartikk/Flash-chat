const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    phoneNumber: { type: String, unique: true, sparse: true },
    phoneSuffix: { type: String }, // country code, e.g. "+91"

    username: { type: String, unique: true, sparse: true },

    email: {
      type: String,
      lowercase: true,
      unique: true,
      sparse: true, // many WhatsApp accounts are phone-only, no email
      validate: {
        validator: function (value) {
          if (!value) return true; // skip validation when not set
          return /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(value);
        },
        message: "Invalid email address format",
      },
    },

    emailOtp: { type: String },
    emailOtpExpiry: { type: Date },

    profilePicture: { type: String },
    password: { type: String },
    about: { type: String, default: "Hey there! I am using FlashChat" },

    lastSeen: { type: Date },

    isOnline: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    agreed: { type: Boolean, default: false },
    isAIBot: { type: Boolean, default: false },

    // ---- WhatsApp-style social/contact features ----

    // Users this account has blocked. Blocking is one-directional and
    // checked both ways in chat/call logic (sender blocked receiver,
    // or receiver blocked sender).
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Connected contacts
    contacts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // E2EE Public Key (JWK JSON string or SPKI base64)
    publicKey: { type: String },

    // Active login sessions for device tracking & token revocation
    activeSessions: [
      {
        sessionId: { type: String, required: true },
        refreshToken: { type: String },
        device: { type: String },
        ip: { type: String },
        lastActive: { type: Date, default: Date.now },
      },
    ],
    privacySettings: {
      lastSeen: {
        type: String,
        enum: ["everyone", "contacts", "nobody"],
        default: "everyone",
      },
      profilePhoto: {
        type: String,
        enum: ["everyone", "contacts", "nobody"],
        default: "everyone",
      },
      about: {
        type: String,
        enum: ["everyone", "contacts", "nobody"],
        default: "everyone",
      },
      readReceipts: {
        type: Boolean,
        default: true,
      },
    },
  },
  { timestamps: true }
);

// Prevent OverwriteModelError on hot-reload (nodemon, dev server)
module.exports = mongoose.models.User || mongoose.model("User", userSchema);