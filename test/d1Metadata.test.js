import assert from 'node:assert/strict';

import { onRequest as migrateKvToD1 } from '../functions/api/manage/migrate/kv-to-d1.js';
import { getDatabase } from '../functions/utils/databaseAdapter.js';
import { addFileToIndex, getIndexMeta, readIndex } from '../functions/utils/indexManager.js';
import { SqliteD1 } from '../server/sqliteD1.js';

class MemoryKV {
    constructor() {
        this.store = new Map();
        this.metadata = new Map();
        this.putCalls = [];
    }

    async put(key, value, options = {}) {
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
        this.store.delete(key);
        this.metadata.delete(key);
    }

    async list(options = {}) {
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

        const db = getDatabase(env);
        const migratedRecord = await db.getWithMetadata('photos/imported.jpg');
        assert.equal(migratedRecord.metadata.FileName, 'imported.jpg');
        const uploadConfig = await db.get('manage@sysConfig@upload');
        assert.ok(uploadConfig);
    });
});
