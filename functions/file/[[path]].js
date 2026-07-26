import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { fetchSecurityConfig, hasSecurityConfigLoadError } from "../utils/sysConfig.js";
import { TelegramAPI, buildTelegramFileUrl, resolveTelegramFilePathCached } from "../utils/telegramAPI.js";
import { DiscordAPI, resolveDiscordFileUrl } from "../utils/discordAPI.js";
import { HuggingFaceAPI } from "../utils/huggingfaceAPI.js";
import {
    applyFileResponseHeaders, getWorkerEdgeCache, setRangeHeaders, handleHeadRequest, getFileContent, isTgChannel,
    returnWithCheck, return404, returnBlockImg, isDomainAllowed
} from './fileTools.js';
import { getDatabase } from '../utils/databaseAdapter.js';
import { extractEmbeddedPreview, supportsEmbeddedPreviewExtraction } from '../upload/exifExtractor.js';
import {
    resolveDiscordAccess,
    resolveHuggingFaceAccess,
    resolveHuggingFaceFileUrl,
    resolveS3CdnFileUrl,
    resolveS3Access,
    resolveTelegramAccess,
} from '../utils/mediaSecurity.js';
import { resolveStoredTelegramReadTarget, resolveStoredTelegramThumbnail } from '../utils/telegramFileId.js';
import { resolveMimeType } from '../utils/mimeTypes.js';

let createS3Client = (options) => new S3Client(options);

export function __setS3ClientFactoryForTests(factory) {
    createS3Client = typeof factory === 'function'
        ? factory
        : (options) => new S3Client(options);
}

export function __resetS3ClientFactoryForTests() {
    createS3Client = (options) => new S3Client(options);
}

function buildPreviewFileName(fileName = 'preview.jpg') {
    const normalized = String(fileName || '').trim();
    if (!normalized) {
        return 'preview.jpg';
    }

    const lastDot = normalized.lastIndexOf('.');
    const baseName = lastDot > 0 ? normalized.slice(0, lastDot) : normalized;
    return `${baseName}.jpg`;
}

function buildEmbeddedPreviewResponse(context, fileName, preview) {
    const { request } = context;
    const headers = new Headers();
    applyFileResponseHeaders(context, headers, encodeURIComponent(buildPreviewFileName(fileName)), preview.mimeType || 'image/jpeg');
    headers.set('Content-Length', String(preview.bytes.byteLength || 0));

    if (request.method === 'HEAD') {
        return handleHeadRequest(headers);
    }

    return new Response(preview.bytes, {
        status: 200,
        headers,
    });
}

function fileMetadataUnavailableResponse() {
    return new Response('File metadata is unavailable', { status: 500 });
}

function imageNotFoundResponse() {
    return new Response('Error: Image Not Found', { status: 404 });
}

function isS3MissingObjectError(error) {
    return error?.$metadata?.httpStatusCode === 404
        || error?.name === 'NoSuchKey'
        || error?.Code === 'NoSuchKey'
        || error?.code === 'NoSuchKey'
        || error?.name === 'NotFound'
        || error?.Code === 'NotFound'
        || error?.code === 'NotFound';
}

function resolveExternalRedirectUrl(externalLink) {
    try {
        const parsedUrl = new URL(String(externalLink || '').trim());
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return null;
        }
        return parsedUrl.toString();
    } catch {
        return null;
    }
}

function parseChunkMetadata(rawValue) {
    try {
        const parsed = JSON.parse(rawValue);
        if (!Array.isArray(parsed)) {
            console.warn('Invalid chunk metadata shape: expected array');
            return { ok: false, error: 'invalid-shape' };
        }
        return { ok: true, value: parsed };
    } catch (error) {
        console.warn('Invalid chunk metadata:', error);
        return { ok: false, error: 'invalid-json' };
    }
}

function loadChunkMetadata(rawValue, expectedChunks = null) {
    if (!rawValue) {
        return { ok: false, response: fileMetadataUnavailableResponse() };
    }

    const parsed = parseChunkMetadata(rawValue);
    if (!parsed.ok) {
        return { ok: false, response: fileMetadataUnavailableResponse() };
    }

    const chunks = [...parsed.value].sort((a, b) => a.index - b.index);
    if (!chunks.length) {
        return { ok: false, response: fileMetadataUnavailableResponse() };
    }

    const normalizedExpectedChunks = Number(expectedChunks) || chunks.length;
    if (chunks.length !== normalizedExpectedChunks) {
        console.warn(`Chunk metadata count mismatch: expected ${normalizedExpectedChunks}, got ${chunks.length}`);
        return { ok: false, response: fileMetadataUnavailableResponse() };
    }

    return { ok: true, chunks };
}

async function fetchBinaryBufferFromUrl(targetUrl) {
    if (!targetUrl) {
        return null;
    }

    const response = await fetch(targetUrl, {
        method: 'GET',
    });
    if (!response.ok) {
        return null;
    }

    return new Uint8Array(await response.arrayBuffer());
}

// 嵌入式预览抽取先只拉文件头：EXIF IFD1 缩略图几乎总在 HEIC 头部，256KB 足够，
// 不必为一张 <100KB 的预览下完整个 3-15MB 原图。
const EMBEDDED_PREVIEW_HEADER_RANGE_BYTES = 262144;

async function fetchBinaryHeaderFromUrl(targetUrl, maxBytes) {
    if (!targetUrl) {
        return null;
    }

    const endByte = Math.max(0, Number(maxBytes) - 1);
    const response = await fetch(targetUrl, {
        method: 'GET',
        headers: { Range: `bytes=0-${endByte}` },
    });
    if (!response.ok) {
        return null;
    }

    return {
        bytes: new Uint8Array(await response.arrayBuffer()),
        // 200 表示上游忽略了 Range、直接给了全量，此时 bytes 已是完整文件
        isPartial: response.status === 206,
    };
}

// 显式 preview 请求打到无法产出可渲染预览的 HEIC/HEIF（没有存储缩略图、也抽不出
// 嵌入式 EXIF 预览）时返回 415：Chromium 解不了 image/heic，回 200 原始字节只会
// 让 tile 报错并无限重试满量下载原图。public 短缓存挡住客户端/CDN 的重复打击。
function heicPreviewUnavailableResponse() {
    return new Response(JSON.stringify({ error: 'preview-unavailable', format: 'heic' }), {
        status: 415,
        headers: {
            'Content-Type': 'application/json',
            'X-Preview-Unavailable': 'heic',
            'Cache-Control': 'public, max-age=3600',
        },
    });
}

async function scheduleBackground(context, promise) {
    if (typeof context?.waitUntil === 'function') {
        context.waitUntil(promise);
        return;
    }
    await promise;
}

