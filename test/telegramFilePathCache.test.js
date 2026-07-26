import assert from 'node:assert/strict';

import { resolveTelegramFilePathCached } from '../functions/utils/telegramAPI.js';

class MemoryCache {
    constructor() {
        this.store = new Map();
        this.putCalls = [];
    }

    async match(request) {
        const key = request instanceof Request ? request.url : String(request);
        return this.store.get(key) || undefined;
    }

    async put(request, response) {
        const key = request instanceof Request ? request.url : String(request);
        this.putCalls.push(key);
        this.store.set(key, response);
    }
}

class FakeTelegramAPI {
    constructor(filePath) {
        this.filePath = filePath;
        this.getFilePathCalls = 0;
    }

    async getFilePath(fileId) {
        this.getFilePathCalls += 1;
        this.lastFileId = fileId;
        return typeof this.filePath === 'function' ? this.filePath(fileId) : this.filePath;
    }
}

describe('resolveTelegramFilePathCached', () => {
    it('bypasses and replaces a stale cached path when forceRefresh is requested', async () => {
        const cache = new MemoryCache();
        await cache.put(new Request('https://internal.cache/tg-file-path/v1/tg-id-stale'), new Response('documents/stale.heic'));
        let calls = 0;
        const api = {
            async getFilePath() {
                calls += 1;
                return 'documents/fresh.heic';
            },
        };

        const refreshed = await resolveTelegramFilePathCached(api, 'tg-id-stale', cache, { forceRefresh: true });
        const cached = await resolveTelegramFilePathCached(api, 'tg-id-stale', cache);

        assert.equal(refreshed, 'documents/fresh.heic');
        assert.equal(cached, 'documents/fresh.heic');
        assert.equal(calls, 1);
    });

    it('returns null without calling getFilePath when telegramAPI is missing', async () => {
        const result = await resolveTelegramFilePathCached(null, 'abc', new MemoryCache());
        assert.equal(result, null);
    });

    it('returns null without calling getFilePath when fileId is missing', async () => {
        const api = new FakeTelegramAPI('documents/x.heic');
        const result = await resolveTelegramFilePathCached(api, '', new MemoryCache());
        assert.equal(result, null);
        assert.equal(api.getFilePathCalls, 0);
    });

    it('falls through to telegramAPI.getFilePath when no cache is provided', async () => {
        const api = new FakeTelegramAPI('documents/x.heic');
        const result = await resolveTelegramFilePathCached(api, 'tg-file-id-1', null);
        assert.equal(result, 'documents/x.heic');
        assert.equal(api.getFilePathCalls, 1);
    });

    it('caches the resolved file_path so the second call skips getFilePath', async () => {
        const cache = new MemoryCache();
        const api = new FakeTelegramAPI('documents/photo.heic');

        const first = await resolveTelegramFilePathCached(api, 'tg-id-A', cache);
        const second = await resolveTelegramFilePathCached(api, 'tg-id-A', cache);

        assert.equal(first, 'documents/photo.heic');
        assert.equal(second, 'documents/photo.heic');
        assert.equal(api.getFilePathCalls, 1, 'second call must come from cache');
        assert.equal(cache.putCalls.length, 1);
    });

    it('caches a negative result for 60s so a failed lookup does not re-fire getFile per tile', async () => {
        const cache = new MemoryCache();
        const api = new FakeTelegramAPI(null);

        const first = await resolveTelegramFilePathCached(api, 'tg-id-B', cache);
        const second = await resolveTelegramFilePathCached(api, 'tg-id-B', cache);

        assert.equal(first, null);
        assert.equal(second, null);
        assert.equal(api.getFilePathCalls, 1, 'second call must be served by the negative cache entry');
        assert.equal(cache.putCalls.length, 1);

        const negativeEntry = cache.store.get('https://internal.cache/tg-file-path/v1/tg-id-B');
        assert.ok(negativeEntry, 'negative entry must live in the same keyspace');
        assert.equal(negativeEntry.headers.get('X-Tg-File-Path-Negative'), '1');
        assert.match(negativeEntry.headers.get('Cache-Control') || '', /max-age=60(?!\d)/);
    });

    it('forceRefresh bypasses a negative entry and replaces it on success', async () => {
        const cache = new MemoryCache();
        let calls = 0;
        const api = {
            async getFilePath() {
                calls += 1;
                return calls === 1 ? null : 'documents/recovered.heic';
            },
        };

        assert.equal(await resolveTelegramFilePathCached(api, 'tg-id-C', cache), null);
        const refreshed = await resolveTelegramFilePathCached(api, 'tg-id-C', cache, { forceRefresh: true });
        const cached = await resolveTelegramFilePathCached(api, 'tg-id-C', cache);

        assert.equal(refreshed, 'documents/recovered.heic');
        assert.equal(cached, 'documents/recovered.heic', 'positive entry must replace the negative marker');
        assert.equal(calls, 2);
    });

    it('coalesces concurrent lookups for the same fileId into one getFile call', async () => {
        let calls = 0;
        let release;
        const gate = new Promise((resolve) => { release = resolve; });
        const api = {
            async getFilePath() {
                calls += 1;
                await gate;
                return 'documents/shared.heic';
            },
        };

        const cache = new MemoryCache();
        const firstPromise = resolveTelegramFilePathCached(api, 'tg-id-shared', cache);
        const secondPromise = resolveTelegramFilePathCached(api, 'tg-id-shared', cache);
        await Promise.resolve();
        release();

        const [first, second] = await Promise.all([firstPromise, secondPromise]);
        assert.equal(first, 'documents/shared.heic');
        assert.equal(second, 'documents/shared.heic');
        assert.equal(calls, 1, 'concurrent lookups must share one in-flight getFile');

        // in-flight map settles per call; a later lookup hits the edge cache instead.
        const third = await resolveTelegramFilePathCached(api, 'tg-id-shared', cache);
        assert.equal(third, 'documents/shared.heic');
        assert.equal(calls, 1);
    });

    it('keeps different file_ids in different cache entries', async () => {
        const cache = new MemoryCache();
        const api = new FakeTelegramAPI((id) => `documents/${id}.heic`);

        const a = await resolveTelegramFilePathCached(api, 'tg-id-X', cache);
        const b = await resolveTelegramFilePathCached(api, 'tg-id-Y', cache);

        assert.equal(a, 'documents/tg-id-X.heic');
        assert.equal(b, 'documents/tg-id-Y.heic');
        assert.equal(api.getFilePathCalls, 2);
        assert.equal(cache.store.size, 2);
    });
});
