const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const authMiddleware = require('../middleware/authMiddleware');

const commentController = require('../controllers/commentController');

router.use(authMiddleware);

// Post Feed
router.get('/feed', postController.getFeedPosts);

// Single Post CRUD
router.post('/', postController.createPost);
router.get('/:id', postController.getPostById);
router.patch('/:id', postController.updatePost);
router.delete('/:id', postController.deletePost);

// Comments on Post
router.get('/:targetId/comments', (req, res, next) => {
  req.params.targetType = 'post';
  commentController.getTargetComments(req, res, next);
});
router.post('/:targetId/comments', (req, res, next) => {
  req.params.targetType = 'post';
  commentController.createComment(req, res, next);
});

// Post Likes & Bookmarks
router.post('/:id/like', postController.likePost);
router.delete('/:id/like', postController.unlikePost);
router.post('/:id/save', postController.savePost);
router.delete('/:id/save', postController.unsavePost);

module.exports = router;
