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

function isUnsupportedPreviewImage(metadata = {}, fileId = '') {
    const fileType = String(metadata?.FileType || '').trim().toLowerCase();
    const fileName = String(metadata?.FileName || fileId || '').trim().toLowerCase();
    if (fileType === 'image/heic' || fileType === 'image/heif') {
        return true;
    }
    return /\.heic(?:$|[?#])|\.heif(?:$|[?#])/.test(fileName);
}

function hasThumbnailMetadata(metadata = {}) {
    return !!String(
        metadata?.TgThumbnailFileId
        || metadata?.TgThumbFileId
        || '',
    ).trim();
}

function extractIdsFromKey(key) {
    const basename = String(key || '').split('/').pop()?.replace(/\.[^.]+$/, '') || '';
    const match = basename.match(/^tg_(.+)_(\d+)_(.+)$/);
    if (!match) return null;
    return { channelName: match[1], messageId: match[2] };
}

function isCandidateRecord(file) {
    const metadata = file?.metadata || {};
    if (metadata.Channel !== 'TelegramNew') return false;
    if (hasThumbnailMetadata(metadata)) return false;
    if (!isUnsupportedPreviewImage(metadata, file?.id)) return false;
    if (metadata.TgMessageId) return true;
    return !!extractIdsFromKey(file?.id)?.messageId;
}

async function scanIndexForCandidates(db) {
    const metaRaw = await db.get(INDEX_META_KEY);
    if (!metaRaw) {
        throw new Error('Index metadata not found. Run an index rebuild first.');
    }

    const meta = JSON.parse(metaRaw);
    const chunkCount = meta.chunkCount || 0;
    const chunkKeys = Array.from({ length: chunkCount }, (_, i) => `${INDEX_KEY}_${i}`);
    const chunks = await Promise.all(chunkKeys.map(key => db.get(key)));

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
            if (isCandidateRecord(file)) {
                candidates.push({ id: file.id, metadata: file.metadata || {} });
            }
        }
    }
    return candidates;
}

function extractThumbnail(message) {
    const thumbnail = (
        message?.document?.thumbnail
        || message?.document?.thumb
        || message?.video?.thumbnail
        || message?.video?.thumb
        || message?.animation?.thumbnail
        || message?.animation?.thumb
        || null
    );
    const fileId = String(thumbnail?.file_id || '').trim();
    if (!fileId) {
        return null;
    }

    const metadata = {
        TgThumbnailFileId: fileId,
        TgThumbnailFileType: 'image/jpeg',
    };
    const fileUniqueId = String(thumbnail?.file_unique_id || '').trim();
    if (fileUniqueId) metadata.TgThumbnailFileUniqueId = fileUniqueId;
    if (Number.isFinite(Number(thumbnail?.width)) && Number(thumbnail.width) > 0) metadata.TgThumbnailWidth = Number(thumbnail.width);
    if (Number.isFinite(Number(thumbnail?.height)) && Number(thumbnail.height) > 0) metadata.TgThumbnailHeight = Number(thumbnail.height);
    if (Number.isFinite(Number(thumbnail?.file_size)) && Number(thumbnail.file_size) > 0) metadata.TgThumbnailFileSize = Number(thumbnail.file_size);
    return metadata;
}

