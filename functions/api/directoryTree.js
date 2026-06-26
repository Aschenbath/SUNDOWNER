import { getDirectoryTree } from '../utils/indexManager.js';
import { dualAuthCheck } from '../utils/dualAuth.js';
import { fetchPageConfig } from '../utils/sysConfig.js';
import { jsonResponse, methodNotAllowed, optionsResponse } from '../utils/cors.js';

const DEFAULT_CACHE_TIME = 60;

function parseCacheTime(value) {
    if (value === null || value === undefined || value === '') {
        return DEFAULT_CACHE_TIME;
    }
    const normalized = String(value).trim();
    if (!/^\d+$/.test(normalized)) {
        return DEFAULT_CACHE_TIME;
    }
    const parsed = Number(normalized);
    return Number.isSafeInteger(parsed) ? parsed : DEFAULT_CACHE_TIME;
}

/**
 * 目录树 API 端点
 * GET /api/directoryTree
 *
 * 查询参数：
 * - cacheTime: 可选，覆盖默认缓存时间（秒），默认 60
 *
 * 响应：
 * - 成功：{ tree: DirectoryTreeNode }
 * - 失败：{ error: string }
 *
 * 权限说明：
 * - 管理端鉴权成功：始终允许访问
 * - 用户端鉴权成功：仅当 showDirectorySuggestions 开启时允许访问
 */
export function onRequestOptions() {
    return optionsResponse();
}

export async function onRequestGet(context) {
    const { env, request } = context;
    const url = new URL(request.url);

    // 双重鉴权：用户端或管理端任意一个通过即可
    const authResult = await dualAuthCheck(env, url, request);
    if (!authResult.authorized) {
        return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    // 如果是用户端鉴权，检查 showDirectorySuggestions 设置
    if (authResult.authType === 'user') {
        const pageConfig = await fetchPageConfig(env);
        // 从 config 数组中查找 showDirectorySuggestions 设置
        const showDirSetting = pageConfig.config?.find(c => c.id === 'showDirectorySuggestions');
        const showDirectorySuggestions = showDirSetting?.value ?? showDirSetting?.default ?? true;

        if (!showDirectorySuggestions) {
            return jsonResponse({ error: 'Directory suggestions disabled' }, { status: 403 });
        }
    }

    try {
        const tree = await getDirectoryTree(context);
        const cacheTime = parseCacheTime(url.searchParams.get('cacheTime'));

        return jsonResponse({ tree }, {
            headers: {
                'Cache-Control': `public, max-age=${cacheTime}`,
            }
        });
    } catch (error) {
        console.error('directoryTree request failed:', error);
        return jsonResponse({ error: 'Unable to load the directory tree' }, { status: 500 });
    }
}

export function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return optionsResponse();
    }
    if (context.request.method !== 'GET') {
        return methodNotAllowed(['GET', 'OPTIONS']);
    }
    return onRequestGet(context);
}
