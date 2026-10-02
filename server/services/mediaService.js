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
  async uploadFile(file, options = {}) {
    const folder = options.folder || 'flashchat';
    const resourceType = options.resource_type || 'auto';

    if (isCloudinaryConfigured) {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: resourceType
          },
          (error, result) => {
            if (error) {
              logger.error({ err: error.message }, 'Cloudinary upload error');
              return reject(error);
            }
            resolve({
              url: result.secure_url,
              public_id: result.public_id,
              resource_type: result.resource_type,
              bytes: result.bytes,
              format: result.format
            });
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
      format: ext.replace('.', '')
    };
  }
}

module.exports = new MediaService();
