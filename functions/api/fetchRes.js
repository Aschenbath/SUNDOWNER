import { dualAuthCheck } from '../utils/dualAuth.js';
import { fetchSecurityConfig } from '../utils/sysConfig.js';

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

export async function onRequest(context) {
    const { request, env } = context;

    const requestUrl = new URL(request.url);
    const { authorized } = await dualAuthCheck(env, requestUrl, request);
    if (!authorized) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    let jsonRequest;
    try {
        jsonRequest = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const targetUrl = jsonRequest?.url;
    if (!targetUrl) {
        return new Response(JSON.stringify({ error: 'URL is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    let parsedTargetUrl;
    try {
        parsedTargetUrl = new URL(targetUrl);
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid target URL' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (!['https:', 'http:'].includes(parsedTargetUrl.protocol) || parsedTargetUrl.username || parsedTargetUrl.password) {
        return new Response(JSON.stringify({ error: 'Target URL is not allowed' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const allowedHosts = parseAllowedHosts(env, await fetchSecurityConfig(env));
    if (allowedHosts.length === 0) {
        return new Response(JSON.stringify({ error: 'fetchRes is disabled until FETCH_RES_ALLOWED_HOSTS is configured' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (isIpLiteral(parsedTargetUrl.hostname) && isBlockedTarget(parsedTargetUrl.hostname)) {
        return new Response(JSON.stringify({ error: 'Private or local targets are blocked' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (isLocalHostname(parsedTargetUrl.hostname) || !isAllowedHost(parsedTargetUrl.hostname, allowedHosts)) {
        return new Response(JSON.stringify({ error: 'Target host is not allowlisted' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const upstreamResponse = await fetch(parsedTargetUrl.toString());
    const headers = new Headers(upstreamResponse.headers);
    headers.set('Cache-Control', 'no-store');

    return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers,
    });
}
