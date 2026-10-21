const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');
const { chatByPhoneLimiter, dailyLookupLimiter } = require('../middleware/rateLimiter');

router.use(authMiddleware);

// Core conversation routes
router.get('/', chatController.getUserChats);
router.post('/', (req, res, next) => {
  if (req.body && (req.body.isGroup || req.body.type === 'group' || Array.isArray(req.body.memberIds))) {
    return chatController.createGroupChat(req, res, next);
  }
  return chatController.createOrGetDirectChat(req, res, next);
});
router.post('/direct', chatController.createOrGetDirectChat);
router.post('/group', chatController.createGroupChat);
router.get('/search/messages', chatController.searchMessages);

// Start chat by phone & Pending conversation routes
router.post('/by-phone', chatByPhoneLimiter, dailyLookupLimiter, chatController.startChatByPhone);
router.get('/pending', chatController.getPendingConversations);
router.post('/pending/:id/messages', chatController.queuePendingMessage);
router.delete('/pending/:id', chatController.deletePendingConversation);

// Message request actions
router.post('/:id/accept', chatController.acceptMessageRequest);
router.post('/:id/reject', chatController.rejectMessageRequest);

// Invite routes
router.get('/join/:inviteCode', chatController.joinByInvite);
router.post('/join/:inviteCode', chatController.joinByInvite);

// Specific conversation endpoints
router.get('/:id', chatController.getChatById);
router.patch('/:id', chatController.updateChat);
router.patch('/:id/settings', chatController.updateChatSettings);
router.get('/:id/messages', chatController.getMessages);
router.get('/:id/media', chatController.getChatMedia);

// Group membership endpoints
router.post('/:id/members', chatController.addMember);
router.delete('/:id/members/:userId', chatController.removeMember);
router.patch('/:id/members/:userId/role', chatController.updateMemberRole);
router.post('/:id/leave', chatController.leaveGroup);
router.post('/:id/invite/reset', chatController.resetInviteCode);

module.exports = router;
