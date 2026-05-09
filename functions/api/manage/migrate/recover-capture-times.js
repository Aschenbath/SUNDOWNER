import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getDatabase, KV_TO_D1_MIGRATION_STATE_KEY, checkDatabaseConfig } from '../../../utils/databaseAdapter.js';
import { addFileToIndex } from '../../../utils/indexManager.js';
import { extractExifData } from '../../../upload/exifExtractor.js';
import { TelegramAPI } from '../../../utils/telegramAPI.js';
import { DiscordAPI, resolveDiscordFileUrl } from '../../../utils/discordAPI.js';
import {
    resolveDiscordAccess,
    resolveHuggingFaceAccess,
    resolveS3Access,
    resolveTelegramAccess,
} from '../../../utils/mediaSecurity.js';
import { resolveStoredTelegramReadTarget } from '../../../utils/telegramFileId.js';
import { resolveMediaCaptureTimestamp } from '../../../../js/media-library/time-resolution.js';
import { loadLegacyKvIndexMetadataMap, mergeCaptureMetadata } from '../../../utils/captureTimeMetadata.js';

const INDEX_META_KEY = 'manage@index@meta';
const INDEX_KEY = 'manage@index';
const MAX_HEADER_BYTES = 65536;

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

function parseMigrationStatus(rawValue) {
    if (!rawValue) {
        return null;
    }

    try {
        return JSON.parse(rawValue);
    } catch {
        return null;
    }
}

function normalizeText(value = '') {
    return String(value || '').trim();
}

