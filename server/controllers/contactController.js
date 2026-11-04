const contactService = require('../services/contactService');
const chatService = require('../services/chatService');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
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

  const currentUser = await User.findById(req.user._id).lean();
  const isSelf =
    (contact.linkedUser && String(contact.linkedUser._id || contact.linkedUser) === String(req.user._id)) ||
    (currentUser?.phoneNumber && contact.phone && contact.phone.trim() === currentUser.phoneNumber.trim()) ||
    (currentUser?.email && contact.email && contact.email.toLowerCase().trim() === currentUser.email.toLowerCase().trim());

  if (isSelf) {
    const rawConv = await chatService.getOrCreateSelfConversation(req.user._id);
    const conversation = (await chatService.getFormattedConversation(rawConv._id, req.user._id)) || rawConv;

    if (req.io) {
      req.io.to(`user:${req.user._id}`).emit('conversation:updated', {
        conversationId: conversation._id,
        conversation
      });
    }

    return res.status(200).json({ success: true, conversation });
  }

  if (contact.linkedUser) {
    const targetUserId = contact.linkedUser._id || contact.linkedUser;
    const rawConv = await chatService.getOrCreateDirectConversation(req.user._id, targetUserId);
    const conversation = (await chatService.getFormattedConversation(rawConv._id, req.user._id)) || rawConv;

    if (req.io) {
      req.io.to(`user:${req.user._id}`).emit('conversation:updated', {
        conversationId: conversation._id,
        conversation
      });
      req.io.to(`user:${targetUserId}`).emit('conversation:updated', {
        conversationId: rawConv._id
      });
    }

    return res.status(200).json({ success: true, conversation });
  }

  if (contact.phone) {
    const phoneResult = await chatService.startChatByPhone(req.user._id, {
      phone: contact.phone,
      name: contact.name,
      saveContact: false
    });

    if (phoneResult.status === 'ready') {
      const conversation = (await chatService.getFormattedConversation(phoneResult.conversationId, req.user._id)) || { _id: phoneResult.conversationId };

      if (req.io) {
        req.io.to(`user:${req.user._id}`).emit('conversation:updated', {
          conversationId: phoneResult.conversationId,
          conversation
        });
      }

      return res.status(200).json({ success: true, conversation });
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