function shouldAttemptEmbeddedPreview(context, metadata = {}, fileType = '', options = {}) {
    if (!supportsEmbeddedPreviewExtraction(fileType)) {
        return false;
    }
    if (options.force === true) {
        return true;
    }
    if (context.wantsEmbeddedPreview) {
        return true;
    }
    if (!context.wantsPreview) {
        return false;
    }

    if (metadata?.Channel === 'Telegram' || metadata?.Channel === 'TelegramNew') {
        return !resolveStoredTelegramThumbnail(metadata)?.fileId;
    }

    return metadata?.Channel === 'CloudflareR2';
}

async function resolveTelegramSourceUrl(env, metadata = {}, fileId = '', options = {}) {
    const telegramReadTarget = resolveStoredTelegramReadTarget(fileId, metadata, options);
    let telegramFileId = telegramReadTarget.fileId;

    if (!telegramFileId && metadata?.Channel === 'Telegram') {
        telegramFileId = fileId.split('.')[0];
    } else if (!telegramFileId && metadata?.Channel === 'TelegramNew') {
        telegramFileId = metadata?.TgFileId;
        if (telegramFileId === null) {
            return null;
        }
    }

    if (!telegramFileId) {
        return null;
    }

    const telegramAccess = await resolveTelegramAccess(env, metadata || {});
    if (!telegramAccess?.botToken) {
        return null;
    }

    const tgApi = new TelegramAPI(telegramAccess.botToken, telegramAccess.proxyUrl || '');
    const filePath = await resolveTelegramFilePathCached(tgApi, telegramFileId, getWorkerEdgeCache());
    if (!filePath) {
        return null;
    }

    return {
        targetUrl: buildTelegramFileUrl(telegramAccess.botToken, filePath, telegramAccess.proxyUrl || ''),
        fileType: telegramReadTarget.fileType || metadata?.FileType || '',
        isPreview: telegramReadTarget.isPreview === true,
    };
}

function buildEmbeddedPreviewCacheKey(context) {
    if (!context?.url) {
        return null;
    }
    const canonical = new URL(context.url.toString());
    canonical.searchParams.set('preview', 'embedded');
    canonical.searchParams.delete('range');
    // file_id 在 path 里且内容寻址，所以 path + 规范化的 ?preview=embedded 足够唯一定位一条嵌入式预览
    return new Request(canonical.toString(), { method: 'GET' });
}

function buildTelegramThumbnailCacheKey(context) {
    if (!context?.url) {
        return null;
    }
    // path 内容寻址 + 只保留 preview=1，其余查询参数一律剥掉，
    // 同一张 Telegram 缩略图跨会话共享同一个缓存键。
    const canonical = new URL(context.url.toString());
    canonical.search = '';
    canonical.searchParams.set('preview', '1');
    return new Request(canonical.toString(), { method: 'GET' });
}

function rebuildTelegramThumbnailFromCache(context, cached, encodedFileName) {
    const headers = new Headers();
    applyFileResponseHeaders(
        context,
        headers,
        encodedFileName,
        cached.headers.get('Content-Type') || 'image/jpeg',
    );
    const contentLength = cached.headers.get('Content-Length');
    if (contentLength) {
        headers.set('Content-Length', contentLength);
    }
    if (context?.request?.method === 'HEAD') {
        return handleHeadRequest(headers);
    }
    return new Response(cached.body, { status: 200, headers });
}

function rebuildEmbeddedPreviewFromCache(context, cached, fileName) {
    const headers = new Headers();
    applyFileResponseHeaders(
        context,
        headers,
        encodeURIComponent(buildPreviewFileName(fileName)),
        cached.headers.get('Content-Type') || 'image/jpeg',
    );
    const contentLength = cached.headers.get('Content-Length');
    if (contentLength) {
        headers.set('Content-Length', contentLength);
    }
    if (context?.request?.method === 'HEAD') {
        return handleHeadRequest(headers);
    }
    return new Response(cached.body, { status: 200, headers });
}

async function tryServeEmbeddedPreview(context, imgRecord, fileId, fileName, fileType, options = {}) {
    const metadata = imgRecord?.metadata || {};
    if (!shouldAttemptEmbeddedPreview(context, metadata, fileType, options)) {
        return null;
    }

    // Worker edge cache 命中直接返回，跳过 TG 拉文件 + exifr 抽帧。
    // 命中后按当前请求 method/Referer 重建头，避免缓存里 public Cache-Control 直接漏给浏览器。
    const cache = getWorkerEdgeCache();
    const cacheKey = buildEmbeddedPreviewCacheKey(context);
    if (cacheKey) {
        try {
            const cached = await cache.match(cacheKey);
            if (cached) {
                return rebuildEmbeddedPreviewFromCache(context, cached, fileName);
            }
        } catch (error) {
            console.warn(`Embedded preview cache lookup failed for ${fileId}:`, error.message || error);
        }
    }

    let sourceBuffer = null;
    let preview = null;

    try {
        switch (metadata.Channel) {
            case 'CloudflareR2': {
                const r2Object = await context.env?.img_r2?.get?.(fileId);
                if (!r2Object || typeof r2Object.arrayBuffer !== 'function') {
                    return null;
                }
                sourceBuffer = new Uint8Array(await r2Object.arrayBuffer());
                break;
            }
            case 'Telegram':
            case 'TelegramNew': {
                if (metadata?.IsChunked === true) {
                    return null;
                }

                const originalTarget = await resolveTelegramSourceUrl(context.env, metadata, fileId, { preview: false });
                const targetUrl = originalTarget?.targetUrl || '';
                if (!targetUrl) {
                    return null;
                }

                // 先试 256KB Range 抽取；Range 尝试失败不终止流程，还有全量下载兜底。
                let headerFetch = null;
                try {
                    headerFetch = await fetchBinaryHeaderFromUrl(targetUrl, EMBEDDED_PREVIEW_HEADER_RANGE_BYTES);
                } catch (error) {
                    console.warn(`Embedded preview header fetch failed for ${fileId}:`, error.message || error);
                }

                if (headerFetch?.bytes?.byteLength) {
                    preview = await extractEmbeddedPreview(headerFetch.bytes, fileType);
                    if (!preview?.bytes?.byteLength) {
                        preview = null;
                        // 上游忽略 Range（200 全量）或返回的字节数已小于请求区间时，
                        // headerFetch.bytes 已经覆盖整个文件，再全量下载也不会有更多字节。
                        if (!headerFetch.isPartial || headerFetch.bytes.byteLength < EMBEDDED_PREVIEW_HEADER_RANGE_BYTES) {
                            return null;
                        }
                    }
                }

                if (!preview) {
                    sourceBuffer = await fetchBinaryBufferFromUrl(targetUrl);
                }
                break;
            }
            default:
                return null;
        }
    } catch (error) {
        console.warn(`Failed to load embedded preview source for ${fileId}:`, error.message || error);
        return null;
    }

    if (!preview) {
        if (!sourceBuffer?.byteLength) {
            return null;
        }
        preview = await extractEmbeddedPreview(sourceBuffer, fileType);
    }
    if (!preview?.bytes?.byteLength) {
        return null;
    }

    await stashEmbeddedPreviewInEdgeCache(context, fileId, preview);

    return buildEmbeddedPreviewResponse(context, fileName, preview);
}

