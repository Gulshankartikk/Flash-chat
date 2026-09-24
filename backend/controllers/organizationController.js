const Organization = require("../models/Organization");
const Team = require("../models/Team");
const User = require("../models/user");
const AuditLog = require("../models/AuditLog");
const response = require("../utils/responseHandler");
const { ROLES } = require("../constants/roles");

/**
 * Create a new organization / business workspace
 */
const createOrganization = async (req, res) => {
  try {
    const { name, slug, description, website, businessEmail, category } = req.body;
    const userId = req.user._id;

    if (!name || !name.trim()) {
      return response(res, 400, "Organization name is required");
    }

    const cleanSlug = (slug || name)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 30);

    const existingOrg = await Organization.findOne({ slug: cleanSlug });
    if (existingOrg) {
      return response(res, 400, "Organization slug or name already taken. Please choose another.");
    }

    const org = await Organization.create({
      name: name.trim(),
      slug: cleanSlug,
      description: description || "",
      website: website || "",
      businessEmail: businessEmail || req.user.email,
      category: category || "General",
      owner: userId,
      members: [
        {
          user: userId,
          role: ROLES.OWNER,
          department: "Executive",
        },
      ],
    });

    // Update creator's currentOrganization
    await User.findByIdAndUpdate(userId, {
      currentOrganization: org._id,
      organizationRole: ROLES.OWNER,
    });

    // Audit log
    await AuditLog.create({
      organization: org._id,
      actor: userId,
      action: "ORGANIZATION_CREATED",
      entityType: "Organization",
      entityId: String(org._id),
      details: { name: org.name, slug: org.slug },
    });

    return response(res, 201, "Organization created successfully", org);
  } catch (err) {
    console.error("[OrgController] createOrganization error:", err);
    return response(res, 500, "Failed to create organization", null, err.message);
  }
};

/**
 * List organizations the authenticated user belongs to
 */
const getMyOrganizations = async (req, res) => {
  try {
    const userId = req.user._id;
    const orgs = await Organization.find({
      $or: [{ owner: userId }, { "members.user": userId }],
    }).populate("owner", "username email profilePicture");

    return response(res, 200, "Organizations fetched successfully", orgs);
  } catch (err) {
    console.error("[OrgController] getMyOrganizations error:", err);
    return response(res, 500, "Failed to fetch organizations", null, err.message);
  }
};

/**
 * Get organization profile details and member list
 */
const getOrganizationDetails = async (req, res) => {
  try {
    const org = await Organization.findById(req.organization._id)
      .populate("owner", "username email profilePicture")
      .populate("members.user", "username email profilePicture displayName isOnline lastSeen");

    return response(res, 200, "Organization details fetched", org);
  } catch (err) {
    console.error("[OrgController] getOrganizationDetails error:", err);
    return response(res, 500, "Failed to fetch organization details", null, err.message);
  }
};

/**
 * Update organization profile
 */
const updateOrganizationProfile = async (req, res) => {
  try {
    const { name, description, website, businessEmail, category, workingHours, settings } = req.body;
    const org = req.organization;

    if (name) org.name = name.trim();
    if (description !== undefined) org.description = description;
    if (website !== undefined) org.website = website;
    if (businessEmail !== undefined) org.businessEmail = businessEmail;
    if (category) org.category = category;
    if (workingHours) org.workingHours = { ...org.workingHours, ...workingHours };
    if (settings) org.settings = { ...org.settings, ...settings };

    await org.save();

    await AuditLog.create({
      organization: org._id,
      actor: req.user._id,
      action: "ORGANIZATION_UPDATED",
      entityType: "Organization",
      entityId: String(org._id),
      details: req.body,
    });

    return response(res, 200, "Organization profile updated", org);
  } catch (err) {
    console.error("[OrgController] updateOrganizationProfile error:", err);
    return response(res, 500, "Failed to update organization", null, err.message);
  }
};

/**
 * Add or invite member to organization by email or username
 */
