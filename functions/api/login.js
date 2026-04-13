import {
    fetchSecurityConfig,
    getConfiguredUserAuthCode,
    hasConfiguredUserAuthCode,
    hasSecurityConfigLoadError,
} from "../utils/sysConfig.js";

export async function onRequestPost(context) {
    const { request, env } = context;
    const jsonRequest = await request.json();
    const authCode = jsonRequest.authCode;

    const securityConfig = await fetchSecurityConfig(env);
    if (hasSecurityConfigLoadError(securityConfig)) {
        return new Response('Security configuration is unavailable', { status: 503 });
    }

    if (!hasConfiguredUserAuthCode(securityConfig)) {
        return new Response('User auth code is not configured', { status: 503 });
    }

    const rightAuthCode = getConfiguredUserAuthCode(securityConfig);
    if (authCode !== rightAuthCode) {
        return new Response('Unauthorized', { status: 401 });
    }

    return new Response('Login success', { status: 200 });
}
