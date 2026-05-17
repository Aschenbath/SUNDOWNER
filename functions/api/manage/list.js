import {
    readIndex, mergeOperationsToIndex, deleteAllOperations, rebuildIndex,
    getIndexInfo, getIndexStorageStats
} from '../../utils/indexManager.js';
import { KV_TO_D1_MIGRATION_STATE_KEY, checkDatabaseConfig, getDatabase } from '../../utils/databaseAdapter.js';
import { cleanupExpiredRecycleBin, isRecycleBinMetadata } from '../../utils/recycleBin.js';
import { sanitizeExposedMetadata } from '../../utils/mediaSecurity.js';
import { methodNotAllowed, optionsResponse } from '../../utils/cors.js';

// CORS 跨域响应头
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};
const MAX_D1_PAGE_SIZE = 500;
const DEFAULT_D1_PAGE_SIZE = 50;
const HYBRID_SUPPLEMENT_PAGE_SIZE = 500;
const HYBRID_SUPPLEMENT_MAX_FILES = 5000;
const ALLOWED_SORT_BY = new Set(['created_at', 'file_name', 'file_type', 'timestamp']);
const GENERIC_FILE_TYPES = new Set([
    '',
    'application/octet-stream',
    'binary/octet-stream',
    'application/x-binary',
    'application/unknown',
    'unknown',
    'none',
    'null',
]);
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif', 'heic', 'heif'];
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'];
const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg'];

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

function clampInteger(value, { min = 1, max = Number.MAX_SAFE_INTEGER, fallback } = {}) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.min(max, Math.max(min, parsed));
}

function normalizeSortBy(sortBy) {
    const normalized = String(sortBy || '').toLowerCase();
    return ALLOWED_SORT_BY.has(normalized) ? normalized : 'created_at';
}

function normalizeSortOrder(sortOrder) {
    return String(sortOrder || '').toLowerCase() === 'asc' ? 'asc' : 'desc';
}

function normalizeText(value) {
    return String(value ?? '').trim();
}

function normalizeFileType(value) {
    return normalizeText(value).toLowerCase();
}

function extractDirectory(filePath) {
    const normalized = normalizeText(filePath).replace(/\\/g, '/');
    const lastSlashIndex = normalized.lastIndexOf('/');
    return lastSlashIndex === -1 ? '' : normalized.slice(0, lastSlashIndex + 1);
}

function getFileName(file) {
    return normalizeText(file?.metadata?.FileName || file?.metadata?.file_name || file?.id?.split('/').pop() || file?.id || '');
}

function getFileTypeReference(file) {
    return `${getFileName(file)} ${normalizeText(file?.id)}`.toLowerCase();
}

function hasFileExtension(file, extensions) {
    const reference = getFileTypeReference(file);
    return extensions.some((extension) => new RegExp(`\\.${extension}(?:$|[?#\\s])`).test(reference));
}

function isImageFile(file) {
    const mimeType = normalizeFileType(file?.metadata?.FileType || file?.metadata?.file_type);
    return mimeType.startsWith('image/')
        || mimeType === 'image'
        || mimeType === 'photo'
        || (GENERIC_FILE_TYPES.has(mimeType) && hasFileExtension(file, IMAGE_EXTENSIONS));
}

function isVideoFile(file) {
    const mimeType = normalizeFileType(file?.metadata?.FileType || file?.metadata?.file_type);
    return mimeType.startsWith('video/')
        || mimeType === 'video'
        || (GENERIC_FILE_TYPES.has(mimeType) && hasFileExtension(file, VIDEO_EXTENSIONS));
}

function isAudioFile(file) {
    const mimeType = normalizeFileType(file?.metadata?.FileType || file?.metadata?.file_type);
    return mimeType.startsWith('audio/')
        || mimeType === 'audio'
        || (GENERIC_FILE_TYPES.has(mimeType) && hasFileExtension(file, AUDIO_EXTENSIONS));
}

function isMediaFile(file) {
    return isImageFile(file) || isVideoFile(file) || isAudioFile(file);
}

