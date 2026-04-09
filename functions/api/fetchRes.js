import { dualAuthCheck } from '../utils/dualAuth.js';
import { fetchSecurityConfig } from '../utils/sysConfig.js';

const ALLOWED_PORTS = new Set(['', '80', '443']);
const MAX_REDIRECTS = 3;

function parseAllowedHosts(env, securityConfig) {
    const raw = [
        env.FETCH_RES_ALLOWED_HOSTS || '',
        securityConfig?.api?.fetchResAllowedHosts || '',
        securityConfig?.fetchRes?.allowedHosts || '',
    ].filter(Boolean).join(',');

    return raw
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
}

function isIpLiteral(hostname) {
    return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(':');
}

function isPrivateIpv4(hostname) {
    const parts = hostname.split('.').map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
        return false;
    }

    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    return false;
}

function isPrivateIpv6(hostname) {
    const normalized = hostname.toLowerCase();
    return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
}

function isLocalHostname(hostname) {
    const normalized = hostname.toLowerCase();
    return normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.endsWith('.local') || normalized.endsWith('.internal');
}

function isBlockedTarget(hostname) {
    if (isLocalHostname(hostname)) {
        return true;
    }
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
        return isPrivateIpv4(hostname);
    }
    if (hostname.includes(':')) {
        return isPrivateIpv6(hostname);
    }
    return false;
}

function isAllowedHost(hostname, allowedHosts) {
    const normalizedHost = hostname.toLowerCase();
    return allowedHosts.some((allowedHost) => (
        normalizedHost === allowedHost || normalizedHost.endsWith(`.${allowedHost}`)
    ));
}

function isAllowedPort(parsedTargetUrl) {
    const port = parsedTargetUrl.port || '';
    return ALLOWED_PORTS.has(port);
}

function jsonResponse(payload, status) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

function validateTargetUrl(parsedTargetUrl, allowedHosts) {
    if (!['https:', 'http:'].includes(parsedTargetUrl.protocol) || parsedTargetUrl.username || parsedTargetUrl.password) {
        return { ok: false, response: jsonResponse({ error: 'Target URL is not allowed' }, 403) };
    }

    if (!isAllowedPort(parsedTargetUrl)) {
        return { ok: false, response: jsonResponse({ error: 'Target port is not allowed' }, 403) };
    }

    if (isIpLiteral(parsedTargetUrl.hostname) && isBlockedTarget(parsedTargetUrl.hostname)) {
        return { ok: false, response: jsonResponse({ error: 'Private or local targets are blocked' }, 403) };
    }

    if (isLocalHostname(parsedTargetUrl.hostname) || !isAllowedHost(parsedTargetUrl.hostname, allowedHosts)) {
        return { ok: false, response: jsonResponse({ error: 'Target host is not allowlisted' }, 403) };
    }

    return { ok: true, response: null };
}

async function fetchWithValidatedRedirects(parsedTargetUrl, allowedHosts) {
    let currentUrl = parsedTargetUrl;

    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
        const upstreamResponse = await fetch(currentUrl.toString(), { redirect: 'manual' });
        const isRedirect = upstreamResponse.status >= 300 && upstreamResponse.status < 400;
        if (!isRedirect) {
            return { response: upstreamResponse, blockedResponse: null };
        }

        if (redirectCount === MAX_REDIRECTS) {
            throw new Error('Upstream redirect limit exceeded');
        }

        const location = upstreamResponse.headers.get('Location');
        if (!location) {
            throw new Error('Upstream redirect missing location header');
        }

        let nextUrl;
        try {
            nextUrl = new URL(location, currentUrl);
        } catch {
            throw new Error('Upstream redirect target is invalid');
        }

        const validation = validateTargetUrl(nextUrl, allowedHosts);
        if (!validation.ok) {
            return { response: null, blockedResponse: validation.response };
        }

        currentUrl = nextUrl;
    }

    throw new Error('Upstream redirect handling failed');
}

export async function onRequest(context) {
    const { request, env } = context;

    const requestUrl = new URL(request.url);
    const { authorized } = await dualAuthCheck(env, requestUrl, request);
    if (!authorized) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    if (request.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    let jsonRequest;
    try {
        jsonRequest = await request.json();
    } catch {
        return jsonResponse({ error: 'Invalid JSON' }, 400);
    }

    const targetUrl = jsonRequest?.url;
    if (!targetUrl) {
        return jsonResponse({ error: 'URL is required' }, 400);
    }

    let parsedTargetUrl;
    try {
        parsedTargetUrl = new URL(targetUrl);
    } catch {
        return jsonResponse({ error: 'Invalid target URL' }, 400);
    }

    const allowedHosts = parseAllowedHosts(env, await fetchSecurityConfig(env));
    if (allowedHosts.length === 0) {
        return jsonResponse({ error: 'fetchRes is disabled until FETCH_RES_ALLOWED_HOSTS is configured' }, 403);
    }

    const targetValidation = validateTargetUrl(parsedTargetUrl, allowedHosts);
    if (!targetValidation.ok) {
        return targetValidation.response;
    }

    const { response: upstreamResponse, blockedResponse } = await fetchWithValidatedRedirects(parsedTargetUrl, allowedHosts);
    if (blockedResponse) {
        return blockedResponse;
    }

    const headers = new Headers(upstreamResponse.headers);
    headers.set('Cache-Control', 'no-store');
    headers.delete('Set-Cookie');

    return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers,
    });
}
