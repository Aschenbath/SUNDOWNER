/**
 * API Response Caching Utilities
 * Provides simple caching for frequently accessed API endpoints
 */

/**
 * Cache configuration for different endpoints
 */
export const CACHE_CONFIG = {
  // Album lists - changes infrequently
  albums: {
    ttl: 60, // 60 seconds
    key: 'cache:albums:list',
  },
  // Playlist metadata
  playlists: {
    ttl: 60,
    key: 'cache:playlists:list',
  },
  // User preferences
  preferences: {
    ttl: 300, // 5 minutes
    key: 'cache:user:preferences',
  },
  // Storage stats
  storage: {
    ttl: 120, // 2 minutes
    key: 'cache:storage:stats',
  },
  // Films list
  films: {
    ttl: 60,
    key: 'cache:films:list',
  },
};

const pendingCacheWrites = new Map();

function trackPendingCacheWrite(cacheKey, writePromise) {
  let pendingWrites = pendingCacheWrites.get(cacheKey);
  if (!pendingWrites) {
    pendingWrites = new Set();
    pendingCacheWrites.set(cacheKey, pendingWrites);
  }

  const tracked = Promise.resolve(writePromise).finally(() => {
    pendingWrites.delete(tracked);
    if (pendingWrites.size === 0) {
      pendingCacheWrites.delete(cacheKey);
    }
  });
  pendingWrites.add(tracked);
  return tracked;
}

async function waitForPendingCacheWrites(cacheKey) {
  const pendingWrites = pendingCacheWrites.get(cacheKey);
  if (!pendingWrites || pendingWrites.size === 0) {
    return;
  }
  await Promise.allSettled([...pendingWrites]);
}

/**
 * Get cached response or fetch and cache
 * @param {object} kv - KV namespace
 * @param {string} cacheKey - Cache key
 * @param {Function} fetcher - Function that returns the data
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<any>}
 */
export async function getCachedOrFetch(kv, cacheKey, fetcher, ttl = 60) {
  if (!kv) {
    // No KV available, fetch directly
    return fetcher();
  }

  try {
    // Try to get from cache
    const cached = await kv.get(cacheKey, { type: 'json' });
    if (cached !== null) {
      console.log(`[Cache] Hit: ${cacheKey}`);
      return cached;
    }

    // Cache miss, fetch data
    console.log(`[Cache] Miss: ${cacheKey}`);
    const data = await fetcher();

    // Store in cache (fire and forget)
    const writePromise = kv.put(cacheKey, JSON.stringify(data), {
      expirationTtl: ttl,
    }).catch(err => {
      console.warn(`[Cache] Failed to store: ${cacheKey}`, err);
    });
    trackPendingCacheWrite(cacheKey, writePromise);

    return data;
  } catch (error) {
    console.error(`[Cache] Error: ${cacheKey}`, error);
    // On error, fetch directly
    return fetcher();
  }
}

/**
 * Invalidate cache for a specific key
 * @param {object} kv - KV namespace
 * @param {string} cacheKey - Cache key to invalidate
 */
export async function invalidateCache(kv, cacheKey) {
  if (!kv) return;

  try {
    await waitForPendingCacheWrites(cacheKey);
    await kv.delete(cacheKey);
    console.log(`[Cache] Invalidated: ${cacheKey}`);
  } catch (error) {
    console.warn(`[Cache] Failed to invalidate: ${cacheKey}`, error);
  }
}

/**
 * Invalidate multiple cache keys
 * @param {object} kv - KV namespace
 * @param {string[]} cacheKeys - Array of cache keys
 */
export async function invalidateMultiple(kv, cacheKeys) {
  if (!kv) return;

  await Promise.all(
    cacheKeys.map(key => invalidateCache(kv, key))
  );
}

/**
 * Create a cached response with appropriate headers
 * @param {any} data - Response data
 * @param {number} maxAge - Cache max-age in seconds
 * @returns {Response}
 */
export function createCachedResponse(data, maxAge = 60) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
      'CDN-Cache-Control': `public, max-age=${maxAge}`,
    },
  });
}

/**
 * Middleware to add cache headers to responses
 * @param {number} maxAge - Cache max-age in seconds
 * @returns {Function} - Middleware function
 */
export function withCacheHeaders(maxAge = 60) {
  return async (context) => {
    const response = await context.next();

    // Only cache successful GET requests
    if (context.request.method !== 'GET' || response.status !== 200) {
      return response;
    }

    const headers = new Headers(response.headers);
    headers.set('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`);
    headers.set('CDN-Cache-Control', `public, max-age=${maxAge}`);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

/**
 * Generate cache key with user context
 * @param {string} baseKey - Base cache key
 * @param {string} userId - User identifier
 * @returns {string}
 */
export function userCacheKey(baseKey, userId) {
  return `${baseKey}:user:${userId}`;
}

/**
 * Generate cache key with query parameters
 * @param {string} baseKey - Base cache key
 * @param {object} params - Query parameters
 * @returns {string}
 */
export function paramsCacheKey(baseKey, params) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  return `${baseKey}:${sortedParams}`;
}

/**
 * Example usage:
 *
 * // In /api/manage/albums.js
 * import { getCachedOrFetch, CACHE_CONFIG, invalidateCache } from '../utils/apiCache.js';
 *
 * export async function onRequestGet(context) {
 *   const albums = await getCachedOrFetch(
 *     context.env.img_url,
 *     CACHE_CONFIG.albums.key,
 *     async () => {
 *       // Fetch albums from database
 *       return fetchAlbumsFromDB(context.env);
 *     },
 *     CACHE_CONFIG.albums.ttl
 *   );
 *
 *   return new Response(JSON.stringify(albums), {
 *     headers: { 'Content-Type': 'application/json' }
 *   });
 * }
 *
 * // When albums are modified, invalidate cache
 * export async function onRequestPost(context) {
 *   // ... create album ...
 *   await invalidateCache(context.env.img_url, CACHE_CONFIG.albums.key);
 *   return new Response('OK');
 * }
 */
