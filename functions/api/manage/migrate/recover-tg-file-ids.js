/**
 * Migration: recover TgFileId for sync-imported files that are missing it.
 *
 * Background:
 *   Batch-sync-imported files (key format: tg_<channel>_<messageId>_<fileUniqueId>)
 *   were stored with file_unique_id in the key but WITHOUT TgFileId in metadata.
 *   Telegram's file_unique_id cannot be used with getFile — only file_id can.
 *   This endpoint recovers the usable file_id by forwarding the original message
 *   to a target chat, reading the fresh file_id from the forwarded message,
 *   then deleting the forwarded message and patching the KV metadata.
 *
 * POST /api/manage/migrate/recover-tg-file-ids
 * Body (JSON):
 *   {
 *     targetChatId: string,   // Required. Chat where messages are forwarded temporarily.
 *                             // Must be accessible by the bot (e.g. your private chat with the bot).
 *     limit?:       number,   // Max files to process in this call. Default 20, max 100.
 *     dryRun?:      boolean,  // If true, only list candidates without making changes.
 *     keys?:        string[], // Optional. Process only these specific file keys.
 *                             // If omitted, scans the full index for candidates.
 *   }
 *
 * Response:
 *   {
 *     success:   boolean,
 *     total:     number,   // Total candidates found
 *     processed: number,   // Attempted
 *     recovered: number,   // Successfully patched
 *     failed:    Array<{ id, reason }>,
 *     skipped:   Array<{ id, reason }>,
 *     dryRun:    boolean,
 *   }
 */

import { getDatabase } from '../../../utils/databaseAdapter.js';
import { TelegramAPI } from '../../../utils/telegramAPI.js';
import { resolveTelegramAccess } from '../../../utils/mediaSecurity.js';
import { addFileToIndex } from '../../../utils/indexManager.js';

const INDEX_META_KEY = 'manage@index@meta';
const INDEX_KEY = 'manage@index';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
}

/**
 * Scan index chunks for files missing TgFileId.
 * Uses only kv.get() — no kv.list() — safe even when list quota is exhausted.
 */
async function scanIndexForCandidates(db) {
    const metaRaw = await db.get(INDEX_META_KEY);
    if (!metaRaw) {
        throw new Error('Index metadata not found. Run an index rebuild first.');
    }

    const meta = JSON.parse(metaRaw);
    const chunkCount = meta.chunkCount || 0;

    // Load all chunks in parallel (all kv.get calls)
    const chunkKeys = Array.from({ length: chunkCount }, (_, i) => `${INDEX_KEY}_${i}`);
    const chunks = await Promise.all(chunkKeys.map(k => db.get(k)));

    const candidates = [];
    for (const chunkRaw of chunks) {
        if (!chunkRaw) continue;
        let files;
        try {
            files = JSON.parse(chunkRaw);
        } catch {
            continue;
        }
        if (!Array.isArray(files)) continue;

        for (const file of files) {
            if (isMissingFileId(file.metadata)) {
                candidates.push({ id: file.id, metadata: file.metadata });
            }
        }
    }

    return candidates;
}

function isMissingFileId(metadata = {}) {
    return (
        (metadata.Channel === 'TelegramNew') &&
        !metadata.TgFileId &&
        metadata.TgChatId &&
        metadata.TgMessageId
    );
}

/**
 * Try to extract chatId and messageId from the key name when metadata lacks them.
 * Key format: tg_<channelName>_<messageId>_<fileUniqueId>.<ext>
 * e.g. tg_Telegram_env_42_AgADCx0AAm2GsVY.jpg → messageId=42
 */
function extractIdsFromKey(key, env) {
    const basename = key.split('/').pop().replace(/\.[^.]+$/, ''); // strip dir + ext
    const match = basename.match(/^tg_(.+)_(\d+)_(.+)$/);
    if (!match) return null;
    const messageId = match[2];
    const chatId = env.TG_CHAT_ID || null;
    if (!chatId) return null;
    return { chatId, messageId };
}

/**
 * Extract the highest-quality file_id from a Telegram message object.
 */
