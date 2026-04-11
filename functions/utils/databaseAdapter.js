import { D1Database } from './d1Database.js';
import { stripSensitiveMetadata } from './mediaSecurity.js';

export const KV_TO_D1_MIGRATION_STATE_KEY = 'manage@sysConfig@kvToD1Migration';

function hasKVBinding(env) {
    return Boolean(env?.img_url && typeof env.img_url.get === 'function');
}

function hasD1Binding(env) {
    return Boolean(env?.img_d1 && typeof env.img_d1.prepare === 'function');
}

function isSettingsKey(key) {
    return String(key).startsWith('manage@sysConfig@');
}

function isIndexOperationKey(key) {
    return String(key).startsWith('manage@index@operation_');
}

function isInternalIndexKey(key) {
    return String(key).startsWith('manage@index');
}

function isTransientChunkKey(key) {
    return String(key).startsWith('chunk_');
}

function shouldPersistFileMetadataInD1(key) {
    return !String(key).startsWith('manage@') && !isTransientChunkKey(key);
}

const KV_METADATA_CORE_KEYS = [
    'FileName', 'FileType', 'FileSize', 'TimeStamp', 'Label', 'Directory',
    'Channel', 'ChannelName', 'ListType', 'Width', 'Height',
    'TgFileId', 'TgChatId', 'TgMessageId', 'TgFileUniqueId',
    'Album', 'TgAlbumPath', 'Description',
];

function trimMetadataForKV(metadata) {
    const trimmed = {};
    for (const key of KV_METADATA_CORE_KEYS) {
        if (metadata[key] !== undefined && metadata[key] !== null) {
            trimmed[key] = metadata[key];
        }
    }
    return trimmed;
}

