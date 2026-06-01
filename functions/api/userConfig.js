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
                // 这是未鉴权、登录前的公开端点：单个 config 值损坏（或被存成裸字符串）
                // 不能让整个端点 500、丢掉全部配置。跳过坏 key、继续返回其余可用配置。
                // 注意只 console 记录、不把原始错误/坏值放进响应体，避免泄露内部细节。
                console.error(`Invalid stored user configuration for ${config.id}, skipping:`, error);
                continue;
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
