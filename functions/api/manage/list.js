import {
    readIndex, mergeOperationsToIndex, deleteAllOperations, rebuildIndex,
    getIndexInfo, getIndexStorageStats
} from '../../utils/indexManager.js';
import { KV_TO_D1_MIGRATION_STATE_KEY, checkDatabaseConfig, getDatabase } from '../../utils/databaseAdapter.js';
import { cleanupExpiredRecycleBin, isRecycleBinMetadata } from '../../utils/recycleBin.js';
import { sanitizeExposedMetadata } from '../../utils/mediaSecurity.js';

// CORS 跨域响应头
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};
const MAX_D1_PAGE_SIZE = 200;
const DEFAULT_D1_PAGE_SIZE = 50;
const ALLOWED_SORT_BY = new Set(['created_at', 'file_name', 'file_type']);

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

export async function onRequest(context) {
    const { request, waitUntil } = context;
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
            const page = clampInteger(pageRequested, {
                min: 1,
                fallback: Math.floor(Math.max(0, start) / pageSize) + 1,
            });
            const sortBy = normalizeSortBy(sortByRequested);
            const sortOrder = normalizeSortOrder(sortOrderRequested);
            const typeFilters = [];
            if (typeRequested) {
                typeFilters.push(typeRequested);
            }
            typeFilters.push(...fileTypeArray);
            const channelNameFilters = channelNameArray.length > 0 ? channelNameArray : channelArray;
            const queryResult = await db.queryFiles({
                page,
                pageSize,
                sortBy,
                sortOrder,
                search,
                directory: dir,
                types: typeFilters,
                channels: [],
                channelNames: channelNameFilters,
                recycleBinMode,
                favourites: favouritesRequested,
            });
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
                start: (page - 1) * pageSize,
                count: pageSize,
                indexLastUpdated: Date.now(),
                isIndexedResponse: true,
                isD1QueryResponse: true
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

        // 索引读取失败，直接从 KV 中获取所有文件记录
        if (!result.success) {
            const dbConfig = checkDatabaseConfig(context.env);
            if (dbConfig.usingD1) {
                return new Response(JSON.stringify({
                    error: 'Index unavailable',
                    message: 'D1-backed metadata query failed'
                }), {
                    status: 503,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            console.error('Index read failed, falling back to direct database scan.');
            const dbRecords = await getAllFileRecords(context.env, dir, recycleBinMode);

            return new Response(JSON.stringify({
                files: dbRecords.files,
                directories: dbRecords.directories,
                totalCount: dbRecords.totalCount,
                directFileCount: dbRecords.directFileCount,
                directFolderCount: dbRecords.directFolderCount,
                returnedCount: dbRecords.returnedCount,
                indexLastUpdated: Date.now(),
                isIndexedResponse: false // 标记这是来自 KV 的响应
            }), {
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
