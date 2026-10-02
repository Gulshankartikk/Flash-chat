const express = require('express');
const router = express.Router();
const shareController = require('../controllers/shareController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Share content into chats
router.post('/', shareController.shareContent);

// Get suggestions for the share sheet
router.get('/suggestions', shareController.getShareSuggestions);

module.exports = router;
