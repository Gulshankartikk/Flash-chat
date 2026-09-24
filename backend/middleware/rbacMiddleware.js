const Organization = require("../models/Organization");
const { ROLES, ROLE_PERMISSIONS, ROLE_HIERARCHY } = require("../constants/roles");
const response = require("../utils/responseHandler");

/**
 * Ensures user is authenticated and is a member of the target organization.
 * Extracts orgId from header 'x-organization-id', query param 'orgId', or route param 'orgId'/'id'.
 */
const requireOrgMember = async (req, res, next) => {
  try {
    const orgId =
      req.headers["x-organization-id"] ||
      req.params.orgId ||
      req.params.organizationId ||
      req.query.orgId ||
      req.user?.currentOrganization;

    if (!orgId) {
      return response(res, 400, "Organization ID is required in headers or parameters", null, "MISSING_ORG_ID");
    }

    const org = await Organization.findById(orgId);
    if (!org) {
      return response(res, 404, "Organization not found", null, "ORG_NOT_FOUND");
    }

    // Check membership
    const userIdStr = String(req.user._id);
    const isOwner = String(org.owner) === userIdStr;
    const member = org.members.find((m) => String(m.user) === userIdStr);

    if (!isOwner && !member && !req.user.isPlatformAdmin) {
      return response(res, 403, "You are not a member of this organization", null, "FORBIDDEN_ORG_MEMBER");
    }

    const effectiveRole = isOwner ? ROLES.OWNER : member ? member.role : ROLES.CUSTOMER;

    req.organization = org;
    req.orgMember = member || { user: req.user._id, role: effectiveRole };
    req.userOrgRole = effectiveRole;

    next();
  } catch (err) {
    console.error("[RBAC] Error resolving organization:", err);
    return response(res, 500, "Internal server error resolving organization membership", null, err.message);
  }
};

/**
 * Checks if user has one of the allowed roles in the active organization.
 */
const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (req.user?.isPlatformAdmin) return next();

    const userRole = req.userOrgRole || req.user?.organizationRole || ROLES.CUSTOMER;
    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!rolesArray.includes(userRole)) {
      return response(
        res,
        403,
        `Access denied. Requires one of roles: [${rolesArray.join(", ")}]. Your role: ${userRole}`,
        null,
        "FORBIDDEN_ROLE"
      );
    }
    next();
  };
};

/**
 * Checks if user has a specific permission based on their role in the organization.
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (req.user?.isPlatformAdmin) return next();

    const userRole = req.userOrgRole || req.user?.organizationRole || ROLES.CUSTOMER;
    const grantedPermissions = ROLE_PERMISSIONS[userRole] || [];

    if (!grantedPermissions.includes(permission)) {
      return response(
        res,
        403,
        `Access denied. Permission '${permission}' is required.`,
        null,
        "FORBIDDEN_PERMISSION"
      );
    }
    next();
  };
};

/**
 * Platform superadmin protection.
 */
const requirePlatformAdmin = (req, res, next) => {
  if (!req.user || !req.user.isPlatformAdmin) {
    return response(res, 403, "Platform Administrator access required", null, "FORBIDDEN_ADMIN");
  }
  next();
};

module.exports = {
  requireOrgMember,
  requireRole,
  requirePermission,
  requirePlatformAdmin,
};
