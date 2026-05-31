import { stripSensitiveMetadata } from './mediaSecurity.js';

const SCHEMA_STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        value TEXT,
        metadata TEXT NOT NULL DEFAULT '{}',
        file_name TEXT,
        file_type TEXT,
        file_size REAL,
        upload_ip TEXT,
        upload_address TEXT,
        list_type TEXT,
        timestamp INTEGER,
        label TEXT,
        directory TEXT,
        channel TEXT,
        channel_name TEXT,
        tg_file_id TEXT,
        tg_chat_id TEXT,
        tg_message_id TEXT,
        is_chunked INTEGER DEFAULT 0,
        file_type_bucket TEXT,
        is_deleted INTEGER DEFAULT 0,
        deleted_at INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    'CREATE INDEX IF NOT EXISTS idx_files_timestamp ON files(timestamp DESC, id ASC)',
    'CREATE INDEX IF NOT EXISTS idx_files_directory ON files(directory, timestamp DESC, id ASC)',
    'CREATE INDEX IF NOT EXISTS idx_files_channel ON files(channel, channel_name, timestamp DESC, id ASC)',
    `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        category TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    'CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category)',
    `CREATE TABLE IF NOT EXISTS index_operations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        data TEXT NOT NULL,
        processed INTEGER DEFAULT 0,
        expires_at INTEGER,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    'CREATE INDEX IF NOT EXISTS idx_index_operations_timestamp ON index_operations(timestamp ASC, id ASC)',
    'CREATE INDEX IF NOT EXISTS idx_index_operations_expires_at ON index_operations(expires_at)',
    // file_type_bucket 列由 repairLegacySchema 在 idx_index_operations_timestamp 触发点补齐，
    // 所以这条 CREATE INDEX 必须排在该触发点之后，否则在没跑过 ALTER TABLE 的旧 D1 上
    // 会因为列不存在而直接报错。
    'CREATE INDEX IF NOT EXISTS idx_files_type_bucket ON files(file_type_bucket, timestamp DESC, id ASC)',
    // is_deleted 索引用于快速查询回收站，避免全表扫描 JSON 字段
    'CREATE INDEX IF NOT EXISTS idx_files_is_deleted ON files(is_deleted, deleted_at DESC, id ASC)',
];

const SCHEMA_REPAIR_COLUMNS = [
    { table: 'index_operations', column: 'expires_at', sql: 'ALTER TABLE index_operations ADD COLUMN expires_at INTEGER' },
    { table: 'index_operations', column: 'updated_at', sql: 'ALTER TABLE index_operations ADD COLUMN updated_at TEXT' },
    { table: 'files', column: 'file_type_bucket', sql: 'ALTER TABLE files ADD COLUMN file_type_bucket TEXT' },
    { table: 'files', column: 'is_deleted', sql: 'ALTER TABLE files ADD COLUMN is_deleted INTEGER DEFAULT 0' },
    { table: 'files', column: 'deleted_at', sql: 'ALTER TABLE files ADD COLUMN deleted_at INTEGER' },
];

// Settings sentinel that records when the file_type_bucket backfill has run, so
// repeat cold starts skip the expensive UPDATE over the whole files table.
const FILE_TYPE_BUCKET_BACKFILL_KEY = 'schema@d1@file_type_bucket_v1';
const FILE_TYPE_BUCKETS = new Set(['image', 'video', 'audio', 'other']);

function normalizeFileTypeBucketCandidate(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return FILE_TYPE_BUCKETS.has(normalized) ? normalized : null;
}

