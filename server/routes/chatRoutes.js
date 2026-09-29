const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', chatController.getChats);
router.post('/private', chatController.createPrivateChat);
router.post('/group', chatController.createGroupChat);
router.get('/:chatId', chatController.getChatById);

module.exports = router;
