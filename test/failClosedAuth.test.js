import assert from 'node:assert/strict';

import { onRequestPost as loginPost } from '../functions/api/login.js';
import { onRequestPost as adminSessionPost } from '../functions/api/manage/auth-session.js';
import { dualAuthCheck } from '../functions/utils/dualAuth.js';
import { userAuthCheck } from '../functions/utils/userAuth.js';

class MemoryKV {
  constructor(initialEntries = {}) {
    this.store = new Map(Object.entries(initialEntries));
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
}

function createEnv({
  kvEntries = {},
  BASIC_USER = '',
  BASIC_PASS = '',
  AUTH_CODE = '',
} = {}) {
  return {
    img_url: new MemoryKV(kvEntries),
    BASIC_USER,
    BASIC_PASS,
    AUTH_CODE,
  };
}

describe('fail-closed auth helpers', () => {
  it('rejects user auth checks when authCode is not configured', async () => {
    const request = new Request('http://localhost/upload');
    const authorized = await userAuthCheck(createEnv(), new URL(request.url), request, 'upload');
    assert.equal(authorized, false);
  });

  it('rejects dual auth checks when neither admin nor user credentials are configured', async () => {
    const request = new Request('http://localhost/api/directoryTree');
    const result = await dualAuthCheck(createEnv(), new URL(request.url), request);
    assert.deepEqual(result, { authorized: false, authType: null });
  });
});

describe('fail-closed auth routes', () => {
  it('returns 503 for user login when authCode is not configured', async () => {
    const response = await loginPost({
      env: createEnv(),
      request: new Request('http://localhost/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authCode: 'anything' }),
      }),
    });

    assert.equal(response.status, 503);
    assert.equal(await response.text(), 'User auth code is not configured');
  });

  it('returns 503 for admin session login when admin credentials are not configured', async () => {
    const response = await adminSessionPost({
      env: createEnv(),
      request: new Request('http://localhost/api/manage/auth-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'secret' }),
      }),
    });

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'Admin credentials are not configured' });
  });
});