function matchesTypeFilters(file, typeFilters) {
    if (!typeFilters.length) {
        return true;
    }

    return typeFilters.some((rawType) => {
        const type = normalizeText(rawType).toLowerCase();
        if (type === 'image' || type === 'photo') return isImageFile(file);
        if (type === 'video') return isVideoFile(file);
        if (type === 'audio') return isAudioFile(file);
        if (type === 'document' || type === 'other') return !isMediaFile(file);
        return true;
    });
}

function isRecycleBinRecord(metadata = {}) {
    const rawValue = metadata.RecycleBin ?? metadata.recycleBin ?? metadata.recycle_bin;
    return ['1', 'true', 'yes'].includes(normalizeText(rawValue).toLowerCase());
}

function isFavouriteRecord(metadata = {}) {
    return [
        metadata.IsFavourite,
        metadata.IsFavorite,
        metadata.Favourite,
        metadata.Favorite,
        metadata.Favorited,
    ].some((value) => ['1', 'true', 'yes'].includes(normalizeText(value).toLowerCase()));
}

function matchesChannelNameFilters(file, channelNameFilters) {
    if (!channelNameFilters.length) {
        return true;
    }

    const metadata = file.metadata || {};
    const channel = normalizeText(metadata.Channel);
    const channelName = normalizeText(metadata.ChannelName);
    return channelNameFilters.some((filterValue) => {
        const normalized = normalizeText(filterValue);
        if (normalized.includes(':')) {
            const [filterChannel, filterChannelName] = normalized.split(':', 2);
            return channel === filterChannel && channelName === filterChannelName;
        }
        return channelName === normalized;
    });
}

function matchesDirectory(file, directory, recursive) {
    if (!directory) {
        return true;
    }

    const normalizedDirectory = directory.endsWith('/') ? directory : `${directory}/`;
    const id = normalizeText(file.id).replace(/\\/g, '/');
    const metadataDirectory = normalizeText(file.metadata?.Directory || file.metadata?.directory || '').replace(/\\/g, '/');
    if (recursive) {
        return id.startsWith(normalizedDirectory) || metadataDirectory.startsWith(normalizedDirectory);
    }

    const directDirectory = metadataDirectory || extractDirectory(id);
    return directDirectory === normalizedDirectory;
}

function matchesSearch(file, search) {
    const query = normalizeText(search).toLowerCase();
    if (!query) {
        return true;
    }

    return getFileName(file).toLowerCase().includes(query)
        || normalizeText(file.id).toLowerCase().includes(query);
}

function matchesRecycleMode(file, recycleBinMode) {
    const isRecycled = isRecycleBinRecord(file.metadata || {});
    if (recycleBinMode === 'only') {
        return isRecycled;
    }
    if (recycleBinMode === 'include') {
        return true;
    }
    return !isRecycled;
}

function matchesHybridSupplementFilters(file, {
    directory,
    recursive,
    search,
    typeFilters,
    channelNameFilters,
    recycleBinMode,
    favourites,
}) {
    return Boolean(file?.id)
        && !file.id.startsWith('manage@')
        && !file.id.startsWith('chunk_')
        && matchesDirectory(file, directory, recursive)
        && matchesSearch(file, search)
        && matchesTypeFilters(file, typeFilters)
        && matchesChannelNameFilters(file, channelNameFilters)
        && matchesRecycleMode(file, recycleBinMode)
        && (!favourites || isFavouriteRecord(file.metadata || {}));
}

function getSortValue(file, sortBy) {
    const metadata = file.metadata || {};
    if (sortBy === 'file_name') {
        return getFileName(file).toLowerCase();
    }
    if (sortBy === 'file_type') {
        return normalizeFileType(metadata.FileType || metadata.file_type);
    }
    if (sortBy === 'timestamp') {
        return Number(metadata.TimeStamp ?? metadata.timeStamp ?? metadata.timestamp ?? metadata.DateTaken ?? 0) || 0;
    }
    return Number(metadata.CreatedAt ?? metadata.createdAt ?? metadata.TimeStamp ?? metadata.timeStamp ?? 0) || 0;
}