function isImageCandidate(file) {
    const metadata = file?.metadata || {};
    const fileId = normalizeText(file?.id);
    const fileType = normalizeText(metadata.FileType).toLowerCase();
    const fileName = normalizeText(metadata.FileName || fileId).toLowerCase();

    if (metadata?.RecycleBin === true || String(metadata?.RecycleBin || '').toLowerCase() === 'true') {
        return false;
    }

    const isImageType = fileType.startsWith('image/')
        || /\.(?:jpe?g|png|webp|gif|bmp|tiff?|heic|heif|avif|dng)(?:$|[?#])/i.test(fileName);
    if (!isImageType) {
        return false;
    }

    return !Number.isFinite(resolveMediaCaptureTimestamp(metadata, metadata.FileName || fileId));
}

function resolveImageFileType(metadata = {}, fileId = '') {
    const explicitType = normalizeText(metadata.FileType).toLowerCase();
    if (explicitType) {
        return explicitType;
    }

    const fileName = normalizeText(metadata.FileName || fileId).toLowerCase();
    if (/\.jpe?g(?:$|[?#])/.test(fileName)) return 'image/jpeg';
    if (/\.png(?:$|[?#])/.test(fileName)) return 'image/png';
    if (/\.webp(?:$|[?#])/.test(fileName)) return 'image/webp';
    if (/\.gif(?:$|[?#])/.test(fileName)) return 'image/gif';
    if (/\.bmp(?:$|[?#])/.test(fileName)) return 'image/bmp';
    if (/\.avif(?:$|[?#])/.test(fileName)) return 'image/avif';
    if (/\.heic(?:$|[?#])/.test(fileName)) return 'image/heic';
    if (/\.heif(?:$|[?#])/.test(fileName)) return 'image/heif';
    if (/\.dng(?:$|[?#])/.test(fileName)) return 'image/dng';
    if (/\.tiff?(?:$|[?#])/.test(fileName)) return 'image/tiff';
    return explicitType;
}

function matchesFilters(file, filters = {}) {
    const metadata = file?.metadata || {};
    const directory = normalizeText(metadata.Directory);
    const channel = normalizeText(metadata.Channel);
    const channelName = normalizeText(metadata.ChannelName);

    if (filters.directory) {
        const normalizedDirectory = filters.directory.endsWith('/') ? filters.directory : `${filters.directory}/`;
        if (!(directory.startsWith(normalizedDirectory) || normalizeText(file?.id).startsWith(normalizedDirectory))) {
            return false;
        }
    }

    if (filters.channel && channel !== filters.channel) {
        return false;
    }

    if (filters.channelName && channelName !== filters.channelName) {
        return false;
    }

    return true;
}

async function scanIndexCandidates(db, filters = {}) {
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
        if (!chunkRaw) continue;
        let files;
        try {
            files = JSON.parse(chunkRaw);
        } catch {
            continue;
        }
        if (!Array.isArray(files)) continue;

        for (const file of files) {
            if (isImageCandidate(file) && matchesFilters(file, filters)) {
                candidates.push({ id: file.id, metadata: file.metadata || {} });
            }
        }
    }

    return candidates;
}

async function scanListCandidates(db, filters = {}) {
    const candidates = [];
    let cursor = null;

    do {
        const page = await db.list({ cursor, limit: 500 });
        for (const file of page.keys || []) {
            const candidate = { id: file.name, metadata: file.metadata || {} };
            if (isImageCandidate(candidate) && matchesFilters(candidate, filters)) {
                candidates.push(candidate);
            }
        }
        cursor = page.cursor || null;
    } while (cursor);

    return candidates;
}

async function shouldUseListScan(env, db) {
    const dbConfig = checkDatabaseConfig(env);
    if (!dbConfig.usingD1) {
        return false;
    }

    if (!dbConfig.usingHybrid) {
        return true;
    }

    const migrationStatus = parseMigrationStatus(await db.get(KV_TO_D1_MIGRATION_STATE_KEY));
    return migrationStatus?.complete === true;
}

async function fetchBinaryBuffer(url, headers = {}) {
    const response = await fetch(url, {
        method: 'GET',
        headers,
    });

    if (!response.ok && response.status !== 206) {
        return null;
    }

    return new Uint8Array(await response.arrayBuffer());
}

async function readAwsBodyBytes(body) {
    if (!body) {
        return null;
    }

    if (body instanceof Uint8Array) {
        return body;
    }

    if (body instanceof ArrayBuffer) {
        return new Uint8Array(body);
    }

    if (typeof body.transformToByteArray === 'function') {
        return new Uint8Array(await body.transformToByteArray());
    }

    if (typeof body.arrayBuffer === 'function') {
        return new Uint8Array(await body.arrayBuffer());
    }

    return new Uint8Array(await new Response(body).arrayBuffer());
}

async function fetchTelegramHeaderBuffer(env, fileId, metadata = {}) {
    if (metadata?.IsChunked === true) {
        return null;
    }

    const telegramAccess = await resolveTelegramAccess(env, metadata);
    if (!telegramAccess?.botToken) {
        return null;
    }

    const readTarget = resolveStoredTelegramReadTarget(fileId, metadata, { preview: false });
    let telegramFileId = readTarget.fileId;
    if (!telegramFileId && metadata.Channel === 'Telegram') {
        telegramFileId = normalizeText(fileId).split('.')[0];
    }
    if (!telegramFileId) {
        return null;
    }

    const tgApi = new TelegramAPI(telegramAccess.botToken, telegramAccess.proxyUrl || '');
    const filePath = await tgApi.getFilePath(telegramFileId);
    if (!filePath) {
        return null;
    }

    return new Uint8Array(await tgApi.getFileHeaderByPath(filePath, MAX_HEADER_BYTES));
}

async function fetchDiscordHeaderBuffer(env, metadata = {}) {
    const discordAccess = await resolveDiscordAccess(env, metadata);
    if (!discordAccess?.botToken || !metadata.DiscordChannelId || !metadata.DiscordMessageId) {
        return null;
    }

    const discordApi = new DiscordAPI(discordAccess.botToken);
    let fileUrl = await discordApi.getFileURL(metadata.DiscordChannelId, metadata.DiscordMessageId);
    if (!fileUrl) {
        return null;
    }

    if (discordAccess.proxyUrl) {
        fileUrl = resolveDiscordFileUrl(fileUrl, discordAccess.proxyUrl);
    }

    return fetchBinaryBuffer(fileUrl, {
        Range: `bytes=0-${MAX_HEADER_BYTES - 1}`,
    });
}

async function fetchS3HeaderBuffer(env, metadata = {}) {
    const s3Access = await resolveS3Access(env, metadata);
    if (!s3Access?.accessKeyId || !s3Access?.secretAccessKey || !metadata?.S3BucketName || !metadata?.S3FileKey) {
        return null;
    }

    const s3Client = new S3Client({
        region: metadata?.S3Region || 'auto',
        endpoint: metadata?.S3Endpoint,
        credentials: {
            accessKeyId: s3Access.accessKeyId,
            secretAccessKey: s3Access.secretAccessKey,
        },
        forcePathStyle: metadata?.S3PathStyle || false,
    });

    const response = await s3Client.send(new GetObjectCommand({
        Bucket: metadata.S3BucketName,
        Key: metadata.S3FileKey,
        Range: `bytes=0-${MAX_HEADER_BYTES - 1}`,
    }));

    return readAwsBodyBytes(response?.Body);
}

async function fetchHuggingFaceHeaderBuffer(env, metadata = {}) {
    const hfAccess = await resolveHuggingFaceAccess(env, metadata);
    const repo = metadata.HfRepo || hfAccess?.repo;
    const filePath = metadata.HfFilePath;
    if (!repo || !filePath) {
        return null;
    }

    const fileUrl = metadata.HfFileUrl || `https://huggingface.co/datasets/${repo}/resolve/main/${filePath}`;
    const headers = {
        Range: `bytes=0-${MAX_HEADER_BYTES - 1}`,
    };
    const isPrivate = typeof metadata.HfIsPrivate === 'boolean' ? metadata.HfIsPrivate : !!hfAccess?.isPrivate;
    if (isPrivate && hfAccess?.token) {
        headers.Authorization = `Bearer ${hfAccess.token}`;
    }

    return fetchBinaryBuffer(fileUrl, headers);
}

async function fetchR2HeaderBuffer(env, fileId) {
    const object = await env?.img_r2?.get?.(fileId);
    if (!object || typeof object.arrayBuffer !== 'function') {
        return null;
    }

    return new Uint8Array(await object.arrayBuffer());
}

async function fetchSourceHeaderBuffer(env, candidate) {
    const metadata = candidate?.metadata || {};
    const fileId = normalizeText(candidate?.id);

    switch (metadata.Channel) {
        case 'CloudflareR2':
            return fetchR2HeaderBuffer(env, fileId);
        case 'Telegram':
        case 'TelegramNew':
            return fetchTelegramHeaderBuffer(env, fileId, metadata);
        case 'Discord':
            return fetchDiscordHeaderBuffer(env, metadata);
        case 'S3':
            return fetchS3HeaderBuffer(env, metadata);
        case 'HuggingFace':
            return fetchHuggingFaceHeaderBuffer(env, metadata);
        default:
            return null;
    }
}

export function onRequestOptions() {
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

    const limit = Math.min(Math.max(parseInt(body.limit, 10) || 20, 1), 200);
    const dryRun = body.dryRun === true;
    const specificKeys = Array.isArray(body.keys) && body.keys.length > 0
        ? body.keys.map((key) => normalizeText(key)).filter(Boolean)
        : null;
    const filters = {
        directory: normalizeText(body.directory),
        channel: normalizeText(body.channel),
        channelName: normalizeText(body.channelName),
    };

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
            candidates = records.filter((record) => record && isImageCandidate(record) && matchesFilters(record, filters));
        } else if (await shouldUseListScan(env, db)) {
            candidates = await scanListCandidates(db, filters);
        } else {
            candidates = await scanIndexCandidates(db, filters);
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
        results.skipped = toProcess.map((candidate) => ({
            id: candidate.id,
            channel: candidate.metadata?.Channel || '',
            channelName: candidate.metadata?.ChannelName || '',
            directory: candidate.metadata?.Directory || '',
            reason: 'dry run',
        }));
        return jsonResponse(results);
    }

    const legacyIndexMetadataMap = await loadLegacyKvIndexMetadataMap(
        env,
        toProcess.map((candidate) => candidate.id),
    );

    for (const candidate of toProcess) {
        results.processed += 1;

        try {
            const record = await db.getWithMetadata(candidate.id);
            const currentMetadata = record?.metadata || candidate.metadata || {};
            const legacyMetadata = legacyIndexMetadataMap.get(candidate.id) || {};
            const legacyPatchedMetadata = mergeCaptureMetadata(
                currentMetadata,
                legacyMetadata,
                currentMetadata.FileName || candidate.id,
            );
            if (Number.isFinite(resolveMediaCaptureTimestamp(legacyPatchedMetadata, legacyPatchedMetadata.FileName || candidate.id))) {
                await db.put(candidate.id, record?.value ?? '', { metadata: legacyPatchedMetadata });
                await addFileToIndex(context, candidate.id, legacyPatchedMetadata);
                results.recovered += 1;
                continue;
            }

            const fileType = resolveImageFileType(candidate.metadata || {}, candidate.id);
            const headerBuffer = await fetchSourceHeaderBuffer(env, candidate);
            if (!headerBuffer?.byteLength) {
                results.skipped.push({ id: candidate.id, reason: 'source header unavailable for this channel or file' });
                continue;
            }

            const exifData = await extractExifData(headerBuffer.buffer.slice(
                headerBuffer.byteOffset,
                headerBuffer.byteOffset + headerBuffer.byteLength
            ), fileType);
            if (!exifData?.dateTime) {
                results.skipped.push({ id: candidate.id, reason: 'no EXIF capture time found in source image' });
                continue;
            }

            const patchedMetadata = {
                ...legacyPatchedMetadata,
                Exif: {
                    ...(legacyPatchedMetadata.Exif && typeof legacyPatchedMetadata.Exif === 'object' ? legacyPatchedMetadata.Exif : {}),
                    ...exifData,
                },
            };

            await db.put(candidate.id, record?.value ?? '', { metadata: patchedMetadata });
            await addFileToIndex(context, candidate.id, patchedMetadata);
            results.recovered += 1;
        } catch (error) {
            results.failed.push({
                id: candidate.id,
                reason: error.message || String(error),
            });
        }
    }

    return jsonResponse(results);
}

export async function onRequest(context) {
    const { request } = context;

    if (request.method === 'OPTIONS') {
        return onRequestOptions();
    }

    if (request.method !== 'POST') {
        return jsonResponse({
            success: false,
            error: 'Method not allowed',
        }, 405);
    }

    return onRequestPost(context);
}
