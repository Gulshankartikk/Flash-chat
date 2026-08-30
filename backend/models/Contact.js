const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "blocked"],
      default: "pending",
      required: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate contact records for the same sender and receiver
contactSchema.index({ sender: 1, receiver: 1 }, { unique: true });

module.exports = mongoose.models.Contact || mongoose.model("Contact", contactSchema);
