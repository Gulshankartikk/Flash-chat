const redisClient = require('../config/redis');
const logger = require('../utils/logger');

// In-memory fallback map when Redis is not running or disabled
const memoryStore = new Map();
const memoryTimeouts = new Map();

const redisService = {
  async get(key) {
    if (redisClient && redisClient.status === 'ready') {
      try {
        return await redisClient.get(key);
      } catch (err) {
        logger.warn({ key, err: err.message }, 'Redis get failed, using in-memory fallback');
      }
    }
    return memoryStore.get(key) || null;
  },

  async set(key, value, mode, duration) {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

    if (redisClient && redisClient.status === 'ready') {
      try {
        if (mode === 'EX' && duration) {
          return await redisClient.set(key, stringValue, 'EX', duration);
        }
        return await redisClient.set(key, stringValue);
      } catch (err) {
        logger.warn({ key, err: err.message }, 'Redis set failed, using in-memory fallback');
      }
    }

    // In-memory fallback
    memoryStore.set(key, stringValue);

    if (memoryTimeouts.has(key)) {
      clearTimeout(memoryTimeouts.get(key));
      memoryTimeouts.delete(key);
    }

    if (mode === 'EX' && duration) {
      const timeout = setTimeout(() => {
        memoryStore.delete(key);
        memoryTimeouts.delete(key);
      }, duration * 1000);
      memoryTimeouts.set(key, timeout);
    }

    return 'OK';
  },

  async del(key) {
    if (redisClient && redisClient.status === 'ready') {
      try {
        return await redisClient.del(key);
      } catch (err) {
        logger.warn({ key, err: err.message }, 'Redis del failed, using in-memory fallback');
      }
    }

    if (memoryTimeouts.has(key)) {
      clearTimeout(memoryTimeouts.get(key));
      memoryTimeouts.delete(key);
    }
    return memoryStore.delete(key) ? 1 : 0;
  },

  async incr(key) {
    if (redisClient && redisClient.status === 'ready') {
      try {
        return await redisClient.incr(key);
      } catch (err) {
        logger.warn({ key, err: err.message }, 'Redis incr failed, using in-memory fallback');
      }
    }

    const current = Number(memoryStore.get(key) || 0);
    const next = current + 1;
    memoryStore.set(key, String(next));
    return next;
  },

  async expire(key, seconds) {
    if (redisClient && redisClient.status === 'ready') {
      try {
        return await redisClient.expire(key, seconds);
      } catch (err) {
        logger.warn({ key, err: err.message }, 'Redis expire failed, using in-memory fallback');
      }
    }

    if (memoryStore.has(key)) {
      if (memoryTimeouts.has(key)) {
        clearTimeout(memoryTimeouts.get(key));
      }
      const timeout = setTimeout(() => {
        memoryStore.delete(key);
        memoryTimeouts.delete(key);
      }, seconds * 1000);
      memoryTimeouts.set(key, timeout);
      return 1;
    }
    return 0;
  }
};

module.exports = redisService;
