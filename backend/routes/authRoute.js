const express = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { multerMiddleware } = require('../config/cloudinaryConfig');

const router = express.Router();

router.post('/send-otp', authController.sendOtp);
router.post('/verify-otp', authController.verifyOtp);
router.get('/logout', authController.logout);
router.post('/logout', authController.logout);
router.get('/check-username/:username', authController.checkUsernameAvailability);

// Protected routes
router.put(
  '/update-profile',
  authMiddleware,
  multerMiddleware,
  authController.updateProfile
);

router.get(
  '/check-auth',
  authController.checkAuthenticated
);

router.get(
  '/users',
  authMiddleware,
  authController.getAllUser
);

router.post(
  '/block/:userId',
  authMiddleware,
  authController.blockUser
);

router.post(
  '/unblock/:userId',
  authMiddleware,
  authController.unblockUser
);

router.get(
  '/blocked-users',
  authMiddleware,
  authController.getBlockedUsers
);

router.put(
  '/privacy-settings',
  authMiddleware,
  authController.updatePrivacySettings
);

module.exports = router;
