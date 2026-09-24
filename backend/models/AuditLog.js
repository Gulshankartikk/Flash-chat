const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    entityType: {
      type: String,
      enum: ["Organization", "User", "Conversation", "Message", "KnowledgeDocument", "Team", "System"],
      required: true,
    },
    entityId: {
      type: String,
    },
    ipAddress: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

auditLogSchema.index({ organization: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ action: 1 });

module.exports =
  mongoose.models.AuditLog ||
  mongoose.model("AuditLog", auditLogSchema);
