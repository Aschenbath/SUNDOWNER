import assert from 'node:assert/strict';

import { onRequest } from '../functions/api/manage/tags/[[path]].js';
import { onRequest as autocompleteOnRequest } from '../functions/api/manage/tags/autocomplete.js';
import { onRequest as batchTagsOnRequest } from '../functions/api/manage/tags/batch.js';

class MemoryKV {
  constructor(initialEntries = {}, options = {}) {
    this.store = new Map(Object.entries(initialEntries));
    this.getDelayMs = options.getDelayMs || 0;
    this.getWithMetadataCalls = 0;
    this.putCalls = 0;
    this.filePutCalls = 0;
    this.activeGets = 0;
    this.maxActiveGets = 0;
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async getWithMetadata(key) {
    this.getWithMetadataCalls++;
    this.activeGets++;
    this.maxActiveGets = Math.max(this.maxActiveGets, this.activeGets);
    try {
      if (this.getDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.getDelayMs));
      }
      if (!this.store.has(key)) {
        return null;
      }
      const record = JSON.parse(this.store.get(key));
      return {
        value: record.value || '',
        metadata: { ...(record.metadata || {}) },
      };
    } finally {
      this.activeGets--;
    }
  }

  async put(key, value, options = {}) {
    this.putCalls++;
    if (!key.startsWith('manage@')) {
      this.filePutCalls++;
    }
    this.store.set(key, JSON.stringify({
      value,
      metadata: options.metadata || {},
    }));
  }

  async list(options = {}) {
    const prefix = options.prefix || '';
    return {
      keys: [...this.store.keys()]
        .filter((name) => !prefix || name.startsWith(prefix))
        .map((name) => ({ name, metadata: {} })),
      cursor: null,
      list_complete: true,
    };
  }
}

function createContext(path) {
  return {
    env: { img_url: new MemoryKV() },
    params: { path },
    waitUntil: async () => {},
    request: new Request('https://example.com/api/manage/tags/bad', { method: 'GET' }),
  };
}

describe('manage tags route', () => {
  it('returns 400 for malformed encoded file paths instead of throwing outside the handler', async () => {
    const response = await onRequest(createContext('%E0%A4%A'));
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error, 'Invalid file path');
  });

  it('rejects non-numeric autocomplete limits instead of returning an empty success page', async () => {
    const response = await autocompleteOnRequest({
      env: { img_url: new MemoryKV() },
      request: new Request('https://example.com/api/manage/tags/autocomplete?limit=abc', { method: 'GET' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error, 'Invalid limit');
  });

  it('persists tag metadata through the KV adapter metadata whitelist', async () => {
    const kv = new MemoryKV({
      'photos/a.jpg': JSON.stringify({ value: 'bytes', metadata: { FileName: 'a.jpg', Tags: [] } }),
    });
    const update = await onRequest({
      env: { img_url: kv },
      params: { path: 'photos,a.jpg' },
      waitUntil: async () => {},
      request: new Request('https://example.com/api/manage/tags/photos/a.jpg', {
        method: 'POST',
        body: JSON.stringify({
          action: 'add',
          tags: ['summer'],
        }),
      }),
    });
    const updatePayload = await update.json();

    assert.equal(update.status, 200);
    assert.deepEqual(updatePayload.tags, ['summer']);

    const readBack = await onRequest({
      env: { img_url: kv },
      params: { path: 'photos,a.jpg' },
      waitUntil: async () => {},
      request: new Request('https://example.com/api/manage/tags/photos/a.jpg', { method: 'GET' }),
    });
    const readPayload = await readBack.json();

    assert.equal(readBack.status, 200);
    assert.deepEqual(readPayload.tags, ['summer']);
  });

  it('rejects oversized batch tag updates before touching storage', async () => {
    const kv = new MemoryKV();
    const response = await batchTagsOnRequest({
      env: { img_url: kv },
      waitUntil: async () => {},
      request: new Request('https://example.com/api/manage/tags/batch', {
        method: 'POST',
        body: JSON.stringify({
          fileIds: Array.from({ length: 101 }, (_, index) => `photos/${index}.jpg`),
          action: 'add',
          tags: ['summer'],
        }),
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error, 'Too many fileIds');
    assert.equal(kv.getWithMetadataCalls, 0);
    assert.equal(kv.putCalls, 0);
  });

  it('updates batch tags with bounded storage concurrency', async () => {
    const entries = Object.fromEntries(
      Array.from({ length: 7 }, (_, index) => [
        `photos/${index}.jpg`,
        JSON.stringify({ value: `bytes-${index}`, metadata: { Tags: [] } }),
      ])
    );
    const kv = new MemoryKV(entries, { getDelayMs: 10 });

    const response = await batchTagsOnRequest({
      env: { img_url: kv },
      waitUntil: async () => {},
      request: new Request('https://example.com/api/manage/tags/batch', {
        method: 'POST',
        body: JSON.stringify({
          fileIds: Object.keys(entries),
          action: 'add',
          tags: ['summer'],
        }),
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.updated, 7);
    assert.equal(kv.filePutCalls, 7);
    assert.ok(kv.maxActiveGets > 1, `expected concurrent reads, saw ${kv.maxActiveGets}`);
    assert.ok(kv.maxActiveGets <= 3, `expected at most 3 concurrent reads, saw ${kv.maxActiveGets}`);
  });
});
