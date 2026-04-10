import assert from 'node:assert/strict';

import { onRequest } from '../functions/api/manage/_middleware.js';

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
    BASIC_USER: '',
    BASIC_PASS: '',
    ...overrides,
  };
}

async function runManageMiddleware({
  request,
  env = createEnv(),
  data = {},
  finalHandler = async () => new Response('ok'),
} = {}) {
  async function dispatch(index) {
    const middleware = onRequest[index];
    if (!middleware) {
      return finalHandler();
    }

    return middleware({
      request,
      env,
      data,
      next: () => dispatch(index + 1),
    });
  }

  return dispatch(0);
}

describe('manage middleware', () => {
  it('returns 400 for malformed Basic auth values instead of collapsing to 401', async () => {
    const response = await runManageMiddleware({
      env: createEnv({
        BASIC_USER: 'admin',
        BASIC_PASS: 'secret',
      }),
      request: new Request('http://localhost/api/manage/list', {
        headers: {
          Authorization: 'Basic !!!',
        },
      }),
    });

    assert.equal(response.status, 400);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(await response.text(), 'Invalid authorization value.');
  });

  it('returns a generic 500 response without leaking stack traces', async () => {
    const response = await runManageMiddleware({
      request: new Request('http://localhost/api/manage/list'),
      finalHandler: async () => {
        throw new Error('kaboom');
      },
    });

    const body = await response.text();
    assert.equal(response.status, 500);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(body, 'Internal Server Error');
    assert.equal(body.includes('kaboom'), false);
    assert.equal(body.includes('Error:'), false);
  });
});