function sortFiles(files, sortBy, sortOrder) {
    const direction = sortOrder === 'asc' ? 1 : -1;
    return files.sort((left, right) => {
        const leftValue = getSortValue(left, sortBy);
        const rightValue = getSortValue(right, sortBy);
        if (typeof leftValue === 'number' && typeof rightValue === 'number') {
            if (leftValue !== rightValue) {
                return (leftValue - rightValue) * direction;
            }
        } else {
            const compared = String(leftValue).localeCompare(String(rightValue));
            if (compared !== 0) {
                return compared * direction;
            }
        }
        return normalizeText(left.id).localeCompare(normalizeText(right.id)) * direction;
    });
}

function shouldUseD1ListQueryPath({
    recursive,
    pageRequested,
    pageSizeRequested,
    listTypeArray,
    accessStatusArray,
    includeTagsArray,
    excludeTagsArray,
    labelArray,
}) {
    if (!recursive && !pageRequested && !pageSizeRequested) {
        return false;
    }

    return listTypeArray.length === 0
        && accessStatusArray.length === 0
        && includeTagsArray.length === 0
        && excludeTagsArray.length === 0
        && labelArray.length === 0;
}

async function isD1ListQueryEnabled(env) {
    const dbConfig = checkDatabaseConfig(env);
    if (!dbConfig.usingD1) {
        return false;
    }

    if (!dbConfig.usingHybrid) {
        return true;
    }

    const db = getDatabase(env);
    const migrationStatus = parseMigrationStatus(await db.get(KV_TO_D1_MIGRATION_STATE_KEY));
    return migrationStatus?.complete === true;
}

function canUseHybridKvSupplement(env) {
    const dbConfig = checkDatabaseConfig(env);
    return dbConfig.usingHybrid
        && env?.img_url
        && typeof env.img_url.list === 'function';
}

async function queryAllD1Files(db, queryOptions) {
    const files = [];
    let total = 0;
    let offset = 0;

    while (files.length < HYBRID_SUPPLEMENT_MAX_FILES) {
        const page = await db.queryFiles({
            ...queryOptions,
            page: Math.floor(offset / HYBRID_SUPPLEMENT_PAGE_SIZE) + 1,
            pageSize: HYBRID_SUPPLEMENT_PAGE_SIZE,
            offset,
        });
        const pageFiles = Array.isArray(page.files) ? page.files : [];
        total = Math.max(total, Number(page.total || 0), files.length + pageFiles.length);
        files.push(...pageFiles);
        if (!pageFiles.length || pageFiles.length < HYBRID_SUPPLEMENT_PAGE_SIZE || files.length >= total) {
            break;
        }
        offset += pageFiles.length;
    }

    return {
        files: files.slice(0, HYBRID_SUPPLEMENT_MAX_FILES),
        total,
    };
}

async function queryKvSupplementFiles(context, filters) {
    const kv = context.env?.img_url;
    if (!kv || typeof kv.list !== 'function') {
        return [];
    }

    const files = [];
    let cursor = null;
    const prefix = filters.directory || '';

    while (files.length < HYBRID_SUPPLEMENT_MAX_FILES) {
        const response = await kv.list({
            limit: 1000,
            cursor,
            ...(prefix ? { prefix } : {}),
        });
        const keys = Array.isArray(response?.keys) ? response.keys : [];

        for (const item of keys) {
            if (files.length >= HYBRID_SUPPLEMENT_MAX_FILES) {
                break;
            }
            const id = normalizeText(item?.name);
            if (!id || id.startsWith('manage@') || id.startsWith('chunk_')) {
                continue;
            }
            let metadata = item?.metadata && typeof item.metadata === 'object' ? item.metadata : null;
            if (!metadata && typeof kv.getWithMetadata === 'function') {
                const record = await kv.getWithMetadata(id);
                metadata = record?.metadata && typeof record.metadata === 'object' ? record.metadata : {};
            }

            const file = { id, metadata: metadata || {} };
            if (matchesHybridSupplementFilters(file, filters)) {
                files.push(file);
            }
        }

        cursor = response?.cursor;
        if (!cursor || keys.length === 0) {
            break;
        }
    }

    return files;
}

