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
];

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

class D1Database {
    constructor(db) {
        this.db = db;
        this.schemaReady = null;
    }

    async ensureSchema() {
        if (!this.schemaReady) {
            this.schemaReady = (async () => {
                for (const sql of SCHEMA_STATEMENTS) {
                    await this.db.prepare(sql).run();
                }
            })();
        }

        return this.schemaReady;
    }

    async putFile(fileId, value, options = {}) {
        await this.ensureSchema();
        const metadata = stripSensitiveMetadata(options.metadata || {});
        const extractedFields = this.extractMetadataFields(metadata);

        return this.db.prepare(
            `INSERT OR REPLACE INTO files (
                id, value, metadata, file_name, file_type, file_size,
                upload_ip, upload_address, list_type, timestamp,
                label, directory, channel, channel_name,
                tg_file_id, tg_chat_id, tg_message_id, is_chunked,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM files WHERE id = ?), CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)`
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

    extractMetadataFields(metadata) {
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
            isChunked: metadata.IsChunked || false,
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
