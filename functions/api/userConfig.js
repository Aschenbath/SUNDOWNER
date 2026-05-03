import { fetchPageConfig } from "../utils/sysConfig.js";
import { methodNotAllowed, optionsResponse, withCorsHeaders } from '../utils/cors.js';

function invalidStoredConfigResponse() {
    return new Response(JSON.stringify({
        success: false,
        error: 'Invalid stored user configuration'
    }), {
        status: 500,
        headers: withCorsHeaders({ 'Content-Type': 'application/json' })
    });
}

export function onRequestOptions() {
    return optionsResponse();
}

export async function onRequest(context) {
    const request = context.request || new Request('http://localhost/api/userConfig', { method: 'GET' });
    if (request.method === 'OPTIONS') {
        return optionsResponse();
    }
    if (request.method !== 'GET') {
        return methodNotAllowed(['GET', 'OPTIONS']);
    }

    const { env } = context;
    const PageConfig = await fetchPageConfig(env);
    const userConfigList = PageConfig.config;
    const userConfig = {};

    for (const config of userConfigList) {
        if (config.value !== undefined && config.value !== null && config.value !== '') {
            try {
                userConfig[config.id] = JSON.parse(config.value);
            } catch (error) {
                console.error(`Invalid stored user configuration for ${config.id}:`, error);
                return invalidStoredConfigResponse();
            }
        } else if (config.type === 'boolean' && config.default !== undefined) {
            userConfig[config.id] = config.default;
        }
    }

    if (!userConfig) {
        return new Response(JSON.stringify({}), {
            status: 200,
            headers: withCorsHeaders({ 'Content-Type': 'application/json' })
        });
    }

    if (typeof userConfig === 'object' && userConfig !== null) {
        return new Response(JSON.stringify(userConfig), {
            status: 200,
            headers: withCorsHeaders({ 'Content-Type': 'application/json' })
        });
    }

    return invalidStoredConfigResponse();
}
