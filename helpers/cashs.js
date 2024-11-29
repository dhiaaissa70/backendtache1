const fs = require('fs').promises;
const path = require('path');

const CACHE_FILE_PATH = path.join(__dirname, '../cache.json'); // Cache file location

/**
 * Get a value from the cache.
 * @param {string} key - The cache key.
 * @returns {Promise<*>} - The cached value or null if not found.
 */
const getFromCache = async (key) => {
  try {
    const cache = JSON.parse(await fs.readFile(CACHE_FILE_PATH, 'utf8').catch(() => '{}'));
    if (cache[key] && cache[key].expiresAt > Date.now()) {
      console.log(`[INFO] Cache hit for key: ${key}`);
      return cache[key].value;
    }
    console.log(`[INFO] Cache miss for key: ${key}`);
    return null;
  } catch (error) {
    console.error(`[ERROR] Failed to read cache: ${error.message}`);
    return null;
  }
};

/**
 * Set a value in the cache.
 * @param {string} key - The cache key.
 * @param {*} value - The value to cache.
 * @param {number} ttl - Time-to-live in seconds (default: 3600).
 * @returns {Promise<void>}
 */
const setToCache = async (key, value, ttl = 3600) => {
  try {
    const cache = JSON.parse(await fs.readFile(CACHE_FILE_PATH, 'utf8').catch(() => '{}'));
    const expiresAt = Date.now() + ttl * 1000; // Set expiration time
    cache[key] = { value, expiresAt };
    await fs.writeFile(CACHE_FILE_PATH, JSON.stringify(cache, null, 2));
    console.log(`[INFO] Cached key: ${key}`);
  } catch (error) {
    console.error(`[ERROR] Failed to write cache: ${error.message}`);
  }
};

/**
 * Clear a specific key from the cache.
 * @param {string} key - The cache key.
 * @returns {Promise<void>}
 */
const clearCacheKey = async (key) => {
  try {
    const cache = JSON.parse(await fs.readFile(CACHE_FILE_PATH, 'utf8').catch(() => '{}'));
    delete cache[key];
    await fs.writeFile(CACHE_FILE_PATH, JSON.stringify(cache, null, 2));
    console.log(`[INFO] Cleared cache for key: ${key}`);
  } catch (error) {
    console.error(`[ERROR] Failed to clear cache: ${error.message}`);
  }
};

module.exports = { getFromCache, setToCache, clearCacheKey };