// 写 cache 跟客户端响应必须用两个独立的 Response：
// 1) HEAD 请求下 buildEmbeddedPreviewResponse 返回空 body，直接 clone 会污染 GET 缓存键。
// 2) Dashboard 内部 Referer 触发 Cache-Control: private，CF caches.default 默认拒收 private 响应，
//    导致整条 HEIC 缓存在最热的路径上静默失效。
// 解决：缓存副本固定 GET 形状 + Cache-Control: public, immutable，客户端响应保持原本的 method/Referer 语义。
async function stashEmbeddedPreviewInEdgeCache(context, fileId, preview) {
    if (!preview?.bytes?.byteLength) {
        return;
    }

    const cacheKey = buildEmbeddedPreviewCacheKey(context);
    if (!cacheKey) {
        return;
    }

    const cache = getWorkerEdgeCache();
    const cacheableHeaders = new Headers();
    cacheableHeaders.set('Content-Type', preview.mimeType || 'image/jpeg');
    cacheableHeaders.set('Content-Length', String(preview.bytes.byteLength));
    cacheableHeaders.set('Cache-Control', 'public, max-age=86400, immutable');
    const cacheableResponse = new Response(preview.bytes, { status: 200, headers: cacheableHeaders });
    const stash = (async () => {
        try {
            await cache.put(cacheKey, cacheableResponse);
        } catch (error) {
            console.warn(`Failed to stash embedded preview for ${fileId}:`, error.message || error);
        }
    })();
    await scheduleBackground(context, stash);
}

function shouldFallbackFromTelegramPreview(context, telegramReadTarget, fileType) {
    return context.wantsPreview
        && telegramReadTarget?.isPreview === true
        && supportsEmbeddedPreviewExtraction(fileType);
}

async function tryFallbackTelegramPreview(context, imgRecord, fileId, fileName, fileType, telegramReadTarget) {
    if (!shouldFallbackFromTelegramPreview(context, telegramReadTarget, fileType)) {
        return null;
    }
    return await tryServeEmbeddedPreview(context, imgRecord, fileId, fileName, fileType, { force: true });
}

function shouldFallbackToTelegramOriginal(context, telegramReadTarget, fileType) {
    const normalizedFileType = String(fileType || '').trim().toLowerCase();
    return context.wantsPreview
        && telegramReadTarget?.isPreview === true
        && normalizedFileType.startsWith('image/')
        && !supportsEmbeddedPreviewExtraction(normalizedFileType);
}