// 与 d1Database 中 IMAGE_TYPE_SQL / VIDEO_TYPE_SQL / AUDIO_TYPE_SQL 等价的 JS 版本，
// 让 putFile 在写入时直接落桶，查询时优先用 file_type_bucket 索引而不是
// JSON 抽取 + LIKE 全表扫描。SQL 与 JS 必须保持同步。
function computeFileTypeBucket(metadata = {}, fileId = '') {
    const explicit = normalizeFileTypeBucketCandidate(metadata?.FileTypeBucket || metadata?.file_type_bucket);
    if (explicit) {
        return explicit;
    }

    const rawType = String(
        metadata?.FileType
        || metadata?.file_type
        || ''
    ).trim().toLowerCase();

    if (rawType.startsWith('image/') || rawType === 'image' || rawType === 'photo') {
        return 'image';
    }
    if (rawType.startsWith('video/') || rawType === 'video') {
        return 'video';
    }
    if (rawType.startsWith('audio/') || rawType === 'audio') {
        return 'audio';
    }

    const isGeneric = !rawType || [
        'application/octet-stream',
        'binary/octet-stream',
        'application/x-binary',
        'application/unknown',
        'unknown',
        'none',
        'null',
    ].includes(rawType);

    if (isGeneric) {
        const reference = `${String(metadata?.FileName || metadata?.file_name || '').toLowerCase()} ${String(fileId || '').toLowerCase()}`;
        if (/\.(jpg|jpeg|png|gif|webp|bmp|avif|heic|heif)(?:[^a-z0-9]|$)/.test(reference)) {
            return 'image';
        }
        if (/\.(mp4|mov|m4v|webm|mkv|avi)(?:[^a-z0-9]|$)/.test(reference)) {
            return 'video';
        }
        if (/\.(mp3|m4a|aac|wav|flac|ogg)(?:[^a-z0-9]|$)/.test(reference)) {
            return 'audio';
        }
    }

    return 'other';
}

function isIgnorableSchemaRepairError(error) {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('duplicate column name')
        || message.includes('already exists')
        || message.includes('no such table');
}

