const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

const followController = require('../controllers/followController');
const postController = require('../controllers/postController');
const reelController = require('../controllers/reelController');

// All /api/users routes require authentication
router.use(authMiddleware);

router.get('/me', userController.getMe);
router.patch('/me', userController.updateMe);
router.get('/search', userController.searchUsers);
router.get('/check-username/:username', userController.checkUsername);
router.get('/blocked', userController.getBlockedUsers);
router.post('/:id/block', userController.blockUser);
router.delete('/:id/block', userController.unblockUser);

router.get('/:id/followers', followController.getFollowers);
router.get('/:id/following', followController.getFollowing);
router.get('/:id/posts', postController.getUserPosts);
router.get('/:id/reels', reelController.getUserReels);
router.get('/:username', userController.getPublicProfile);

module.exports = router;