async function tryFallbackTelegramOriginal(context, imgRecord, fileId, fileName, fileType, telegramReadTarget) {
    if (!shouldFallbackToTelegramOriginal(context, telegramReadTarget, fileType)) {
        return null;
    }

    const originalTarget = await resolveTelegramSourceUrl(context.env, imgRecord?.metadata || {}, fileId, { preview: false });
    if (!originalTarget?.targetUrl) {
        return null;
    }

    const response = await getFileContent(context.request, originalTarget.targetUrl);
    if (!response || response.status === 404) {
        return null;
    }

    const headers = new Headers(response.headers);
    applyFileResponseHeaders(
        context,
        headers,
        encodeURIComponent(fileName),
        originalTarget.fileType || fileType,
    );

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

async function tryFallbackTelegramPreviewRead(context, imgRecord, fileId, fileName, fileType, telegramReadTarget) {
    const embeddedPreview = await tryFallbackTelegramPreview(context, imgRecord, fileId, fileName, fileType, telegramReadTarget);
    if (embeddedPreview) {
        return embeddedPreview;
    }

    return await tryFallbackTelegramOriginal(context, imgRecord, fileId, fileName, fileType, telegramReadTarget);
}


export async function onRequest(context) {  // Contents of context object
    const {
        request, // same as existing Worker API
        env, // same as existing Worker API
        params, // if filename includes [id] or [[path]]
        waitUntil, // same as ctx.waitUntil in existing Worker API
        next, // used for middleware or to fetch assets
        data, // arbitrary space for passing data between middlewares
    } = context;

    // 解码文件ID
    let fileId = '';
    try {
        params.path = decodeURIComponent(params.path);
        fileId = params.path.split(',').join('/');
    } catch (e) {
        return new Response('Error: Decode Image ID Failed', { status: 400 });
    }

    // 读取安全配置，解析必要参数
    const securityConfig = await fetchSecurityConfig(env);
    // Fail closed: if security config couldn't be loaded, block rather than
    // silently serving with the permissive fallback (whiteListMode=false, no domain restriction).
    if (hasSecurityConfigLoadError(securityConfig)) {
        return await returnBlockImg(new URL(request.url));
    }
    context.securityConfig = securityConfig;

    const url = new URL(request.url);
    context.url = url;
    const previewMode = String(url.searchParams.get('preview') || '').trim().toLowerCase();
    const wantsPreview = ['1', 'true', 'yes', 'embedded'].includes(previewMode);
    const wantsEmbeddedPreview = previewMode === 'embedded';
    context.wantsPreview = wantsPreview;
    context.wantsEmbeddedPreview = wantsEmbeddedPreview;

    const Referer = request.headers.get('Referer')
    context.Referer = Referer;

    // 检查引用域名是否被允许
    if (!isDomainAllowed(context)) {
        return await returnBlockImg(url);
    }

    // 从数据库中获取图片记录
    const db = getDatabase(env);
    const imgRecord = await db.getWithMetadata(fileId);
    if (!imgRecord) {
        console.warn(`Image metadata not found in database: ${fileId}`);
        return imageNotFoundResponse();
    }

    // 如果metadata不存在，只可能是之前未设置KV，且存储在Telegraph上的图片
    if (!imgRecord.metadata) {
        imgRecord.metadata = {};
    }

    const fileName = imgRecord.metadata?.FileName || fileId;
    const encodedFileName = encodeURIComponent(fileName);
    const fileType = resolveMimeType(imgRecord.metadata?.FileType || '', [fileName, fileId], imgRecord.metadata?.FileType || null);

    // 检查文件可访问状态
    let accessRes = await returnWithCheck(context, imgRecord);
    if (accessRes.status !== 200) {
        return accessRes; // 如果不可访问，直接返回
    }

    // 内容寻址 ETag：fileId 不变意味着内容不变，按 variant（原图/缩略图/嵌入式 preview）
    // 区分，让浏览器把每条变体单独缓存。Range 请求保持透传，由各 chunked handler 自己处理。
    const variantTag = wantsEmbeddedPreview ? 'embedded' : (wantsPreview ? 'preview' : 'original');
    const safeFileIdToken = String(fileId).replace(/"/g, '');
    context.responseEtag = `"${safeFileIdToken}-${variantTag}"`;

    if (
        (request.method === 'GET' || request.method === 'HEAD')
        && !request.headers.get('Range')
        && request.headers.get('If-None-Match') === context.responseEtag
    ) {
        const notModifiedHeaders = new Headers();
        applyFileResponseHeaders(context, notModifiedHeaders, encodedFileName, fileType);
        notModifiedHeaders.delete('Content-Length');
        return new Response(null, {
            status: 304,
            headers: notModifiedHeaders,
        });
    }

    /* Cloudflare R2渠道 */
    const embeddedPreviewResponse = await tryServeEmbeddedPreview(context, imgRecord, fileId, fileName, fileType);
    if (embeddedPreviewResponse) {
        return embeddedPreviewResponse;
    }

    // 显式 preview 请求 + HEIC/HEIF + 没有存储缩略图 + 上面的嵌入式抽取也失败时，
    // 不再回落到原始 image/heic 字节（Chromium 渲染不了，tile 会无限重试满量重下）。
    // 非 preview 的 GET /file/<id> 保持原样：前端 libheif 解码依赖能拿到原始字节。
    if (wantsPreview && supportsEmbeddedPreviewExtraction(fileType)) {
        const previewChannel = imgRecord.metadata?.Channel;
        const isTelegramPreviewChannel = previewChannel === 'Telegram' || previewChannel === 'TelegramNew';
        const hasStoredTelegramThumbnail = isTelegramPreviewChannel
            && Boolean(resolveStoredTelegramThumbnail(imgRecord.metadata || {})?.fileId);
        if ((previewChannel === 'CloudflareR2' || isTelegramPreviewChannel) && !hasStoredTelegramThumbnail) {
            return heicPreviewUnavailableResponse();
        }
    }

    if (imgRecord.metadata?.Channel === 'CloudflareR2') {
        return await handleR2File(context, fileId, encodedFileName, fileType);
    }

    /* S3渠道 */
    if (imgRecord.metadata?.Channel === "S3") {
        return await handleS3File(context, imgRecord.metadata, encodedFileName, fileType, fileId);
    }

    /* Discord 渠道 */
    if (imgRecord.metadata?.Channel === 'Discord') {
        // 检查是否为分片文件
        if (imgRecord.metadata?.IsChunked === true) {
            return await handleDiscordChunkedFile(context, imgRecord, encodedFileName, fileType);
        }
        return await handleDiscordFile(context, imgRecord.metadata, encodedFileName, fileType);
    }

    /* HuggingFace 渠道 */
    if (imgRecord.metadata?.Channel === 'HuggingFace') {
        return await handleHuggingFaceFile(context, imgRecord.metadata, encodedFileName, fileType);
    }

    /* 外链渠道 */
    if (imgRecord.metadata?.Channel === 'External') {
        // 直接重定向到外链
        const externalUrl = resolveExternalRedirectUrl(imgRecord.metadata?.ExternalLink);
        if (!externalUrl) {
            return imageNotFoundResponse();
        }
        return Response.redirect(externalUrl, 302);
    }

    /* Telegram及Telegraph渠道 */

    // 构建目标 URL
    let targetUrl = '';
    let responseFileType = fileType;
    let telegramReadTarget = null;
    let telegramThumbnailCacheKey = null;

    if (isTgChannel(imgRecord)) {
        telegramReadTarget = resolveStoredTelegramReadTarget(fileId, imgRecord.metadata || {}, {
            preview: wantsPreview,
        });
        responseFileType = telegramReadTarget.fileType || fileType;

        // Edge-cache 小体积 Telegram 缩略图（?preview=1）：dashboard tile 响应因内部
        // Referer 是 Cache-Control: private，不缓存的话每个会话每个 tile 都要重跑
        // worker + getFile + Telegram 下载整条链。查缓存必须发生在 isDomainAllowed /
        // returnWithCheck 之后（上方已完成），命中后按当前请求 method/Referer 重建
        // 响应头，鉴权语义仍逐请求生效。
        if (wantsPreview && telegramReadTarget.isPreview === true && !request.headers.get('Range')) {
            telegramThumbnailCacheKey = buildTelegramThumbnailCacheKey(context);
            if (telegramThumbnailCacheKey) {
                try {
                    const cachedThumbnail = await getWorkerEdgeCache().match(telegramThumbnailCacheKey);
                    if (cachedThumbnail) {
                        return rebuildTelegramThumbnailFromCache(context, cachedThumbnail, encodedFileName);
                    }
                } catch (error) {
                    console.warn(`Telegram thumbnail cache lookup failed for ${fileId}:`, error.message || error);
                }
            }
        }

        const resolveStoredTelegramFileId = () => telegramReadTarget.fileId;
        let TgFileID = resolveStoredTelegramFileId(fileId, imgRecord.metadata || {}); // Tg的file_id

        if (imgRecord.metadata?.Channel === 'TelegramNew' && imgRecord.metadata?.IsChunked === true) {
            // 如果请求预览且有存储的缩略图，跳过分片处理，走正常缩略图路径
            if (!(wantsPreview && telegramReadTarget.isPreview)) {
                return await handleTelegramChunkedFile(context, imgRecord, encodedFileName, responseFileType);
            }
        }

        if (!TgFileID && imgRecord.metadata?.Channel === 'Telegram') {
            TgFileID = fileId.split('.')[0]; // id为file_id + ext
        } else if (!TgFileID && imgRecord.metadata?.Channel === 'TelegramNew') {
            TgFileID = imgRecord.metadata?.TgFileId;

            if (TgFileID === null) {
                return new Response('Error: Failed to fetch image', { status: 500 });
            }
        }

        if (!TgFileID) {
            return new Response('Error: Telegram file id missing', { status: 500 });
        }

        // 获取TG图片真实地址（支持代理域名）
        const telegramAccess = await resolveTelegramAccess(env, imgRecord.metadata || {});
        if (!telegramAccess?.botToken) {
            return new Response('Error: Telegram channel credentials not available', { status: 500 });
        }
        const TgBotToken = telegramAccess.botToken;
        const TgProxyUrl = telegramAccess.proxyUrl || '';
        const tgApi = new TelegramAPI(TgBotToken, TgProxyUrl);
        let filePath = await resolveTelegramFilePathCached(tgApi, TgFileID, getWorkerEdgeCache());
        if (filePath === null) {
            const fallbackPreview = await tryFallbackTelegramPreviewRead(context, imgRecord, fileId, fileName, fileType, telegramReadTarget);
            if (fallbackPreview) {
                return fallbackPreview;
            }
            return new Response('Error: Failed to fetch image path', { status: 500 });
        }
        // 使用代理域名或官方域名
        targetUrl = buildTelegramFileUrl(TgBotToken, filePath, TgProxyUrl);
        context.telegramPathRefresh = async () => {
            const refreshedPath = await resolveTelegramFilePathCached(tgApi, TgFileID, getWorkerEdgeCache(), { forceRefresh: true });
            return refreshedPath ? buildTelegramFileUrl(TgBotToken, refreshedPath, TgProxyUrl) : '';
        };
    } else {
        targetUrl = 'https://telegra.ph/' + url.pathname + url.search;
    }

    try {
        const response = await getFileContent(request, targetUrl);

        if (response === null) {
            const fallbackPreview = await tryFallbackTelegramPreviewRead(context, imgRecord, fileId, fileName, fileType, telegramReadTarget);
            if (fallbackPreview) {
                return fallbackPreview;
            }
            return new Response('Error: Failed to fetch image', { status: 500 });
        } else if (response.status === 404) {
            const refreshedTargetUrl = typeof context.telegramPathRefresh === 'function'
                ? await context.telegramPathRefresh()
                : '';
            if (refreshedTargetUrl && refreshedTargetUrl !== targetUrl) {
                const refreshedResponse = await getFileContent(request, refreshedTargetUrl);
                if (refreshedResponse && refreshedResponse.status !== 404) {
                    if (wantsPreview && supportsEmbeddedPreviewExtraction(fileType)) {
                        // body 只能读一次：整体缓冲后，抽取失败的兜底响应必须用缓冲的
                        // 字节重建，不能再用已被 arrayBuffer() 消耗掉的流。
                        const refreshedBytes = new Uint8Array(await refreshedResponse.arrayBuffer());
                        const refreshedPreview = await extractEmbeddedPreview(refreshedBytes, fileType);
                        if (refreshedPreview?.bytes?.byteLength) {
                            await stashEmbeddedPreviewInEdgeCache(context, fileId, refreshedPreview);
                            return buildEmbeddedPreviewResponse(context, fileName, refreshedPreview);
                        }
                        const refreshedHeaders = new Headers(refreshedResponse.headers);
                        applyFileResponseHeaders(context, refreshedHeaders, encodedFileName, responseFileType);
                        refreshedHeaders.set('Content-Length', String(refreshedBytes.byteLength));
                        return new Response(refreshedBytes, {
                            status: refreshedResponse.status,
                            statusText: refreshedResponse.statusText,
                            headers: refreshedHeaders,
                        });
                    }
                    const refreshedHeaders = new Headers(refreshedResponse.headers);
                    applyFileResponseHeaders(context, refreshedHeaders, encodedFileName, responseFileType);
                    return new Response(refreshedResponse.body, {
                        status: refreshedResponse.status,
                        statusText: refreshedResponse.statusText,
                        headers: refreshedHeaders,
                    });
                }
            }
            const fallbackPreview = await tryFallbackTelegramPreviewRead(context, imgRecord, fileId, fileName, fileType, telegramReadTarget);
            if (fallbackPreview) {
                return fallbackPreview;
            }
            return await return404(url);
        }

        // 上游拉取成功的 Telegram 缩略图存一份 public 副本进 edge cache，
        // 与嵌入式预览的 stash 同一模式：GET 形状 + public immutable，
        // 客户端响应仍按当前 Referer 语义（可能是 private）返回。
        if (
            telegramThumbnailCacheKey
            && request.method === 'GET'
            && response.status === 200
        ) {
            const cacheCopy = response.clone();
            const cacheableHeaders = new Headers();
            cacheableHeaders.set('Content-Type', responseFileType || 'image/jpeg');
            const upstreamLength = cacheCopy.headers.get('Content-Length');
            if (upstreamLength) {
                cacheableHeaders.set('Content-Length', upstreamLength);
            }
            cacheableHeaders.set('Cache-Control', 'public, max-age=86400, immutable');
            const stash = (async () => {
                try {
                    await getWorkerEdgeCache().put(
                        telegramThumbnailCacheKey,
                        new Response(cacheCopy.body, { status: 200, headers: cacheableHeaders }),
                    );
                } catch (error) {
                    console.warn(`Failed to stash Telegram thumbnail for ${fileId}:`, error.message || error);
                }
            })();
            await scheduleBackground(context, stash);
        }

        const headers = new Headers(response.headers);
        applyFileResponseHeaders(context, headers, encodedFileName, responseFileType);

        const newRes = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });

        return newRes;
    } catch (error) {
        console.error('File serving error:', error);
        return new Response('Internal server error', { status: 500 });
    }
}


