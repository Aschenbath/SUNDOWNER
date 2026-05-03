import assert from 'node:assert/strict';

import { onRequestOptions as loginOptions, onRequestPost as loginPost } from '../functions/api/login.js';
import { onRequest } from '../functions/api/userConfig.js';
import { onRequest as listRequest } from '../functions/api/manage/list.js';
import { onRequest as albumsRequest } from '../functions/api/manage/albums/[[path]].js';
import { onRequestOptions as authSessionOptions, onRequestPost as authSessionPost } from '../functions/api/manage/auth-session.js';
import { onRequest as channelsRequest } from '../functions/api/channels.js';
import { onRequest as directoryTreeRequest } from '../functions/api/directoryTree.js';

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

  async delete(key) {
    this.store.delete(key);
  }

  async list() {
    return { keys: [], list_complete: true, cursor: '' };
  }

  async getWithMetadata() {
    return null;
  }
}

function createEnv({ pageConfig = null, securityConfig = null, uploadConfig = null, authCode = '' } = {}) {
  const entries = {};
  if (pageConfig) {
    entries['manage@sysConfig@page'] = JSON.stringify(pageConfig);
  }
  if (securityConfig) {
    entries['manage@sysConfig@security'] = JSON.stringify(securityConfig);
  }
  if (uploadConfig) {
    entries['manage@sysConfig@upload'] = JSON.stringify(uploadConfig);
  }
  return {
    img_url: new MemoryKV(entries),
    AUTH_CODE: authCode,
  };
}

function assertCors(response) {
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'Content-Type, Authorization');
}

describe('API CORS responses', () => {
  it('returns OPTIONS /api/login with CORS headers', async () => {
    const response = loginOptions();
    assert.equal(response.status, 204);
    assertCors(response);
  });

  it('returns invalid body /api/login with CORS headers', async () => {
    const response = await loginPost({
      env: createEnv(),
      request: new Request('http://localhost/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      }),
    });
    assert.equal(response.status, 400);
    assertCors(response);
  });

  it('returns OPTIONS /api/userConfig with CORS headers', async () => {
    const response = await onRequest({
      env: createEnv(),
      request: new Request('http://localhost/api/userConfig', { method: 'OPTIONS' }),
    });
    assert.equal(response.status, 204);
    assertCors(response);
  });

  it('returns invalid stored user config with CORS headers', async () => {
    const response = await onRequest({
      env: createEnv({
        pageConfig: {
          config: [
            { id: 'showDirectorySuggestions', value: '{bad' },
          ],
        },
      }),
      request: new Request('http://localhost/api/userConfig', { method: 'GET' }),
    });
    assert.equal(response.status, 500);
    assertCors(response);
  });

  it('returns OPTIONS /api/manage/list with CORS headers', async () => {
    const response = await listRequest({
      request: new Request('http://localhost/api/manage/list', { method: 'OPTIONS' }),
      waitUntil() {},
      env: createEnv(),
    });
    assert.equal(response.status, 204);
    assertCors(response);
  });

  it('returns method not allowed on /api/manage/list with CORS headers', async () => {
    const response = await listRequest({
      request: new Request('http://localhost/api/manage/list', { method: 'POST' }),
      waitUntil() {},
      env: createEnv(),
    });
    assert.equal(response.status, 405);
    assertCors(response);
    assert.equal(response.headers.get('Allow'), 'GET, OPTIONS');
  });

  it('returns OPTIONS /api/manage/albums with CORS headers', async () => {
    const response = await albumsRequest({
      env: createEnv(),
      params: {},
      request: new Request('http://localhost/api/manage/albums', { method: 'OPTIONS' }),
    });
    assert.equal(response.status, 204);
    assertCors(response);
  });

  it('returns albums GET fallback validation response with CORS headers', async () => {
    const response = await albumsRequest({
      env: createEnv(),
      params: {},
      request: new Request('http://localhost/api/manage/albums', { method: 'PUT' }),
    });
    assert.equal(response.status, 400);
    assertCors(response);
  });

  it('returns auth-session invalid JSON with CORS headers', async () => {
    const response = await authSessionPost({
      env: createEnv(),
      request: new Request('http://localhost/api/manage/auth-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      }),
    });
    assert.equal(response.status, 400);
    assertCors(response);
  });

  it('returns OPTIONS /api/manage/auth-session with CORS headers', async () => {
    const response = authSessionOptions();
    assert.equal(response.status, 204);
    assertCors(response);
  });

  it('returns OPTIONS /api/channels with CORS headers', async () => {
    const response = await channelsRequest({
      env: createEnv(),
      request: new Request('http://localhost/api/channels', { method: 'OPTIONS' }),
    });
    assert.equal(response.status, 204);
    assertCors(response);
  });

  it('returns unsupported method /api/channels with CORS headers and Allow header', async () => {
    const response = await channelsRequest({
      env: createEnv(),
      request: new Request('http://localhost/api/channels', { method: 'POST' }),
    });
    assert.equal(response.status, 405);
    assertCors(response);
    assert.equal(response.headers.get('Allow'), 'GET, OPTIONS');
  });

  it('returns normal /api/channels response with CORS headers', async () => {
    const response = await channelsRequest({
      env: createEnv({
        securityConfig: {
          auth: { user: { authCode: 'user-code' }, admin: { adminUsername: '', adminPassword: '' } },
          upload: { moderate: { enabled: false, channel: 'default', moderateContentApiKey: '', nsfwApiPath: '' } },
          access: { allowedDomains: '', whiteListMode: false },
          apiTokens: { tokens: {} },
        },
        uploadConfig: {
          telegram: { channels: [] },
          cfr2: { channels: [] },
          s3: { channels: [] },
          discord: { channels: [] },
          huggingface: { channels: [] },
        },
        authCode: 'user-code',
      }),
      request: new Request('http://localhost/api/channels', {
        method: 'GET',
        headers: { authCode: 'user-code' },
      }),
    });
    assert.equal(response.status, 200);
    assertCors(response);
  });

  it('returns OPTIONS /api/directoryTree with CORS headers', async () => {
    const response = await directoryTreeRequest({
      env: createEnv(),
      request: new Request('http://localhost/api/directoryTree', { method: 'OPTIONS' }),
      waitUntil() {},
      data: {},
    });
    assert.equal(response.status, 204);
    assertCors(response);
  });

  it('returns unauthorized /api/directoryTree with CORS headers', async () => {
    const response = await directoryTreeRequest({
      env: createEnv(),
      request: new Request('http://localhost/api/directoryTree', { method: 'GET' }),
      waitUntil() {},
      data: {},
    });
    assert.equal(response.status, 401);
    assertCors(response);
  });

  it('returns unsupported method /api/directoryTree with CORS headers and Allow header', async () => {
    const response = await directoryTreeRequest({
      env: createEnv(),
      request: new Request('http://localhost/api/directoryTree', { method: 'POST' }),
      waitUntil() {},
      data: {},
    });
    assert.equal(response.status, 405);
    assertCors(response);
    assert.equal(response.headers.get('Allow'), 'GET, OPTIONS');
  });
});
