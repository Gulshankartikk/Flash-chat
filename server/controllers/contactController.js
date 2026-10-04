const contactService = require('../services/contactService');
const chatService = require('../services/chatService');
const Contact = require('../models/Contact');
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

  if (!contact.linkedUser) {
    return res.status(404).json({
      success: false,
      message: 'This contact is not registered on Flash Chat yet. You can send them an invitation!'
    });
  }

  const conversation = await chatService.getOrCreateDirectConversation(
    req.user._id,
    contact.linkedUser._id || contact.linkedUser
  );

  res.status(200).json({ success: true, conversation });
});

exports.inviteContact = asyncHandler(async (req, res) => {
  const result = await contactService.inviteContact(req.user._id, req.params.id);
  res.status(200).json(result);
});
