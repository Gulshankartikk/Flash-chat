const Conversation = require("../models/Conversation");
const BusinessCustomer = require("../models/BusinessCustomer");
const Organization = require("../models/Organization");
const AIUsage = require("../models/AIUsage");
const response = require("../utils/responseHandler");

/**
 * Fetch high-level business KPI dashboard metrics
 */
const getBusinessOverview = async (req, res) => {
  try {
    const orgId = req.organization._id;

    // Concurrently aggregate analytics
    const [
      totalConversations,
      activeConversations,
      resolvedConversations,
      urgentTickets,
      customersCount,
      aiStats,
      priorityDistribution,
    ] = await Promise.all([
      Conversation.countDocuments({ organization: orgId }),
      Conversation.countDocuments({ organization: orgId, ticketStatus: { $in: ["open", "pending"] } }),
      Conversation.countDocuments({ organization: orgId, ticketStatus: "resolved" }),
      Conversation.countDocuments({ organization: orgId, priority: "urgent", ticketStatus: { $ne: "resolved" } }),
      BusinessCustomer.countDocuments({ organization: orgId }),
      AIUsage.aggregate([
        { $match: { organization: orgId } },
        {
          $group: {
            _id: null,
            totalTokens: { $sum: "$totalTokens" },
            totalRequests: { $sum: 1 },
            totalCost: { $sum: "$costEstimateUSD" },
          },
        },
      ]),
      Conversation.aggregate([
        { $match: { organization: orgId } },
        { $group: { _id: "$priority", count: { $sum: 1 } } },
      ]),
    ]);

    const org = await Organization.findById(orgId).select("members settings");
    const teamMembersCount = (org?.members || []).length;

    const formattedPriority = {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    };
    priorityDistribution.forEach((p) => {
      if (p._id && formattedPriority[p._id] !== undefined) {
        formattedPriority[p._id] = p.count;
      }
    });

    const aiMetrics = aiStats[0] || {
      totalTokens: 0,
      totalRequests: 0,
      totalCost: 0,
    };

    return response(res, 200, "Business analytics fetched successfully", {
      overview: {
        totalConversations,
        activeConversations,
        resolvedConversations,
        urgentTickets,
        customersCount,
        teamMembersCount,
        resolutionRate: totalConversations > 0 ? Math.round((resolvedConversations / totalConversations) * 100) : 0,
      },
      priorityDistribution: formattedPriority,
      aiMetrics: {
        tokensUsed: aiMetrics.totalTokens,
        tokensQuota: org?.settings?.maxTokensPerMonth || 200000,
        requestsCount: aiMetrics.totalRequests,
        estimatedCostUSD: Number(aiMetrics.totalCost.toFixed(4)),
      },
    });
  } catch (err) {
    console.error("[BusinessAnalytics] getBusinessOverview error:", err);
    return response(res, 500, "Failed to fetch analytics", null, err.message);
  }
};

/**
 * Fetch team performance breakdown
 */
const getTeamPerformance = async (req, res) => {
  try {
    const orgId = req.organization._id;

    const agentActivity = await Conversation.aggregate([
      { $match: { organization: orgId, assignedAgent: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: "$assignedAgent",
          totalAssigned: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $eq: ["$ticketStatus", "resolved"] }, 1, 0] },
          },
          open: {
            $sum: { $cond: [{ $in: ["$ticketStatus", ["open", "pending"]] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "agent",
        },
      },
      { $unwind: "$agent" },
      {
        $project: {
          agentId: "$_id",
          agentName: "$agent.displayName",
          username: "$agent.username",
          profilePicture: "$agent.profilePicture",
          totalAssigned: 1,
          resolved: 1,
          open: 1,
        },
      },
    ]);

    return response(res, 200, "Team performance metrics fetched", agentActivity);
  } catch (err) {
    console.error("[BusinessAnalytics] getTeamPerformance error:", err);
    return response(res, 500, "Failed to fetch team performance", null, err.message);
  }
};

module.exports = {
  getBusinessOverview,
  getTeamPerformance,
};