function sanitizeOptionsForPut(key, options = {}) {
    if (!String(key).startsWith('manage@') && options.metadata) {
        return {
            ...options,
            metadata: stripSensitiveMetadata(options.metadata),
        };
    }

    return options;
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

export function createDatabaseAdapter(env) {
    const hasKV = hasKVBinding(env);
    const hasD1 = hasD1Binding(env);

    if (hasKV && hasD1) {
        return new HybridAdapter(env.img_url, new D1Database(env.img_d1));
    }

    if (hasD1) {
        return new D1Database(env.img_d1);
    }

    if (hasKV) {
        return new KVAdapter(env.img_url);
    }

    console.error('No database configured. Please configure either KV (env.img_url) or D1 (env.img_d1).');
    return null;
}

class KVAdapter {
    constructor(kv) {
        this.kv = kv;
    }

    async put(key, value, options = {}) {
        const sanitized = sanitizeOptionsForPut(key, options);
        if (!String(key).startsWith('manage@') && sanitized.metadata) {
            sanitized.metadata = trimMetadataForKV(sanitized.metadata);
        }
        return this.kv.put(key, value, sanitized);
    }

    async get(key, options = {}) {
        return this.kv.get(key, options.type);
    }

    async getWithMetadata(key, options = {}) {
        return this.kv.getWithMetadata(key, options.type);
    }

    async delete(key, options = {}) {
        return this.kv.delete(key, options);
    }

    async list(options = {}) {
        return this.kv.list(options);
    }

    async putFile(fileId, value, options) {
        return this.put(fileId, value, options);
    }

    async getFile(fileId, options) {
        return this.getWithMetadata(fileId, options);
    }

    async getFileWithMetadata(fileId, options) {
        return this.getWithMetadata(fileId, options);
    }

    async deleteFile(fileId, options) {
        return this.delete(fileId, options);
    }

    async listFiles(options) {
        return this.list(options);
    }

    async putSetting(key, value, options) {
        return this.put(key, value, options);
    }

    async getSetting(key, options) {
        return this.get(key, options);
    }

    async deleteSetting(key, options) {
        return this.delete(key, options);
    }

    async listSettings(options) {
        return this.list(options);
    }

    async putIndexOperation(operationId, operation, options) {
        return this.put(`manage@index@operation_${operationId}`, JSON.stringify(operation), options);
    }

    async getIndexOperation(operationId, options) {
        const result = await this.get(`manage@index@operation_${operationId}`, options);
        return result ? JSON.parse(result) : null;
    }

    async deleteIndexOperation(operationId, options) {
        return this.delete(`manage@index@operation_${operationId}`, options);
    }

    async listIndexOperations(options = {}) {
        const result = await this.list({
            ...options,
            prefix: 'manage@index@operation_',
        });

        const operations = [];
        for (const item of result.keys || []) {
            const value = await this.get(item.name);
            if (!value) {
                continue;
            }

            const operation = JSON.parse(value);
            operations.push({
                id: item.name.replace('manage@index@operation_', ''),
                type: operation.type,
                timestamp: operation.timestamp,
                data: operation.data,
                processed: Boolean(operation.processed),
            });
        }

        return operations;
    }

    async queryFiles() {
        throw new Error('queryFiles is only available when D1 is configured');
    }
}

class HybridAdapter {
    constructor(kv, d1) {
        this.kv = kv;
        this.d1 = d1;
        this._migrationStatusPromise = null;
    }

    async snapshotD1Record(key) {
        return this.d1.getWithMetadata(key);
    }

    async restoreD1Record(key, snapshot) {
        if (!snapshot) {
            await this.d1.delete(key);
            return;
        }

        await this.d1.put(key, snapshot.value ?? '', {
            metadata: snapshot.metadata || {},
        });
    }

    async putWithRollback(key, d1Value, kvValue, options = {}) {
        const snapshot = await this.snapshotD1Record(key);
        await this.d1.put(key, d1Value, options);

        const kvOptions = options.metadata
            ? { ...options, metadata: trimMetadataForKV(stripSensitiveMetadata(options.metadata)) }
            : options;

        try {
            await this.kv.put(key, kvValue, kvOptions);
        } catch (error) {
            try {
                await this.restoreD1Record(key, snapshot);
            } catch (rollbackError) {
                console.error(`Failed to roll back D1 state for ${key}:`, rollbackError);
            }

            throw error;
        }
    }

    async deleteWithRollback(key, options = {}) {
        const snapshot = await this.snapshotD1Record(key);
        await this.d1.delete(key);

        try {
            await this.kv.delete(key, options);
        } catch (error) {
            try {
                await this.restoreD1Record(key, snapshot);
            } catch (rollbackError) {
                console.error(`Failed to roll back D1 delete for ${key}:`, rollbackError);
            }

            throw error;
        }
    }

    async getMigrationStatus() {
        if (!this._migrationStatusPromise) {
            this._migrationStatusPromise = this.d1.get(KV_TO_D1_MIGRATION_STATE_KEY)
                .then((rawValue) => parseMigrationStatus(rawValue));
        }

        return this._migrationStatusPromise;
    }

    async put(key, value, options = {}) {
        const sanitizedOptions = sanitizeOptionsForPut(key, options);

        if (isSettingsKey(key)) {
            await this.putWithRollback(key, value, value, sanitizedOptions);
            return;
        }

        if (isIndexOperationKey(key) || isInternalIndexKey(key)) {
            return this.d1.put(key, value, sanitizedOptions);
        }

        if (shouldPersistFileMetadataInD1(key)) {
            await this.putWithRollback(key, '', value, sanitizedOptions);
            return;
        }

        return this.kv.put(key, value, sanitizedOptions);
    }

    async get(key, options = {}) {
        if (isSettingsKey(key) || isIndexOperationKey(key) || isInternalIndexKey(key)) {
            const d1Value = await this.d1.get(key);
            if (d1Value !== null && d1Value !== undefined) {
                return d1Value;
            }

            return this.kv.get(key, options.type);
        }

        return this.kv.get(key, options.type);
    }

    async getWithMetadata(key, options = {}) {
        if (isSettingsKey(key) || isIndexOperationKey(key) || isInternalIndexKey(key)) {
            const d1Value = await this.d1.getWithMetadata(key);
            if (d1Value) {
                return d1Value;
            }

            return this.kv.getWithMetadata(key, options.type);
        }

        if (shouldPersistFileMetadataInD1(key)) {
            const [value, d1Record] = await Promise.all([
                this.kv.get(key, options.type),
                this.d1.getWithMetadata(key),
            ]);

            if (value === null && !d1Record) {
                return null;
            }

            if (d1Record) {
                return {
                    value,
                    metadata: d1Record.metadata || {},
                };
            }
        }

        return this.kv.getWithMetadata(key, options.type);
    }

    async delete(key, options = {}) {
        if (isSettingsKey(key)) {
            await this.deleteWithRollback(key, options);
            return;
        }

        if (isIndexOperationKey(key) || isInternalIndexKey(key)) {
            return this.d1.delete(key);
        }

        if (shouldPersistFileMetadataInD1(key)) {
            await this.deleteWithRollback(key, options);
            return;
        }

        return this.kv.delete(key, options);
    }

    async list(options = {}) {
        const prefix = options.prefix || '';

        if (isSettingsKey(prefix) || isIndexOperationKey(prefix) || isInternalIndexKey(prefix)) {
            return this.d1.list(options);
        }

        if (!prefix || shouldPersistFileMetadataInD1(prefix)) {
            const migrationStatus = await this.getMigrationStatus();
            if (migrationStatus?.complete === true) {
                return this.d1.list(options);
            }

            return this.kv.list(options);
        }

        return this.kv.list(options);
    }

    async putFile(fileId, value, options) {
        return this.put(fileId, value, options);
    }

    async getFile(fileId, options) {
        return this.getWithMetadata(fileId, options);
    }

    async getFileWithMetadata(fileId, options) {
        return this.getWithMetadata(fileId, options);
    }

    async deleteFile(fileId, options) {
        return this.delete(fileId, options);
    }

    async listFiles(options) {
        return this.list(options);
    }

    async putSetting(key, value, options) {
        return this.put(key, value, options);
    }

    async getSetting(key, options) {
        return this.get(key, options);
    }

    async deleteSetting(key, options) {
        return this.delete(key, options);
    }

    async listSettings(options) {
        return this.list(options);
    }

    async putIndexOperation(operationId, operation, options) {
        return this.put(`manage@index@operation_${operationId}`, JSON.stringify(operation), options);
    }

    async getIndexOperation(operationId, options) {
        const result = await this.get(`manage@index@operation_${operationId}`, options);
        return result ? JSON.parse(result) : null;
    }

    async deleteIndexOperation(operationId, options) {
        return this.delete(`manage@index@operation_${operationId}`, options);
    }

    async listIndexOperations(options = {}) {
        const response = await this.d1.listIndexOperations(options);
        return response.operations || [];
    }

    async queryFiles(options = {}) {
        return this.d1.queryFiles(options);
    }
}

export function getDatabase(env) {
    const adapter = createDatabaseAdapter(env);
    if (!adapter) {
        throw new Error('Database not configured. Please configure D1 database (env.img_d1) or KV storage (env.img_url).');
    }
    return adapter;
}

export function checkDatabaseConfig(env) {
    const hasD1 = hasD1Binding(env);
    const hasKV = hasKVBinding(env);

    return {
        hasD1,
        hasKV,
        usingD1: hasD1,
        usingKV: hasKV,
        usingHybrid: hasD1 && hasKV,
        configured: hasD1 || hasKV,
    };
}
