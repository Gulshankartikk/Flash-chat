const mongoose = require("mongoose");

const aiUsageSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    feature: {
      type: String,
      enum: ["chat_assistant", "smart_reply", "summarize", "rewrite", "rag_query", "intent_classification"],
      required: true,
    },
    provider: {
      type: String,
      default: "gemini",
    },
    model: {
      type: String,
      default: "gemini-flash",
    },
    promptTokens: {
      type: Number,
      default: 0,
    },
    completionTokens: {
      type: Number,
      default: 0,
    },
    totalTokens: {
      type: Number,
      default: 0,
    },
    costEstimateUSD: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["success", "rate_limited", "failed", "fallback"],
      default: "success",
    },
    durationMs: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

aiUsageSchema.index({ organization: 1, createdAt: -1 });
aiUsageSchema.index({ user: 1, createdAt: -1 });
aiUsageSchema.index({ feature: 1, createdAt: -1 });

module.exports =
  mongoose.models.AIUsage ||
  mongoose.model("AIUsage", aiUsageSchema);
