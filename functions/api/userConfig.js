import { fetchPageConfig } from "../utils/sysConfig.js";

function invalidStoredConfigResponse() {
    return new Response(JSON.stringify({
        success: false,
        error: 'Invalid stored user configuration'
    }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
}

export async function onRequest(context) {
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
        return new Response(JSON.stringify({}), { status: 200 });
    }

    if (typeof userConfig === 'object' && userConfig !== null) {
        return new Response(JSON.stringify(userConfig), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return invalidStoredConfigResponse();
}
