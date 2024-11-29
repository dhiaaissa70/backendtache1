const redis = require('redis');

const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || null, // Use if password-protected
});

redisClient.on('error', (err) => {
  console.error(`[ERROR] Redis Client Error: ${err.message}`);
});

module.exports = redisClient;
