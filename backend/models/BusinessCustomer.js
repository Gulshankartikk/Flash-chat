const mongoose = require("mongoose");

const businessCustomerSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    displayName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    company: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["lead", "active", "churned", "vip", "blocked"],
      default: "lead",
    },
    assignedAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    customAttributes: {
      type: Map,
      of: String,
      default: {},
    },
    totalConversations: {
      type: Number,
      default: 0,
    },
    lastContactedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

businessCustomerSchema.index({ organization: 1, user: 1 }, { unique: true });
businessCustomerSchema.index({ organization: 1, assignedAgent: 1 });
businessCustomerSchema.index({ organization: 1, status: 1 });
businessCustomerSchema.index({ organization: 1, email: 1 });

module.exports =
  mongoose.models.BusinessCustomer ||
  mongoose.model("BusinessCustomer", businessCustomerSchema);
