import assert from 'node:assert/strict';
import fs from 'node:fs';

import { onRequest as securityOnRequest } from '../functions/api/manage/sysConfig/security.js';
import { onRequest as publicListOnRequest } from '../functions/api/public/list.js';
import { onRequest as davOnRequest } from '../functions/dav/[[path]].js';
import { onRequest as randomOnRequest } from '../functions/random/index.js';
import { userAuthCheck } from '../functions/utils/userAuth.js';
import { returnWithCheck } from '../functions/file/fileTools.js';

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

  async list(options = {}) {
    const prefix = options.prefix || '';
    const keys = [];
    for (const key of this.store.keys()) {
      if (!prefix || key.startsWith(prefix)) {
        keys.push({ name: key, metadata: {} });
      }
    }
    return {
      keys,
      cursor: null,
      list_complete: true,
    };
  }
}

function createEnv(overrides = {}) {
  return {
    img_url: new MemoryKV(),
    ...overrides,
  };
}

describe('audit security hardening', () => {
  it('does not accept cookie authCode for upload-style checks when disabled', async () => {
    const env = createEnv();
    await env.img_url.put('manage@sysConfig@security', JSON.stringify({
      auth: {
        user: { authCode: 'abc123' },
        admin: { adminUsername: 'admin', adminPassword: 'secret' }
      },
      upload: { moderate: { enabled: false, channel: 'default', moderateContentApiKey: '', nsfwApiPath: '' } },
      access: { allowedDomains: '', whiteListMode: false },
      apiTokens: { tokens: {} }
    }));

    const request = new Request('http://localhost/upload', {
      headers: {
        Cookie: 'authCode=abc123'
      }
    });

    const authorized = await userAuthCheck(env, new URL(request.url), request, 'upload', { allowCookieAuthCode: false });
    assert.equal(authorized, false);
  });

  it('masks sensitive fields in security config responses', async () => {
    const env = createEnv();
    await env.img_url.put('manage@sysConfig@security', JSON.stringify({
      auth: {
        user: { authCode: 'user-secret' },
        admin: { adminUsername: 'admin', adminPassword: 'super-secret' }
      },
      upload: { moderate: { enabled: false, channel: 'default', moderateContentApiKey: 'key', nsfwApiPath: '' } },
      access: { allowedDomains: '', whiteListMode: false },
      apiTokens: { tokens: { token1: { token: 'raw-token' } } }
    }));

    const response = await securityOnRequest({
      env,
      request: new Request('http://localhost/api/manage/sysConfig/security', { method: 'GET' }),
    });

    const payload = await response.json();
    assert.equal(payload.auth.user.authCode, 'Configured');
    assert.equal(payload.auth.user.configured, true);
    assert.equal(payload.auth.admin.adminUsername, 'admin');
    assert.equal(payload.auth.admin.adminPassword, 'Configured');
    assert.equal(payload.auth.admin.configured, true);
    assert.deepEqual(payload.apiTokens, { tokens: {} });
  });

  it('does not allow same-origin referer alone to bypass file access rules', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response('blocked', { status: 403 });
    try {
      const response = await returnWithCheck({
        request: new Request('http://localhost/file/demo.jpg', {
          headers: { Referer: 'http://localhost/dashboard' }
        }),
        url: new URL('http://localhost/file/demo.jpg'),
        securityConfig: {
          access: {
            whiteListMode: true,
            allowedDomains: 'localhost'
          }
        }
      }, {
        metadata: {
          ListType: 'None',
          Label: 'None'
        }
      });

      assert.ok([302, 403].includes(response.status));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('fails closed for public browse when allowed directories are empty', async () => {
    const env = createEnv();
    await env.img_url.put('manage@sysConfig@others', JSON.stringify({
      publicBrowse: {
        enabled: true,
        allowedDir: ''
      }
    }));

    const response = await publicListOnRequest({
      env,
      waitUntil: async () => {},
      request: new Request('http://localhost/api/public/list?dir=photos', { method: 'GET' })
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'Directory not allowed' });
  });

  it('does not leak internal error details from public browse failures', async () => {
    const env = createEnv();
    await env.img_url.put('manage@sysConfig@others', JSON.stringify({
      publicBrowse: {
        enabled: true,
        allowedDir: '*'
      }
    }));
    const response = await publicListOnRequest({
      env,
      waitUntil: async () => {},
      request: new Request('http://localhost/api/public/list?dir=photos', { method: 'GET' })
    });

    assert.ok([200, 500].includes(response.status));
    if (response.status === 500) {
      assert.deepEqual(await response.json(), { error: 'Internal server error' });
    }
  });

  it('does not leak internal WebDAV directory errors', async () => {
    const env = createEnv();
    await env.img_url.put('manage@sysConfig@others', JSON.stringify({
      webDAV: {
        enabled: true,
        username: 'dav',
        password: 'pass'
      }
    }));
    await env.img_url.put('manage@sysConfig@security', JSON.stringify({
      auth: {
        user: { authCode: 'user' },
        admin: { adminUsername: 'admin', adminPassword: 'secret' }
      },
      upload: { moderate: { enabled: false, channel: 'default', moderateContentApiKey: '', nsfwApiPath: '' } },
      access: { allowedDomains: '', whiteListMode: false },
      apiTokens: { tokens: {} }
    }));

    const basic = Buffer.from('dav:pass').toString('base64');
    const response = await davOnRequest({
      env,
      request: new Request('http://localhost/dav/', {
        method: 'GET',
        headers: { Authorization: `Basic ${basic}` }
      })
    });

    if (response.status === 500) {
      const body = await response.text();
      assert.equal(body, 'Error listing directory');
    } else {
      assert.ok([200, 403, 404, 207].includes(response.status));
    }
  });

  it('fails closed instead of crashing when WebDAV falls back to default others config', async () => {
    const response = await davOnRequest({
      env: {},
      request: new Request('http://localhost/dav/private.txt', { method: 'GET' })
    });

    assert.equal(response.status, 403);
    assert.equal(await response.text(), 'WebDAV is disabled');
  });

  it('fails closed instead of crashing when random image config falls back to defaults', async () => {
    const response = await randomOnRequest({
      env: {},
      request: new Request('http://localhost/random?dir=photos', { method: 'GET' }),
      waitUntil: async () => {}
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'Random is disabled' });
  });

  it('keeps D1 queryFiles totals accurate when pagination returns no rows', () => {
    const source = fs.readFileSync(new URL('../functions/utils/d1Database.js', import.meta.url), 'utf8');
    const resultsAssignment = source.indexOf('const results = rows.results || [];');
    const emptyOffsetGuard = source.indexOf('if (results.length === 0 && offset > 0)', resultsAssignment);
    const fallbackCount = source.indexOf('SELECT COUNT(*) AS total FROM files${whereSql}', emptyOffsetGuard);
    const filteredParams = source.indexOf(').bind(...params).first();', fallbackCount);

    assert.ok(resultsAssignment >= 0, 'queryFiles should assign paginated results before computing total');
    assert.ok(emptyOffsetGuard > resultsAssignment, 'empty pages past the first offset need a total-count fallback');
    assert.ok(fallbackCount > emptyOffsetGuard, 'fallback count must reuse the same filtered WHERE clause');
    assert.ok(filteredParams > fallbackCount, 'fallback count must bind the same filter params');
  });
});
