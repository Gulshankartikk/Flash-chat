const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Replies
router.get('/:id/replies', commentController.getCommentReplies);

// Delete comment / reply
router.delete('/:id', commentController.deleteComment);

// Like / unlike comment
router.post('/:id/like', commentController.likeComment);
router.delete('/:id/like', commentController.unlikeComment);

module.exports = router;
