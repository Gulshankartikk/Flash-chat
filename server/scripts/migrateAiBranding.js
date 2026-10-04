/**
 * Migration Script: Update legacy system-generated AI labels to "Flash AI"
 */

const mongoose = require('mongoose');
const AiConversation = require('../models/AiConversation');
const config = require('../config/env');
const logger = require('../utils/logger');

const migrateAiBranding = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(config.MONGO_URI);
      logger.info('Connected to MongoDB for AI branding migration');
    }

    // 1. Update system default conversation titles
    const legacyTitles = ['New Gemini Chat', 'Gemini Chat', 'Gemini Assistant'];
    const titleUpdateResult = await AiConversation.updateMany(
      { title: { $in: legacyTitles } },
      { $set: { title: 'New Flash AI Chat' } }
    );
    logger.info({ modified: titleUpdateResult.modifiedCount }, 'Migrated legacy AI conversation titles');

    logger.info('AI branding migration completed successfully.');
    return { success: true, updatedTitles: titleUpdateResult.modifiedCount };
  } catch (err) {
    logger.error({ err: err.message }, 'AI branding migration error');
    return { success: false, error: err.message };
  }
};

module.exports = migrateAiBranding;

if (require.main === module) {
  migrateAiBranding().then(() => process.exit(0));
}
