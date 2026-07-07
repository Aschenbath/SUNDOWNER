/**
 * Simple rate limiter using KV storage
 * Tracks requests per IP address with sliding window
 */

const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX_REQUESTS = 60; // 60 requests per minute

/**
 * Check if a request should be rate limited
 * @param {string} key - Unique identifier (e.g., IP address)
 * @param {object} kv - KV namespace
 * @param {object} options - Rate limit options
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: number}>}
 */
export async function checkRateLimit(key, kv, options = {}) {
  const {
    windowMs = DEFAULT_WINDOW_MS,
    maxRequests = DEFAULT_MAX_REQUESTS,
    keyPrefix = 'ratelimit',
  } = options;

  if (!kv) {
    // If KV is not available, allow the request
    console.warn('Rate limiter: KV not available, allowing request');
    return { allowed: true, remaining: maxRequests, resetAt: Date.now() + windowMs };
  }

  const rateLimitKey = `${keyPrefix}:${key}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    // Get current rate limit data
    const data = await kv.get(rateLimitKey, { type: 'json' });

    if (!data) {
      // First request in this window
      await kv.put(rateLimitKey, JSON.stringify({
        requests: [now],
        resetAt: now + windowMs,
      }), {
        expirationTtl: Math.ceil(windowMs / 1000) + 60, // Add buffer
      });
      return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
    }

    // Filter out requests outside the current window
    const recentRequests = (data.requests || []).filter(timestamp => timestamp > windowStart);

    if (recentRequests.length >= maxRequests) {
      // Rate limit exceeded
      const oldestRequest = Math.min(...recentRequests);
      const resetAt = oldestRequest + windowMs;
      return { allowed: false, remaining: 0, resetAt };
    }

    // Add current request
    recentRequests.push(now);
    await kv.put(rateLimitKey, JSON.stringify({
      requests: recentRequests,
      resetAt: now + windowMs,
    }), {
      expirationTtl: Math.ceil(windowMs / 1000) + 60,
    });

    return {
      allowed: true,
      remaining: maxRequests - recentRequests.length,
      resetAt: now + windowMs,
    };
  } catch (error) {
    console.error('Rate limiter error:', error);
    // On error, allow the request to avoid blocking legitimate users
    return { allowed: true, remaining: maxRequests, resetAt: now + windowMs };
  }
}

/**
 * Get client IP address from request
 * @param {Request} request - The request object
 * @returns {string} - Client IP address
 */
export function getClientIp(request) {
  // Trust only Cloudflare's edge-populated client IP header. Proxy-style
  // headers such as X-Forwarded-For are caller-controlled in this app.
  const cfIp = String(request.headers.get('CF-Connecting-IP') || '').trim();
  if (cfIp && !cfIp.includes(',')) {
    return cfIp;
  }

  return 'unknown';
}

/**
 * Create a rate limit response
 * @param {number} resetAt - Timestamp when the rate limit resets
 * @returns {Response}
 */
export function createRateLimitResponse(resetAt) {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return new Response('Too Many Requests', {
    status: 429,
    headers: {
      'Content-Type': 'text/plain',
      'Retry-After': String(Math.max(1, retryAfter)),
      'X-RateLimit-Reset': String(Math.floor(resetAt / 1000)),
    },
  });
}