// 处理 Telegram 渠道分片文件读取
async function handleTelegramChunkedFile(context, imgRecord, encodedFileName, fileType) {
    const { env, request, url, Referer } = context;

    const metadata = imgRecord.metadata;
    const telegramAccess = await resolveTelegramAccess(env, metadata || {});
    if (!telegramAccess?.botToken) {
        return new Response('Error: Telegram channel credentials not available', { status: 500 });
    }
    const TgBotToken = telegramAccess.botToken;
    const TgProxyUrl = telegramAccess.proxyUrl || '';

    const chunkMetadata = loadChunkMetadata(imgRecord.value, metadata.TotalChunks);
    if (!chunkMetadata.ok) {
        return chunkMetadata.response;
    }
    const chunks = chunkMetadata.chunks;

    // 计算文件总大小
    const totalSize = chunks.reduce((total, chunk) => total + (chunk.size || 0), 0);

    // 构建响应头
    const headers = new Headers();
    applyFileResponseHeaders(context, headers, encodedFileName, fileType);
    headers.set('Content-Length', totalSize.toString());

    // ETag 沿用顶层 context.responseEtag（内容寻址，按 fileId+variant），
    // 这样顶层 If-None-Match 短路对 chunked 文件也生效，且刷新不会因为 Date.now()
    // 在缺 TimeStamp 时漂移失效。applyFileResponseHeaders 已经把它写到了 headers。
    const etag = headers.get('ETag') || `"${metadata.TimeStamp || 'chunked'}-${totalSize}"`;
    if (!headers.has('ETag')) {
        headers.set('ETag', etag);
    }

    // 检查If-None-Match头（304缓存）
    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch && ifNoneMatch === etag) {
        return new Response(null, {
            status: 304,
            headers: {
                'ETag': etag,
                'Cache-Control': headers.get('Cache-Control'),
                'Accept-Ranges': 'bytes'
            }
        });
    }

    // 检查Range请求头
    const range = request.headers.get('Range');
    let rangeStart = 0;
    let rangeEnd = totalSize - 1;
    let isRangeRequest = false;

    if (range) {
        const matches = range.match(/bytes=(\d+)-(\d*)/);
        if (matches) {
            rangeStart = parseInt(matches[1]);
            rangeEnd = matches[2] ? parseInt(matches[2]) : totalSize - 1;
            isRangeRequest = true;

            // 验证范围有效性
            if (rangeStart >= totalSize || rangeEnd >= totalSize || rangeStart > rangeEnd) {
                return new Response('Range Not Satisfiable', { status: 416 });
            }
        }
    }

    // 处理HEAD请求
    if (request.method === 'HEAD') {
        return handleHeadRequest(headers, etag);
    }

    try {
        // 创建支持Range请求的流
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    let currentPosition = 0;

                    for (let i = 0; i < chunks.length; i++) {
                        const chunk = chunks[i];
                        const chunkSize = chunk.size || 0;

                        // 如果当前分片完全在请求范围之前，跳过
                        if (currentPosition + chunkSize <= rangeStart) {
                            currentPosition += chunkSize;
                            continue;
                        }

                        // 如果当前分片完全在请求范围之后，结束
                        if (currentPosition > rangeEnd) {
                            break;
                        }

                        // 获取分片数据（支持代理域名）
                        const chunkData = await fetchTelegramChunkWithRetry(TgBotToken, chunk, TgProxyUrl, 3);
                        if (!chunkData) {
                            throw new Error(`Failed to fetch chunk ${chunk.index} after retries`);
                        }

                        // 计算在当前分片中的起始和结束位置
                        const chunkStart = Math.max(0, rangeStart - currentPosition);
                        const chunkEnd = Math.min(chunkSize, rangeEnd - currentPosition + 1);

                        // 如果需要部分分片数据
                        if (chunkStart > 0 || chunkEnd < chunkSize) {
                            const partialData = chunkData.slice(chunkStart, chunkEnd);
                            controller.enqueue(partialData);
                        } else {
                            controller.enqueue(chunkData);
                        }

                        currentPosition += chunkSize;
                    }

                    controller.close();
                } catch (error) {
                    controller.error(error);
                }
            }
        });

        // 设置Range相关头部
        if (isRangeRequest) {
            setRangeHeaders(headers, rangeStart, rangeEnd, totalSize);

            return new Response(stream, {
                status: 206, // Partial Content
                headers,
            });
        } else {
            headers.set('Cache-Control', 'private, max-age=86400'); // CDN 不缓存完整文件，避免 CDN 不支持 Range 请求

            return new Response(stream, {
                status: 200,
                headers,
            });
        }

    } catch (error) {
        console.error('Chunked file reconstruction error:', error);
        return new Response('Error: Failed to reconstruct chunked file', { status: 500 });
    }
}

