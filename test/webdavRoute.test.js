import assert from 'node:assert/strict';

import { onRequest } from '../functions/dav/[[path]].js';

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

function createWebDavRequest(pathname, { method = 'GET', headers = {} } = {}) {
  return new Request(`http://localhost${pathname}`, {
    method,
    headers,
  });
}

describe('WebDAV route', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fails closed when WebDAV is enabled without credentials', async () => {
    let fetchCalled = false;
    global.fetch = async () => {
      fetchCalled = true;
      throw new Error('fetch should not be called');
    };

    const response = await onRequest({
      env: createEnv({
        kvEntries: {
          'manage@sysConfig@others': JSON.stringify({
            webDAV: { enabled: true, username: '', password: '' }
          })
        }
      }),
      request: createWebDavRequest('/dav/private.txt'),
    });

    assert.equal(response.status, 503);
    assert.equal(await response.text(), 'WebDAV credentials are not configured');
    assert.equal(fetchCalled, false);
  });

  it('uses internal auth headers when proxying file downloads', async () => {
    const calls = [];
    global.fetch = async (url, options = {}) => {
      calls.push({ url, options });
      return new Response('file-data', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
        }
      });
    };

    const response = await onRequest({
      env: createEnv({
        BASIC_USER: 'admin',
        BASIC_PASS: 'secret',
        AUTH_CODE: 'user-code',
        kvEntries: {
          'manage@sysConfig@others': JSON.stringify({
            webDAV: { enabled: true, username: 'dav', password: 'dav-pass' }
          })
        }
      }),
      request: createWebDavRequest('/dav/docs/readme.txt', {
        headers: {
          Authorization: `Basic ${Buffer.from('dav:dav-pass').toString('base64')}`
        }
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'file-data');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://localhost/file/docs/readme.txt');
    assert.equal(calls[0].options.headers.Authorization, `Basic ${Buffer.from('admin:secret').toString('base64')}`);
    assert.equal(calls[0].options.headers.authCode, 'user-code');
  });

  it('returns 400 for malformed Basic auth instead of throwing', async () => {
    const response = await onRequest({
      env: createEnv({
        kvEntries: {
          'manage@sysConfig@others': JSON.stringify({
            webDAV: { enabled: true, username: 'dav', password: 'dav-pass' }
          })
        }
      }),
      request: createWebDavRequest('/dav/docs/readme.txt', {
        headers: {
          Authorization: 'Basic %%%'
        }
      }),
    });

    assert.equal(response.status, 400);
    assert.equal(await response.text(), 'Invalid Authorization value');
  });

  it('escapes PROPFIND XML text values from file metadata', async () => {
    global.fetch = async () => new Response(JSON.stringify({
      files: [
        {
          name: 'docs/a&b<evil>.txt',
          metadata: { 'File-Size': '1&2<3' }
        }
      ],
      directories: ['docs/x&y<dir>']
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

    const response = await onRequest({
      env: createEnv({
        BASIC_USER: 'admin',
        BASIC_PASS: 'secret',
        AUTH_CODE: 'user-code',
        kvEntries: {
          'manage@sysConfig@others': JSON.stringify({
            webDAV: { enabled: true, username: 'dav', password: 'dav-pass' }
          }),
          'manage@sysConfig@security': JSON.stringify({
            auth: {
              user: { authCode: 'user-code' },
              admin: { adminUsername: 'admin', adminPassword: 'secret' }
            },
            upload: { moderate: { enabled: false, channel: 'default', moderateContentApiKey: '', nsfwApiPath: '' } },
            access: { allowedDomains: '', whiteListMode: false },
            apiTokens: { tokens: {} }
          })
        }
      }),
      request: createWebDavRequest('/dav/docs/', {
        method: 'PROPFIND',
        headers: {
          Authorization: `Basic ${Buffer.from('dav:dav-pass').toString('base64')}`
        }
      }),
    });

    const body = await response.text();
    assert.equal(response.status, 207);
    assert.match(body, /<D:displayname>x&amp;y&lt;dir&gt;<\/D:displayname>/);
    assert.match(body, /<D:displayname>a&amp;b&lt;evil&gt;\.txt<\/D:displayname>/);
    assert.match(body, /<D:getcontentlength>1&amp;2&lt;3<\/D:getcontentlength>/);
    assert.doesNotMatch(body, /<D:displayname>x&y<dir><\/D:displayname>/);
    assert.doesNotMatch(body, /<D:displayname>a&b<evil>\.txt<\/D:displayname>/);
  });

  it('does not forward internal delete API errors to WebDAV clients', async () => {
    const internalMessage = 'D1 shard failed for private_token_456';
    global.fetch = async () => new Response(JSON.stringify({
      success: false,
      error: internalMessage
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });

    const response = await onRequest({
      env: createEnv({
        BASIC_USER: 'admin',
        BASIC_PASS: 'secret',
        AUTH_CODE: 'user-code',
        kvEntries: {
          'manage@sysConfig@others': JSON.stringify({
            webDAV: { enabled: true, username: 'dav', password: 'dav-pass' }
          }),
          'manage@sysConfig@security': JSON.stringify({
            auth: {
              user: { authCode: 'user-code' },
              admin: { adminUsername: 'admin', adminPassword: 'secret' }
            },
            upload: { moderate: { enabled: false, channel: 'default', moderateContentApiKey: '', nsfwApiPath: '' } },
            access: { allowedDomains: '', whiteListMode: false },
            apiTokens: { tokens: {} }
          })
        }
      }),
      request: createWebDavRequest('/dav/docs/private.txt', {
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${Buffer.from('dav:dav-pass').toString('base64')}`
        }
      }),
    });

    const body = await response.text();
    assert.equal(response.status, 500);
    assert.equal(body, 'Deletion failed');
    assert.doesNotMatch(body, /private_token_456/);
  });
});
