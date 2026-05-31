import {
    fetchSecurityConfig,
    getConfiguredUserAuthCode,
    hasConfiguredUserAuthCode,
    hasSecurityConfigLoadError,
} from "../utils/sysConfig.js";
import { optionsResponse, withCorsHeaders } from '../utils/cors.js';
import { checkRateLimit, getClientIp, createRateLimitResponse } from '../utils/rateLimiter.js';

function invalidBodyResponse() {
    return new Response(JSON.stringify({ success: false, error: 'Invalid request body' }), {
        status: 400,
        headers: withCorsHeaders({ 'Content-Type': 'application/json' }),
    });
}

export function onRequestOptions() {
    return optionsResponse();
}

export async function onRequestPost(context) {
    const { request, env } = context;

    // Rate limiting: 5 attempts per 5 minutes per IP
    const clientIp = getClientIp(request);
    const rateLimitResult = await checkRateLimit(clientIp, env.img_url, {
        windowMs: 300000, // 5 minutes
        maxRequests: 5,
        keyPrefix: 'login_ratelimit'
    });

    if (!rateLimitResult.allowed) {
        console.warn(`Rate limit exceeded for login attempt from IP: ${clientIp}`);
        return createRateLimitResponse(rateLimitResult.resetAt);
    }

    let jsonRequest;
    try {
        jsonRequest = await request.json();
    } catch {
        return invalidBodyResponse();
    }

    if (!jsonRequest || typeof jsonRequest !== 'object' || Array.isArray(jsonRequest)) {
        return invalidBodyResponse();
    }

    const authCode = jsonRequest.authCode;

    const securityConfig = await fetchSecurityConfig(env);
    if (hasSecurityConfigLoadError(securityConfig)) {
        return new Response('Security configuration is unavailable', {
            status: 503,
            headers: withCorsHeaders(),
        });
    }

    if (!hasConfiguredUserAuthCode(securityConfig)) {
        return new Response('User auth code is not configured', {
            status: 503,
            headers: withCorsHeaders(),
        });
    }

    const rightAuthCode = getConfiguredUserAuthCode(securityConfig);
    if (authCode !== rightAuthCode) {
        return new Response('Unauthorized', {
            status: 401,
            headers: withCorsHeaders(),
        });
    }

    return new Response('Login success', {
        status: 200,
        headers: withCorsHeaders(),
    });
}