// 带重试机制的Telegram分片获取函数（支持代理域名）
async function fetchTelegramChunkWithRetry(botToken, chunk, proxyUrl = '', maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const tgApi = new TelegramAPI(botToken, proxyUrl);

            const response = await tgApi.getFileContent(chunk.fileId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // 验证分片大小是否匹配
            const chunkData = await response.arrayBuffer();
            const actualSize = chunkData.byteLength;

            // 如果有期望大小且不匹配，抛出错误
            if (chunk.size && actualSize !== chunk.size) {
                console.warn(`Chunk ${chunk.index} size mismatch: expected ${chunk.size}, got ${actualSize}`);
            }

            return new Uint8Array(chunkData);

        } catch (error) {
            console.warn(`Chunk ${chunk.index} fetch attempt ${attempt + 1} failed:`, error.message);

            if (attempt === maxRetries - 1) {
                return null; // 最后一次尝试也失败了
            }

            // 重试前等待一段时间
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        }
    }

    return null;
}

// 处理 Discord 渠道分片文件读取
async function handleDiscordChunkedFile(context, imgRecord, encodedFileName, fileType) {
    const { env, request, url, Referer } = context;

    const metadata = imgRecord.metadata;
    const discordAccess = await resolveDiscordAccess(env, metadata || {});
    if (!discordAccess?.botToken) {
        return new Response('Error: Discord channel credentials not available', { status: 500 });
    }
    const botToken = discordAccess.botToken;
    const proxyUrl = discordAccess.proxyUrl;

    const chunkMetadata = loadChunkMetadata(imgRecord.value, metadata.TotalChunks);
    if (!chunkMetadata.ok) {
        return chunkMetadata.response;
    }
    const chunks = chunkMetadata.chunks;

    // 计算文件总大小
    const totalSize = chunks.reduce((total, chunk) => total + (chunk.size || 0), 0);

    // 构建响应头
    const headers = new Headers();
    applyFileResponseHeaders(context, headers, encodedFileName, fileType);
    headers.set('Content-Length', totalSize.toString());

    // ETag 沿用顶层 context.responseEtag（内容寻址，按 fileId+variant），
    // 这样顶层 If-None-Match 短路对 chunked 文件也生效，且刷新不会因为 Date.now()
    // 在缺 TimeStamp 时漂移失效。applyFileResponseHeaders 已经把它写到了 headers。
    const etag = headers.get('ETag') || `"${metadata.TimeStamp || 'chunked'}-${totalSize}"`;
    if (!headers.has('ETag')) {
        headers.set('ETag', etag);
    }

    // 检查If-None-Match头（304缓存）
    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch && ifNoneMatch === etag) {
        return new Response(null, {
            status: 304,
            headers: {
                'ETag': etag,
                'Cache-Control': headers.get('Cache-Control'),
                'Accept-Ranges': 'bytes'
            }
        });
    }

    // 检查Range请求头
    const range = request.headers.get('Range');
    let rangeStart = 0;
    let rangeEnd = totalSize - 1;
    let isRangeRequest = false;

    if (range) {
        const matches = range.match(/bytes=(\d+)-(\d*)/);
        if (matches) {
            rangeStart = parseInt(matches[1]);
            rangeEnd = matches[2] ? parseInt(matches[2]) : totalSize - 1;
            isRangeRequest = true;

            // 验证范围有效性
            if (rangeStart >= totalSize || rangeEnd >= totalSize || rangeStart > rangeEnd) {
                return new Response('Range Not Satisfiable', { status: 416 });
            }
        }
    }

    // 处理HEAD请求
    if (request.method === 'HEAD') {
        return handleHeadRequest(headers, etag);
    }

    try {
        // 创建支持Range请求的流
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    let currentPosition = 0;

                    for (let i = 0; i < chunks.length; i++) {
                        const chunk = chunks[i];
                        const chunkSize = chunk.size || 0;

                        // 如果当前分片完全在请求范围之前，跳过
                        if (currentPosition + chunkSize <= rangeStart) {
                            currentPosition += chunkSize;
                            continue;
                        }

                        // 如果当前分片完全在请求范围之后，结束
                        if (currentPosition > rangeEnd) {
                            break;
                        }

                        // 获取分片数据（每次通过 API 获取新的附件 URL）
                        const chunkData = await fetchDiscordChunkWithRetry(botToken, metadata.DiscordChannelId, chunk, proxyUrl, 3);
                        if (!chunkData) {
                            throw new Error(`Failed to fetch Discord chunk ${chunk.index} after retries`);
                        }

                        // 计算在当前分片中的起始和结束位置
                        const chunkStart = Math.max(0, rangeStart - currentPosition);
                        const chunkEnd = Math.min(chunkSize, rangeEnd - currentPosition + 1);

                        // 如果需要部分分片数据
                        if (chunkStart > 0 || chunkEnd < chunkSize) {
                            const partialData = chunkData.slice(chunkStart, chunkEnd);
                            controller.enqueue(partialData);
                        } else {
                            controller.enqueue(chunkData);
                        }

                        currentPosition += chunkSize;
                    }

                    controller.close();
                } catch (error) {
                    controller.error(error);
                }
            }
        });

        // 设置Range相关头部
        if (isRangeRequest) {
            setRangeHeaders(headers, rangeStart, rangeEnd, totalSize);

            return new Response(stream, {
                status: 206, // Partial Content
                headers,
            });
        } else {
            headers.set('Cache-Control', 'private, max-age=86400');

            return new Response(stream, {
                status: 200,
                headers,
            });
        }

    } catch (error) {
        console.error('Discord chunked file reconstruction error:', error);
        return new Response('Error: Failed to reconstruct chunked file', { status: 500 });
    }
}