const addMember = async (req, res) => {
  try {
    const { identifier, role, department } = req.body;
    const org = req.organization;

    if (!identifier) {
      return response(res, 400, "Email or username is required");
    }

    const targetUser = await User.findOne({
      $or: [{ email: identifier.toLowerCase().trim() }, { username: identifier.trim() }],
    });

    if (!targetUser) {
      return response(res, 404, "User not found with this email or username");
    }

    const isAlreadyMember = org.members.some(
      (m) => String(m.user) === String(targetUser._id)
    );

    if (isAlreadyMember) {
      return response(res, 400, "User is already a member of this organization");
    }

    const assignedRole = role && Object.values(ROLES).includes(role) ? role : ROLES.SUPPORT_AGENT;

    org.members.push({
      user: targetUser._id,
      role: assignedRole,
      department: department || "Customer Support",
    });

    await org.save();

    if (!targetUser.currentOrganization) {
      await User.findByIdAndUpdate(targetUser._id, {
        currentOrganization: org._id,
        organizationRole: assignedRole,
        department: department || "Customer Support",
      });
    }

    await AuditLog.create({
      organization: org._id,
      actor: req.user._id,
      action: "MEMBER_ADDED",
      entityType: "User",
      entityId: String(targetUser._id),
      details: { role: assignedRole, department },
    });

    const updatedOrg = await Organization.findById(org._id).populate(
      "members.user",
      "username email profilePicture displayName isOnline"
    );

    return response(res, 200, "Member added successfully", updatedOrg.members);
  } catch (err) {
    console.error("[OrgController] addMember error:", err);
    return response(res, 500, "Failed to add member", null, err.message);
  }
};

/**
 * Update member role or department
 */
const updateMemberRole = async (req, res) => {
  try {
    const { memberUserId } = req.params;
    const { role, department } = req.body;
    const org = req.organization;

    const member = org.members.find((m) => String(m.user) === String(memberUserId));
    if (!member) {
      return response(res, 404, "Member not found in organization");
    }

    if (role && Object.values(ROLES).includes(role)) {
      member.role = role;
    }
    if (department) {
      member.department = department;
    }

    await org.save();

    // Sync to user record if it's their active org
    await User.findOneAndUpdate(
      { _id: memberUserId, currentOrganization: org._id },
      { organizationRole: member.role, department: member.department }
    );

    await AuditLog.create({
      organization: org._id,
      actor: req.user._id,
      action: "MEMBER_ROLE_UPDATED",
      entityType: "User",
      entityId: String(memberUserId),
      details: { role, department },
    });

    return response(res, 200, "Member role updated successfully", member);
  } catch (err) {
    console.error("[OrgController] updateMemberRole error:", err);
    return response(res, 500, "Failed to update member role", null, err.message);
  }
};

/**
 * Remove member from organization
 */
const removeMember = async (req, res) => {
  try {
    const { memberUserId } = req.params;
    const org = req.organization;

    if (String(org.owner) === String(memberUserId)) {
      return response(res, 400, "Cannot remove the owner of the organization");
    }

    org.members = org.members.filter((m) => String(m.user) !== String(memberUserId));
    await org.save();

    await User.findOneAndUpdate(
      { _id: memberUserId, currentOrganization: org._id },
      { $unset: { currentOrganization: 1 }, organizationRole: ROLES.CUSTOMER }
    );

    await AuditLog.create({
      organization: org._id,
      actor: req.user._id,
      action: "MEMBER_REMOVED",
      entityType: "User",
      entityId: String(memberUserId),
    });

    return response(res, 200, "Member removed from organization");
  } catch (err) {
    console.error("[OrgController] removeMember error:", err);
    return response(res, 500, "Failed to remove member", null, err.message);
  }
};

/**
 * Team Management inside Organization
 */
const createTeam = async (req, res) => {
  try {
    const { name, department, description, leadId } = req.body;
    const orgId = req.organization._id;

    if (!name || !name.trim()) {
      return response(res, 400, "Team name is required");
    }

    const team = await Team.create({
      organization: orgId,
      name: name.trim(),
      department: department || "General",
      description: description || "",
      lead: leadId || req.user._id,
      members: leadId ? [leadId] : [req.user._id],
    });

    return response(res, 201, "Team created successfully", team);
  } catch (err) {
    console.error("[OrgController] createTeam error:", err);
    return response(res, 500, "Failed to create team", null, err.message);
  }
};

const getTeams = async (req, res) => {
  try {
    const teams = await Team.find({ organization: req.organization._id })
      .populate("lead", "username email profilePicture")
      .populate("members", "username email profilePicture");

    return response(res, 200, "Teams fetched successfully", teams);
  } catch (err) {
    console.error("[OrgController] getTeams error:", err);
    return response(res, 500, "Failed to fetch teams", null, err.message);
  }
};

module.exports = {
  createOrganization,
  getMyOrganizations,
  getOrganizationDetails,
  updateOrganizationProfile,
  addMember,
  updateMemberRole,
  removeMember,
  createTeam,
  getTeams,
};