function extractFileId(message) {
    if (Array.isArray(message.photo) && message.photo.length > 0) {
        return message.photo.reduce((best, cur) =>
            (cur.file_size || 0) > (best.file_size || 0) ? cur : best
        ).file_id;
    }
    return (
        message.video?.file_id ||
        message.document?.file_id ||
        message.audio?.file_id ||
        message.animation?.file_id ||
        message.voice?.file_id ||
        message.video_note?.file_id ||
        null
    );
}

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequestPost(context) {
    const { env, request } = context;

    let body;
    try {
        body = await request.json();
    } catch {
        return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400);
    }

    const targetChatId = String(body.targetChatId || '').trim();
    if (!targetChatId) {
        return jsonResponse({ success: false, error: 'targetChatId is required' }, 400);
    }

    const limit = Math.min(Math.max(parseInt(body.limit) || 20, 1), 100);
    const dryRun = body.dryRun === true;
    const specificKeys = Array.isArray(body.keys) && body.keys.length > 0 ? body.keys : null;

    const db = getDatabase(env);

    // --- Find candidates ---
    let candidates;
    try {
        if (specificKeys) {
            const records = await Promise.all(
                specificKeys.map(async key => {
                    const record = await db.getWithMetadata(key);
                    return record ? { id: key, metadata: record.metadata || {} } : null;
                })
            );
            candidates = records.filter(r => r !== null);
        } else {
            candidates = await scanIndexForCandidates(db);
        }
    } catch (err) {
        return jsonResponse({ success: false, error: `Failed to scan candidates: ${err.message}` }, 500);
    }

    const results = {
        success: true,
        total: candidates.length,
        processed: 0,
        recovered: 0,
        failed: [],
        skipped: [],
        dryRun,
    };

    if (dryRun) {
        results.skipped = candidates.slice(0, limit).map(c => {
            const chatId = c.metadata.TgChatId
                || extractIdsFromKey(c.id, env)?.chatId
                || null;
            const messageId = c.metadata.TgMessageId
                || extractIdsFromKey(c.id, env)?.messageId
                || null;
            return { id: c.id, reason: 'dry run', chatId, messageId };
        });
        results.processed = results.skipped.length;
        return jsonResponse(results);
    }

    const toProcess = candidates.slice(0, limit);

    for (const candidate of toProcess) {
        results.processed++;
        const { id, metadata } = candidate;

        // Prefer metadata fields; fall back to extracting from key name + env
        const fromKey = extractIdsFromKey(id, env);
        const chatId = metadata.TgChatId || fromKey?.chatId || null;
        const messageId = metadata.TgMessageId || fromKey?.messageId || null;

        if (!chatId || !messageId) {
            results.skipped.push({ id, reason: 'missing TgChatId or TgMessageId (not in metadata or key)' });
            continue;
        }

        let telegramAccess = await resolveTelegramAccess(env, metadata);
        // Old sync-imported files may lack Channel/ChannelName in metadata.
        // Fall back to the env-level bot token which is always the default channel.
        if (!telegramAccess?.botToken && env.TG_BOT_TOKEN) {
            telegramAccess = {
                botToken: env.TG_BOT_TOKEN,
                proxyUrl: env.TG_PROXY_URL || '',
            };
        }
        if (!telegramAccess?.botToken) {
            results.skipped.push({ id, reason: 'no bot token resolved (TG_BOT_TOKEN env var not set)' });
            continue;
        }

        const tgApi = new TelegramAPI(telegramAccess.botToken, telegramAccess.proxyUrl || '');
        let forwardedMessageId = null;

        try {
            // Forward the original message to get a fresh file_id
            const forwarded = await tgApi.request('forwardMessage', {
                method: 'POST',
                params: {
                    chat_id: targetChatId,
                    from_chat_id: chatId,
                    message_id: String(messageId),
                },
            });

            forwardedMessageId = forwarded.message_id;
            const recoveredFileId = extractFileId(forwarded);

            if (!recoveredFileId) {
                results.failed.push({ id, reason: 'forwarded message contained no recognizable media' });
                continue;
            }

            // Patch KV: read current value, merge metadata, write back
            const record = await db.getWithMetadata(id);
            const currentMetadata = record?.metadata || metadata;
            const newMetadata = { ...currentMetadata, TgFileId: recoveredFileId };
            const value = record?.value ?? '';

            await db.put(id, value, { metadata: newMetadata });

            // Record an index update operation so the index reflects the new metadata
            await addFileToIndex(context, id, newMetadata);

            results.recovered++;
        } catch (err) {
            results.failed.push({ id, reason: err.message });
        } finally {
            // Always clean up the forwarded message — non-fatal if it fails
            if (forwardedMessageId !== null) {
                try {
                    await tgApi.request('deleteMessage', {
                        method: 'POST',
                        params: {
                            chat_id: targetChatId,
                            message_id: String(forwardedMessageId),
                        },
                    });
                } catch {
                    console.warn(`[recover-tg-file-ids] Failed to delete forwarded message ${forwardedMessageId} in ${targetChatId} for file ${id}`);
                }
            }
        }
    }

    return jsonResponse(results);
}
