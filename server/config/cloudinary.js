const cloudinary = require('cloudinary').v2;
const config = require('./env');
const logger = require('../utils/logger');

let isCloudinaryConfigured = false;

if (config.CLOUDINARY_CLOUD_NAME && config.CLOUDINARY_API_KEY && config.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: config.CLOUDINARY_CLOUD_NAME,
    api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET,
    secure: true
  });
  isCloudinaryConfigured = true;
  logger.info('Cloudinary configured successfully');
} else {
  logger.info('Cloudinary credentials not provided. Media upload will fallback to local storage / data URLs.');
}

module.exports = {
  cloudinary,
  isCloudinaryConfigured
};
