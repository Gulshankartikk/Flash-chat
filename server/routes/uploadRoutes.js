const express = require('express');
const router = express.Router();
const { upload, verifyUploadedFile } = require('../middleware/uploadMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadLimiter } = require('../middleware/rateLimiter');
const mediaService = require('../services/mediaService');
const logger = require('../utils/logger');

/**
 * Determine Cloudinary resource_type and normalized type from mimetype
 */
const getResourceTypeAndType = (mimetype) => {
  if (mimetype.startsWith('image/')) return { resourceType: 'image', type: 'image' };
  if (mimetype.startsWith('video/')) return { resourceType: 'video', type: 'video' };
  if (mimetype.startsWith('audio/')) return { resourceType: 'video', type: 'audio' };
  if (mimetype === 'application/pdf') return { resourceType: 'raw', type: 'pdf' };
  return { resourceType: 'auto', type: 'file' };
};

/**
 * POST /api/upload
 * Returns: { url, publicId, type }
 */
router.post('/', authMiddleware, uploadLimiter, upload.single('file'), verifyUploadedFile, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please provide a file in the form field "file".'
      });
    }

    const { resourceType, type } = getResourceTypeAndType(req.file.mimetype);
    const folder = req.body.folder || 'flashchat/uploads';

    const uploaded = await mediaService.uploadFile(req.file, {
      folder,
      resource_type: resourceType
    });

    return res.status(200).json({
      success: true,
      url: uploaded.url,
      publicId: uploaded.public_id,
      type
    });
  } catch (error) {
    logger.error({ err: error.message }, 'Upload handler error');
    next(error);
  }
});

/**
 * POST /api/upload/avatar
 * Returns { url, publicId, type: 'image' }
 */
router.post('/avatar', authMiddleware, upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No avatar uploaded. Please provide an image file in the field "avatar".'
      });
    }

    const uploaded = await mediaService.uploadFile(req.file, {
      folder: 'flashchat/avatars',
      resource_type: 'image'
    });

    return res.status(200).json({
      success: true,
      url: uploaded.url,
      publicId: uploaded.public_id,
      type: 'image'
    });
  } catch (error) {
    logger.error({ err: error.message }, 'Avatar upload handler error');
    next(error);
  }
});

module.exports = router;

