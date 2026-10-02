const express = require('express');
const router = express.Router();
const followController = require('../controllers/followController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Follow requests
router.get('/requests', followController.getPendingRequests);
router.post('/requests/:id/accept', followController.acceptFollowRequest);
router.post('/requests/:id/reject', followController.rejectFollowRequest);

// Follow / Unfollow actions
router.post('/:userId', followController.followUser);
router.delete('/:userId', followController.unfollowUser);

module.exports = router;
