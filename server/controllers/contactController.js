const contactService = require('../services/contactService');
const chatService = require('../services/chatService');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const asyncHandler = require('../middleware/asyncHandler');

exports.getContacts = asyncHandler(async (req, res) => {
  const { q, favorites, page, limit, groupByLetter } = req.query;
  const result = await contactService.getContacts(req.user._id, {
    q,
    favorites,
    page,
    limit,
    groupByLetter
  });
  res.status(200).json({ success: true, ...result });
});

exports.getContactById = asyncHandler(async (req, res) => {
  const contact = await contactService.getContactById(req.user._id, req.params.id);
  res.status(200).json({ success: true, contact });
});

exports.createContact = asyncHandler(async (req, res) => {
  const contact = await contactService.createContact(req.user._id, req.body);
  res.status(201).json({ success: true, contact });
});

exports.updateContact = asyncHandler(async (req, res) => {
  const contact = await contactService.updateContact(req.user._id, req.params.id, req.body);
  res.status(200).json({ success: true, contact });
});

exports.deleteContact = asyncHandler(async (req, res) => {
  const result = await contactService.deleteContact(req.user._id, req.params.id);
  res.status(200).json(result);
});

exports.bulkImportContacts = asyncHandler(async (req, res) => {
  const contacts = req.body.contacts || req.body;
  const result = await contactService.bulkImport(req.user._id, contacts);
  res.status(200).json({ success: true, ...result });
});

exports.startChatWithContact = asyncHandler(async (req, res) => {
  const contact = await contactService.getContactById(req.user._id, req.params.id);

  if (contact.linkedUser) {
    const targetUserId = contact.linkedUser._id || contact.linkedUser;
    const conversation = await chatService.getOrCreateDirectConversation(req.user._id, targetUserId);
    return res.status(200).json({ success: true, conversation });
  }

  if (contact.phone) {
    const phoneResult = await chatService.startChatByPhone(req.user._id, {
      phone: contact.phone,
      name: contact.name,
      saveContact: false
    });

    if (phoneResult.status === 'ready') {
      const conversation = await Conversation.findById(phoneResult.conversationId)
        .populate('members.user', '_id name username avatar isOnline lastSeen privacy')
        .populate('lastMessage');
      return res.status(200).json({ success: true, conversation: conversation || { _id: phoneResult.conversationId } });
    }

    return res.status(200).json({
      success: true,
      status: 'pending',
      pendingId: phoneResult.pendingId,
      canInvite: phoneResult.canInvite
    });
  }

  return res.status(404).json({
    success: false,
    message: 'This contact is not registered on Flash Chat yet. You can send them an invitation!'
  });
});


exports.inviteContact = asyncHandler(async (req, res) => {
  const result = await contactService.inviteContact(req.user._id, req.params.id);
  res.status(200).json(result);
});
