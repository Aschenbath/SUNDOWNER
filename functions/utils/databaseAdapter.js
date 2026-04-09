import { D1Database } from './d1Database.js';
import { stripSensitiveMetadata } from './mediaSecurity.js';

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

function sanitizeOptionsForPut(key, options = {}) {
    if (!String(key).startsWith('manage@') && options.metadata) {
        return {
            ...options,
            metadata: stripSensitiveMetadata(options.metadata),
        };
    }

    return options;
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
        return this.kv.put(key, value, sanitizeOptionsForPut(key, options));
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
}

class HybridAdapter {
    constructor(kv, d1) {
        this.kv = kv;
        this.d1 = d1;
    }

    async put(key, value, options = {}) {
        const sanitizedOptions = sanitizeOptionsForPut(key, options);

        if (isSettingsKey(key)) {
            await Promise.all([
                this.kv.put(key, value, sanitizedOptions),
                this.d1.put(key, value, sanitizedOptions),
            ]);
            return;
        }

        if (isIndexOperationKey(key) || isInternalIndexKey(key)) {
            return this.d1.put(key, value, sanitizedOptions);
        }

        if (shouldPersistFileMetadataInD1(key)) {
            await Promise.all([
                this.kv.put(key, value, sanitizedOptions),
                this.d1.put(key, '', sanitizedOptions),
            ]);
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
            await Promise.allSettled([
                this.kv.delete(key, options),
                this.d1.delete(key),
            ]);
            return;
        }

        if (isIndexOperationKey(key) || isInternalIndexKey(key)) {
            return this.d1.delete(key);
        }

        if (shouldPersistFileMetadataInD1(key)) {
            await Promise.allSettled([
                this.kv.delete(key, options),
                this.d1.delete(key),
            ]);
            return;
        }

        return this.kv.delete(key, options);
    }

    async list(options = {}) {
        const prefix = options.prefix || '';

        if (isSettingsKey(prefix) || isIndexOperationKey(prefix) || isInternalIndexKey(prefix) || (!prefix || shouldPersistFileMetadataInD1(prefix))) {
            return this.d1.list(options);
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
