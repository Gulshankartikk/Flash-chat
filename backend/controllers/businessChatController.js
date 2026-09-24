const Conversation = require("../models/Conversation");
const Message = require("../models/message");
const User = require("../models/user");
const BusinessCustomer = require("../models/BusinessCustomer");
const AuditLog = require("../models/AuditLog");
const response = require("../utils/responseHandler");

/**
 * Fetch support inbox conversations for the active organization
 */
const getSupportInbox = async (req, res) => {
  try {
    const orgId = req.organization._id;
    const { status, priority, filter, page = 1, limit = 30, search } = req.query;

    const query = {
      organization: orgId,
      channelType: { $in: ["support_ticket", "lead", "group", "personal"] },
    };

    if (status && status !== "all") {
      query.ticketStatus = status;
    }

    if (priority && priority !== "all") {
      query.priority = priority;
    }

    if (filter === "assigned_to_me") {
      query.assignedAgent = req.user._id;
    } else if (filter === "unassigned") {
      query.assignedAgent = { $exists: false };
    }

    const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const conversations = await Conversation.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("participants", "username email profilePicture displayName isOnline lastSeen")
      .populate("assignedAgent", "username email profilePicture displayName")
      .populate("lastMessage")
      .populate("internalNotes.author", "username profilePicture");

    const total = await Conversation.countDocuments(query);

    return response(res, 200, "Support inbox conversations retrieved", {
      conversations,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error("[BusinessChat] getSupportInbox error:", err);
    return response(res, 500, "Failed to retrieve support inbox", null, err.message);
  }
};

/**
 * Assign conversation ticket to a support agent
 */
const assignTicket = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { agentId } = req.body;
    const orgId = req.organization._id;

    let targetAgent = null;
    if (agentId) {
      targetAgent = await User.findById(agentId);
      if (!targetAgent) {
        return response(res, 404, "Target agent user not found");
      }
    }

    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, organization: orgId },
      { assignedAgent: agentId || null },
      { new: true }
    )
      .populate("assignedAgent", "username email profilePicture displayName")
      .populate("participants", "username email profilePicture displayName");

    if (!conversation) {
      return response(res, 404, "Conversation not found in this organization");
    }

    // Socket notification to agent
    if (req.io && agentId) {
      req.io.to(String(agentId)).emit("business_ticket_assigned", {
        conversationId,
        assignedBy: { _id: req.user._id, username: req.user.username },
        conversation,
      });
    }

    await AuditLog.create({
      organization: orgId,
      actor: req.user._id,
      action: "TICKET_ASSIGNED",
      entityType: "Conversation",
      entityId: String(conversationId),
      details: { assignedTo: agentId },
    });

    return response(res, 200, "Ticket assigned successfully", conversation);
  } catch (err) {
    console.error("[BusinessChat] assignTicket error:", err);
    return response(res, 500, "Failed to assign ticket", null, err.message);
  }
};

/**
 * Update conversation ticket status (open, pending, resolved, closed)
 */
const updateTicketStatus = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { status } = req.body;
    const orgId = req.organization._id;

    if (!["open", "pending", "resolved", "closed"].includes(status)) {
      return response(res, 400, "Invalid status. Allowed: open, pending, resolved, closed");
    }

    const updateFields = { ticketStatus: status };
    if (status === "resolved") updateFields.resolvedAt = new Date();
    if (status === "closed") updateFields.closedAt = new Date();

    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, organization: orgId },
      updateFields,
      { new: true }
    )
      .populate("assignedAgent", "username email profilePicture displayName")
      .populate("participants", "username email profilePicture displayName");

    if (!conversation) {
      return response(res, 404, "Conversation not found");
    }

    if (req.io) {
      req.io.to(`org_${orgId}`).emit("business_ticket_updated", {
        conversationId,
        ticketStatus: status,
        updatedBy: req.user._id,
      });
    }

    return response(res, 200, `Ticket status updated to ${status}`, conversation);
  } catch (err) {
    console.error("[BusinessChat] updateTicketStatus error:", err);
    return response(res, 500, "Failed to update ticket status", null, err.message);
  }
};

/**
 * Update conversation priority (low, medium, high, urgent)
 */
const updateTicketPriority = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { priority } = req.body;
    const orgId = req.organization._id;

    if (!["low", "medium", "high", "urgent"].includes(priority)) {
      return response(res, 400, "Invalid priority. Allowed: low, medium, high, urgent");
    }

    const conversation = await Conversation.findOneAndUpdate(
      { _id: conversationId, organization: orgId },
      { priority },
      { new: true }
    );

    if (!conversation) {
      return response(res, 404, "Conversation not found");
    }

    return response(res, 200, `Ticket priority updated to ${priority}`, conversation);
  } catch (err) {
    console.error("[BusinessChat] updateTicketPriority error:", err);
    return response(res, 500, "Failed to update ticket priority", null, err.message);
  }
};

/**
 * Add internal team note (visible only to team members, not to customer)
 */
const addInternalNote = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { text } = req.body;
    const orgId = req.organization._id;

    if (!text || !text.trim()) {
      return response(res, 400, "Note text is required");
    }

    const conversation = await Conversation.findOne({ _id: conversationId, organization: orgId });
    if (!conversation) {
      return response(res, 404, "Conversation not found");
    }

    const note = {
      author: req.user._id,
      text: text.trim(),
      createdAt: new Date(),
    };

    conversation.internalNotes.push(note);
    await conversation.save();

    const populated = await Conversation.findById(conversationId)
      .populate("internalNotes.author", "username profilePicture displayName");

    const savedNote = populated.internalNotes[populated.internalNotes.length - 1];

    return response(res, 201, "Internal note added", savedNote);
  } catch (err) {
    console.error("[BusinessChat] addInternalNote error:", err);
    return response(res, 500, "Failed to add internal note", null, err.message);
  }
};

/**
 * Transfer conversation to another agent or department
 */
const transferTicket = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { targetAgentId, department, note } = req.body;
    const orgId = req.organization._id;

    const conversation = await Conversation.findOne({ _id: conversationId, organization: orgId });
    if (!conversation) {
      return response(res, 404, "Conversation not found");
    }

    if (targetAgentId) conversation.assignedAgent = targetAgentId;
    if (department) conversation.department = department;

    if (note && note.trim()) {
      conversation.internalNotes.push({
        author: req.user._id,
        text: `[Transfer Note]: ${note.trim()}`,
        createdAt: new Date(),
      });
    }

    await conversation.save();

    const updated = await Conversation.findById(conversationId)
      .populate("assignedAgent", "username email profilePicture displayName")
      .populate("internalNotes.author", "username profilePicture");

    return response(res, 200, "Conversation transferred successfully", updated);
  } catch (err) {
    console.error("[BusinessChat] transferTicket error:", err);
    return response(res, 500, "Failed to transfer ticket", null, err.message);
  }
};

module.exports = {
  getSupportInbox,
  assignTicket,
  updateTicketStatus,
  updateTicketPriority,
  addInternalNote,
  transferTicket,
};
