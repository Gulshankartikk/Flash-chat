const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["OWNER", "ADMIN", "MANAGER", "TEAM_LEAD", "EMPLOYEE", "SUPPORT_AGENT", "CUSTOMER"],
      default: "SUPPORT_AGENT",
    },
    department: {
      type: String,
      trim: true,
      default: "Customer Support",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    logoUrl: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    website: {
      type: String,
      default: "",
    },
    businessEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    category: {
      type: String,
      default: "General",
    },
    workingHours: {
      timezone: { type: String, default: "UTC" },
      start: { type: String, default: "09:00" },
      end: { type: String, default: "18:00" },
      workDays: {
        type: [String],
        default: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      },
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [memberSchema],
    settings: {
      aiAssistantEnabled: { type: Boolean, default: true },
      ragGroundingEnabled: { type: Boolean, default: true },
      autoAssignmentEnabled: { type: Boolean, default: false },
      defaultPriority: { type: String, enum: ["low", "medium", "high", "urgent"], default: "medium" },
      maxTokensPerMonth: { type: Number, default: 200000 },
      tokensUsedThisMonth: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

organizationSchema.index({ slug: 1 }, { unique: true });
organizationSchema.index({ owner: 1 });
organizationSchema.index({ "members.user": 1 });

module.exports =
  mongoose.models.Organization ||
  mongoose.model("Organization", organizationSchema);
