const redis = require('redis');

// Initialize Redis client
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  password: process.env.REDIS_PASSWORD || null, // Add password if required
});

redisClient.on('error', (err) => {
  console.error(`[ERROR] Redis Client Error: ${err.message}`);
});

redisClient.on('connect', () => {
  console.log('[INFO] Redis Client Connected');
});

(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('[ERROR] Redis Connection Failed:', err.message);
  }
})();

module.exports = redisClient;
