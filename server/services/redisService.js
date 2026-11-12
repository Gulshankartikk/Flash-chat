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
  },

  /**
   * Blacklist a revoked token (Access or Refresh) using its SHA-256 hash
   */
  async blacklistToken(token, ttlSeconds = 7 * 24 * 3600) {
    if (!token) return;
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const key = `bl:token:${tokenHash}`;
    await this.set(key, '1', 'EX', ttlSeconds);
  },

  /**
   * Check if a token has been explicitly revoked/blacklisted
   */
  async isTokenBlacklisted(token) {
    if (!token) return false;
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const key = `bl:token:${tokenHash}`;
    const result = await this.get(key);
    return Boolean(result);
  },

  /**
   * Retrieve parsed JSON from cache
   */
  async cacheGet(key) {
    try {
      const data = await this.get(key);
      if (!data) return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  /**
   * Store serializable object in cache with TTL
   */
  async cacheSet(key, value, ttlSeconds = 300) {
    try {
      return await this.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      logger.warn({ key, err: err.message }, 'Failed to cache data');
      return null;
    }
  },

  /**
   * Evict single key from cache
   */
  async cacheDel(key) {
    return await this.del(key);
  },

  /**
   * Invalidate multiple keys matching wildcard pattern
   */
  async cacheDelPattern(pattern) {
    if (redisClient && redisClient.status === 'ready') {
      try {
        const keys = await redisClient.keys(pattern);
        if (keys && keys.length > 0) {
          await redisClient.del(...keys);
        }
      } catch (err) {
        logger.warn({ pattern, err: err.message }, 'Redis pattern deletion failed');
      }
    }

    // In-memory fallback pattern match
    try {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      for (const k of memoryStore.keys()) {
        if (regex.test(k)) {
          this.del(k);
        }
      }
    } catch {
      // Ignore regex parse errors
    }
  }
};

module.exports = redisService;
