// functions/utils/cache.js

/**
 * Simple in‑memory cache with TTL for Cloudflare Workers.
 * Lives for the duration of a Worker instance.
 */
let cachedValue = null;
let cacheExpiry = 0;

/** Get cached data if valid */
export function getCache(ttlMs) {
  const now = Date.now();
  return (cachedValue !== null && now < cacheExpiry) ? cachedValue : null;
}
/** Set cached data with TTL */
export function setCache(value, ttlMs) {
  cachedValue = value;
  cacheExpiry = Date.now() + ttlMs;
}
/** Clear cache */
export function clearCache() {
  cachedValue = null;
  cacheExpiry = 0;
}
