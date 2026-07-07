/**
 * Migration: recover TgFileId for Telegram files that are missing it.
 *
 * Supported sources:
 * 1. Imported tg_<channel>_<messageId>_<fileUniqueId> keys, where messageId can
 *    still be derived from the storage key.
 * 2. Timestamp-style orphan files, when the request provides explicit recovery
 *    hints that link a file key to its original Telegram message or file_id.
 *
 * POST /api/manage/migrate/recover-tg-file-ids
 * Body (JSON):
 *   {
 *     targetChatId: string,
 *     botToken?: string,
 *     sourceChatId?: string,
 *     proxyUrl?: string,
 *     limit?: number,
 *     dryRun?: boolean,
 *     keys?: string[],
 *     matches?: Array<{
 *       key: string,
 *       messageId?: string|number,
 *       chatId?: string|number,
 *       channelName?: string,
 *       fileId?: string,
 *     }>,
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

function normalizeString(value) {
    const normalized = String(value ?? '').trim();
    return normalized || '';
}

function normalizeOptionalString(value) {
    const normalized = normalizeString(value);
    return normalized || null;
}

function isTimestampStyleKey(key = '') {
    const basename = normalizeString(key).split('/').pop() || '';
    return /^\d{13}(?:[_.( -]|$)/.test(basename);
}

function extractIdsFromKey(key = '') {
    const basename = normalizeString(key).split('/').pop()?.replace(/\.[^.]+$/, '') || '';
    const match = basename.match(/^tg_(.+)_(\d+)_(.+)$/);
    if (!match) {
        return null;
    }
    return { channelName: match[1], messageId: match[2] };
}

function isImportedCandidate(file) {
    const metadata = file?.metadata || {};
    if (metadata.Channel !== 'TelegramNew' || metadata.TgFileId) {
        return false;
    }
    if (metadata.TgMessageId) {
        return true;
    }
    return !!extractIdsFromKey(file?.id)?.messageId;
}

function isTimestampOrphanCandidate(file) {
    const metadata = file?.metadata || {};
    const channelName = normalizeString(metadata.ChannelName).toLowerCase();
    if (metadata.Channel !== 'TelegramNew' || metadata.TgFileId || metadata.TgMessageId) {
        return false;
    }
    return isTimestampStyleKey(file?.id) && (
        metadata.Channel === 'TelegramNew'
        || channelName.includes('telegram')
    );
}

function shouldRecoverRecord(file, recoveryHints) {
    return isImportedCandidate(file)
        || isTimestampOrphanCandidate(file)
        || recoveryHints.has(file?.id);
}

async function scanIndexForCandidates(db, recoveryHints) {
    const metaRaw = await db.get(INDEX_META_KEY);
    if (!metaRaw) {
        throw new Error('Index metadata not found. Run an index rebuild first.');
    }

    const meta = JSON.parse(metaRaw);
    const chunkCount = meta.chunkCount || 0;
    const chunkKeys = Array.from({ length: chunkCount }, (_, index) => `${INDEX_KEY}_${index}`);
    const chunks = await Promise.all(chunkKeys.map((key) => db.get(key)));

    const candidates = [];
    for (const chunkRaw of chunks) {
        if (!chunkRaw) {
            continue;
        }

        let files;
        try {
            files = JSON.parse(chunkRaw);
        } catch {
            continue;
        }

        if (!Array.isArray(files)) {
            continue;
        }

        for (const file of files) {
            if (shouldRecoverRecord(file, recoveryHints)) {
                candidates.push({
                    id: file.id,
                    metadata: file.metadata || {},
                });
            }
        }
    }

    return candidates;
}

function normalizeRecoveryHints(rawMatches) {
    const hints = new Map();
    if (!Array.isArray(rawMatches)) {
        return hints;
    }

    for (const rawEntry of rawMatches) {
        const key = normalizeString(rawEntry?.key || rawEntry?.id);
        if (!key) {
            continue;
        }

        const fileId = normalizeString(rawEntry?.fileId || rawEntry?.tgFileId);
        const messageId = normalizeOptionalString(rawEntry?.messageId);
        if (!fileId && !messageId) {
            continue;
        }

        hints.set(key, {
            fileId,
            messageId,
            chatId: normalizeOptionalString(rawEntry?.chatId || rawEntry?.sourceChatId),
            channelName: normalizeString(rawEntry?.channelName),
        });
    }

    return hints;
}

function extractFileId(message) {
    if (Array.isArray(message?.photo) && message.photo.length > 0) {
        return message.photo.reduce((best, current) =>
            (current.file_size || 0) > (best.file_size || 0) ? current : best
        ).file_id;
    }

    return (
        message?.video?.file_id ||
        message?.document?.file_id ||
        message?.audio?.file_id ||
        message?.animation?.file_id ||
        message?.voice?.file_id ||
        message?.video_note?.file_id ||
        null
    );
}

async function resolveSourceAccess(env, db, metadata, recoveryHint, explicitBotToken, explicitSourceChatId, explicitProxyUrl) {
    const hintChannelName = normalizeString(recoveryHint?.channelName);
    const hintedMetadata = hintChannelName && !metadata?.ChannelName
        ? { ...metadata, ChannelName: hintChannelName }
        : metadata;

    let telegramAccess = await resolveTelegramAccess(env, hintedMetadata || {});
    let chatId = normalizeOptionalString(metadata?.TgChatId)
        || normalizeOptionalString(recoveryHint?.chatId)
        || normalizeOptionalString(telegramAccess?.chatId);

    if (!telegramAccess?.botToken || !chatId) {
        const config = await getUploadConfig(db, env);
        const channels = config?.telegram?.channels || [];
        const requestedChannelName = normalizeString(hintedMetadata?.ChannelName);
        const matchedChannel = requestedChannelName
            ? channels.find((channel) => normalizeString(channel?.name) === requestedChannelName)
            : channels.find((channel) => channel?.botToken && channel?.enabled !== false);

        if (matchedChannel) {
            if (!telegramAccess?.botToken) {
                telegramAccess = {
                    botToken: matchedChannel.botToken,
                    proxyUrl: matchedChannel.proxyUrl || '',
                };
            }
            if (!chatId) {
                chatId = normalizeOptionalString(matchedChannel.chatId);
            }
        }
    }

    if (!telegramAccess?.botToken && explicitBotToken) {
        telegramAccess = {
            botToken: explicitBotToken,
            proxyUrl: explicitProxyUrl,
        };
    }
    if (!chatId) {
        chatId = normalizeOptionalString(explicitSourceChatId);
    }

    return {
        botToken: telegramAccess?.botToken || '',
        proxyUrl: telegramAccess?.proxyUrl || explicitProxyUrl || '',
        chatId: chatId || null,
    };
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

    const targetChatId = normalizeString(body.targetChatId);
    if (!targetChatId) {
        return jsonResponse({ success: false, error: 'targetChatId is required' }, 400);
    }

    const explicitBotToken = normalizeOptionalString(body.botToken);
    const explicitSourceChatId = normalizeOptionalString(body.sourceChatId);
    const explicitProxyUrl = normalizeString(body.proxyUrl);
    const limit = Math.min(Math.max(parseInt(body.limit, 10) || 20, 1), 100);
    const dryRun = body.dryRun === true;
    const recoveryHints = normalizeRecoveryHints(body.matches);
    const hintKeys = [...recoveryHints.keys()];
    const specificKeys = Array.isArray(body.keys) && body.keys.length > 0
        ? body.keys
        : (hintKeys.length > 0 ? hintKeys : null);

    const db = getDatabase(env);

    let candidates;
    try {
        if (specificKeys) {
            const records = await Promise.all(
                specificKeys.map(async (key) => {
                    const record = await db.getWithMetadata(key);
                    return record ? { id: key, metadata: record.metadata || {} } : null;
                }),
            );
            candidates = records.filter((record) => record && shouldRecoverRecord(record, recoveryHints));
        } else {
            candidates = await scanIndexForCandidates(db, recoveryHints);
        }
    } catch (error) {
        console.error('[recover-tg-file-ids] Failed to scan candidates:', error);
        return jsonResponse({ success: false, error: 'Failed to scan candidates' }, 500);
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

    const toProcess = candidates.slice(0, limit);

    if (dryRun) {
        results.processed = toProcess.length;
        results.skipped = toProcess.map((candidate) => {
            const fromKey = extractIdsFromKey(candidate.id);
            const hint = recoveryHints.get(candidate.id);
            return {
                id: candidate.id,
                reason: 'dry run',
                channelName: candidate.metadata?.ChannelName || fromKey?.channelName || hint?.channelName || '',
                messageId: candidate.metadata?.TgMessageId || fromKey?.messageId || hint?.messageId || null,
                matchedByHint: Boolean(hint),
            };
        });
        return jsonResponse(results);
    }

    for (const candidate of toProcess) {
        results.processed += 1;

        const { id, metadata } = candidate;
        const fromKey = extractIdsFromKey(id);
        const recoveryHint = recoveryHints.get(id);
        const directFileId = normalizeString(recoveryHint?.fileId);
        const messageId = normalizeOptionalString(metadata?.TgMessageId)
            || normalizeOptionalString(fromKey?.messageId)
            || normalizeOptionalString(recoveryHint?.messageId);
        const resolvedChannelName = normalizeString(metadata?.ChannelName)
            || normalizeString(fromKey?.channelName)
            || normalizeString(recoveryHint?.channelName)
            || 'Telegram_env';

        if (!directFileId && !messageId) {
            results.skipped.push({ id, reason: 'cannot determine message ID from metadata or key' });
            continue;
        }

        let access = null;
        let tgApi = null;
        let forwardedMessageId = null;

        try {
            let recoveredFileId = directFileId;

            if (!recoveredFileId) {
                access = await resolveSourceAccess(
                    env,
                    db,
                    { ...metadata, ChannelName: resolvedChannelName },
                    recoveryHint,
                    explicitBotToken,
                    explicitSourceChatId,
                    explicitProxyUrl,
                );

                if (!access.botToken) {
                    results.skipped.push({ id, reason: 'no bot token resolved' });
                    continue;
                }
                if (!access.chatId) {
                    results.skipped.push({ id, reason: 'cannot determine source chat ID' });
                    continue;
                }

                tgApi = new TelegramAPI(access.botToken, access.proxyUrl || '');
                const forwarded = await tgApi.request('forwardMessage', {
                    method: 'POST',
                    params: {
                        chat_id: targetChatId,
                        from_chat_id: access.chatId,
                        message_id: String(messageId),
                    },
                });

                forwardedMessageId = forwarded.message_id;
                recoveredFileId = extractFileId(forwarded);
            }

            if (!recoveredFileId) {
                results.failed.push({ id, reason: 'no Telegram file_id could be recovered' });
                continue;
            }

            const record = await db.getWithMetadata(id);
            const currentMetadata = record?.metadata || metadata || {};
            const patchedMetadata = {
                ...currentMetadata,
                TgFileId: recoveredFileId,
                ...(messageId ? { TgMessageId: String(messageId) } : {}),
                ...((currentMetadata.TgChatId || access?.chatId) ? {
                    TgChatId: currentMetadata.TgChatId || access?.chatId,
                } : {}),
                Channel: currentMetadata.Channel || 'TelegramNew',
                ChannelName: currentMetadata.ChannelName || resolvedChannelName,
            };

            await db.put(id, record?.value ?? '', { metadata: patchedMetadata });
            await addFileToIndex(context, id, patchedMetadata);
            results.recovered += 1;
        } catch (error) {
            console.error(`[recover-tg-file-ids] Failed to recover ${id}:`, error);
            results.failed.push({ id, reason: 'Failed to recover Telegram file_id' });
        } finally {
            if (tgApi && forwardedMessageId !== null) {
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
