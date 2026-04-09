import assert from 'node:assert/strict';

import {
  onRequest,
  onRequestOptions,
} from '../functions/api/manage/sysConfig/upload.js';

class MemoryKV {
  constructor(initialEntries = {}) {
    this.store = new Map(Object.entries(initialEntries));
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async put(key, value) {
    this.store.set(key, String(value));
  }
}

function createEnv(overrides = {}) {
  return {
    img_url: new MemoryKV(),
    ...overrides,
  };
}

describe('sysConfig upload route', () => {
  it('returns CORS headers for OPTIONS', async () => {
    const response = onRequestOptions();

    assert.equal(response.status, 204);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, POST, OPTIONS');
  });

  it('returns 500 with CORS headers when stored upload config JSON is corrupted', async () => {
    const env = createEnv({
      img_url: new MemoryKV({
        'manage@sysConfig@upload': '{"telegram":',
      }),
    });

    const response = await onRequest({
      env,
      request: new Request('http://localhost/api/manage/sysConfig/upload', {
        method: 'GET',
      }),
    });

    assert.equal(response.status, 500);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    const payload = await response.json();
    assert.deepEqual(payload, {
      success: false,
      error: 'Corrupted config data',
    });
  });

  it('returns 400 with CORS headers for invalid JSON bodies', async () => {
    const response = await onRequest({
      env: createEnv(),
      request: new Request('http://localhost/api/manage/sysConfig/upload', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: '{"telegram":',
      }),
    });

    assert.equal(response.status, 400);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    const payload = await response.json();
    assert.deepEqual(payload, {
      success: false,
      error: 'Invalid JSON body',
    });
  });
});
