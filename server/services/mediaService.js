const fs = require('fs');
const path = require('path');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const logger = require('../utils/logger');

class MediaService {
  constructor() {
    this.uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Upload file buffer or path to Cloudinary with local disk fallback
   * @param {Object} file - Multer file object or { buffer, mimetype, originalname, path }
   * @param {Object} options - { folder, resource_type }
   * @returns {Promise<{ url: string, public_id: string, resource_type: string, bytes: number }>}
   */
  /**
   * Generate an optimized thumbnail URL
   */
  generateThumbnailUrl(url, publicIdOrResourceType, resourceType) {
    if (!url) return '';
    const type = resourceType || (['video', 'image', 'audio', 'raw'].includes(publicIdOrResourceType) ? publicIdOrResourceType : 'image');
    if (url.includes('res.cloudinary.com')) {
      if (type === 'video') {
        // Video poster frame at 0s
        return url.replace(/\.[a-zA-Z0-9]+$/, '.jpg').replace('/upload/', '/upload/so_0,w_400,c_scale,q_auto,f_auto/');
      }
      return url.replace('/upload/', '/upload/c_fill,w_300,h_300,g_auto,q_auto,f_auto/');
    }
    return url;
  }

  /**
   * Upload file buffer or path to Cloudinary with automatic optimization and local disk fallback
   * @param {Object} file - Multer file object or { buffer, mimetype, originalname, path }
   * @param {Object} options - { folder, resource_type }
   * @returns {Promise<{ url: string, public_id: string, resource_type: string, bytes: number, thumbnail: string }>}
   */
  async uploadFile(file, options = {}) {
    const folder = options.folder || 'flashchat';
    const resourceType = options.resource_type || 'auto';

    const uploadParams = {
      folder,
      resource_type: resourceType
    };

    if (resourceType === 'image') {
      uploadParams.quality = 'auto';
      uploadParams.fetch_format = 'auto';
      uploadParams.width = 2048;
      uploadParams.height = 2048;
      uploadParams.crop = 'limit';
    }

    if (isCloudinaryConfigured) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              uploadParams,
              (error, res) => {
                if (error) return reject(error);
                resolve(res);
              }
            );

            if (file.buffer) {
              uploadStream.end(file.buffer);
            } else if (file.path) {
              fs.createReadStream(file.path).pipe(uploadStream);
            } else {
              reject(new Error('Invalid file payload: No buffer or path provided.'));
            }
          });

          const thumbnail = this.generateThumbnailUrl(result.secure_url, result.public_id, result.resource_type);

          return {
            url: result.secure_url,
            public_id: result.public_id,
            resource_type: result.resource_type,
            bytes: result.bytes,
            format: result.format,
            thumbnail
          };
        } catch (err) {
          logger.warn({ attempt, err: err.message }, 'Cloudinary upload attempt failed');
          if (attempt === 2) {
            logger.error({ err: err.message }, 'Cloudinary retries exhausted - falling back to local storage');
          } else {
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      }
    }

    // Fallback: Local disk storage
    const ext = path.extname(file.originalname || '.png') || '.png';
    const filename = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
    const targetPath = path.join(this.uploadsDir, filename);

    if (file.buffer) {
      fs.writeFileSync(targetPath, file.buffer);
    } else if (file.path) {
      fs.copyFileSync(file.path, targetPath);
    }

    const localUrl = `/uploads/${filename}`;
    return {
      url: localUrl,
      public_id: filename,
      resource_type: resourceType,
      bytes: file.size || (file.buffer ? file.buffer.length : 0),
      format: ext.replace('.', ''),
      thumbnail: localUrl
    };
  }

  /**
   * Securely delete a media file from Cloudinary or local disk
   * @param {string} publicId - Cloudinary public_id or local filename
   * @param {string} resourceType - 'image' | 'video' | 'raw'
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async deleteFile(publicId, resourceType = 'image') {
    if (!publicId || typeof publicId !== 'string') {
      throw new Error('Valid public ID is required for media deletion.');
    }

    const safePublicId = path.basename(publicId);

    // 1. Check local disk
    const localPath = path.resolve(this.uploadsDir, safePublicId);
    if (localPath.startsWith(this.uploadsDir) && fs.existsSync(localPath)) {
      try {
        fs.unlinkSync(localPath);
        logger.info({ publicId: safePublicId }, 'Deleted local media file');
        return { success: true, message: 'Local media deleted successfully' };
      } catch (err) {
        logger.error({ err: err.message, publicId: safePublicId }, 'Failed to delete local media file');
      }
    }

    // 2. Cloudinary deletion
    if (isCloudinaryConfigured) {
      try {
        const result = await cloudinary.uploader.destroy(publicId, {
          resource_type: resourceType,
          invalidate: true
        });
        logger.info({ publicId, result }, 'Cloudinary media destroyed');
        return { success: true, message: 'Cloudinary media destroyed', result };
      } catch (err) {
        logger.error({ err: err.message, publicId }, 'Failed to delete Cloudinary media');
        throw err;
      }
    }

    return { success: true, message: 'Media deletion processed' };
  }
}

module.exports = new MediaService();
