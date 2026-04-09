import {
    cleanupExpiredRecycleBin,
    listRecycleBinRecords,
    getDeletedAt,
    RECYCLE_BIN_RETENTION_DAYS
} from '../../../utils/recycleBin.js';
import { sanitizeExposedMetadata } from '../../../utils/mediaSecurity.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

export async function onRequest(context) {
    const { request, env, waitUntil } = context;

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        waitUntil(cleanupExpiredRecycleBin(context));

        const url = new URL(request.url);
        const requestedLimit = parseInt(url.searchParams.get('limit'), 10);
        const limit = Number.isFinite(requestedLimit)
            ? Math.max(1, Math.min(requestedLimit, 500))
            : 200;
        const now = Date.now();

        const records = await listRecycleBinRecords(env, { limit, now });

        const files = records.map(record => {
            const deletedAt = getDeletedAt(record.metadata || {});
            const expiresAt = deletedAt + RECYCLE_BIN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
            const daysLeft = Math.max(0, Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000)));

            return {
                id: record.name,
                metadata: sanitizeExposedMetadata(record.metadata),
                deletedAt,
                expiresAt,
                daysLeft
            };
        });

        files.sort((a, b) => b.deletedAt - a.deletedAt);

        return new Response(JSON.stringify({
            success: true,
            files,
            totalCount: files.length,
            retentionDays: RECYCLE_BIN_RETENTION_DAYS
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}
