const express = require('express');
const router = express.Router();
const pushController = require('../controllers/pushController');
const authMiddleware = require('../middleware/authMiddleware');
const { pushLimiter } = require('../middleware/rateLimiter');

// All push routes require user authentication
router.get('/public-key', authMiddleware, pushController.getPublicKey);
router.post('/subscribe', authMiddleware, pushLimiter, pushController.subscribe);
router.delete('/subscribe', authMiddleware, pushController.unsubscribe);
router.post('/test', authMiddleware, pushLimiter, pushController.sendTestPush);

module.exports = router;
