const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/search', userController.searchUsers);
router.get('/:id', userController.getProfile);
router.patch('/profile', userController.updateProfile);

module.exports = router;
