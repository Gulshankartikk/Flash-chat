const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { authLimiter, mailLimiter } = require('../middleware/rateLimiter');

// OTP Auth routes
router.post('/send-otp', mailLimiter, authController.sendOtp);
router.post('/verify-otp', authLimiter, authController.verifyOtp);
router.post('/refresh-token', authController.refreshToken);
router.post('/onboard', authMiddleware, authController.onboarding);
router.post('/onboarding', authMiddleware, authController.onboarding);
router.get('/check-username/:username', authController.checkUsername);
router.get('/sessions', authMiddleware, authController.getSessions);
router.post('/logout', authMiddleware, authController.logout);
router.post('/logout-all', authMiddleware, authController.logoutAll);
router.get('/me', authMiddleware, authController.getMe);

// Legacy routes (backward compatibility)
router.post('/signup', authLimiter, authController.signup);
router.post('/login', authLimiter, authController.login);
router.post('/google', authLimiter, authController.googleAuth);

module.exports = router;
