const express = require('express');
const router = express.Router();
const mailController = require('../controllers/mailController');
const authMiddleware = require('../middleware/authMiddleware');
const { mailLimiter } = require('../middleware/rateLimiter');

// POST /api/mail/test (protected, dev/admin test route)
router.post('/test', authMiddleware, mailLimiter, mailController.sendTestEmail);

module.exports = router;
