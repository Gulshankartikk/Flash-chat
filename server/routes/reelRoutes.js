const express = require('express');
const router = express.Router();
const reelController = require('../controllers/reelController');
const commentController = require('../controllers/commentController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Reels Feed
router.get('/feed', reelController.getReelsFeed);

// Single Reel CRUD
router.post('/', reelController.createReel);
router.get('/:id', reelController.getReelById);

// Reel Interactions
router.post('/:id/like', reelController.likeReel);
router.delete('/:id/like', reelController.unlikeReel);
router.post('/:id/save', reelController.saveReel);
router.delete('/:id/save', reelController.unsaveReel);
router.post('/:id/view', reelController.registerView);

// Comments on Reel
router.get('/:targetId/comments', (req, res, next) => {
  req.params.targetType = 'reels';
  commentController.getTargetComments(req, res, next);
});
router.post('/:targetId/comments', (req, res, next) => {
  req.params.targetType = 'reels';
  commentController.createComment(req, res, next);
});

module.exports = router;
