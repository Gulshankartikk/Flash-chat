const express = require("express");
const businessChatController = require("../../controllers/businessChatController");
const businessAnalyticsController = require("../../controllers/businessAnalyticsController");
const authMiddleware = require("../../middleware/authMiddleware");
const { requireOrgMember, requirePermission } = require("../../middleware/rbacMiddleware");
const { PERMISSIONS } = require("../../constants/roles");

const router = express.Router();

// Support Inbox
router.get(
  "/inbox",
  authMiddleware,
  requireOrgMember,
  requirePermission(PERMISSIONS.INBOX_VIEW_ALL),
  businessChatController.getSupportInbox
);

// Ticket actions
router.put(
  "/tickets/:conversationId/assign",
  authMiddleware,
  requireOrgMember,
  requirePermission(PERMISSIONS.INBOX_ASSIGN),
  businessChatController.assignTicket
);

router.put(
  "/tickets/:conversationId/status",
  authMiddleware,
  requireOrgMember,
  requirePermission(PERMISSIONS.INBOX_RESOLVE),
  businessChatController.updateTicketStatus
);

router.put(
  "/tickets/:conversationId/priority",
  authMiddleware,
  requireOrgMember,
  requirePermission(PERMISSIONS.INBOX_ASSIGN),
  businessChatController.updateTicketPriority
);

router.post(
  "/tickets/:conversationId/notes",
  authMiddleware,
  requireOrgMember,
  requirePermission(PERMISSIONS.INBOX_INTERNAL_NOTES),
  businessChatController.addInternalNote
);

router.put(
  "/tickets/:conversationId/transfer",
  authMiddleware,
  requireOrgMember,
  requirePermission(PERMISSIONS.INBOX_TRANSFER),
  businessChatController.transferTicket
);

// Analytics
router.get(
  "/analytics/overview",
  authMiddleware,
  requireOrgMember,
  requirePermission(PERMISSIONS.ANALYTICS_VIEW),
  businessAnalyticsController.getBusinessOverview
);

router.get(
  "/analytics/team",
  authMiddleware,
  requireOrgMember,
  requirePermission(PERMISSIONS.ANALYTICS_VIEW),
  businessAnalyticsController.getTeamPerformance
);

module.exports = router;
