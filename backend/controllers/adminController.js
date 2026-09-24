const User = require("../models/user");
const Organization = require("../models/Organization");
const Conversation = require("../models/Conversation");
const Message = require("../models/message");
const AIUsage = require("../models/AIUsage");
const AuditLog = require("../models/AuditLog");
const response = require("../utils/responseHandler");

// In-memory or dynamic feature flags
const featureFlags = {
  AI_ASSISTANT: true,
  AI_SMART_REPLY: true,
  AI_SUMMARY: true,
  AI_TRANSLATION: true,
  BUSINESS_MODE: true,
  VIDEO_CALL: true,
  GROUPS: true,
  ADVANCED_ANALYTICS: true,
  RAG_KNOWLEDGE_BASE: true,
};

/**
 * System-wide metrics for platform administrators
 */
const getPlatformStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalOrgs,
      totalMessages,
      totalConversations,
      aiSummary,
      recentLogs,
    ] = await Promise.all([
      User.countDocuments(),
      Organization.countDocuments(),
      Message.countDocuments(),
      Conversation.countDocuments(),
      AIUsage.aggregate([
        {
          $group: {
            _id: null,
            totalTokens: { $sum: "$totalTokens" },
            totalRequests: { $sum: 1 },
            totalCost: { $sum: "$costEstimateUSD" },
          },
        },
      ]),
      AuditLog.find().sort({ createdAt: -1 }).limit(10).populate("actor", "username email"),
    ]);

    return response(res, 200, "Platform statistics retrieved", {
      stats: {
        totalUsers,
        totalOrganizations: totalOrgs,
        totalMessages,
        totalConversations,
        totalAITokens: aiSummary[0]?.totalTokens || 0,
        totalAIRequests: aiSummary[0]?.totalRequests || 0,
        totalAICostUSD: Number((aiSummary[0]?.totalCost || 0).toFixed(4)),
      },
      featureFlags,
      recentActivity: recentLogs,
    });
  } catch (err) {
    console.error("[AdminController] getPlatformStats error:", err);
    return response(res, 500, "Failed to retrieve platform stats", null, err.message);
  }
};

/**
 * Get and update feature flags
 */
const getFeatureFlags = async (req, res) => {
  return response(res, 200, "Feature flags retrieved", featureFlags);
};

const updateFeatureFlag = async (req, res) => {
  const { flag, enabled } = req.body;
  if (!flag || typeof enabled !== "boolean") {
    return response(res, 400, "Flag name and boolean status required");
  }

  featureFlags[flag] = enabled;

  await AuditLog.create({
    actor: req.user._id,
    action: "FEATURE_FLAG_UPDATED",
    entityType: "System",
    details: { flag, enabled },
  });

  return response(res, 200, `Feature flag '${flag}' set to ${enabled}`, featureFlags);
};

module.exports = {
  getPlatformStats,
  getFeatureFlags,
  updateFeatureFlag,
  featureFlags,
};
