const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const logger = require('../utils/logger');

/**
 * Determine Cloudinary resource_type and normalized type from mimetype
 */
const getResourceTypeAndType = (mimetype) => {
  if (mimetype.startsWith('image/')) return { resourceType: 'image', type: 'image' };
  if (mimetype.startsWith('video/')) return { resourceType: 'video', type: 'video' };
  if (mimetype.startsWith('audio/')) return { resourceType: 'video', type: 'audio' }; // Cloudinary stores audio under 'video'
  if (mimetype === 'application/pdf') return { resourceType: 'raw', type: 'pdf' };
  return { resourceType: 'auto', type: 'file' };
};

/**
 * POST /api/upload
 * Returns: { url, publicId, type }
 * If Cloudinary keys are empty, returns a clear error message instead of crashing.
 */
router.post('/', authMiddleware, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please provide a file in the form field "file".'
      });
    }

    if (!isCloudinaryConfigured) {
      return res.status(400).json({
        success: false,
        message:
          'Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in the server environment.'
      });
    }

    const { resourceType, type } = getResourceTypeAndType(req.file.mimetype);
    const folder = req.body.folder || 'flashchat/uploads';

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType
      },
      (error, result) => {
        if (error) {
          logger.error({ err: error.message }, 'Cloudinary upload error');
          return res.status(500).json({
            success: false,
            message: `Cloudinary upload failed: ${error.message}`
          });
        }

        return res.status(200).json({
          success: true,
          url: result.secure_url,
          publicId: result.public_id,
          type
        });
      }
    );

    uploadStream.end(req.file.buffer);
  } catch (error) {
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

    if (!isCloudinaryConfigured) {
      return res.status(400).json({
        success: false,
        message:
          'Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in the server environment.'
      });
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'flashchat/avatars',
        resource_type: 'image',
        transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }]
      },
      (error, result) => {
        if (error) {
          logger.error({ err: error.message }, 'Cloudinary avatar upload error');
          return res.status(500).json({
            success: false,
            message: `Cloudinary upload failed: ${error.message}`
          });
        }

        return res.status(200).json({
          success: true,
          url: result.secure_url,
          publicId: result.public_id,
          type: 'image'
        });
      }
    );

    uploadStream.end(req.file.buffer);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
