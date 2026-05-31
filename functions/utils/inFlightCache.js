/**
 * In-flight request deduplication for Telegram API calls
 * Prevents multiple concurrent requests for the same resource
 */

class InFlightRequestCache {
  constructor() {
    // Map of request key -> Promise
    this.pending = new Map();
    // Map of request key -> timestamp (for cleanup)
    this.timestamps = new Map();
    // Cleanup interval (5 minutes)
    this.cleanupInterval = 5 * 60 * 1000;
    this.lastCleanup = Date.now();
  }

  /**
   * Get or create a request
   * @param {string} key - Unique request identifier
   * @param {Function} fetcher - Function that returns a Promise
   * @returns {Promise} - The request promise
   */
  async getOrFetch(key, fetcher) {
    // Cleanup old entries periodically
    this.maybeCleanup();

    // Check if request is already in flight
    if (this.pending.has(key)) {
      console.log(`[InFlight] Deduplicating request: ${key}`);
      return this.pending.get(key);
    }

    // Create new request
    console.log(`[InFlight] Starting new request: ${key}`);
    const promise = fetcher()
      .then(result => {
        // Remove from pending after completion
        this.pending.delete(key);
        this.timestamps.delete(key);
        return result;
      })
      .catch(error => {
        // Remove from pending on error
        this.pending.delete(key);
        this.timestamps.delete(key);
        throw error;
      });

    this.pending.set(key, promise);
    this.timestamps.set(key, Date.now());

    return promise;
  }

  /**
   * Cleanup old entries (called periodically)
   */
  maybeCleanup() {
    const now = Date.now();
    if (now - this.lastCleanup < this.cleanupInterval) {
      return;
    }

    this.lastCleanup = now;
    const timeout = 10 * 60 * 1000; // 10 minutes

    for (const [key, timestamp] of this.timestamps.entries()) {
      if (now - timestamp > timeout) {
        console.warn(`[InFlight] Cleaning up stale request: ${key}`);
        this.pending.delete(key);
        this.timestamps.delete(key);
      }
    }
  }

  /**
   * Clear all pending requests
   */
  clear() {
    this.pending.clear();
    this.timestamps.clear();
  }

  /**
   * Get current stats
   */
  getStats() {
    return {
      pendingCount: this.pending.size,
      oldestRequest: this.timestamps.size > 0
        ? Math.min(...this.timestamps.values())
        : null,
    };
  }
}

// Global instance (per Worker isolate)
const globalCache = new InFlightRequestCache();

/**
 * Wrap a Telegram API call with deduplication
 * @param {string} fileId - Telegram file ID
 * @param {Function} fetcher - Function that fetches the file path
 * @returns {Promise<string>} - File path
 */
export async function deduplicatedTelegramRequest(fileId, fetcher) {
  const key = `tg:file:${fileId}`;
  return globalCache.getOrFetch(key, fetcher);
}

/**
 * Get cache statistics
 */
export function getInFlightStats() {
  return globalCache.getStats();
}

/**
 * Clear the in-flight cache (for testing)
 */
export function clearInFlightCache() {
  globalCache.clear();
}

/**
 * Example usage in telegramAPI.js:
 *
 * import { deduplicatedTelegramRequest } from './inFlightCache.js';
 *
 * async function getFilePathWithDedup(api, fileId) {
 *   return deduplicatedTelegramRequest(fileId, async () => {
 *     return api.getFilePath(fileId);
 *   });
 * }
 */