// 带重试机制的Discord分片获取函数（每次通过 API 获取新的附件 URL）
async function fetchDiscordChunkWithRetry(botToken, channelId, chunk, proxyUrl, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            // 通过 Discord API 获取新的附件 URL（因为 URL 会在约24小时后过期）
            const discordAPI = new DiscordAPI(botToken);
            let fileUrl = await discordAPI.getFileURL(channelId, chunk.messageId);

            if (!fileUrl) {
                throw new Error('Failed to get attachment URL from Discord API');
            }

            // 如果配置了代理 URL，替换 Discord CDN 域名
            fileUrl = resolveDiscordFileUrl(fileUrl, proxyUrl);

            const response = await fetch(fileUrl);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // 验证分片大小是否匹配
            const chunkData = await response.arrayBuffer();
            const actualSize = chunkData.byteLength;

            // 如果有期望大小且不匹配，记录警告
            if (chunk.size && actualSize !== chunk.size) {
                console.warn(`Discord chunk ${chunk.index} size mismatch: expected ${chunk.size}, got ${actualSize}`);
            }

            return new Uint8Array(chunkData);

        } catch (error) {
            console.warn(`Discord chunk ${chunk.index} fetch attempt ${attempt + 1} failed:`, error.message);

            if (attempt === maxRetries - 1) {
                return null; // 最后一次尝试也失败了
            }

            // 重试前等待一段时间
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        }
    }

    return null;
}

