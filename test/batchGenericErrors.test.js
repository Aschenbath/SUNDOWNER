import assert from 'node:assert/strict';

import { onRequestGet as batchListGet } from '../functions/api/manage/batch/list.js';
import { onRequestGet as batchSettingsGet } from '../functions/api/manage/batch/settings.js';
import { onRequestGet as batchIndexConfigGet } from '../functions/api/manage/batch/index/config.js';
import { onRequestPost as batchIndexChunkPost } from '../functions/api/manage/batch/index/chunk.js';
import { onRequestPost as batchIndexFinalizePost } from '../functions/api/manage/batch/index/finalize.js';
import { onRequestPost as batchRestoreChunkPost } from '../functions/api/manage/batch/restore/chunk.js';

const INTERNAL_MESSAGE = 'D1 shard failed for private_token_123';

class MemoryKV {
  constructor() {
    this.store = new Map();
    this.failPutKeys = new Set(['manage@index@meta']);
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async put(key, value) {
    if (this.failPutKeys.has(key)) {
      throw new Error(INTERNAL_MESSAGE);
    }
    this.store.set(key, value);
  }

  async delete(key) {
    this.store.delete(key);
  }
}

function throwingEnv(property = 'img_url') {
  return new Proxy({}, {
    get(_target, prop) {
      if (prop === property) {
        throw new Error(INTERNAL_MESSAGE);
      }
      return undefined;
    },
  });
}

function jsonRequest(url, body) {
  return new Request(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function sha256Json(value) {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function assertGeneric500(response, expectedError) {
  assert.equal(response.status, 500);
  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, expectedError);
  assert.ok(!JSON.stringify(payload).includes(INTERNAL_MESSAGE));
}

describe('batch API generic 500 errors', () => {
  let originalConsoleError;

  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = () => {};
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('hides raw database errors from batch list responses', async () => {
    const response = await batchListGet({
      env: throwingEnv(),
      request: new Request('https://example.com/api/manage/batch/list'),
    });

    await assertGeneric500(response, 'Database read error');
  });

  it('hides raw database errors from batch settings responses', async () => {
    const response = await batchSettingsGet({
      env: throwingEnv(),
      request: new Request('https://example.com/api/manage/batch/settings'),
    });

    await assertGeneric500(response, 'Database read error');
  });

  it('hides raw database errors from batch index config responses', async () => {
    const response = await batchIndexConfigGet({
      env: throwingEnv('img_d1'),
      request: new Request('https://example.com/api/manage/batch/index/config'),
    });

    await assertGeneric500(response, 'Unable to read index configuration');
  });

  it('hides raw database errors from batch index chunk responses', async () => {
    const data = [];
    const response = await batchIndexChunkPost({
      env: throwingEnv(),
      request: jsonRequest('https://example.com/api/manage/batch/index/chunk', {
        chunkId: '0',
        sessionId: 'rebuild_secret',
        data,
        checksum: await sha256Json(data),
      }),
    });

    await assertGeneric500(response, 'Database write error');
  });

  it('hides raw database errors from batch index finalize responses', async () => {
    const response = await batchIndexFinalizePost({
      env: throwingEnv(),
      request: jsonRequest('https://example.com/api/manage/batch/index/finalize', {
        sessionId: 'rebuild_secret',
        totalChunks: 0,
        totalFiles: 0,
      }),
    });

    await assertGeneric500(response, 'Server error');
  });

  it('hides raw save-index errors from batch index finalize details', async () => {
    const img_url = new MemoryKV();
    const response = await batchIndexFinalizePost({
      env: { img_url },
      request: jsonRequest('https://example.com/api/manage/batch/index/finalize', {
        sessionId: 'rebuild_secret',
        totalChunks: 0,
        totalFiles: 0,
      }),
    });

    await assertGeneric500(response, 'Failed to save empty index');
  });

  it('hides raw database errors from batch restore chunk responses', async () => {
    const response = await batchRestoreChunkPost({
      env: throwingEnv(),
      request: jsonRequest('https://example.com/api/manage/batch/restore/chunk', {
        type: 'files',
        data: {
          'photos/private.jpg': {
            metadata: { FileName: 'private.jpg' },
          },
        },
      }),
    });

    await assertGeneric500(response, 'Server error');
  });

  it('hides raw per-file restore errors from partial failure responses', async () => {
    const img_url = new MemoryKV();
    img_url.failPutKeys = new Set(['photos/private.jpg']);
    const response = await batchRestoreChunkPost({
      env: { img_url },
      request: jsonRequest('https://example.com/api/manage/batch/restore/chunk', {
        type: 'files',
        data: {
          'photos/private.jpg': {
            metadata: { FileName: 'private.jpg' },
          },
        },
      }),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.failedCount, 1);
    assert.equal(payload.errors[0].error, 'Failed to restore file');
    assert.ok(!JSON.stringify(payload).includes(INTERNAL_MESSAGE));
  });

  it('hides raw per-setting restore errors from partial failure responses', async () => {
    const img_url = new MemoryKV();
    img_url.failPutKeys = new Set(['manage@sysConfig@upload']);
    const response = await batchRestoreChunkPost({
      env: { img_url },
      request: jsonRequest('https://example.com/api/manage/batch/restore/chunk', {
        type: 'settings',
        data: {
          'sysConfig@upload': {
            telegram: [],
          },
        },
      }),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.failedCount, 1);
    assert.equal(payload.errors[0].error, 'Failed to restore setting');
    assert.ok(!JSON.stringify(payload).includes(INTERNAL_MESSAGE));
  });
});
