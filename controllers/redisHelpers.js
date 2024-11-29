const redisClient = require('./redisClient');

// Helper function to retrieve from Redis cache
const getFromCache = async (key) => {
  try {
    // Ensure Redis client is connected
    if (!redisClient.isOpen) {
      console.log('[INFO] Reconnecting to Redis...');
      await redisClient.connect();
    }

    return new Promise((resolve, reject) => {
      redisClient.get(key, (err, data) => {
        if (err) {
          console.error(`[ERROR] Redis Get Error: ${err.message}`);
          return reject(err);
        }
        resolve(data ? JSON.parse(data) : null);
      });
    });
  } catch (error) {
    console.error("[ERROR] Redis Operation Failed:", error.message);
    throw new Error("Failed to retrieve data from cache");
  }
};

// Helper function to set Redis cache
const setToCache = async (key, value, ttl = 3600) => { // Cache for 1 hour
  try {
    if (!redisClient.isOpen) {
      console.log('[INFO] Reconnecting to Redis...');
      await redisClient.connect();
    }

    await redisClient.setEx(key, ttl, JSON.stringify(value));
    console.log(`[INFO] Data cached under key: ${key}`);
  } catch (error) {
    console.error("[ERROR] Failed to set cache:", error.message);
  }
};

module.exports = { getFromCache, setToCache };
