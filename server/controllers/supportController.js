const supportService = require('../services/supportService');
const SupportFaq = require('../models/SupportFaq');
const SupportCannedReply = require('../models/SupportCannedReply');
const asyncHandler = require('../middleware/asyncHandler');

// ---------------------------------------------------------------------------
// 1. User Support Routes
// ---------------------------------------------------------------------------

exports.createTicket = asyncHandler(async (req, res) => {
  const io = req.app.get('io');
  const ticket = await supportService.createTicket(req.user._id, req.body, io);
  res.status(201).json({ success: true, ticket });
});

exports.getUserTickets = asyncHandler(async (req, res) => {
  const tickets = await supportService.getUserTickets(req.user._id);
  res.status(200).json({ success: true, tickets });
});

exports.getTicketDetail = asyncHandler(async (req, res) => {
  const ticket = await supportService.getTicketDetail(req.params.id, req.user._id);
  res.status(200).json({ success: true, ticket });
});

exports.requestHumanHandoff = asyncHandler(async (req, res) => {
  const io = req.app.get('io');
  const ticket = await supportService.requestHumanHandoff(req.params.id, req.user._id, io);
  res.status(200).json({ success: true, message: 'Human agent requested.', ticket });
});

exports.rateTicket = asyncHandler(async (req, res) => {
  const result = await supportService.rateTicket(req.params.id, req.user._id, req.body);
  res.status(200).json(result);
});

exports.closeTicket = asyncHandler(async (req, res) => {
  const io = req.app.get('io');
  const result = await supportService.closeTicket(req.params.id, req.user._id, io);
  res.status(200).json(result);
});

exports.getFaq = asyncHandler(async (req, res) => {
  const { category, search } = req.query;
  const query = { isActive: true };
  if (category) query.category = category;
  if (search && search.trim()) {
    query.$or = [
      { question: { $regex: search.trim(), $options: 'i' } },
      { answer: { $regex: search.trim(), $options: 'i' } }
    ];
  }
  const faqs = await SupportFaq.find(query).sort({ order: 1 }).lean();
  res.status(200).json({ success: true, faqs });
});

exports.getSupportPolicy = (req, res) => {
  const policy = supportService.getSupportPolicy();
  res.status(200).json({ success: true, policy });
};

// ---------------------------------------------------------------------------
// 2. Admin & Support Agent Routes
// ---------------------------------------------------------------------------

exports.getAdminTickets = asyncHandler(async (req, res) => {
  const { status, category, assignedTo, search, page, limit } = req.query;
  const result = await supportService.getAdminTickets({
    status,
    category,
    assignedTo,
    search,
    page,
    limit
  });
  res.status(200).json({ success: true, ...result });
});

exports.updateAdminTicket = asyncHandler(async (req, res) => {
  const ticket = await supportService.updateAdminTicket(req.params.id, req.body);
  res.status(200).json({ success: true, ticket });
});

exports.agentReply = asyncHandler(async (req, res) => {
  const io = req.app.get('io');
  const message = await supportService.agentReply(req.user._id, req.params.id, req.body, io);
  res.status(200).json({ success: true, message });
});

exports.getCannedReplies = asyncHandler(async (req, res) => {
  const cannedReplies = await SupportCannedReply.find().sort({ shortcut: 1 }).lean();
  res.status(200).json({ success: true, cannedReplies });
});

exports.createCannedReply = asyncHandler(async (req, res) => {
  const { shortcut, title, content, category } = req.body;
  const reply = await SupportCannedReply.create({
    shortcut: shortcut.toLowerCase().trim(),
    title: title.trim(),
    content: content.trim(),
    category: category || 'general',
    createdBy: req.user._id
  });
  res.status(201).json({ success: true, reply });
});

exports.deleteCannedReply = asyncHandler(async (req, res) => {
  await SupportCannedReply.findByIdAndDelete(req.params.id);
  res.status(200).json({ success: true, message: 'Canned reply deleted.' });
});
