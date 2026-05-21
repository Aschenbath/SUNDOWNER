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

    it('does not cache when telegramAPI returns null (avoid pinning a failed lookup)', async () => {
        const cache = new MemoryCache();
        const api = new FakeTelegramAPI(null);

        const first = await resolveTelegramFilePathCached(api, 'tg-id-B', cache);
        const second = await resolveTelegramFilePathCached(api, 'tg-id-B', cache);

        assert.equal(first, null);
        assert.equal(second, null);
        assert.equal(api.getFilePathCalls, 2, 'failed lookups must retry on the next request');
        assert.equal(cache.putCalls.length, 0);
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
