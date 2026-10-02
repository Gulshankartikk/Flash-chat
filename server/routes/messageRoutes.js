const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', messageController.sendMessage);
router.patch('/read/:chatId', messageController.markChatAsRead);
router.post('/forward', messageController.forwardMessage);
router.patch('/:id', messageController.editMessage);
router.delete('/:id', messageController.deleteMessage);
router.post('/:id/react', messageController.reactMessage);
router.post('/:id/star', messageController.starMessage);

module.exports = router;
