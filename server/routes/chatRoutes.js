const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Core conversation routes
router.get('/', chatController.getUserChats);
router.post('/direct', chatController.createOrGetDirectChat);
router.post('/group', chatController.createGroupChat);
router.get('/search/messages', chatController.searchMessages);

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
