import assert from 'node:assert/strict';

import { onRequest as listRoute } from '../functions/api/manage/list.js';
import { onRequest as migrateKvToD1 } from '../functions/api/manage/migrate/kv-to-d1.js';
import { KV_TO_D1_MIGRATION_STATE_KEY, getDatabase } from '../functions/utils/databaseAdapter.js';
import { D1Database } from '../functions/utils/d1Database.js';
import { addFileToIndex, deleteAllOperations, getIndexMeta, readIndex } from '../functions/utils/indexManager.js';
import { SqliteD1 } from '../server/sqliteD1.js';

class MemoryKV {
    constructor() {
        this.store = new Map();
        this.metadata = new Map();
        this.putCalls = [];
        this.listCalls = [];
        this.failPuts = new Set();
        this.failDeletes = new Set();
    }

    async put(key, value, options = {}) {
        if (this.failPuts.has(key)) {
            throw new Error(`KV put failed for ${key}`);
        }

        this.store.set(key, value);
        this.metadata.set(key, options.metadata || null);
        this.putCalls.push({ key, value, options });
    }

    async get(key) {
        return this.store.has(key) ? this.store.get(key) : null;
    }

    async getWithMetadata(key) {
        if (!this.store.has(key)) {
            return null;
        }

        return {
            value: this.store.get(key),
            metadata: this.metadata.get(key) || {},
        };
    }

    async delete(key) {
        if (this.failDeletes.has(key)) {
            throw new Error(`KV delete failed for ${key}`);
        }

        this.store.delete(key);
        this.metadata.delete(key);
    }

    async list(options = {}) {
        this.listCalls.push(options);
        const prefix = options.prefix || '';
        const limit = options.limit || 1000;
        const cursor = options.cursor || null;
        const keys = [...this.store.keys()]
            .filter((key) => key.startsWith(prefix))
            .sort()
            .filter((key) => !cursor || key > cursor);

        const page = keys.slice(0, limit + 1);
        const hasMore = page.length > limit;
        if (hasMore) {
            page.pop();
        }

        return {
            keys: page.map((name) => ({
                name,
                metadata: this.metadata.get(name) || {},
            })),
            cursor: hasMore && page.length > 0 ? page[page.length - 1] : null,
            list_complete: !hasMore,
        };
    }
}

function createContext(env, request = new Request('https://example.com/api/manage/list')) {
    return {
        env,
        request,
        waitUntil(promise) {
            return promise;
        },
    };
}

function createIndexChunk(files) {
    return JSON.stringify(files.map((file) => ({
        id: file.id,
        metadata: file.metadata,
    })));
}

async function seedD1File(d1, id, metadata = {}) {
    await d1.put(id, '', {
        metadata: {
            FileName: metadata.FileName || id.split('/').pop(),
            FileType: metadata.FileType || 'image/jpeg',
            TimeStamp: metadata.TimeStamp || 1,
            Directory: metadata.Directory || 'photos/',
            ...metadata,
        },
    });
}

