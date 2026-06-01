/**
 * Integration tests for API cache
 */

import { describe, it, before, after } from 'mocha';
import { strict as assert } from 'assert';
import {
  getCachedOrFetch,
  invalidateCache,
  paramsCacheKey,
  userCacheKey,
} from '../functions/utils/apiCache.js';

describe('API Cache', () => {
  let mockKV;
  let fetchCount;

  before(() => {
    fetchCount = 0;
    mockKV = {
      storage: new Map(),
      async get(key, options) {
        const value = this.storage.get(key);
        if (!value) return null;
        if (options?.type === 'json') {
          return JSON.parse(value);
        }
        return value;
      },
      async put(key, value, options) {
        this.storage.set(key, value);
      },
      async delete(key) {
        this.storage.delete(key);
      },
    };
  });

  after(() => {
    mockKV.storage.clear();
  });

  describe('getCachedOrFetch', () => {
    it('should fetch on cache miss', async () => {
      fetchCount = 0;
      const fetcher = async () => {
        fetchCount++;
        return { data: 'test' };
      };

      const result = await getCachedOrFetch(mockKV, 'test-key-1', fetcher, 60);

      assert.deepEqual(result, { data: 'test' });
      assert.equal(fetchCount, 1);
    });

    it('should return cached value on cache hit', async () => {
      fetchCount = 0;
      const fetcher = async () => {
        fetchCount++;
        return { data: 'test' };
      };

      // First call - cache miss
      await getCachedOrFetch(mockKV, 'test-key-2', fetcher, 60);
      assert.equal(fetchCount, 1);

      // Second call - cache hit
      const result = await getCachedOrFetch(mockKV, 'test-key-2', fetcher, 60);
      assert.deepEqual(result, { data: 'test' });
      assert.equal(fetchCount, 1); // Should not increment
    });

    it('should handle KV unavailable', async () => {
      fetchCount = 0;
      const fetcher = async () => {
        fetchCount++;
        return { data: 'test' };
      };

      const result = await getCachedOrFetch(null, 'test-key-3', fetcher, 60);

      assert.deepEqual(result, { data: 'test' });
      assert.equal(fetchCount, 1);
    });

    it('should handle fetcher errors', async () => {
      const fetcher = async () => {
        throw new Error('Fetch failed');
      };

      try {
        await getCachedOrFetch(mockKV, 'test-key-4', fetcher, 60);
        assert.fail('Should have thrown');
      } catch (error) {
        assert.equal(error.message, 'Fetch failed');
      }
    });
  });

  describe('invalidateCache', () => {
    it('should remove cached value', async () => {
      fetchCount = 0;
      const fetcher = async () => {
        fetchCount++;
        return { data: 'test' };
      };

      // Cache the value
      await getCachedOrFetch(mockKV, 'test-key-5', fetcher, 60);
      assert.equal(fetchCount, 1);

      // Invalidate
      await invalidateCache(mockKV, 'test-key-5');

      // Should fetch again
      await getCachedOrFetch(mockKV, 'test-key-5', fetcher, 60);
      assert.equal(fetchCount, 2);
    });

    it('waits for an in-flight read-through write before deleting the cache key', async () => {
      let releasePut;
      const delayedKV = {
        storage: new Map(),
        async get() {
          return null;
        },
        async put(key, value) {
          await new Promise((resolve) => {
            releasePut = resolve;
          });
          this.storage.set(key, value);
        },
        async delete(key) {
          this.storage.delete(key);
        },
      };

      const result = await getCachedOrFetch(delayedKV, 'test-key-race', async () => ({ data: 'stale' }), 60);
      assert.deepEqual(result, { data: 'stale' });

      const invalidatePromise = invalidateCache(delayedKV, 'test-key-race');
      await Promise.resolve();
      releasePut();
      await invalidatePromise;

      assert.equal(delayedKV.storage.has('test-key-race'), false);
    });
  });

  describe('Cache key helpers', () => {
    it('should generate user-specific cache key', () => {
      const key = userCacheKey('albums', 'user123');
      assert.equal(key, 'albums:user:user123');
    });

    it('should generate params-based cache key', () => {
      const key = paramsCacheKey('list', { page: 1, limit: 50, type: 'image' });
      // Should be sorted alphabetically
      assert.equal(key, 'list:limit=50&page=1&type=image');
    });

    it('should handle empty params', () => {
      const key = paramsCacheKey('list', {});
      assert.equal(key, 'list:');
    });
  });
});