async function resolveSourceAccess(env, db, metadata, explicitBotToken, explicitSourceChatId, explicitProxyUrl) {
    let telegramAccess = await resolveTelegramAccess(env, metadata);
    let chatId = metadata?.TgChatId || telegramAccess?.chatId || null;

    if (!telegramAccess?.botToken || !chatId) {
        const config = await getUploadConfig(db, env);
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

    if (!telegramAccess?.botToken && explicitBotToken) {
        telegramAccess = {
            botToken: explicitBotToken,
            proxyUrl: explicitProxyUrl,
        };
    }
    if (!chatId) {
        chatId = explicitSourceChatId;
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

    const targetChatId = String(body.targetChatId || '').trim();
    if (!targetChatId) {
        return jsonResponse({ success: false, error: 'targetChatId is required' }, 400);
    }

    const explicitBotToken = String(body.botToken || '').trim() || '';
    const explicitSourceChatId = String(body.sourceChatId || '').trim() || '';
    const explicitProxyUrl = String(body.proxyUrl || '').trim() || '';
    const limit = Math.min(Math.max(parseInt(body.limit) || 20, 1), 100);
    const dryRun = body.dryRun === true;
    const specificKeys = Array.isArray(body.keys) && body.keys.length > 0 ? body.keys : null;

    const db = getDatabase(env);
    let candidates;
    try {
        if (specificKeys) {
            const records = await Promise.all(
                specificKeys.map(async key => {
                    const record = await db.getWithMetadata(key);
                    return record ? { id: key, metadata: record.metadata || {} } : null;
                }),
            );
            candidates = records.filter(record => record && isCandidateRecord(record));
        } else {
            candidates = await scanIndexForCandidates(db);
        }
    } catch (error) {
        return jsonResponse({ success: false, error: `Failed to scan candidates: ${error.message}` }, 500);
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
        results.skipped = toProcess.map(candidate => {
            const fromKey = extractIdsFromKey(candidate.id);
            return {
                id: candidate.id,
                reason: 'dry run',
                channelName: candidate.metadata?.ChannelName || fromKey?.channelName || '',
                messageId: candidate.metadata?.TgMessageId || fromKey?.messageId || null,
            };
        });
        return jsonResponse(results);
    }

    for (const candidate of toProcess) {
        results.processed += 1;
        const fromKey = extractIdsFromKey(candidate.id);
        const messageId = candidate.metadata?.TgMessageId || fromKey?.messageId || null;
        if (!messageId) {
            results.skipped.push({ id: candidate.id, reason: 'cannot determine message ID from metadata or key' });
            continue;
        }

        const access = await resolveSourceAccess(
            env,
            db,
            candidate.metadata || {},
            explicitBotToken,
            explicitSourceChatId,
            explicitProxyUrl,
        );
        if (!access.botToken) {
            results.skipped.push({ id: candidate.id, reason: 'no bot token resolved' });
            continue;
        }
        if (!access.chatId) {
            results.skipped.push({ id: candidate.id, reason: 'cannot determine source chat ID' });
            continue;
        }

        const tgApi = new TelegramAPI(access.botToken, access.proxyUrl);
        let forwardedMessageId = null;

        try {
            const forwarded = await tgApi.request('forwardMessage', {
                method: 'POST',
                params: {
                    chat_id: targetChatId,
                    from_chat_id: access.chatId,
                    message_id: String(messageId),
                },
            });

            forwardedMessageId = forwarded.message_id;
            const thumbnailMetadata = extractThumbnail(forwarded);
            if (!thumbnailMetadata) {
                results.failed.push({ id: candidate.id, reason: 'forwarded message contained no thumbnail metadata' });
                continue;
            }

            const record = await db.getWithMetadata(candidate.id);
            const currentMetadata = record?.metadata || candidate.metadata || {};
            const patchedMetadata = {
                ...currentMetadata,
                ...thumbnailMetadata,
                TgChatId: currentMetadata.TgChatId || access.chatId,
                Channel: currentMetadata.Channel || 'TelegramNew',
                ChannelName: currentMetadata.ChannelName || fromKey?.channelName || 'Telegram_env',
            };

            await db.put(candidate.id, record?.value ?? '', { metadata: patchedMetadata });
            await addFileToIndex(context, candidate.id, patchedMetadata);
            results.recovered += 1;
        } catch (error) {
            results.failed.push({ id: candidate.id, reason: error.message });
        } finally {
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
                    console.warn(`[recover-tg-thumbnails] Failed to delete forwarded message ${forwardedMessageId} in ${targetChatId} for file ${candidate.id}`);
                }
            }
        }
    }

    return jsonResponse(results);
}
