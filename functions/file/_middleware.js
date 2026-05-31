import { checkDatabaseConfig } from '../utils/middleware.js';
import { checkRateLimit, getClientIp, createRateLimitResponse } from '../utils/rateLimiter.js';

// Rate limit: 120 requests per minute per IP for file downloads
const FILE_RATE_LIMIT = {
  windowMs: 60 * 1000,
  maxRequests: 120,
  keyPrefix: 'ratelimit:file',
};

async function rateLimitMiddleware(context) {
  const clientIp = getClientIp(context.request);
  const result = await checkRateLimit(clientIp, context.env.img_url, FILE_RATE_LIMIT);

  if (!result.allowed) {
    return createRateLimitResponse(result.resetAt);
  }

  // Add rate limit headers to response
  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', String(FILE_RATE_LIMIT.maxRequests));
  headers.set('X-RateLimit-Remaining', String(result.remaining));
  headers.set('X-RateLimit-Reset', String(Math.floor(result.resetAt / 1000)));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const onRequest = [checkDatabaseConfig, rateLimitMiddleware];
