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
 *     botToken?:    string,   // Optional. Bot token override when env/KV config is unavailable.
 *     sourceChatId?: string,  // Optional. Source chat ID override (where original messages live).
 *     proxyUrl?:    string,   // Optional. Telegram API proxy domain.
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
import { getUploadConfig } from '../sysConfig/upload.js';

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
            if (isMissingFileId(file)) {
                candidates.push({ id: file.id, metadata: file.metadata });
            }
        }
    }

    return candidates;
}

function isMissingFileId(file) {
    const metadata = file?.metadata || {};
    if (metadata.Channel !== 'TelegramNew' || metadata.TgFileId) return false;
    // messageId can come from metadata or key name
    if (metadata.TgMessageId) return true;
    return !!extractIdsFromKey(file.id)?.messageId;
}

/**
 * Extract channelName and messageId from the key name.
 * Key format: tg_<channelName>_<messageId>_<fileUniqueId>.<ext>
 * e.g. tg_Telegram_env_42_AgADCx0AAm2GsVY.jpg → channelName=Telegram_env, messageId=42
 */
function extractIdsFromKey(key) {
    const basename = key.split('/').pop().replace(/\.[^.]+$/, ''); // strip dir + ext
    const match = basename.match(/^tg_(.+)_(\d+)_(.+)$/);
    if (!match) return null;
    return { channelName: match[1], messageId: match[2] };
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

    const explicitBotToken = String(body.botToken || '').trim() || null;
    const explicitSourceChatId = String(body.sourceChatId || '').trim() || null;
    const explicitProxyUrl = String(body.proxyUrl || '').trim() || '';
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
            const fromKey = extractIdsFromKey(c.id);
            const messageId = c.metadata.TgMessageId || fromKey?.messageId || null;
            return { id: c.id, reason: 'dry run', channelName: fromKey?.channelName, messageId };
        });
        results.processed = results.skipped.length;
        return jsonResponse(results);
    }

    const toProcess = candidates.slice(0, limit);

    // Lazy-load upload config (single KV read shared across all candidates)
    let _uploadConfig = null;
    async function getUploadConfigOnce() {
        if (!_uploadConfig) _uploadConfig = await getUploadConfig(db, env);
        return _uploadConfig;
    }

    for (const candidate of toProcess) {
        results.processed++;
        const { id, metadata } = candidate;

        const fromKey = extractIdsFromKey(id);
        const messageId = metadata.TgMessageId || fromKey?.messageId || null;

        if (!messageId) {
            results.skipped.push({ id, reason: 'cannot determine message ID from metadata or key' });
            continue;
        }

        // Resolve Telegram credentials: metadata → upload config → env → explicit params
        let telegramAccess = await resolveTelegramAccess(env, metadata);
        let chatId = metadata.TgChatId || telegramAccess?.chatId || null;

        // Fall back to upload config for botToken AND/OR chatId
        if (!telegramAccess?.botToken || !chatId) {
            const config = await getUploadConfigOnce();
            const channels = config?.telegram?.channels || [];
            const channel = channels.find(ch => ch.botToken && ch.enabled !== false);
            if (channel) {
                if (!telegramAccess?.botToken) {
                    telegramAccess = {
                        botToken: channel.botToken,
                        proxyUrl: channel.proxyUrl || '',
                    };
                }
                if (!chatId) {
                    chatId = channel.chatId || null;
                }
            }
        }
        // Final fallback: explicit request params
        if (!telegramAccess?.botToken && explicitBotToken) {
            telegramAccess = { botToken: explicitBotToken, proxyUrl: explicitProxyUrl };
        }
        if (!chatId) {
            chatId = explicitSourceChatId;
        }

        if (!telegramAccess?.botToken) {
            results.skipped.push({ id, reason: 'no bot token resolved' });
            continue;
        }
        if (!chatId) {
            results.skipped.push({ id, reason: 'cannot determine source chat ID' });
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
            const newMetadata = {
                ...currentMetadata,
                TgFileId: recoveredFileId,
                // Ensure channel credentials are in metadata so file serving
                // can resolve them via resolveTelegramAccess path 1.
                TgBotToken: currentMetadata.TgBotToken || telegramAccess.botToken,
                TgChatId: currentMetadata.TgChatId || chatId,
                TgProxyUrl: currentMetadata.TgProxyUrl || telegramAccess.proxyUrl || '',
                Channel: currentMetadata.Channel || 'TelegramNew',
                ChannelName: currentMetadata.ChannelName || fromKey?.channelName || 'Telegram_env',
            };
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