// 处理R2文件读取
async function handleR2File(context, fileId, encodedFileName, fileType) {
    const { env, request, url, Referer } = context;

    try {
        // 检查是否配置了R2
        if (typeof env.img_r2 == "undefined" || env.img_r2 == null || env.img_r2 == "") {
            return new Response('Error: Please configure R2 database', { status: 500 });
        }

        const R2DataBase = env.img_r2;

        // 检查Range请求头
        const range = request.headers.get('Range');
        let object;

        if (range) {
            // 处理Range请求
            const matches = range.match(/bytes=(\d+)-(\d*)/);
            if (matches) {
                const start = parseInt(matches[1]);
                const end = matches[2] ? parseInt(matches[2]) : undefined;

                const rangeOptions = {
                    range: {
                        offset: start
                    }
                };
                if (end !== undefined) {
                    rangeOptions.range.length = end - start + 1;
                }

                object = await R2DataBase.get(fileId, rangeOptions);
            } else {
                object = await R2DataBase.get(fileId);
            }
        } else {
            object = await R2DataBase.get(fileId);
        }

        if (object === null) {
            return imageNotFoundResponse();
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        applyFileResponseHeaders(context, headers, encodedFileName, fileType);

        // 处理HEAD请求
        if (request.method === 'HEAD') {
            return handleHeadRequest(headers);
        }

        // 如果是Range请求，设置相应的状态码和头
        if (range && object.range) {
            headers.set('Content-Range', `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
            headers.set('Content-Length', object.range.length.toString());

            return new Response(object.body, {
                status: 206, // Partial Content
                headers,
            });
        }

        // 正常请求
        return new Response(object.body, {
            status: 200,
            headers,
        });
    } catch (error) {
        console.error('R2 fetch error:', error);
        return new Response('Error: Failed to fetch file', { status: 500 });
    }
}

// 处理S3文件读取
async function handleS3File(context, metadata, encodedFileName, fileType, fileId) {
    const { Referer, url, request } = context;
    const s3Access = await resolveS3Access(context.env, metadata || {});

    // 检查是否配置了 CDN 文件完整路径
    const cdnFileUrl = resolveS3CdnFileUrl(metadata || {}, s3Access || {}, fileId);

    // 如果配置了 CDN 文件路径，通过 CDN 读取文件
    if (cdnFileUrl) {
        try {
            // 处理 HEAD 请求
            if (request.method === 'HEAD') {
                const headers = new Headers();
                applyFileResponseHeaders(context, headers, encodedFileName, fileType);
                return handleHeadRequest(headers);
            }

            // 构建请求头
            const fetchHeaders = {};

            // 支持 Range 请求
            const range = request.headers.get('Range');
            if (range) {
                fetchHeaders['Range'] = range;
            }

            // 通过 CDN 获取文件（直接使用完整路径，无需拼接）
            const response = await fetch(cdnFileUrl, {
                method: 'GET',
                headers: fetchHeaders
            });

            if (!response.ok && response.status !== 206) {
                // CDN 读取失败，回退到 S3 API
                console.warn(`CDN fetch failed (${response.status}), falling back to S3 API`);
                return await handleS3FileViaAPI(context, metadata, encodedFileName, fileType, fileId, s3Access);
            }

            // 构建响应头
            const headers = new Headers();
            applyFileResponseHeaders(context, headers, encodedFileName, fileType);

            // 复制相关头部
            if (response.headers.get('Content-Length')) {
                headers.set('Content-Length', response.headers.get('Content-Length'));
            }
            if (response.headers.get('Content-Range')) {
                headers.set('Content-Range', response.headers.get('Content-Range'));
            }

            return new Response(response.body, {
                status: response.status,
                headers
            });

        } catch (error) {
            // CDN 读取出错，回退到 S3 API
            console.error(`CDN fetch error: ${error.message}, falling back to S3 API`);
            return await handleS3FileViaAPI(context, metadata, encodedFileName, fileType, fileId, s3Access);
        }
    }

    // 没有配置 CDN 文件路径，使用 S3 API
    return await handleS3FileViaAPI(context, metadata, encodedFileName, fileType, fileId, s3Access);
}

// 通过 S3 API 读取文件
async function handleS3FileViaAPI(context, metadata, encodedFileName, fileType, fileId, resolvedS3Access = null) {
    const { Referer, url, request } = context;

    const s3Access = resolvedS3Access || await resolveS3Access(context.env, metadata || {});
    if (!s3Access?.accessKeyId || !s3Access?.secretAccessKey) {
        return new Response('Error: S3 channel credentials not available', { status: 500 });
    }

    const bucketName = metadata?.S3BucketName || s3Access.bucketName;
    const key = metadata?.S3FileKey || fileId;
    if (!bucketName || !key) {
        return new Response('Error: S3 file info not found', { status: 500 });
    }

    const s3Client = createS3Client({
        region: metadata?.S3Region || s3Access.region || "auto",
        endpoint: metadata?.S3Endpoint || s3Access.endpoint,
        credentials: {
            accessKeyId: s3Access.accessKeyId,
            secretAccessKey: s3Access.secretAccessKey
        },
        forcePathStyle: metadata?.S3PathStyle ?? s3Access.pathStyle ?? false
    });

    try {
        // 检查Range请求头
        const range = request.headers.get('Range');
        const commandParams = {
            Bucket: bucketName,
            Key: key
        };

        if (range) {
            // 添加Range参数用于部分内容请求
            commandParams.Range = range;
        }

        const command = new GetObjectCommand(commandParams);
        const response = await s3Client.send(command);

        // 设置响应头
        const headers = new Headers();
        applyFileResponseHeaders(context, headers, encodedFileName, fileType);

        // 设置Content-Length和Content-Range头
        if (response.ContentLength) {
            headers.set('Content-Length', response.ContentLength.toString());
        }

        if (response.ContentRange) {
            headers.set('Content-Range', response.ContentRange);
        }

        // 处理HEAD请求
        if (request.method === 'HEAD') {
            return handleHeadRequest(headers);
        }

        // 返回响应，支持流式传输
        const statusCode = range ? 206 : 200; // Range请求返回206 Partial Content
        return new Response(response.Body, {
            status: statusCode,
            headers
        });

    } catch (error) {
        if (isS3MissingObjectError(error)) {
            return imageNotFoundResponse();
        }

        console.error('S3 fetch error:', error);
        return new Response('Error: Failed to fetch file', { status: 500 });
    }
}


// 处理 Discord 文件读取
async function handleDiscordFile(context, metadata, encodedFileName, fileType) {
    const { env, request, url, Referer } = context;

    try {
        // 每次读取都通过 API 获取新的附件 URL（因为 Discord 附件 URL 会在约24小时后过期）
        let fileUrl = null;
        const discordAccess = await resolveDiscordAccess(env, metadata || {});
        if (metadata.DiscordMessageId && metadata.DiscordChannelId && discordAccess?.botToken) {
            const discordAPI = new DiscordAPI(discordAccess.botToken);
            fileUrl = await discordAPI.getFileURL(metadata.DiscordChannelId, metadata.DiscordMessageId);
        }

        if (!fileUrl) {
            return imageNotFoundResponse();
        }

        // 如果配置了代理 URL，替换 Discord CDN 域名
        fileUrl = resolveDiscordFileUrl(fileUrl, discordAccess?.proxyUrl || '');

        // 处理 HEAD 请求
        if (request.method === 'HEAD') {
            const headers = new Headers();
            applyFileResponseHeaders(context, headers, encodedFileName, fileType);
            return handleHeadRequest(headers);
        }

        // 获取文件内容（支持 Range 请求）
        const fetchHeaders = {};
        const range = request.headers.get('Range');
        if (range) {
            fetchHeaders['Range'] = range;
        }

        const response = await fetch(fileUrl, {
            method: 'GET',
            headers: fetchHeaders
        });

        if (!response.ok && response.status !== 206) {
            return new Response(`Error: Failed to fetch from Discord - ${response.status}`, { status: response.status });
        }

        // 构建响应头
        const headers = new Headers();
        applyFileResponseHeaders(context, headers, encodedFileName, fileType);

        // 复制相关头部
        if (response.headers.get('Content-Length')) {
            headers.set('Content-Length', response.headers.get('Content-Length'));
        }
        if (response.headers.get('Content-Range')) {
            headers.set('Content-Range', response.headers.get('Content-Range'));
        }

        return new Response(response.body, {
            status: response.status,
            headers
        });

    } catch (error) {
        console.error('Discord fetch error:', error);
        return new Response('Error: Failed to fetch file', { status: 500 });
    }
}


// 处理 HuggingFace 文件读取
async function handleHuggingFaceFile(context, metadata, encodedFileName, fileType) {
    const { request, url, Referer } = context;

    try {
        const hfAccess = await resolveHuggingFaceAccess(context.env, metadata || {});
        const hfRepo = metadata.HfRepo || hfAccess?.repo;
        const hfFilePath = metadata.HfFilePath;
        const hfToken = hfAccess?.token;
        const hfIsPrivate = typeof metadata.HfIsPrivate === 'boolean' ? metadata.HfIsPrivate : !!hfAccess?.isPrivate;

        if (!hfRepo || !hfFilePath) {
            return new Response('Error: HuggingFace file info not found', { status: 500 });
        }

        // 构建文件 URL
        const fileUrl = resolveHuggingFaceFileUrl(metadata, hfRepo, hfFilePath);

        // 处理 HEAD 请求
        if (request.method === 'HEAD') {
            const headers = new Headers();
            applyFileResponseHeaders(context, headers, encodedFileName, fileType);
            return handleHeadRequest(headers);
        }

        // 构建请求头
        const fetchHeaders = {};

        // 私有仓库需要 Authorization
        if (hfIsPrivate && hfToken) {
            fetchHeaders['Authorization'] = `Bearer ${hfToken}`;
        }

        // 支持 Range 请求
        const range = request.headers.get('Range');
        if (range) {
            fetchHeaders['Range'] = range;
        }

        const response = await fetch(fileUrl, {
            method: 'GET',
            headers: fetchHeaders
        });

        if (!response.ok && response.status !== 206) {
            return new Response(`Error: Failed to fetch from HuggingFace - ${response.status}`, { status: response.status });
        }

        // 构建响应头
        const headers = new Headers();
        applyFileResponseHeaders(context, headers, encodedFileName, fileType);

        // 复制相关头部
        if (response.headers.get('Content-Length')) {
            headers.set('Content-Length', response.headers.get('Content-Length'));
        }
        if (response.headers.get('Content-Range')) {
            headers.set('Content-Range', response.headers.get('Content-Range'));
        }

        return new Response(response.body, {
            status: response.status,
            headers
        });

    } catch (error) {
        console.error('HuggingFace fetch error:', error);
        return new Response('Error: Failed to fetch file', { status: 500 });
    }
}
