const Redis = require('ioredis');
const config = require('./env');
const logger = require('../utils/logger');

let redisClient = null;

if (config.REDIS_URL) {
  try {
    redisClient = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 2000);
        return delay;
      }
    });

    redisClient.on('connect', () => {
      logger.info('Connected to Redis');
    });

    redisClient.on('error', (err) => {
      logger.warn({ err: err.message }, 'Redis error, falling back to in-memory mode');
    });
  } catch (error) {
    logger.warn({ err: error.message }, 'Failed to initialize Redis. Running in standalone mode.');
    redisClient = null;
  }
} else {
  logger.info('Redis disabled (REDIS_URL not set). Running with in-memory adapter.');
}

module.exports = redisClient;
