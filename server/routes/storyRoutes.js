const express = require('express');
const router = express.Router();
const storyController = require('../controllers/storyController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Tray
router.get('/tray', storyController.getStoriesTray);

// Story CRUD & Interactions
router.post('/', storyController.createStory);
router.post('/:id/view', storyController.viewStory);
router.get('/:id/viewers', storyController.getStoryViewers);
router.delete('/:id', storyController.deleteStory);

// Cross-linking reply to direct chat
router.post('/:id/reply', storyController.replyToStory);

module.exports = router;