async function queryHybridFilesWithKvSupplement(context, db, queryOptions, {
    offset,
    pageSize,
    sortBy,
    sortOrder,
    filters,
}) {
    const [d1Result, kvFiles] = await Promise.all([
        queryAllD1Files(db, queryOptions),
        queryKvSupplementFiles(context, filters),
    ]);

    const mergedById = new Map();
    d1Result.files.forEach((file) => {
        if (file?.id) {
            mergedById.set(file.id, file);
        }
    });
    kvFiles.forEach((file) => {
        if (file?.id && !mergedById.has(file.id)) {
            mergedById.set(file.id, file);
        }
    });

    const mergedFiles = sortFiles([...mergedById.values()], sortBy, sortOrder);
    const total = mergedFiles.length;
    return {
        files: mergedFiles.slice(offset, offset + pageSize),
        total,
        supplementedCount: Math.max(0, total - d1Result.total),
        d1Total: d1Result.total,
    };
}

export async function onRequest(context) {
    const { request, waitUntil } = context;
    if (request.method === 'OPTIONS') {
        return optionsResponse();
    }
    if (request.method !== 'GET') {
        return methodNotAllowed(['GET', 'OPTIONS']);
    }

    const url = new URL(request.url);

    // 解析查询参数
    let start = parseInt(url.searchParams.get('start'), 10) || 0;
    let count = parseInt(url.searchParams.get('count'), 10) || 50;
    let sum = url.searchParams.get('sum') === 'true';
    let recursive = url.searchParams.get('recursive') === 'true';
    let dir = url.searchParams.get('dir') || '';
    let search = url.searchParams.get('search') || '';
    let channel = url.searchParams.get('channel') || '';
    let listType = url.searchParams.get('listType') || '';
    let accessStatus = url.searchParams.get('accessStatus') || '';
    let action = url.searchParams.get('action') || '';
    let includeTags = url.searchParams.get('includeTags') || '';
    let excludeTags = url.searchParams.get('excludeTags') || '';
    let label = url.searchParams.get('label') || '';
    let fileType = url.searchParams.get('fileType') || '';
    let channelName = url.searchParams.get('channelName') || '';
    let recycleBinMode = url.searchParams.get('recycleBin') || 'exclude';
    const pageRequested = url.searchParams.get('page');
    const pageSizeRequested = url.searchParams.get('pageSize');
    const sortByRequested = url.searchParams.get('sortBy');
    const sortOrderRequested = url.searchParams.get('sortOrder');
    const typeRequested = url.searchParams.get('type') || '';
    const favouritesRequested = url.searchParams.get('favourites') === 'true';
    const trashRequested = url.searchParams.get('trash') === 'true';

    if (!['exclude', 'include', 'only'].includes(recycleBinMode)) {
        recycleBinMode = 'exclude';
    }
    if (trashRequested) {
        recycleBinMode = 'only';
    }

    // 处理搜索关键字
    if (search) {
        search = decodeURIComponent(search).trim();
    }

    // 处理标签参数
    const includeTagsArray = includeTags ? includeTags.split(',').map(t => t.trim()).filter(t => t) : [];
    const excludeTagsArray = excludeTags ? excludeTags.split(',').map(t => t.trim()).filter(t => t) : [];

    // 处理筛选参数（支持逗号分隔的多选）
    const listTypeArray = listType ? listType.split(',').map(t => t.trim()).filter(t => t) : [];
    const accessStatusArray = accessStatus ? accessStatus.split(',').map(t => t.trim()).filter(t => t) : [];
    const labelArray = label ? label.split(',').map(t => t.trim()).filter(t => t) : [];
    const fileTypeArray = fileType ? fileType.split(',').map(t => t.trim()).filter(t => t) : [];
    const channelArray = channel ? channel.split(',').map(t => t.trim()).filter(t => t) : [];
    const channelNameArray = channelName ? channelName.split(',').map(t => t.trim()).filter(t => t) : [];

    // 处理目录参数
    if (dir) {
        // 路径安全处理：防止路径穿越
        dir = dir.replace(/\.\./g, '_').replace(/\\/g, '/').replace(/\/{2,}/g, '/');
    }
    if (dir.startsWith('/')) {
        dir = dir.substring(1);
    }
    if (dir && !dir.endsWith('/')) {
        dir += '/';
    }

    try {
        waitUntil(cleanupExpiredRecycleBin(context));

        // 特殊操作：重建索引
        if (action === 'rebuild') {
            waitUntil(rebuildIndex(context, (processed) => {
                console.log(`Rebuilt ${processed} files...`);
            }));

            return new Response('Index rebuilt asynchronously', {
                headers: { "Content-Type": "text/plain", ...corsHeaders }
            });
        }

        // 特殊操作：合并挂起的原子操作到索引
        if (action === 'merge-operations') {
            waitUntil(mergeOperationsToIndex(context));

            return new Response('Operations merged into index asynchronously', {
                headers: { "Content-Type": "text/plain", ...corsHeaders }
            });
        }

        // 特殊操作：清除所有原子操作
        if (action === 'delete-operations') {
            waitUntil(deleteAllOperations(context));

            return new Response('All operations deleted asynchronously', {
                headers: { "Content-Type": "text/plain", ...corsHeaders }
            });
        }

        // 特殊操作：获取索引存储信息
        if (action === 'index-storage-stats') {
            const stats = await getIndexStorageStats(context);
            return new Response(JSON.stringify(stats), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        // 特殊操作：获取索引信息
        if (action === 'info') {
            const info = await getIndexInfo(context);
            return new Response(JSON.stringify(info), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        // 普通查询：只返回总数
        if (count === -1 && sum) {
            const result = await readIndex(context, {
                search,
                directory: dir,
                channel: channelArray,
                listType: listTypeArray,
                accessStatus: accessStatusArray,
                label: labelArray,
                fileType: fileTypeArray,
                channelName: channelNameArray,
                includeTags: includeTagsArray,
                excludeTags: excludeTagsArray,
                recycleBinMode,
                countOnly: true
            });

            return new Response(JSON.stringify({
                sum: result.totalCount,
                indexLastUpdated: result.indexLastUpdated
            }), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        // 普通查询：返回数据
        const canUseD1ListQuery = shouldUseD1ListQueryPath({
            recursive,
            pageRequested,
            pageSizeRequested,
            listTypeArray,
            accessStatusArray,
            includeTagsArray,
            excludeTagsArray,
            labelArray,
        }) && await isD1ListQueryEnabled(context.env);

        if (canUseD1ListQuery) {
            const db = getDatabase(context.env);
            const requestedPageSize = pageSizeRequested ?? (count > 0 ? count : DEFAULT_D1_PAGE_SIZE);
            const pageSize = clampInteger(requestedPageSize, {
                min: 1,
                max: MAX_D1_PAGE_SIZE,
                fallback: DEFAULT_D1_PAGE_SIZE,
            });
            const hasExplicitPage = pageRequested !== null;
            const startOffset = Math.max(0, start);
            const page = clampInteger(pageRequested, {
                min: 1,
                fallback: Math.floor(startOffset / pageSize) + 1,
            });
            const offset = hasExplicitPage ? (page - 1) * pageSize : startOffset;
            const sortBy = normalizeSortBy(sortByRequested);
            const sortOrder = normalizeSortOrder(sortOrderRequested);
            const typeFilters = [];
            if (typeRequested) {
                typeFilters.push(typeRequested);
            }
            typeFilters.push(...fileTypeArray);
            const channelNameFilters = channelNameArray.length > 0 ? channelNameArray : channelArray;
            const d1QueryOptions = {
                page,
                pageSize,
                offset,
                sortBy,
                sortOrder,
                search,
                directory: dir,
                types: typeFilters,
                channels: [],
                channelNames: channelNameFilters,
                recycleBinMode,
                favourites: favouritesRequested,
            };
            const queryResult = canUseHybridKvSupplement(context.env)
                ? await queryHybridFilesWithKvSupplement(context, db, d1QueryOptions, {
                    offset,
                    pageSize,
                    sortBy,
                    sortOrder,
                    filters: {
                        directory: dir,
                        recursive,
                        search,
                        typeFilters,
                        channelNameFilters,
                        recycleBinMode,
                        favourites: favouritesRequested,
                    },
                })
                : await db.queryFiles(d1QueryOptions);
            const compatibleFiles = queryResult.files.map(file => ({
                name: file.id,
                metadata: sanitizeExposedMetadata(file.metadata)
            }));
            const totalPages = Math.max(1, Math.ceil(queryResult.total / pageSize));

            return new Response(JSON.stringify({
                files: compatibleFiles,
                total: queryResult.total,
                page,
                pageSize,
                totalPages,
                directories: [],
                totalCount: queryResult.total,
                directFileCount: compatibleFiles.length,
                directFolderCount: 0,
                returnedCount: compatibleFiles.length,
                start: offset,
                count: pageSize,
                indexLastUpdated: Date.now(),
                isIndexedResponse: true,
                isD1QueryResponse: true,
                ...(queryResult.supplementedCount > 0 ? {
                    isHybridSupplementedResponse: true,
                    d1TotalCount: queryResult.d1Total,
                    kvSupplementedCount: queryResult.supplementedCount
                } : {})
            }), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        const result = await readIndex(context, {
            search,
            directory: dir,
            start,
            count,
            channel: channelArray,
            listType: listTypeArray,
            accessStatus: accessStatusArray,
            label: labelArray,
            fileType: fileTypeArray,
            channelName: channelNameArray,
            includeTags: includeTagsArray,
            excludeTags: excludeTagsArray,
            recycleBinMode,
            includeSubdirFiles: recursive,
        });

        if (!result.success) {
            return new Response(JSON.stringify({
                error: 'Index unavailable',
                message: 'Indexed metadata query failed'
            }), {
                status: 503,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        // 转换文件格式
        const compatibleFiles = result.files.map(file => ({
            name: file.id,
            metadata: sanitizeExposedMetadata(file.metadata)
        }));

        return new Response(JSON.stringify({
            files: compatibleFiles,
            directories: result.directories,
            totalCount: result.totalCount,
            directFileCount: result.directFileCount,
            directFolderCount: result.directFolderCount,
            returnedCount: result.returnedCount,
            indexLastUpdated: result.indexLastUpdated,
            isIndexedResponse: true // 标记这是来自索引的响应
        }), {
            headers: { "Content-Type": "application/json", ...corsHeaders }
        });

    } catch (error) {
        console.error('Error in list-indexed API:', error);
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: error.message
        }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
        });
    }
}

async function getAllFileRecords(env, dir, recycleBinMode = 'exclude') {
    const allRecords = [];
    let cursor = null;

    try {
        const db = getDatabase(env);

        while (true) {
            const response = await db.list({
                prefix: dir,
                limit: 1000,
                cursor: cursor
            });

            // 检查响应格式
            if (!response || !response.keys || !Array.isArray(response.keys)) {
                console.error('Invalid response from database list:', response);
                break;
            }

            cursor = response.cursor;

            for (const item of response.keys) {
                // 跳过管理相关的键
                if (item.name.startsWith('manage@') || item.name.startsWith('chunk_')) {
                    continue;
                }

                // 跳过没有元数据的文件
                if (!item.metadata || !item.metadata.TimeStamp) {
                    continue;
                }

                const inRecycleBin = isRecycleBinMetadata(item.metadata || {});
                if (recycleBinMode === 'only' && !inRecycleBin) {
                    continue;
                }
                if (recycleBinMode !== 'include' && recycleBinMode !== 'only' && inRecycleBin) {
                    continue;
                }

                allRecords.push({
                    ...item,
                    metadata: sanitizeExposedMetadata(item.metadata || {})
                });
            }

            if (!cursor) break;

            // 添加协作点
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        // 提取目录信息
        const directories = new Set();
        const filteredRecords = [];
        allRecords.forEach(item => {
            const subDir = item.name.substring(dir.length);
            const firstSlashIndex = subDir.indexOf('/');
            if (firstSlashIndex !== -1) {
                directories.add(dir + subDir.substring(0, firstSlashIndex));
            } else {
                filteredRecords.push(item);
            }
        });

        return {
            files: filteredRecords,
            directories: Array.from(directories),
            totalCount: allRecords.length,
            directFileCount: filteredRecords.length,
            directFolderCount: directories.size,
            returnedCount: filteredRecords.length
        };

    } catch (error) {
        console.error('Error in getAllFileRecords:', error);
        return {
            files: [],
            directories: [],
            totalCount: 0,
            directFileCount: 0,
            directFolderCount: 0,
            returnedCount: 0,
            error: error.message
        };
    }
}
