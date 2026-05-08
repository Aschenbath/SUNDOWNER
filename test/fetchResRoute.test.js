import assert from 'node:assert/strict';

import { onRequest } from '../functions/api/fetchRes.js';

class MemoryKV {
  constructor(initialEntries = {}) {
    this.store = new Map(Object.entries(initialEntries));
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
}

function createEnv(overrides = {}) {
  return {
    img_url: new MemoryKV(),
    FETCH_RES_ALLOWED_HOSTS: 'example.com',
    AUTH_CODE: 'test-auth-code',
    ...overrides,
  };
}

function createRequest(url, { method = 'POST', body } = {}) {
  const init = {
    method,
    headers: {
      'content-type': 'application/json',
      authCode: 'test-auth-code',
    },
  };
  if (!['GET', 'HEAD'].includes(method)) {
    init.body = body ?? JSON.stringify({ url });
  }
  return new Request('http://localhost/api/fetchRes', init);
}

describe('fetchRes route', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('rejects non-POST requests', async () => {
    const response = await onRequest({
      env: createEnv(),
      request: createRequest('https://assets.example.com/file.jpg', { method: 'GET', body: undefined }),
    });

    assert.equal(response.status, 405);
    assert.deepEqual(await response.json(), { error: 'Method not allowed' });
  });

  it('rejects explicit non-standard target ports', async () => {
    const response = await onRequest({
      env: createEnv(),
      request: createRequest('https://assets.example.com:444/file.jpg'),
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'Target port is not allowed' });
  });

  it('follows safe allowlisted redirects manually and strips set-cookie', async () => {
    const calls = [];
    global.fetch = async (url, options = {}) => {
      calls.push({ url, options });
      if (calls.length === 1) {
        return new Response(null, {
          status: 302,
          headers: {
            Location: 'https://cdn.example.com/file.jpg',
          },
        });
      }
      return new Response('image-data', {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Set-Cookie': 'session=1',
        },
      });
    };

    const response = await onRequest({
      env: createEnv(),
      request: createRequest('https://assets.example.com/file.jpg'),
    });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'image-data');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('Set-Cookie'), null);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map((entry) => entry.options?.redirect), ['manual', 'manual']);
  });

  it('blocks redirects that leave the allowlist or hit private targets', async () => {
    const calls = [];
    global.fetch = async (url, options = {}) => {
      calls.push({ url, options });
      return new Response(null, {
        status: 302,
        headers: {
          Location: 'http://127.0.0.1/internal',
        },
      });
    };

    const response = await onRequest({
      env: createEnv(),
      request: createRequest('https://assets.example.com/file.jpg'),
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'Private or local targets are blocked' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options?.redirect, 'manual');
  });
});
