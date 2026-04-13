import {
    fetchSecurityConfig,
    getConfiguredUserAuthCode,
    hasConfiguredUserAuthCode,
    hasSecurityConfigLoadError,
} from './sysConfig.js';
import { validateApiToken } from './tokenValidator.js';
import { getDatabase } from './databaseAdapter.js';

export async function userAuthCheck(env, url, request, requiredPermission = null) {
    const securityConfig = await fetchSecurityConfig(env);
    if (hasSecurityConfigLoadError(securityConfig)) {
        return false;
    }

    const tokenValidation = await validateApiToken(request, getDatabase(env), requiredPermission);
    if (tokenValidation.valid) {
        return true;
    }

    if (!hasConfiguredUserAuthCode(securityConfig)) {
        return false;
    }

    const rightAuthCode = getConfiguredUserAuthCode(securityConfig);

    let authCode = request.headers.get('authCode');
    if (!authCode) {
        const cookies = request.headers.get('Cookie');
        if (cookies) {
            authCode = getCookieValue(cookies, 'authCode');
        }
    }

    if (!isValidAuthCode(rightAuthCode, authCode)) {
        return false;
    }

    return true;
}

export function UnauthorizedResponse(reason) {
    return new Response(reason, {
        status: 401,
        statusText: "Unauthorized",
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            "Content-Type": "text/plain;charset=UTF-8",
            "Cache-Control": "no-store",
            "Content-Length": reason.length,
        },
    });
}

function isValidAuthCode(rightAuthCode, authCode) {
    return authCode === rightAuthCode;
}

function getCookieValue(cookies, name) {
    const match = cookies.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
}
