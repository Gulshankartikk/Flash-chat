const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(authMiddleware);

router.get('/:chatId', messageController.getMessages);
router.post('/', upload.single('attachment'), messageController.sendMessage);
router.put('/:messageId', messageController.editMessage);
router.delete('/:messageId', messageController.deleteMessage);
router.patch('/read/:chatId', messageController.markAsRead);

module.exports = router;
