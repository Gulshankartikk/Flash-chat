let redisClient = null;
const memoryCache = new Map();
const memoryExpirations = new Map();

// Helper to handle memory cache TTL
function getMemory(key) {
  const expiry = memoryExpirations.get(key);
  if (expiry && Date.now() > expiry) {
    memoryCache.delete(key);
    memoryExpirations.delete(key);
    return null;
  }
  const val = memoryCache.get(key);
  return val !== undefined ? JSON.parse(val) : null;
}

function setMemory(key, value, ttlSeconds) {
  const stringVal = JSON.stringify(value);
  memoryCache.set(key, stringVal);
  if (ttlSeconds) {
    memoryExpirations.set(key, Date.now() + (ttlSeconds * 1000));
  } else {
    memoryExpirations.delete(key);
  }
}

function delMemory(key) {
  memoryCache.delete(key);
  memoryExpirations.delete(key);
}

// Try to initialize Redis
try {
  // Use dynamic require so it doesn't crash on startup if the package is missing
  const Redis = require("ioredis");
  const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  
  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    connectTimeout: 500,
    enableOfflineQueue: false,
    retryStrategy(times) {
      // If connection fails, stop retrying and fallback
      console.warn("[redis] Connection failed. Falling back to in-memory cache.");
      return null; 
    }
  });

  redisClient.on("error", (err) => {
    console.warn("[redis] Error connecting to Redis server:", err.message);
    redisClient = null; // Trigger fallback
  });

  redisClient.on("connect", () => {
    console.log("[redis] Connected to Redis server successfully.");
  });
} catch (err) {
  console.warn("[redis] ioredis package not found. Using in-memory fallback cache.");
}

const cache = {
  get: async (key) => {
    if (redisClient) {
      try {
        const val = await redisClient.get(key);
        return val ? JSON.parse(val) : null;
      } catch (err) {
        console.warn("[redis] get error, using memory fallback:", err.message);
        return getMemory(key);
      }
    }
    return getMemory(key);
  },

  set: async (key, value, ttlSeconds = null) => {
    if (value === undefined) return false;
    const stringVal = JSON.stringify(value);
    
    if (redisClient) {
      try {
        if (ttlSeconds) {
          await redisClient.set(key, stringVal, "EX", ttlSeconds);
        } else {
          await redisClient.set(key, stringVal);
        }
        return true;
      } catch (err) {
        console.warn("[redis] set error, using memory fallback:", err.message);
        setMemory(key, value, ttlSeconds);
      }
    } else {
      setMemory(key, value, ttlSeconds);
    }
    return true;
  },

  del: async (key) => {
    if (redisClient) {
      try {
        await redisClient.del(key);
        return true;
      } catch (err) {
        console.warn("[redis] del error, using memory fallback:", err.message);
        delMemory(key);
      }
    } else {
      delMemory(key);
    }
    return true;
  }
};

module.exports = cache;
