import assert from 'node:assert/strict';

import { onRequest } from '../functions/api/manage/migrate/status.js';
import { KV_TO_D1_MIGRATION_STATE_KEY } from '../functions/utils/databaseAdapter.js';
import { D1Database } from '../functions/utils/d1Database.js';
import { SqliteD1 } from '../server/sqliteD1.js';

class MemoryKV {
    constructor() {
        this.store = new Map();
    }

    async get(key) {
        return this.store.has(key) ? this.store.get(key) : null;
    }

    async put(key, value) {
        this.store.set(key, value);
    }
}

function createRequest(method = 'GET') {
    return new Request('https://example.com/api/manage/migrate/status', { method });
}

describe('migration status route', () => {
    it('reports disabled when D1 is not configured', async () => {
        const response = await onRequest({
            env: {
                img_url: new MemoryKV(),
            },
            request: createRequest('GET'),
        });

        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.success, true);
        assert.equal(payload.database.usingD1, false);
        assert.equal(payload.migration.state, 'disabled');
        assert.equal(payload.migration.complete, false);
    });

    it('reports not_started when D1 is configured but migration marker is absent', async () => {
        const response = await onRequest({
            env: {
                img_url: new MemoryKV(),
                img_d1: new SqliteD1(':memory:'),
            },
            request: createRequest('GET'),
        });

        assert.equal(response.status, 200);
        const payload = await response.json();
        assert.equal(payload.success, true);
        assert.equal(payload.database.usingHybrid, true);
        assert.equal(payload.migration.state, 'not_started');
        assert.equal(payload.migration.complete, false);
    });

    it('reports in_progress and complete from the stored migration marker', async () => {
        const env = {
            img_url: new MemoryKV(),
            img_d1: new SqliteD1(':memory:'),
        };
        const d1 = new D1Database(env.img_d1);

        await d1.put(KV_TO_D1_MIGRATION_STATE_KEY, JSON.stringify({
            complete: false,
            nextCursor: 'cursor-123',
            updatedAt: 1775745000000,
        }));

        const inProgressResponse = await onRequest({
            env,
            request: createRequest('GET'),
        });

        assert.equal(inProgressResponse.status, 200);
        const inProgressPayload = await inProgressResponse.json();
        assert.equal(inProgressPayload.migration.state, 'in_progress');
        assert.equal(inProgressPayload.migration.complete, false);
        assert.equal(inProgressPayload.migration.nextCursor, 'cursor-123');

        await d1.put(KV_TO_D1_MIGRATION_STATE_KEY, JSON.stringify({
            complete: true,
            nextCursor: null,
            updatedAt: 1775745001000,
        }));

        const completeResponse = await onRequest({
            env,
            request: createRequest('GET'),
        });

        assert.equal(completeResponse.status, 200);
        const completePayload = await completeResponse.json();
        assert.equal(completePayload.migration.state, 'complete');
        assert.equal(completePayload.migration.complete, true);
        assert.equal(completePayload.migration.nextCursor, null);
        assert.equal(completePayload.migration.updatedAt, 1775745001000);
    });

    it('returns 500 when migration marker data is corrupted', async () => {
        const env = {
            img_url: new MemoryKV(),
            img_d1: new SqliteD1(':memory:'),
        };
        const d1 = new D1Database(env.img_d1);
        await d1.put(KV_TO_D1_MIGRATION_STATE_KEY, '{bad json');

        const response = await onRequest({
            env,
            request: createRequest('GET'),
        });

        assert.equal(response.status, 500);
        const payload = await response.json();
        assert.deepEqual(payload, {
            success: false,
            error: 'Corrupted migration status data',
        });
    });

    it('returns cors headers for options', async () => {
        const response = await onRequest({
            env: {
                img_url: new MemoryKV(),
            },
            request: createRequest('OPTIONS'),
        });

        assert.equal(response.status, 204);
        assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
        assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, OPTIONS');
    });
});