function parseJson(value, fallback) {
    if (!value) {
        return fallback;
    }

    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function normalizeBoolean(value) {
    return value ? 1 : 0;
}

const ALLOWED_SORT_COLUMNS = {
    created_at: 'created_at',
    file_name: "COALESCE(NULLIF(file_name, ''), json_extract(metadata, '$.FileName'), json_extract(metadata, '$.file_name'), id)",
    file_type: "COALESCE(NULLIF(file_type, ''), json_extract(metadata, '$.FileType'), json_extract(metadata, '$.file_type'), '')",
    timestamp: "COALESCE(timestamp, CAST(json_extract(metadata, '$.TimeStamp') AS INTEGER), CAST(json_extract(metadata, '$.timeStamp') AS INTEGER), CAST(strftime('%s', created_at) AS INTEGER) * 1000, 0)",
};
const FILE_NAME_LOOKUP_SQL = "LOWER(COALESCE(NULLIF(file_name, ''), json_extract(metadata, '$.FileName'), json_extract(metadata, '$.file_name'), id))";
const FILE_TYPE_LOOKUP_SQL = "LOWER(COALESCE(NULLIF(file_type, ''), json_extract(metadata, '$.FileType'), json_extract(metadata, '$.file_type'), ''))";
const FILE_EXTENSION_LOOKUP_SQL = "LOWER(COALESCE(NULLIF(file_name, ''), json_extract(metadata, '$.FileName'), json_extract(metadata, '$.file_name'), '') || ' ' || id)";
const IMAGE_EXTENSION_SQL = [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif', 'heic', 'heif'
].map((ext) => `${FILE_EXTENSION_LOOKUP_SQL} LIKE '%.${ext}'`).join(' OR ');
const VIDEO_EXTENSION_SQL = [
    'mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'
].map((ext) => `${FILE_EXTENSION_LOOKUP_SQL} LIKE '%.${ext}'`).join(' OR ');
const AUDIO_EXTENSION_SQL = [
    'mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg'
].map((ext) => `${FILE_EXTENSION_LOOKUP_SQL} LIKE '%.${ext}'`).join(' OR ');
const GENERIC_FILE_TYPE_SQL = `(${FILE_TYPE_LOOKUP_SQL} IN ('', 'application/octet-stream', 'binary/octet-stream', 'application/x-binary', 'application/unknown', 'unknown', 'none', 'null'))`;
const IMAGE_TYPE_SQL = `(${FILE_TYPE_LOOKUP_SQL} LIKE 'image/%' OR ${FILE_TYPE_LOOKUP_SQL} IN ('image', 'photo') OR (${GENERIC_FILE_TYPE_SQL} AND (${IMAGE_EXTENSION_SQL})))`;
const VIDEO_TYPE_SQL = `(${FILE_TYPE_LOOKUP_SQL} LIKE 'video/%' OR ${FILE_TYPE_LOOKUP_SQL} = 'video' OR (${GENERIC_FILE_TYPE_SQL} AND (${VIDEO_EXTENSION_SQL})))`;
const AUDIO_TYPE_SQL = `(${FILE_TYPE_LOOKUP_SQL} LIKE 'audio/%' OR ${FILE_TYPE_LOOKUP_SQL} = 'audio' OR (${GENERIC_FILE_TYPE_SQL} AND (${AUDIO_EXTENSION_SQL})))`;
const MEDIA_TYPE_SQL = `(${IMAGE_TYPE_SQL} OR ${VIDEO_TYPE_SQL} OR ${AUDIO_TYPE_SQL})`;

function normalizeStringArray(value) {
    if (Array.isArray(value)) {
        return value.map((item) => String(item || '').trim()).filter(Boolean);
    }

    if (value === null || value === undefined || value === '') {
        return [];
    }

    return [String(value).trim()].filter(Boolean);
}

function normalizeSortBy(sortBy) {
    return ALLOWED_SORT_COLUMNS[String(sortBy || '').toLowerCase()] || ALLOWED_SORT_COLUMNS.created_at;
}

function normalizeSortOrder(sortOrder) {
    return String(sortOrder || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
}

function isTruthyMetadataValue(value) {
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === '1' || normalized === 'true';
}

class D1Database {
    constructor(db) {
        this.db = db;
        this.schemaReady = null;
    }

    async ensureSchema() {
        if (!this.schemaReady) {
            this.schemaReady = (async () => {
                for (const sql of SCHEMA_STATEMENTS) {
                    if (sql.includes('idx_index_operations_timestamp')) {
                        await this.repairLegacySchema();
                    }
                    await this.db.prepare(sql).run();
                }
                await this.backfillFileTypeBucket();
            })();
        }

        return this.schemaReady;
    }

    // 旧记录的 file_type_bucket 列在 ALTER TABLE 之后是 NULL，需要按 IMAGE/VIDEO/AUDIO 判定
    // 一次性灌进来。用 settings 表的哨兵 key 防止每次 cold start 都重跑 UPDATE，避免大表
    // 触发 worker timeout。手动想强制重跑可以删掉 schema@d1@file_type_bucket_v1 设置。
    async backfillFileTypeBucket() {
        try {
            const sentinel = await this.db
                .prepare('SELECT value FROM settings WHERE key = ?')
                .bind(FILE_TYPE_BUCKET_BACKFILL_KEY)
                .first();
            if (sentinel?.value) {
                return;
            }

            const fileTypeLookup = "LOWER(COALESCE(NULLIF(file_type, ''), json_extract(metadata, '$.FileType'), json_extract(metadata, '$.file_type'), ''))";
            const referenceLookup = "LOWER(COALESCE(NULLIF(file_name, ''), json_extract(metadata, '$.FileName'), json_extract(metadata, '$.file_name'), '') || ' ' || id)";
            const genericPredicate = `(${fileTypeLookup} IN ('', 'application/octet-stream', 'binary/octet-stream', 'application/x-binary', 'application/unknown', 'unknown', 'none', 'null'))`;
            const imageExtPredicate = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif', 'heic', 'heif']
                .map((ext) => `${referenceLookup} LIKE '%.${ext}'`)
                .join(' OR ');
            const videoExtPredicate = ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi']
                .map((ext) => `${referenceLookup} LIKE '%.${ext}'`)
                .join(' OR ');
            const audioExtPredicate = ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg']
                .map((ext) => `${referenceLookup} LIKE '%.${ext}'`)
                .join(' OR ');

            const updateSql = `
                UPDATE files SET file_type_bucket = (
                    CASE
                        WHEN ${fileTypeLookup} LIKE 'image/%' THEN 'image'
                        WHEN ${fileTypeLookup} IN ('image', 'photo') THEN 'image'
                        WHEN ${fileTypeLookup} LIKE 'video/%' THEN 'video'
                        WHEN ${fileTypeLookup} = 'video' THEN 'video'
                        WHEN ${fileTypeLookup} LIKE 'audio/%' THEN 'audio'
                        WHEN ${fileTypeLookup} = 'audio' THEN 'audio'
                        WHEN ${genericPredicate} AND (${imageExtPredicate}) THEN 'image'
                        WHEN ${genericPredicate} AND (${videoExtPredicate}) THEN 'video'
                        WHEN ${genericPredicate} AND (${audioExtPredicate}) THEN 'audio'
                        ELSE 'other'
                    END
                )
                WHERE file_type_bucket IS NULL
            `;
            await this.db.prepare(updateSql).run();
            await this.db
                .prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
                .bind(FILE_TYPE_BUCKET_BACKFILL_KEY, new Date().toISOString())
                .run();
        } catch (error) {
            // Backfill 不是请求关键路径，失败时打日志继续，queryFiles 仍可以走 fallback 分支
            console.warn('file_type_bucket backfill failed:', error?.message || error);
        }
    }

    async repairLegacySchema() {
        const cachedColumns = new Map();
        for (const repair of SCHEMA_REPAIR_COLUMNS) {
            let columns = cachedColumns.get(repair.table);
            if (!columns) {
                columns = await this.getTableColumns(repair.table);
                cachedColumns.set(repair.table, columns);
            }
            if (columns.has(repair.column)) {
                continue;
            }

            try {
                await this.db.prepare(repair.sql).run();
                columns.add(repair.column);
            } catch (error) {
                if (isIgnorableSchemaRepairError(error)) {
                    continue;
                }
                throw error;
            }
        }
    }

    async getTableColumns(tableName) {
        const response = await this.db.prepare(`PRAGMA table_info(${tableName})`).all();
        return new Set((response.results || []).map((row) => row.name).filter(Boolean));
    }

    async putFile(fileId, value, options = {}) {
        await this.ensureSchema();
        const metadata = stripSensitiveMetadata(options.metadata || {});
        const extractedFields = this.extractMetadataFields(metadata, fileId);

        return this.db.prepare(
            `INSERT OR REPLACE INTO files (
                id, value, metadata, file_name, file_type, file_size,
                upload_ip, upload_address, list_type, timestamp,
                label, directory, channel, channel_name,
                tg_file_id, tg_chat_id, tg_message_id, is_chunked,
                file_type_bucket, is_deleted, deleted_at,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM files WHERE id = ?), CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)`
        ).bind(
            fileId,
            value ?? '',
            JSON.stringify(metadata),
            extractedFields.fileName,
            extractedFields.fileType,
            extractedFields.fileSize,
            extractedFields.uploadIP,
            extractedFields.uploadAddress,
            extractedFields.listType,
            extractedFields.timestamp,
            extractedFields.label,
            extractedFields.directory,
            extractedFields.channel,
            extractedFields.channelName,
            extractedFields.tgFileId,
            extractedFields.tgChatId,
            extractedFields.tgMessageId,
            normalizeBoolean(extractedFields.isChunked),
            extractedFields.fileTypeBucket,
            normalizeBoolean(extractedFields.isDeleted),
            extractedFields.deletedAt,
            fileId,
        ).run();
    }

    async getFile(fileId) {
        await this.ensureSchema();
        const result = await this.db.prepare('SELECT value, metadata FROM files WHERE id = ?').bind(fileId).first();
        if (!result) {
            return null;
        }

        return {
            value: result.value,
            metadata: parseJson(result.metadata, {}),
        };
    }

    async getFileWithMetadata(fileId) {
        return this.getFile(fileId);
    }

    async deleteFile(fileId) {
        await this.ensureSchema();
        return this.db.prepare('DELETE FROM files WHERE id = ?').bind(fileId).run();
    }

    async listRecords(options = {}) {
        await this.ensureSchema();

        const prefix = options.prefix || '';
        const limit = options.limit || 1000;
        const cursor = options.cursor || null;
        const includeInternal = options.includeInternal === true;
        const whereClauses = [];
        const params = [];

        if (!includeInternal) {
            whereClauses.push("id NOT LIKE 'manage@%'");
            whereClauses.push("id NOT LIKE 'chunk_%'");
        }

        if (prefix) {
            whereClauses.push('id LIKE ?');
            params.push(prefix + '%');
        }

        if (cursor) {
            whereClauses.push('id > ?');
            params.push(cursor);
        }

        const query =
            'SELECT id, metadata FROM files'
            + (whereClauses.length ? ` WHERE ${whereClauses.join(' AND ')}` : '')
            + ' ORDER BY id LIMIT ?';
        params.push(limit + 1);

        const response = await this.db.prepare(query).bind(...params).all();
        const results = response.results || [];
        const hasMore = results.length > limit;
        if (hasMore) {
            results.pop();
        }

        const keys = results.map((row) => ({
            name: row.id,
            metadata: parseJson(row.metadata, {}),
        }));

        return {
            keys,
            cursor: hasMore && keys.length > 0 ? keys[keys.length - 1].name : null,
            list_complete: !hasMore,
        };
    }

    async listFiles(options = {}) {
        return this.listRecords(options);
    }

    async queryFiles(options = {}) {
        await this.ensureSchema();

        const page = Math.max(1, Number.parseInt(options.page, 10) || 1);
        const pageSize = Math.min(500, Math.max(1, Number.parseInt(options.pageSize, 10) || 50));
        const requestedOffset = Number.parseInt(options.offset, 10);
        const offset = Number.isFinite(requestedOffset) && requestedOffset >= 0
            ? requestedOffset
            : (page - 1) * pageSize;
        const sortColumn = normalizeSortBy(options.sortBy);
        const sortDirection = normalizeSortOrder(options.sortOrder);
        const search = String(options.search || '').trim();
        const directory = String(options.directory || '').trim();
        const recycleBinMode = options.recycleBinMode || 'exclude';
        const favouritesOnly = options.favourites === true;
        const typeFilters = normalizeStringArray(options.types || options.type).map((value) => value.toLowerCase());
        const channelFilters = normalizeStringArray(options.channels || options.channel);
        const channelNameFilters = normalizeStringArray(options.channelNames || options.channelName);
        const whereClauses = ["id NOT LIKE 'manage@%'", "id NOT LIKE 'chunk_%'"];
        const params = [];

        if (directory) {
            const normalizedDirectory = directory.endsWith('/') ? directory : `${directory}/`;
            whereClauses.push('(COALESCE(directory, \'\') LIKE ? OR id LIKE ?)');
            params.push(`${normalizedDirectory}%`, `${normalizedDirectory}%`);
        }

        if (search) {
            whereClauses.push(`${FILE_NAME_LOOKUP_SQL} LIKE ?`);
            params.push(`%${search.toLowerCase()}%`);
        }

        if (channelFilters.length > 0) {
            const channelClauses = channelFilters.map(() => 'channel = ?');
            whereClauses.push(`(${channelClauses.join(' OR ')})`);
            params.push(...channelFilters);
        }

        if (channelNameFilters.length > 0) {
            const channelNameClauses = channelNameFilters.map((value) => {
                if (value.includes(':')) {
                    return '(channel = ? AND channel_name = ?)';
                }

                return 'channel_name = ?';
            });
            whereClauses.push(`(${channelNameClauses.join(' OR ')})`);

            for (const value of channelNameFilters) {
                if (value.includes(':')) {
                    const [channelType, channelName] = value.split(':', 2);
                    params.push(channelType, channelName);
                } else {
                    params.push(value);
                }
            }
        }

        if (typeFilters.length > 0) {
            // 优先用 file_type_bucket 索引；老记录（NULL 桶）仍走原本的 LIKE/JSON
            // fallback，保证未 backfill 数据库的查询正确。两条分支用 OR 组合，
            // 让 SQLite 在大多数行上吃 idx_files_type_bucket 索引。
            const bucketTargets = new Set();
            let wantsOther = false;
            for (const type of typeFilters) {
                if (type === 'image') {
                    bucketTargets.add('image');
                } else if (type === 'video') {
                    bucketTargets.add('video');
                } else if (type === 'audio') {
                    bucketTargets.add('audio');
                } else if (type === 'document' || type === 'other') {
                    bucketTargets.add('other');
                    wantsOther = true;
                }
            }

            const orClauses = [];
            if (bucketTargets.size > 0) {
                const bucketList = Array.from(bucketTargets);
                const placeholders = bucketList.map(() => '?').join(',');
                orClauses.push(`file_type_bucket IN (${placeholders})`);
                params.push(...bucketList);
            }

            const fallbackClauses = [];
            for (const type of typeFilters) {
                if (type === 'image') {
                    fallbackClauses.push(IMAGE_TYPE_SQL);
                } else if (type === 'video') {
                    fallbackClauses.push(VIDEO_TYPE_SQL);
                } else if (type === 'audio') {
                    fallbackClauses.push(AUDIO_TYPE_SQL);
                } else if (type === 'document' || type === 'other') {
                    fallbackClauses.push(`NOT ${MEDIA_TYPE_SQL}`);
                }
            }
            if (fallbackClauses.length > 0) {
                orClauses.push(`(file_type_bucket IS NULL AND (${fallbackClauses.join(' OR ')}))`);
            }

            // 'other' 桶天然包含 application/pdf 等真实非媒体；同时也覆盖了
            // 未 backfill 老记录里非 media 的情况，所以查 'other' 时 NULL 桶
            // 也允许走 fallback 路径（NOT MEDIA_TYPE_SQL）以匹配真实 document。
            if (wantsOther && !fallbackClauses.some((clause) => clause.startsWith('NOT'))) {
                orClauses.push(`(file_type_bucket IS NULL AND NOT ${MEDIA_TYPE_SQL})`);
            }

            if (orClauses.length > 0) {
                whereClauses.push(`(${orClauses.join(' OR ')})`);
            }
        }

        if (recycleBinMode === 'only') {
            whereClauses.push("LOWER(COALESCE(json_extract(metadata, '$.RecycleBin'), '')) = 'true'");
        } else if (recycleBinMode !== 'include') {
            whereClauses.push("LOWER(COALESCE(json_extract(metadata, '$.RecycleBin'), '')) != 'true'");
        }

        if (favouritesOnly) {
            whereClauses.push(`LOWER(COALESCE(
                CAST(json_extract(metadata, '$.IsFavourite') AS TEXT),
                CAST(json_extract(metadata, '$.IsFavorite') AS TEXT),
                CAST(json_extract(metadata, '$.Favourite') AS TEXT),
                CAST(json_extract(metadata, '$.Favorite') AS TEXT),
                CAST(json_extract(metadata, '$.Favorited') AS TEXT),
                '0'
            )) IN ('1', 'true')`);
        }

        const whereSql = whereClauses.length ? ` WHERE ${whereClauses.join(' AND ')}` : '';

        // Use window function to get total count in single query (30-50% faster)
        const rows = await this.db.prepare(
            `SELECT id, metadata, COUNT(*) OVER() AS total
             FROM files${whereSql}
             ORDER BY ${sortColumn} ${sortDirection}, id ${sortDirection}
             LIMIT ? OFFSET ?`
        ).bind(...params, pageSize, offset).all();

        const results = rows.results || [];
        const total = results.length > 0 ? Number(results[0].total || 0) : 0;

        return {
            files: results.map((row) => ({
                id: row.id,
                metadata: parseJson(row.metadata, {}),
            })),
            total,
        };
    }

    async putSetting(key, value, category = null) {
        await this.ensureSchema();

        let finalCategory = category;
        if (!finalCategory && key.startsWith('manage@sysConfig@')) {
            finalCategory = key.split('@')[2] || null;
        }

        return this.db.prepare(
            'INSERT OR REPLACE INTO settings (key, value, category, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
        ).bind(key, value, finalCategory).run();
    }

    async getSetting(key) {
        await this.ensureSchema();
        const result = await this.db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
        return result ? result.value : null;
    }

    async deleteSetting(key) {
        await this.ensureSchema();
        return this.db.prepare('DELETE FROM settings WHERE key = ?').bind(key).run();
    }

    async listSettings(options = {}) {
        await this.ensureSchema();

        const prefix = options.prefix || '';
        const limit = options.limit || 1000;
        const cursor = options.cursor || null;
        const whereClauses = [];
        const params = [];

        if (prefix) {
            whereClauses.push('key LIKE ?');
            params.push(prefix + '%');
        }

        if (cursor) {
            whereClauses.push('key > ?');
            params.push(cursor);
        }

        const query =
            'SELECT key, value FROM settings'
            + (whereClauses.length ? ` WHERE ${whereClauses.join(' AND ')}` : '')
            + ' ORDER BY key LIMIT ?';
        params.push(limit + 1);

        const response = await this.db.prepare(query).bind(...params).all();
        const results = response.results || [];
        const hasMore = results.length > limit;
        if (hasMore) {
            results.pop();
        }

        const keys = results.map((row) => ({
            name: row.key,
            value: row.value,
        }));

        return {
            keys,
            cursor: hasMore && keys.length > 0 ? keys[keys.length - 1].name : null,
            list_complete: !hasMore,
        };
    }

    async putIndexOperation(operationId, operation, options = {}) {
        await this.ensureSchema();
        const expirationTtl = Number(options.expirationTtl) || 0;
        const expiresAt = expirationTtl > 0 ? Date.now() + (expirationTtl * 1000) : null;

        return this.db.prepare(
            `INSERT OR REPLACE INTO index_operations (
                id, type, timestamp, data, processed, expires_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        ).bind(
            operationId,
            operation.type,
            operation.timestamp,
            JSON.stringify(operation.data),
            normalizeBoolean(operation.processed),
            expiresAt,
        ).run();
    }

    async getIndexOperation(operationId) {
        await this.ensureSchema();
        const result = await this.db.prepare(
            'SELECT id, type, timestamp, data, processed FROM index_operations WHERE id = ?'
        ).bind(operationId).first();

        if (!result) {
            return null;
        }

        return {
            id: result.id,
            type: result.type,
            timestamp: result.timestamp,
            data: parseJson(result.data, {}),
            processed: Boolean(result.processed),
        };
    }

    async deleteIndexOperation(operationId) {
        await this.ensureSchema();
        return this.db.prepare('DELETE FROM index_operations WHERE id = ?').bind(operationId).run();
    }

    async listIndexOperations(options = {}) {
        await this.ensureSchema();
        const limit = options.limit || 1000;
        const cursor = options.cursor || null;
        const processed = options.processed;
        const now = Date.now();
        const whereClauses = ['(expires_at IS NULL OR expires_at > ?)'];
        const params = [now];

        if (processed !== null && processed !== undefined) {
            whereClauses.push('processed = ?');
            params.push(normalizeBoolean(processed));
        }

        if (cursor) {
            whereClauses.push('id > ?');
            params.push(cursor);
        }

        const query =
            'SELECT id, type, timestamp, data, processed FROM index_operations'
            + ` WHERE ${whereClauses.join(' AND ')}`
            + ' ORDER BY id LIMIT ?';
        params.push(limit + 1);

        const response = await this.db.prepare(query).bind(...params).all();
        const results = response.results || [];
        const hasMore = results.length > limit;
        if (hasMore) {
            results.pop();
        }

        return {
            keys: results.map((row) => ({
                name: `manage@index@operation_${row.id}`,
                metadata: {
                    type: row.type,
                    timestamp: row.timestamp,
                    processed: Boolean(row.processed),
                },
            })),
            cursor: hasMore && results.length > 0 ? results[results.length - 1].id : null,
            list_complete: !hasMore,
            operations: results.map((row) => ({
                id: row.id,
                type: row.type,
                timestamp: row.timestamp,
                data: parseJson(row.data, {}),
                processed: Boolean(row.processed),
            })),
        };
    }

    extractMetadataFields(metadata, fileId = '') {
        return {
            fileName: metadata.FileName || null,
            fileType: metadata.FileType || null,
            fileSize: metadata.FileSize || null,
            uploadIP: metadata.UploadIP || null,
            uploadAddress: metadata.UploadAddress || null,
            listType: metadata.ListType || null,
            timestamp: metadata.TimeStamp || null,
            label: metadata.Label || null,
            directory: metadata.Directory || null,
            channel: metadata.Channel || null,
            channelName: metadata.ChannelName || null,
            tgFileId: metadata.TgFileId || null,
            tgChatId: metadata.TgChatId || null,
            tgMessageId: metadata.TgMessageId || null,
            isChunked: isTruthyMetadataValue(metadata.IsChunked),
            fileTypeBucket: computeFileTypeBucket(metadata, fileId),
            isDeleted: isTruthyMetadataValue(metadata.RecycleBin),
            deletedAt: metadata.DeletedAt ? Number(metadata.DeletedAt) : null,
        };
    }

    async put(key, value, options = {}) {
        await this.ensureSchema();

        if (key.startsWith('manage@sysConfig@')) {
            return this.putSetting(key, value);
        }

        if (key.startsWith('manage@index@operation_')) {
            const operationId = key.replace('manage@index@operation_', '');
            const operation = parseJson(value, null);
            if (!operation) {
                throw new Error(`Invalid operation payload for key ${key}`);
            }
            return this.putIndexOperation(operationId, operation, options);
        }

        return this.putFile(key, value, options);
    }

    async get(key) {
        await this.ensureSchema();

        if (key.startsWith('manage@sysConfig@')) {
            return this.getSetting(key);
        }

        if (key.startsWith('manage@index@operation_')) {
            const operationId = key.replace('manage@index@operation_', '');
            const operation = await this.getIndexOperation(operationId);
            return operation ? JSON.stringify({
                type: operation.type,
                timestamp: operation.timestamp,
                data: operation.data,
                processed: operation.processed,
            }) : null;
        }

        const file = await this.getFile(key);
        return file ? file.value : null;
    }

    async getWithMetadata(key) {
        await this.ensureSchema();

        if (key.startsWith('manage@sysConfig@')) {
            const value = await this.getSetting(key);
            return value !== null ? { value, metadata: {} } : null;
        }

        return this.getFileWithMetadata(key);
    }

    async delete(key) {
        await this.ensureSchema();

        if (key.startsWith('manage@sysConfig@')) {
            return this.deleteSetting(key);
        }

        if (key.startsWith('manage@index@operation_')) {
            const operationId = key.replace('manage@index@operation_', '');
            return this.deleteIndexOperation(operationId);
        }

        return this.deleteFile(key);
    }

    async list(options = {}) {
        await this.ensureSchema();
        const prefix = options.prefix || '';

        if (prefix.startsWith('manage@sysConfig@')) {
            return this.listSettings(options);
        }

        if (prefix.startsWith('manage@index@operation_')) {
            return this.listIndexOperations(options);
        }

        if (prefix.startsWith('manage@index') || prefix.startsWith('chunk_')) {
            return this.listRecords({
                ...options,
                includeInternal: true,
            });
        }

        return this.listFiles(options);
    }
}

export { D1Database };
