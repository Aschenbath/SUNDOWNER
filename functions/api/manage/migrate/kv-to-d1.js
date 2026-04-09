import { rebuildIndex } from '../../../utils/indexManager.js';
import { D1Database } from '../../../utils/d1Database.js';
import { KV_TO_D1_MIGRATION_STATE_KEY } from '../../../utils/databaseAdapter.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

function clampNumber(value, min, max, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.min(max, Math.max(min, parsed));
}

function shouldSkipKey(key) {
    return (
        key.startsWith('chunk_')
        || key.startsWith('manage@index')
        || key === 'manage@sysConfig@mediaLibraryAlbums'
    );
}

export async function onRequest(context) {
    const { request } = context;

    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({
            error: 'Method not allowed',
        }), {
            status: 405,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
            },
        });
    }

    return onRequestPost(context);
}

async function onRequestPost(context) {
    const { env, request } = context;

    if (!env.img_url || typeof env.img_url.list !== 'function') {
        return new Response(JSON.stringify({
            error: 'KV binding img_url is required',
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
            },
        });
    }

    if (!env.img_d1 || typeof env.img_d1.prepare !== 'function') {
        return new Response(JSON.stringify({
            error: 'D1 binding img_d1 is required',
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
            },
        });
    }

    const payload = await request.json().catch(() => ({}));
    const limit = clampNumber(payload.limit, 1, 2000, 500);
    const cursor = typeof payload.cursor === 'string' && payload.cursor ? payload.cursor : undefined;
    const includeSettings = payload.includeSettings !== false;
    const rebuild = payload.rebuild !== false;

    const d1 = new D1Database(env.img_d1);
    const response = await env.img_url.list({
        limit,
        cursor,
    });

    let migratedFiles = 0;
    let migratedSettings = 0;
    let skipped = 0;
    const skippedKeys = [];

    function recordSkippedKey(key, reason) {
        skipped += 1;
        if (skippedKeys.length < 100) {
            skippedKeys.push({ key, reason });
        }
    }

    for (const item of response.keys || []) {
        const key = item.name;
        if (shouldSkipKey(key)) {
            recordSkippedKey(key, 'internal_key');
            continue;
        }

        if (key.startsWith('manage@sysConfig@')) {
            if (!includeSettings) {
                recordSkippedKey(key, 'settings_excluded');
                continue;
            }

            const value = await env.img_url.get(key);
            if (value === null) {
                recordSkippedKey(key, 'missing_setting_value');
                continue;
            }

            await d1.put(key, value);
            migratedSettings += 1;
            continue;
        }

        if (key.startsWith('manage@')) {
            recordSkippedKey(key, 'unsupported_manage_key');
            continue;
        }

        if (!item.metadata || Object.keys(item.metadata).length === 0) {
            recordSkippedKey(key, 'missing_metadata');
            continue;
        }

        await d1.put(key, '', {
            metadata: item.metadata,
        });
        migratedFiles += 1;
    }

    const migrationStatus = {
        complete: !response.cursor,
        nextCursor: response.cursor || null,
        updatedAt: Date.now(),
    };
    await d1.put(KV_TO_D1_MIGRATION_STATE_KEY, JSON.stringify(migrationStatus));

    let rebuildResult = null;
    if (rebuild) {
        rebuildResult = await rebuildIndex(context);
    }

    return new Response(JSON.stringify({
        success: true,
        migratedFiles,
        migratedSettings,
        skipped,
        skippedKeys,
        skippedKeysTruncated: skipped > skippedKeys.length,
        nextCursor: response.cursor || null,
        done: !response.cursor,
        migrationStatus,
        rebuild: rebuildResult,
    }), {
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
        },
    });
}
