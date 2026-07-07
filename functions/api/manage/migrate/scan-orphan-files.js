import { getDatabase } from '../../../utils/databaseAdapter.js';

const INDEX_META_KEY = 'manage@index@meta';
const INDEX_KEY = 'manage@index';
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
        },
    });
}

function clampLimit(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
        return DEFAULT_LIMIT;
    }
    return Math.min(MAX_LIMIT, Math.max(1, parsed));
}

function normalizePrefix(value = '') {
    const normalized = String(value || '').trim().replace(/\\/g, '/');
    if (!normalized) {
        return '';
    }
    return normalized.endsWith('/') ? normalized : `${normalized}/`;
}

function extractImportedTelegramIds(key) {
    const basename = String(key || '').split('/').pop()?.replace(/\.[^.]+$/, '') || '';
    const match = basename.match(/^tg_(.+)_(\d+)_(.+)$/);
    if (!match) return null;
    return {
        channelName: match[1],
        messageId: match[2],
    };
}

function isTimestampStyleKey(key) {
    const basename = String(key || '').split('/').pop() || '';
    return /^\d{13}(?:[_(.]|$)/.test(basename);
}

function isLikelyTelegramRecord(metadata = {}) {
    return metadata.Channel === 'TelegramNew'
        || String(metadata.ChannelName || '').toLowerCase().includes('telegram');
}

function isOrphanCandidate(file) {
    const metadata = file?.metadata || {};

    if (!isLikelyTelegramRecord(metadata)) {
        return false;
    }

    if (metadata.TgFileId || metadata.TgMessageId) {
        return false;
    }

    if (extractImportedTelegramIds(file?.id)) {
        return false;
    }

    return isTimestampStyleKey(file?.id);
}

function toCandidate(file) {
    const metadata = file?.metadata || {};
    return {
        id: file.id,
        fileName: metadata.FileName || '',
        timeStamp: metadata.TimeStamp || null,
        channel: metadata.Channel || '',
        channelName: metadata.ChannelName || '',
        directory: metadata.Directory || '',
        tgChatId: metadata.TgChatId || null,
        tgFileId: metadata.TgFileId || null,
        tgMessageId: metadata.TgMessageId || null,
        recoverableByKey: false,
        reason: 'timestamp-style Telegram record without TgFileId/TgMessageId',
    };
}

async function scanIndexFiles(db) {
    const metaRaw = await db.get(INDEX_META_KEY);
    if (!metaRaw) {
        throw new Error('Index metadata not found. Run an index rebuild first.');
    }

    const meta = JSON.parse(metaRaw);
    const chunkCount = Number(meta.chunkCount) || 0;
    const chunkKeys = Array.from({ length: chunkCount }, (_, index) => `${INDEX_KEY}_${index}`);
    const chunks = await Promise.all(chunkKeys.map((key) => db.get(key)));

    const files = [];
    for (const chunkRaw of chunks) {
        if (!chunkRaw) continue;

        let parsedChunk;
        try {
            parsedChunk = JSON.parse(chunkRaw);
        } catch {
            continue;
        }

        if (!Array.isArray(parsedChunk)) {
            continue;
        }

        for (const file of parsedChunk) {
            if (file?.id) {
                files.push({
                    id: file.id,
                    metadata: file.metadata || {},
                });
            }
        }
    }

    return files;
}

export function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: corsHeaders,
    });
}

export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const limit = clampLimit(url.searchParams.get('limit'));
    const channelNameFilter = String(url.searchParams.get('channelName') || '').trim();
    const directoryPrefix = normalizePrefix(url.searchParams.get('directory'));
    const db = getDatabase(env);

    let files;
    try {
        files = await scanIndexFiles(db);
    } catch (error) {
        console.error('[scan-orphan-files] Failed to scan index:', error);
        return jsonResponse({
            success: false,
            error: 'Failed to scan index',
        }, 500);
    }

    const candidates = files
        .filter(isOrphanCandidate)
        .filter((file) => !channelNameFilter || file.metadata?.ChannelName === channelNameFilter)
        .filter((file) => !directoryPrefix || String(file.metadata?.Directory || '').startsWith(directoryPrefix))
        .sort((left, right) => (Number(right.metadata?.TimeStamp) || 0) - (Number(left.metadata?.TimeStamp) || 0));

    const returnedCandidates = candidates.slice(0, limit).map(toCandidate);

    return jsonResponse({
        success: true,
        total: candidates.length,
        returned: returnedCandidates.length,
        limit,
        truncated: candidates.length > returnedCandidates.length,
        files: returnedCandidates,
    });
}
