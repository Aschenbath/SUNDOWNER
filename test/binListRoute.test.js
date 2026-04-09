import assert from 'node:assert/strict';

import { onRequest } from '../functions/api/manage/bin/list.js';

class MemoryKV {
  constructor(entries = []) {
    this.entries = new Map(entries.map((entry) => [entry.name, entry]));
    this.lastListOptions = null;
  }

  async get() {
    return null;
  }

  async put() {}

  async delete() {}

  async list(options = {}) {
    this.lastListOptions = { ...options };
    return {
      keys: [...this.entries.values()].map((entry) => ({
        name: entry.name,
        metadata: entry.metadata || {},
      })),
      list_complete: true,
      cursor: '',
    };
  }
}

function createRecycleRecord(name, deletedAt) {
  return {
    name,
    metadata: {
      RecycleBin: 'true',
      DeletedAt: String(deletedAt),
      FileName: `${name}.jpg`,
    },
  };
}

function createContext(env, limitQuery = '') {
  const suffix = limitQuery ? `?limit=${limitQuery}` : '';
  return {
    env,
    waitUntil() {},
    request: new Request(`http://localhost/api/manage/bin/list${suffix}`, {
      method: 'GET',
    }),
  };
}

describe('bin list route', () => {
  it('clamps negative limit values before scanning recycle-bin records', async () => {
    const now = Date.now();
    const env = {
      img_url: new MemoryKV([
        createRecycleRecord('alpha.jpg', now - 1_000),
        createRecycleRecord('beta.jpg', now - 2_000),
      ]),
    };

    const response = await onRequest(createContext(env, '-10'));

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.files.length, 1);
    assert.equal(payload.files[0].id, 'alpha.jpg');
    assert.equal(env.img_url.lastListOptions.limit, 500);
  });

  it('keeps the 500 upper bound for oversized limit values', async () => {
    const now = Date.now();
    const env = {
      img_url: new MemoryKV([
        createRecycleRecord('alpha.jpg', now - 1_000),
      ]),
    };

    const response = await onRequest(createContext(env, '9999'));

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.files.length, 1);
    assert.equal(env.img_url.lastListOptions.limit, 500);
  });
});
