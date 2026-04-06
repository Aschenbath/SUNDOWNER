import { getDatabase } from './databaseAdapter.js';
import { removeFileFromIndex } from './indexManager.js';
import { permanentlyDeleteFileRecord } from './mediaDeletion.js';

export const RECYCLE_BIN_RETENTION_DAYS = 45;
export const RECYCLE_BIN_RETENTION_MS = RECYCLE_BIN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const MAX_SCAN_BATCH = 500;

export function isRecycleBinMetadata(metadata = {}) {
    return String(metadata?.RecycleBin || '').toLowerCase() === 'true';
}

export function getDeletedAt(metadata = {}) {
    const raw = Number(metadata?.DeletedAt || 0);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

export function markRecycleBinMetadata(metadata = {}, deletedAt = Date.now()) {
    return {
        ...metadata,
        RecycleBin: 'true',
        DeletedAt: String(deletedAt)
    };
}

export function restoreRecycleBinMetadata(metadata = {}) {
    const nextMetadata = { ...metadata };
    delete nextMetadata.RecycleBin;
    delete nextMetadata.DeletedAt;
    return nextMetadata;
}

export function isExpiredRecycleBinMetadata(metadata = {}, now = Date.now()) {
    if (!isRecycleBinMetadata(metadata)) {
        return false;
    }
    const deletedAt = getDeletedAt(metadata);
    return deletedAt > 0 && deletedAt <= now - RECYCLE_BIN_RETENTION_MS;
}

export async function listRecycleBinRecords(env, options = {}) {
    const {
        expiredOnly = false,
        limit = 64,
        now = Date.now()
    } = options;
    const db = getDatabase(env);
    const records = [];
    let cursor = null;

    while (records.length < limit) {
        const response = await db.list({
            prefix: '',
            limit: MAX_SCAN_BATCH,
            cursor
        });

        if (!response || !Array.isArray(response.keys)) {
            break;
        }

        for (const item of response.keys) {
            if (!item?.name || item.name.startsWith('manage@') || item.name.startsWith('chunk_')) {
                continue;
            }
            if (!isRecycleBinMetadata(item.metadata || {})) {
                continue;
            }
            if (expiredOnly && !isExpiredRecycleBinMetadata(item.metadata || {}, now)) {
                continue;
            }
            records.push(item);
            if (records.length >= limit) {
                break;
            }
        }

        cursor = response.cursor;
        if (!cursor) {
            break;
        }
    }

    return records;
}

export async function cleanupExpiredRecycleBin(context, options = {}) {
    const {
        limit = 24,
        now = Date.now()
    } = options;

    const records = await listRecycleBinRecords(context.env, {
        expiredOnly: true,
        limit,
        now
    });

    if (!records.length) {
        return { deleted: 0, failed: 0 };
    }

    let deleted = 0;
    let failed = 0;

    for (const record of records) {
        const ok = await permanentlyDeleteFileRecord(context, record.name);
        if (ok) {
            await removeFileFromIndex(context, record.name);
            deleted++;
        } else {
            failed++;
        }
    }

    return { deleted, failed };
}
