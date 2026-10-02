const express = require('express');
const multer = require('multer');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const mediaService = require('../services/mediaService');

// Multer memory storage for direct Cloudinary streaming or local disk fallback
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max file size
  }
});

/**
 * Upload single media file (image, avatar, audio, video, document)
 */
router.post('/', authMiddleware, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const folder = req.body.folder || 'flashchat/uploads';
    const resourceType = req.body.resourceType || 'auto';

    const result = await mediaService.uploadFile(req.file, { folder, resource_type: resourceType });

    return res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      file: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Upload avatar specifically
 */
router.post('/avatar', authMiddleware, upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No avatar uploaded' });
    }

    const result = await mediaService.uploadFile(req.file, { folder: 'flashchat/avatars', resource_type: 'image' });

    return res.status(200).json({
      success: true,
      url: result.url
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