describe('D1 metadata migration path', () => {
    it('reads metadata from D1 while keeping file values in KV', async () => {
        const env = {
            img_url: new MemoryKV(),
            img_d1: new SqliteD1(':memory:'),
        };
        const db = getDatabase(env);
        const context = createContext(env);

        await db.put('photos/a.jpg', 'file-a', {
            metadata: {
                FileName: 'a.jpg',
                FileType: 'image/jpeg',
                TimeStamp: 200,
                Directory: 'photos/',
                ChannelName: 'Telegram_env',
                FileSize: '1.5',
                TgBotToken: 'secret-token',
            },
        });
        await db.put('photos/sub/b.jpg', 'file-b', {
            metadata: {
                FileName: 'b.jpg',
                FileType: 'image/jpeg',
                TimeStamp: 100,
                Directory: 'photos/sub/',
                ChannelName: 'Telegram_env',
                FileSize: '0.5',
            },
        });

        const record = await db.getWithMetadata('photos/a.jpg');
        assert.equal(record.value, 'file-a');
        assert.equal(record.metadata.FileName, 'a.jpg');
        assert.equal(record.metadata.TgBotToken, undefined);

        const listResult = await readIndex(context, {
            directory: 'photos',
            count: -1,
            includeSubdirFiles: true,
        });

        assert.equal(listResult.success, true);
        assert.equal(listResult.totalCount, 2);
        assert.deepEqual(listResult.files.map((file) => file.id), [
            'photos/a.jpg',
            'photos/sub/b.jpg',
        ]);

        const meta = await getIndexMeta(context);
        assert.equal(meta.success, true);
        assert.equal(meta.totalCount, 2);
        assert.equal(meta.totalSizeMB, 2);
        assert.equal(meta.channelStats.Telegram_env.fileCount, 2);
    });

    it('adds TTL to KV index operations when D1 is not configured', async () => {
        const env = {
            img_url: new MemoryKV(),
        };

        await addFileToIndex(createContext(env), 'ttl-check.jpg', {
            FileName: 'ttl-check.jpg',
            TimeStamp: 1,
        });

        const operationWrite = env.img_url.putCalls.find((entry) => entry.key.startsWith('manage@index@operation_'));
        assert.ok(operationWrite);
        assert.equal(operationWrite.options.expirationTtl, 3600);
    });

    it('keeps a flattened DateTaken in KV metadata when full capture metadata is present', async () => {
        const env = {
            img_url: new MemoryKV(),
        };
        const db = getDatabase(env);

        await db.put('photos/capture.jpg', 'kv-value', {
            metadata: {
                FileName: 'capture.jpg',
                FileType: 'image/jpeg',
                TimeStamp: 300,
                Exif: {
                    dateTime: '2025-03-14T08:09:10.000Z',
                },
            },
        });

        const stored = await env.img_url.getWithMetadata('photos/capture.jpg');
        assert.equal(stored.metadata.DateTaken, '2025-03-14T08:09:10.000Z');
        assert.equal(stored.metadata.Exif, undefined);
    });

    it('migrates existing KV metadata into D1', async () => {
        const env = {
            img_url: new MemoryKV(),
            img_d1: new SqliteD1(':memory:'),
        };

        await env.img_url.put('photos/imported.jpg', 'kv-value', {
            metadata: {
                FileName: 'imported.jpg',
                FileType: 'image/jpeg',
                TimeStamp: 300,
                Directory: 'photos/',
                ChannelName: 'Telegram_env',
            },
        });
        await env.img_url.put('manage@sysConfig@upload', JSON.stringify({
            telegram: {
                channels: [
                    { name: 'Telegram_env', botToken: 'token', chatId: '123' },
                ],
            },
        }));

        const response = await migrateKvToD1(createContext(
            env,
            new Request('https://example.com/api/manage/migrate/kv-to-d1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ limit: 100, rebuild: true }),
            }),
        ));

        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.success, true);
        assert.equal(payload.migratedFiles, 1);
        assert.equal(payload.migratedSettings, 1);
        assert.equal(payload.migrationStatus.complete, true);

        const db = getDatabase(env);
        const migratedRecord = await db.getWithMetadata('photos/imported.jpg');
        assert.equal(migratedRecord.metadata.FileName, 'imported.jpg');
        const uploadConfig = await db.get('manage@sysConfig@upload');
        assert.ok(uploadConfig);

        const d1 = new D1Database(env.img_d1);
        const migrationStatus = JSON.parse(await d1.get(KV_TO_D1_MIGRATION_STATE_KEY));
        assert.equal(migrationStatus.complete, true);
    });

    it('enriches migrated D1 metadata with capture time from legacy index chunks', async () => {
        const env = {
            img_url: new MemoryKV(),
            img_d1: new SqliteD1(':memory:'),
        };

        await env.img_url.put('manage@index@meta', JSON.stringify({ chunkCount: 1 }));
        await env.img_url.put('manage@index_0', createIndexChunk([
            {
                id: 'photos/imported.jpg',
                metadata: {
                    FileName: 'imported.jpg',
                    FileType: 'image/jpeg',
                    TimeStamp: 300,
                    Exif: {
                        dateTime: '2024-07-12T10:30:00.000Z',
                    },
                },
            },
        ]));
        await env.img_url.put('photos/imported.jpg', 'kv-value', {
            metadata: {
                FileName: 'imported.jpg',
                FileType: 'image/jpeg',
                TimeStamp: 300,
                Directory: 'photos/',
                ChannelName: 'Telegram_env',
            },
        });

        const response = await migrateKvToD1(createContext(
            env,
            new Request('https://example.com/api/manage/migrate/kv-to-d1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ limit: 100, rebuild: false }),
            }),
        ));

        assert.equal(response.status, 200);
        const migratedRecord = await getDatabase(env).getWithMetadata('photos/imported.jpg');
        assert.equal(migratedRecord.metadata.DateTaken, '2024-07-12T10:30:00.000Z');
        assert.equal(migratedRecord.metadata.Exif.dateTime, '2024-07-12T10:30:00.000Z');
    });

    it('rolls back D1 metadata when the KV write fails in hybrid mode', async () => {
        const env = {
            img_url: new MemoryKV(),
            img_d1: new SqliteD1(':memory:'),
        };
        env.img_url.failPuts.add('photos/rollback.jpg');

        const db = getDatabase(env);
        await assert.rejects(
            db.put('photos/rollback.jpg', 'kv-value', {
                metadata: {
                    FileName: 'rollback.jpg',
                    TimeStamp: 10,
                },
            }),
            /KV put failed/,
        );

        const d1 = new D1Database(env.img_d1);
        assert.equal(await d1.getWithMetadata('photos/rollback.jpg'), null);
        assert.equal(await env.img_url.get('photos/rollback.jpg'), null);
    });

    it('uses KV file listings until the KV-to-D1 migration is marked complete', async () => {
        const env = {
            img_url: new MemoryKV(),
            img_d1: new SqliteD1(':memory:'),
        };
        const db = getDatabase(env);

        await env.img_url.put('photos/legacy.jpg', 'legacy-value', {
            metadata: {
                FileName: 'legacy.jpg',
                TimeStamp: 20,
            },
        });

        const beforeMigration = await db.list({ prefix: 'photos/' });
        assert.deepEqual(beforeMigration.keys.map((item) => item.name), ['photos/legacy.jpg']);
        assert.equal(env.img_url.listCalls.length, 1);

        const d1 = new D1Database(env.img_d1);
        await d1.put('photos/migrated.jpg', '', {
            metadata: {
                FileName: 'migrated.jpg',
                TimeStamp: 30,
            },
        });
        await d1.put(KV_TO_D1_MIGRATION_STATE_KEY, JSON.stringify({
            complete: true,
            nextCursor: null,
            updatedAt: Date.now(),
        }));

        const afterMigrationDb = getDatabase(env);
        const afterMigration = await afterMigrationDb.list({ prefix: 'photos/' });
        assert.deepEqual(afterMigration.keys.map((item) => item.name), ['photos/migrated.jpg']);
        assert.equal(env.img_url.listCalls.length, 1);
    });

    it('caches migrationStatus per HybridAdapter instance across repeated file list calls', async () => {
        const env = {
            img_url: new MemoryKV(),
            img_d1: new SqliteD1(':memory:'),
        };
        const db = getDatabase(env);
        const originalGet = db.d1.get.bind(db.d1);
        let migrationStatusReads = 0;

        await env.img_url.put('photos/one.jpg', 'value-one', {
            metadata: {
                FileName: 'one.jpg',
                TimeStamp: 10,
            },
        });
        await env.img_url.put('photos/two.jpg', 'value-two', {
            metadata: {
                FileName: 'two.jpg',
                TimeStamp: 20,
            },
        });

        db.d1.get = async (key) => {
            if (key === KV_TO_D1_MIGRATION_STATE_KEY) {
                migrationStatusReads += 1;
            }

            return originalGet(key);
        };

        const firstList = await db.list({ prefix: 'photos/' });
        const secondList = await db.list({ prefix: 'photos/' });

        assert.deepEqual(firstList.keys.map((item) => item.name), ['photos/one.jpg', 'photos/two.jpg']);
        assert.deepEqual(secondList.keys.map((item) => item.name), ['photos/one.jpg', 'photos/two.jpg']);
        assert.equal(migrationStatusReads, 1);
        assert.equal(env.img_url.listCalls.length, 2);
    });

    it('restores the D1 record when KV delete fails in hybrid mode', async () => {
        const env = {
            img_url: new MemoryKV(),
            img_d1: new SqliteD1(':memory:'),
        };
        const db = getDatabase(env);

        await db.put('photos/delete-rollback.jpg', 'kv-value', {
            metadata: {
                FileName: 'delete-rollback.jpg',
                TimeStamp: 50,
            },
        });
        env.img_url.failDeletes.add('photos/delete-rollback.jpg');

        await assert.rejects(
            db.delete('photos/delete-rollback.jpg'),
            /KV delete failed/,
        );

        const d1 = new D1Database(env.img_d1);
        const restoredRecord = await d1.getWithMetadata('photos/delete-rollback.jpg');
        assert.equal(restoredRecord.value, '');
        assert.equal(restoredRecord.metadata.FileName, 'delete-rollback.jpg');
        assert.equal(await env.img_url.get('photos/delete-rollback.jpg'), 'kv-value');
    });

    it('reports keys skipped because they are missing metadata during migration', async () => {
        const env = {
            img_url: new MemoryKV(),
            img_d1: new SqliteD1(':memory:'),
        };

        await env.img_url.put('photos/no-metadata.jpg', 'kv-value');
        await env.img_url.put('photos/with-metadata.jpg', 'kv-value', {
            metadata: {
                FileName: 'with-metadata.jpg',
                TimeStamp: 40,
            },
        });

        const response = await migrateKvToD1(createContext(
            env,
            new Request('https://example.com/api/manage/migrate/kv-to-d1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ limit: 100, rebuild: false }),
            }),
        ));

        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.skipped, 1);
        assert.deepEqual(payload.skippedKeys, [
            {
                key: 'photos/no-metadata.jpg',
                reason: 'missing_metadata',
            },
        ]);
    });

    it('queryFiles paginates and returns the total count', async () => {
        const d1 = new D1Database(new SqliteD1(':memory:'));

        await seedD1File(d1, 'photos/a.jpg', { FileName: 'a.jpg', TimeStamp: 1 });
        await seedD1File(d1, 'photos/b.jpg', { FileName: 'b.jpg', TimeStamp: 2 });
        await seedD1File(d1, 'photos/c.jpg', { FileName: 'c.jpg', TimeStamp: 3 });

        const firstPage = await d1.queryFiles({
            page: 1,
            pageSize: 2,
            sortBy: 'file_name',
            sortOrder: 'asc',
        });
        const secondPage = await d1.queryFiles({
            page: 2,
            pageSize: 2,
            sortBy: 'file_name',
            sortOrder: 'asc',
        });

        assert.equal(firstPage.total, 3);
        assert.deepEqual(firstPage.files.map((file) => file.id), ['photos/a.jpg', 'photos/b.jpg']);
        assert.equal(secondPage.total, 3);
        assert.deepEqual(secondPage.files.map((file) => file.id), ['photos/c.jpg']);
    });

    it('queryFiles filters by file_type category', async () => {
        const d1 = new D1Database(new SqliteD1(':memory:'));

        await seedD1File(d1, 'photos/image.jpg', { FileType: 'image/jpeg', TimeStamp: 1 });
        await seedD1File(d1, 'photos/video.mp4', { FileType: 'video/mp4', TimeStamp: 2 });
        await seedD1File(d1, 'photos/doc.pdf', { FileType: 'application/pdf', TimeStamp: 3 });

        const result = await d1.queryFiles({
            types: ['image'],
            page: 1,
            pageSize: 10,
        });

        assert.equal(result.total, 1);
        assert.deepEqual(result.files.map((file) => file.id), ['photos/image.jpg']);
    });

    it('queryFiles treats legacy generic file types as media when the filename extension is explicit', async () => {
        const d1 = new D1Database(new SqliteD1(':memory:'));

        await seedD1File(d1, 'photos/legacy-image.jpg', { FileType: 'image', TimeStamp: 1 });
        await seedD1File(d1, 'photos/octet-image.jpg', { FileType: 'application/octet-stream', TimeStamp: 4 });
        await seedD1File(d1, 'photos/path-only-image.jpg', { FileName: 'path-only-image', FileType: 'application/octet-stream', TimeStamp: 5 });
        await seedD1File(d1, 'photos/legacy-video.mp4', { FileType: 'video', TimeStamp: 2 });
        await seedD1File(d1, 'photos/legacy-audio.m4a', { FileType: 'audio', TimeStamp: 3 });

        const images = await d1.queryFiles({
            types: ['image'],
            page: 1,
            pageSize: 10,
            sortBy: 'timestamp',
            sortOrder: 'desc',
        });
        const videos = await d1.queryFiles({
            types: ['video'],
            page: 1,
            pageSize: 10,
            sortBy: 'timestamp',
            sortOrder: 'desc',
        });
        const audio = await d1.queryFiles({
            types: ['audio'],
            page: 1,
            pageSize: 10,
            sortBy: 'timestamp',
            sortOrder: 'desc',
        });

        assert.deepEqual(images.files.map((file) => file.id), ['photos/path-only-image.jpg', 'photos/octet-image.jpg', 'photos/legacy-image.jpg']);
        assert.deepEqual(videos.files.map((file) => file.id), ['photos/legacy-video.mp4']);
        assert.deepEqual(audio.files.map((file) => file.id), ['photos/legacy-audio.m4a']);
    });

    it('readIndex treats legacy generic file types as media when the filename extension is explicit', async () => {
        const env = {
            img_url: new MemoryKV(),
        };
        const context = createContext(env);

        await env.img_url.put('manage@index@meta', JSON.stringify({
            lastUpdated: Date.now(),
            totalCount: 4,
            chunkCount: 1,
            chunkSize: 5000,
        }));
        await env.img_url.put('manage@index_0', createIndexChunk([
            { id: 'photos/legacy-image.jpg', metadata: { FileName: 'legacy-image.jpg', FileType: 'image', Directory: 'photos/' } },
            { id: 'photos/octet-image.jpg', metadata: { FileName: 'octet-image.jpg', FileType: 'application/octet-stream', Directory: 'photos/' } },
            { id: 'photos/legacy-video.mp4', metadata: { FileName: 'legacy-video.mp4', FileType: 'video', Directory: 'photos/' } },
            { id: 'photos/doc.pdf', metadata: { FileName: 'doc.pdf', FileType: 'application/pdf', Directory: 'photos/' } },
        ]));

        const images = await readIndex(context, {
            fileType: ['image'],
            includeSubdirFiles: true,
            count: -1,
        });
        const allMedia = await readIndex(context, {
            fileType: ['image', 'video', 'audio', 'other'],
            includeSubdirFiles: true,
            count: -1,
        });

        assert.equal(images.success, true);
        assert.deepEqual(images.files.map((file) => file.id), ['photos/legacy-image.jpg', 'photos/octet-image.jpg']);
        assert.equal(allMedia.success, true);
        assert.deepEqual(allMedia.files.map((file) => file.id), [
            'photos/legacy-image.jpg',
            'photos/octet-image.jpg',
            'photos/legacy-video.mp4',
            'photos/doc.pdf',
        ]);
    });

    it('queryFiles falls back to metadata fields and filename extensions for legacy D1 rows', async () => {
        const d1 = new D1Database(new SqliteD1(':memory:'));

        await d1.put('photos/legacy-image.jpg', '', {
            metadata: {
                FileName: 'legacy-image.jpg',
                TimeStamp: 1,
            },
        });
        await d1.put('photos/legacy-video.mp4', '', {
            metadata: {
                FileName: 'legacy-video.mp4',
                TimeStamp: 2,
            },
        });
        await d1.put('photos/legacy-audio.m4a', '', {
            metadata: {
                FileName: 'legacy-audio.m4a',
                TimeStamp: 3,
            },
        });

        const images = await d1.queryFiles({
            types: ['image'],
            page: 1,
            pageSize: 10,
            sortBy: 'timestamp',
            sortOrder: 'desc',
        });
        const videos = await d1.queryFiles({
            types: ['video'],
            page: 1,
            pageSize: 10,
            sortBy: 'timestamp',
            sortOrder: 'desc',
        });
        const audio = await d1.queryFiles({
            types: ['audio'],
            page: 1,
            pageSize: 10,
            sortBy: 'timestamp',
            sortOrder: 'desc',
        });

        assert.deepEqual(images.files.map((file) => file.id), ['photos/legacy-image.jpg']);
        assert.deepEqual(videos.files.map((file) => file.id), ['photos/legacy-video.mp4']);
        assert.deepEqual(audio.files.map((file) => file.id), ['photos/legacy-audio.m4a']);
    });

    it('queryFiles searches by file_name with LIKE binding', async () => {
        const d1 = new D1Database(new SqliteD1(':memory:'));

        await seedD1File(d1, 'photos/sunrise.jpg', { FileName: 'sunrise.jpg', TimeStamp: 1 });
        await seedD1File(d1, 'photos/night.jpg', { FileName: 'night.jpg', TimeStamp: 2 });

        const result = await d1.queryFiles({
            search: 'sun',
            page: 1,
            pageSize: 10,
        });

        assert.equal(result.total, 1);
        assert.deepEqual(result.files.map((file) => file.id), ['photos/sunrise.jpg']);
    });

    it('queryFiles sorts deterministically in both asc and desc order', async () => {
        const d1 = new D1Database(new SqliteD1(':memory:'));

        await seedD1File(d1, 'photos/b.jpg', { FileName: 'b.jpg', TimeStamp: 1 });
        await seedD1File(d1, 'photos/a.jpg', { FileName: 'a.jpg', TimeStamp: 2 });

        const ascResult = await d1.queryFiles({
            page: 1,
            pageSize: 10,
            sortBy: 'file_name',
            sortOrder: 'asc',
        });
        const descResult = await d1.queryFiles({
            page: 1,
            pageSize: 10,
            sortBy: 'file_name',
            sortOrder: 'desc',
        });

        assert.deepEqual(ascResult.files.map((file) => file.id), ['photos/a.jpg', 'photos/b.jpg']);
        assert.deepEqual(descResult.files.map((file) => file.id), ['photos/b.jpg', 'photos/a.jpg']);
    });

    it('list route returns D1-backed paginated responses when migration is complete', async () => {
        const env = {
            img_url: new MemoryKV(),
            img_d1: new SqliteD1(':memory:'),
        };
        const d1 = new D1Database(env.img_d1);

        await seedD1File(d1, 'photos/a.jpg', { FileName: 'a.jpg', TimeStamp: 1 });
        await seedD1File(d1, 'photos/b.jpg', { FileName: 'b.jpg', TimeStamp: 2 });
        await seedD1File(d1, 'photos/c.jpg', { FileName: 'c.jpg', TimeStamp: 3 });
        await d1.put(KV_TO_D1_MIGRATION_STATE_KEY, JSON.stringify({
            complete: true,
            nextCursor: null,
            updatedAt: Date.now(),
        }));

        const response = await listRoute(createContext(
            env,
            new Request('https://example.com/api/manage/list?recursive=true&page=2&pageSize=2&sortBy=file_name&sortOrder=asc', {
                method: 'GET',
            }),
        ));

        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.isD1QueryResponse, true);
        assert.equal(payload.total, 3);
        assert.equal(payload.page, 2);
        assert.equal(payload.pageSize, 2);
        assert.equal(payload.totalPages, 2);
        assert.deepEqual(payload.files.map((file) => file.name), ['photos/c.jpg']);
    });

    it('list route preserves absolute offsets when page is omitted and D1 pagination uses timestamps', async () => {
        const env = {
            img_url: new MemoryKV(),
            img_d1: new SqliteD1(':memory:'),
        };
        const d1 = new D1Database(env.img_d1);

        await seedD1File(d1, 'photos/a.jpg', { FileName: 'a.jpg', TimeStamp: 1 });
        await seedD1File(d1, 'photos/b.jpg', { FileName: 'b.jpg', TimeStamp: 2 });
        await seedD1File(d1, 'photos/c.jpg', { FileName: 'c.jpg', TimeStamp: 3 });
        await d1.put(KV_TO_D1_MIGRATION_STATE_KEY, JSON.stringify({
            complete: true,
            nextCursor: null,
            updatedAt: Date.now(),
        }));

        const response = await listRoute(createContext(
            env,
            new Request('https://example.com/api/manage/list?recursive=true&start=1&count=1&sortBy=timestamp&sortOrder=desc', {
                method: 'GET',
            }),
        ));

        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.isD1QueryResponse, true);
        assert.equal(payload.start, 1);
        assert.equal(payload.page, 2);
        assert.equal(payload.pageSize, 1);
        assert.deepEqual(payload.files.map((file) => file.name), ['photos/b.jpg']);
    });

    it('list route supplements complete D1 migrations with legacy KV files that are still missing from D1', async () => {
        const env = {
            img_url: new MemoryKV(),
            img_d1: new SqliteD1(':memory:'),
        };
        const d1 = new D1Database(env.img_d1);

        await seedD1File(d1, 'photos/latest.jpg', { FileName: 'latest.jpg', FileType: 'image/jpeg', TimeStamp: 300 });
        await env.img_url.put('photos/old.jpg', 'kv-old', {
            metadata: {
                FileName: 'old.jpg',
                FileType: 'image/jpeg',
                TimeStamp: 200,
                Directory: 'photos/',
            },
        });
        await d1.put(KV_TO_D1_MIGRATION_STATE_KEY, JSON.stringify({
            complete: true,
            nextCursor: null,
            updatedAt: Date.now(),
        }));

        const response = await listRoute(createContext(
            env,
            new Request('https://example.com/api/manage/list?recursive=true&start=0&count=10&sortBy=timestamp&sortOrder=desc', {
                method: 'GET',
            }),
        ));

        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.totalCount, 2);
        assert.equal(payload.isHybridSupplementedResponse, true);
        assert.equal(payload.d1TotalCount, 1);
        assert.equal(payload.kvSupplementedCount, 1);
        assert.deepEqual(payload.files.map((file) => file.name), ['photos/latest.jpg', 'photos/old.jpg']);
    });

    it('list route does not duplicate KV aliases that match an active D1 media identity', async () => {
        const env = {
            img_url: new MemoryKV(),
            img_d1: new SqliteD1(':memory:'),
        };
        const d1 = new D1Database(env.img_d1);

        await seedD1File(d1, 'photos/latest-copy.jpg', {
            FileName: 'same.jpg',
            FileType: 'image/jpeg',
            FileSize: '2.4',
            Width: '1200',
            Height: '900',
            TgFileUniqueId: 'telegram-unique-1',
            TimeStamp: 300,
        });
        await env.img_url.put('photos/legacy-alias.jpg', 'kv-old', {
            metadata: {
                FileName: 'same.jpg',
                FileType: 'image/jpeg',
                FileSize: '2.4',
                Width: '1200',
                Height: '900',
                TgFileUniqueId: 'telegram-unique-1',
                TimeStamp: 200,
                Directory: 'photos/',
            },
        });
        await d1.put(KV_TO_D1_MIGRATION_STATE_KEY, JSON.stringify({
            complete: true,
            nextCursor: null,
            updatedAt: Date.now(),
        }));

        const response = await listRoute(createContext(
            env,
            new Request('https://example.com/api/manage/list?recursive=true&start=0&count=10&sortBy=timestamp&sortOrder=desc', {
                method: 'GET',
            }),
        ));

        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.totalCount, 1);
        assert.equal(payload.kvSupplementedCount, undefined);
        assert.deepEqual(payload.files.map((file) => file.name), ['photos/latest-copy.jpg']);
    });

    it('list route does not resurrect stale KV aliases for D1 recycle-bin records', async () => {
        const env = {
            img_url: new MemoryKV(),
            img_d1: new SqliteD1(':memory:'),
        };
        const d1 = new D1Database(env.img_d1);

        await seedD1File(d1, 'photos/deleted-copy.jpg', {
            FileName: 'deleted.jpg',
            FileType: 'image/jpeg',
            FileSize: '1.2',
            Width: '800',
            Height: '600',
            TgFileUniqueId: 'deleted-unique-1',
            RecycleBin: 'true',
            DeletedAt: String(Date.now()),
            TimeStamp: 300,
        });
        await env.img_url.put('photos/deleted-legacy-alias.jpg', 'kv-old', {
            metadata: {
                FileName: 'deleted.jpg',
                FileType: 'image/jpeg',
                FileSize: '1.2',
                Width: '800',
                Height: '600',
                TgFileUniqueId: 'deleted-unique-1',
                TimeStamp: 200,
                Directory: 'photos/',
            },
        });
        await d1.put(KV_TO_D1_MIGRATION_STATE_KEY, JSON.stringify({
            complete: true,
            nextCursor: null,
            updatedAt: Date.now(),
        }));

        const response = await listRoute(createContext(
            env,
            new Request('https://example.com/api/manage/list?recursive=true&start=0&count=10&sortBy=timestamp&sortOrder=desc', {
                method: 'GET',
            }),
        ));

        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.totalCount, 0);
        assert.deepEqual(payload.files, []);
    });

    it('list route prefers the legacy KV index over raw KV scans for hybrid supplements', async () => {
        const env = {
            img_url: new MemoryKV(),
            img_d1: new SqliteD1(':memory:'),
        };
        const d1 = new D1Database(env.img_d1);

        await seedD1File(d1, 'photos/latest.jpg', { FileName: 'latest.jpg', FileType: 'image/jpeg', TimeStamp: 300 });
        await env.img_url.put('manage@index@meta', JSON.stringify({
            lastUpdated: Date.now(),
            totalCount: 1,
            chunkCount: 1,
            chunkSize: 5000,
        }));
        await env.img_url.put('manage@index_0', JSON.stringify([{
            id: 'photos/indexed-old.jpg',
            metadata: {
                FileName: 'indexed-old.jpg',
                FileType: 'image/jpeg',
                TimeStamp: 200,
                Directory: 'photos/',
            },
        }]));
        await env.img_url.put('photos/raw-stale.jpg', 'kv-stale', {
            metadata: {
                FileName: 'raw-stale.jpg',
                FileType: 'image/jpeg',
                TimeStamp: 250,
                Directory: 'photos/',
            },
        });
        await d1.put(KV_TO_D1_MIGRATION_STATE_KEY, JSON.stringify({
            complete: true,
            nextCursor: null,
            updatedAt: Date.now(),
        }));

        const response = await listRoute(createContext(
            env,
            new Request('https://example.com/api/manage/list?recursive=true&start=0&count=10&sortBy=timestamp&sortOrder=desc', {
                method: 'GET',
            }),
        ));

        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.totalCount, 2);
        assert.equal(payload.kvSupplementedCount, 1);
        assert.equal(payload.kvSupplementSource, 'legacy-kv-index');
        assert.deepEqual(payload.files.map((file) => file.name), ['photos/latest.jpg', 'photos/indexed-old.jpg']);
    });

    it('list route clamps D1 pageSize requests to the raised 500-item ceiling', async () => {
        const env = {
            img_url: new MemoryKV(),
            img_d1: new SqliteD1(':memory:'),
        };
        const d1 = new D1Database(env.img_d1);

        await seedD1File(d1, 'photos/a.jpg', { FileName: 'a.jpg', TimeStamp: 1 });
        await seedD1File(d1, 'photos/b.jpg', { FileName: 'b.jpg', TimeStamp: 2 });
        await seedD1File(d1, 'photos/c.jpg', { FileName: 'c.jpg', TimeStamp: 3 });
        await d1.put(KV_TO_D1_MIGRATION_STATE_KEY, JSON.stringify({
            complete: true,
            nextCursor: null,
            updatedAt: Date.now(),
        }));

        const response = await listRoute(createContext(
            env,
            new Request('https://example.com/api/manage/list?recursive=true&page=1&pageSize=999', {
                method: 'GET',
            }),
        ));

        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.isD1QueryResponse, true);
        assert.equal(payload.pageSize, 500);
        assert.equal(payload.files.length, 3);
    });

    it('list route fails closed when the KV index is unavailable instead of scanning KV directly', async () => {
        const env = {
            img_url: new MemoryKV(),
        };
        await env.img_url.put('manage@index@meta', '{broken-json');

        const response = await listRoute(createContext(
            env,
            new Request('https://example.com/api/manage/list?dir=photos/&count=10', {
                method: 'GET',
            }),
        ));

        assert.equal(response.status, 503);
        const payload = await response.json();
        assert.equal(payload.error, 'Index unavailable');
        assert.equal(payload.message, 'Indexed metadata query failed');
    });

    it('readIndex still succeeds when pending operations exceed one merge batch', async () => {
        const env = {
            img_url: new MemoryKV(),
        };
        const context = createContext(env);

        await env.img_url.put('manage@index@meta', JSON.stringify({
            lastUpdated: Date.now(),
            totalCount: 0,
            lastOperationId: null,
            chunkCount: 0,
            chunkSize: 5000,
        }));

        for (let i = 0; i < 31; i += 1) {
            const operationId = String(i + 1).padStart(4, '0');
            await env.img_url.put(`manage@index@operation_${operationId}`, JSON.stringify({
                type: 'add',
                timestamp: i + 1,
                data: {
                    fileId: `photos/${operationId}.jpg`,
                    metadata: {
                        FileName: `${operationId}.jpg`,
                        Directory: 'photos/',
                        TimeStamp: i + 1,
                    },
                },
            }));
        }

        const result = await readIndex(context, {
            directory: 'photos',
            count: -1,
            includeSubdirFiles: true,
        });

        assert.equal(result.success, true);
        assert.equal(result.totalCount, 31);
        assert.equal(result.files.length, 31);
    });

    it('deleteAllOperations clears more than one delete batch without recursive self-fetch', async () => {
        const env = {
            img_url: new MemoryKV(),
        };
        const context = createContext(env);

        for (let i = 0; i < 41; i += 1) {
            const operationId = String(i + 1).padStart(4, '0');
            await env.img_url.put(`manage@index@operation_${operationId}`, JSON.stringify({
                type: 'remove',
                timestamp: i + 1,
                data: {
                    fileId: `photos/${operationId}.jpg`,
                },
            }));
        }

        const result = await deleteAllOperations(context);

        assert.equal(result.success, true);
        assert.equal(result.deletedCount, 41);
        assert.equal(result.errorCount, 0);
        const remaining = [...env.img_url.store.keys()].filter((key) => key.startsWith('manage@index@operation_'));
        assert.deepEqual(remaining, []);
    });
});
