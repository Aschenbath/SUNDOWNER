import { rebuildIndex } from '../../../utils/indexManager.js';
import { D1Database } from '../../../utils/d1Database.js';
import { KV_TO_D1_MIGRATION_STATE_KEY } from '../../../utils/databaseAdapter.js';
import { loadLegacyKvIndexMetadataMap, mergeCaptureMetadata } from '../../../utils/captureTimeMetadata.js';

const MIGRATION_WRITE_CONCURRENCY = 3;

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

async function runWithConcurrency(items, concurrency, worker) {
    const results = new Array(items.length);
    let nextIndex = 0;
    const workerCount = Math.min(Math.max(1, concurrency), items.length);
    const runners = Array.from({ length: workerCount }, async () => {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            results[currentIndex] = await worker(items[currentIndex], currentIndex);
        }
    });
    await Promise.all(runners);
    return results;
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

    const skippedKeys = [];
    const targetFileKeys = (response.keys || [])
        .map((item) => item?.name)
        .filter((key) => key && !shouldSkipKey(key) && !key.startsWith('manage@'));
    const legacyIndexMetadataMap = await loadLegacyKvIndexMetadataMap(env, targetFileKeys);

    const migrationResults = await runWithConcurrency(response.keys || [], MIGRATION_WRITE_CONCURRENCY, async (item) => {
        const key = item.name;
        if (shouldSkipKey(key)) {
            return { skippedKey: { key, reason: 'internal_key' } };
        }

        if (key.startsWith('manage@sysConfig@')) {
            if (!includeSettings) {
                return { skippedKey: { key, reason: 'settings_excluded' } };
            }

            const value = await env.img_url.get(key);
            if (value === null) {
                return { skippedKey: { key, reason: 'missing_setting_value' } };
            }

            await d1.put(key, value);
            return { migratedSettings: 1 };
        }

        if (key.startsWith('manage@')) {
            return { skippedKey: { key, reason: 'unsupported_manage_key' } };
        }

        if (!item.metadata || Object.keys(item.metadata).length === 0) {
            return { skippedKey: { key, reason: 'missing_metadata' } };
        }

        await d1.put(key, '', {
            metadata: mergeCaptureMetadata(
                item.metadata,
                legacyIndexMetadataMap.get(key) || {},
                item.metadata?.FileName || key,
            ),
        });
        return { migratedFiles: 1 };
    });

    let migratedFiles = 0;
    let migratedSettings = 0;
    let skipped = 0;
    for (const result of migrationResults) {
        migratedFiles += result?.migratedFiles || 0;
        migratedSettings += result?.migratedSettings || 0;
        if (result?.skippedKey) {
            skipped += 1;
            if (skippedKeys.length < 100) {
                skippedKeys.push(result.skippedKey);
            }
        }
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
