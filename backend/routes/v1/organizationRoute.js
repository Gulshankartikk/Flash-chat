const express = require("express");
const organizationController = require("../../controllers/organizationController");
const authMiddleware = require("../../middleware/authMiddleware");
const { requireOrgMember, requireRole, requirePermission } = require("../../middleware/rbacMiddleware");
const { ROLES, PERMISSIONS } = require("../../constants/roles");

const router = express.Router();

// List user's organizations and create new org
router.get("/my", authMiddleware, organizationController.getMyOrganizations);
router.post("/create", authMiddleware, organizationController.createOrganization);

// Organization specific actions (requires membership)
router.get("/:orgId", authMiddleware, requireOrgMember, organizationController.getOrganizationDetails);
router.put(
  "/:orgId/profile",
  authMiddleware,
  requireOrgMember,
  requirePermission(PERMISSIONS.ORG_MANAGE),
  organizationController.updateOrganizationProfile
);

// Member management
router.post(
  "/:orgId/members",
  authMiddleware,
  requireOrgMember,
  requirePermission(PERMISSIONS.MEMBER_INVITE),
  organizationController.addMember
);
router.put(
  "/:orgId/members/:memberUserId/role",
  authMiddleware,
  requireOrgMember,
  requirePermission(PERMISSIONS.MEMBER_MANAGE_ROLE),
  organizationController.updateMemberRole
);
router.delete(
  "/:orgId/members/:memberUserId",
  authMiddleware,
  requireOrgMember,
  requirePermission(PERMISSIONS.MEMBER_REMOVE),
  organizationController.removeMember
);

// Teams
router.get("/:orgId/teams", authMiddleware, requireOrgMember, organizationController.getTeams);
router.post(
  "/:orgId/teams",
  authMiddleware,
  requireOrgMember,
  requirePermission(PERMISSIONS.TEAM_MANAGE),
  organizationController.createTeam
);

module.exports = router;
