const express = require('express');
const router = express.Router();
const exploreController = require('../controllers/exploreController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Explore trending grid
router.get('/explore', exploreController.getExplore);

// Hashtags
router.get('/hashtags/:tag', exploreController.getHashtagPosts);

// Search
router.get('/search', exploreController.searchSocial);

module.exports = router;
