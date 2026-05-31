/**
 * Integration tests for rate limiter
 */

import { describe, it, before, after } from 'mocha';
import { strict as assert } from 'assert';
import { checkRateLimit, getClientIp, createRateLimitResponse } from '../functions/utils/rateLimiter.js';

describe('Rate Limiter', () => {
  let mockKV;

  before(() => {
    // Mock KV namespace
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

  describe('checkRateLimit', () => {
    it('should allow first request', async () => {
      const result = await checkRateLimit('test-ip-1', mockKV, {
        windowMs: 60000,
        maxRequests: 5,
      });

      assert.equal(result.allowed, true);
      assert.equal(result.remaining, 4);
    });

    it('should track multiple requests', async () => {
      const ip = 'test-ip-2';
      const options = { windowMs: 60000, maxRequests: 3 };

      const r1 = await checkRateLimit(ip, mockKV, options);
      assert.equal(r1.allowed, true);
      assert.equal(r1.remaining, 2);

      const r2 = await checkRateLimit(ip, mockKV, options);
      assert.equal(r2.allowed, true);
      assert.equal(r2.remaining, 1);

      const r3 = await checkRateLimit(ip, mockKV, options);
      assert.equal(r3.allowed, true);
      assert.equal(r3.remaining, 0);
    });

    it('should block when limit exceeded', async () => {
      const ip = 'test-ip-3';
      const options = { windowMs: 60000, maxRequests: 2 };

      await checkRateLimit(ip, mockKV, options);
      await checkRateLimit(ip, mockKV, options);

      const blocked = await checkRateLimit(ip, mockKV, options);
      assert.equal(blocked.allowed, false);
      assert.equal(blocked.remaining, 0);
    });

    it('should allow requests after window expires', async () => {
      const ip = 'test-ip-4';
      const options = { windowMs: 100, maxRequests: 1 }; // 100ms window

      const r1 = await checkRateLimit(ip, mockKV, options);
      assert.equal(r1.allowed, true);

      const r2 = await checkRateLimit(ip, mockKV, options);
      assert.equal(r2.allowed, false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      const r3 = await checkRateLimit(ip, mockKV, options);
      assert.equal(r3.allowed, true);
    });

    it('should handle KV unavailable gracefully', async () => {
      const result = await checkRateLimit('test-ip-5', null, {
        windowMs: 60000,
        maxRequests: 5,
      });

      assert.equal(result.allowed, true);
    });
  });

  describe('getClientIp', () => {
    it('should extract CF-Connecting-IP', () => {
      const request = {
        headers: new Map([
          ['CF-Connecting-IP', '1.2.3.4'],
        ]),
      };
      request.headers.get = function(key) { return this.get(key); };

      const ip = getClientIp(request);
      assert.equal(ip, '1.2.3.4');
    });

    it('should fallback to X-Forwarded-For', () => {
      const request = {
        headers: new Map([
          ['X-Forwarded-For', '5.6.7.8, 9.10.11.12'],
        ]),
      };
      request.headers.get = function(key) { return this.get(key); };

      const ip = getClientIp(request);
      assert.equal(ip, '5.6.7.8');
    });

    it('should return unknown if no IP headers', () => {
      const request = {
        headers: new Map(),
      };
      request.headers.get = function(key) { return this.get(key); };

      const ip = getClientIp(request);
      assert.equal(ip, 'unknown');
    });
  });

  describe('createRateLimitResponse', () => {
    it('should create 429 response with headers', () => {
      const resetAt = Date.now() + 60000;
      const response = createRateLimitResponse(resetAt);

      assert.equal(response.status, 429);
      assert.equal(response.headers.get('Content-Type'), 'text/plain');
      assert.ok(response.headers.has('Retry-After'));
      assert.ok(response.headers.has('X-RateLimit-Reset'));
    });
  });
});
