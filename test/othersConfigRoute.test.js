import assert from 'node:assert/strict';

import {
  getOthersConfig,
  onRequest,
} from '../functions/api/manage/sysConfig/others.js';

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

describe('sysConfig others route', () => {
  it('masks operator secrets in management responses', async () => {
    const env = createEnv({
      CF_ZONE_ID: 'env-zone',
      CF_EMAIL: 'env@example.com',
      CF_API_KEY: 'env-cf-api-key',
      img_url: new MemoryKV({
        'manage@sysConfig@others': JSON.stringify({
          cloudflareApiToken: {
            CF_ZONE_ID: 'kv-zone',
            CF_EMAIL: 'kv@example.com',
            CF_API_KEY: 'kv-cf-api-key',
          },
          webDAV: {
            enabled: true,
            username: 'dav-user',
            password: 'kv-webdav-password',
          },
        }),
      }),
    });

    const response = await onRequest({
      env,
      request: new Request('http://localhost/api/manage/sysConfig/others', {
        method: 'GET',
      }),
    });

    assert.equal(response.status, 200);
    const text = await response.text();
    assert.equal(text.includes('kv-cf-api-key'), false);
    assert.equal(text.includes('env-cf-api-key'), false);
    assert.equal(text.includes('kv-webdav-password'), false);

    const payload = JSON.parse(text);
    assert.equal(payload.cloudflareApiToken.CF_API_KEY, 'Configured');
    assert.equal(payload.webDAV.password, 'Configured');
    assert.equal(payload.cloudflareApiToken.CF_EMAIL, 'kv@example.com');
    assert.equal(payload.webDAV.username, 'dav-user');
  });

  it('keeps real operator secrets available to internal config consumers', async () => {
    const db = new MemoryKV({
      'manage@sysConfig@others': JSON.stringify({
        cloudflareApiToken: {
          CF_ZONE_ID: 'kv-zone',
          CF_EMAIL: 'kv@example.com',
          CF_API_KEY: 'kv-cf-api-key',
        },
        webDAV: {
          enabled: true,
          username: 'dav-user',
          password: 'kv-webdav-password',
        },
      }),
    });

    const config = await getOthersConfig(db, createEnv({
      CF_API_KEY: 'env-cf-api-key',
    }));

    assert.equal(config.cloudflareApiToken.CF_API_KEY, 'kv-cf-api-key');
    assert.equal(config.webDAV.password, 'kv-webdav-password');
  });

  it('preserves stored operator secrets when management posts masked placeholders', async () => {
    const kv = new MemoryKV({
      'manage@sysConfig@others': JSON.stringify({
        cloudflareApiToken: {
          CF_ZONE_ID: 'stored-zone',
          CF_EMAIL: 'stored@example.com',
          CF_API_KEY: 'stored-cf-api-key',
        },
        webDAV: {
          enabled: true,
          username: 'stored-dav-user',
          password: 'stored-webdav-password',
          uploadChannel: 'S3',
        },
        publicBrowse: {
          enabled: false,
          allowedDir: '',
        },
      }),
    });

    const response = await onRequest({
      env: createEnv({ img_url: kv }),
      request: new Request('http://localhost/api/manage/sysConfig/others', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cloudflareApiToken: {
            CF_ZONE_ID: 'stored-zone',
            CF_EMAIL: 'updated@example.com',
            CF_API_KEY: 'Configured',
          },
          webDAV: {
            enabled: false,
            username: 'updated-dav-user',
            password: 'Configured',
            uploadChannel: 'TelegramNew',
          },
          publicBrowse: {
            enabled: true,
            allowedDir: 'public',
          },
        }),
      }),
    });

    assert.equal(response.status, 200);
    const responseText = await response.text();
    assert.equal(responseText.includes('stored-cf-api-key'), false);
    assert.equal(responseText.includes('stored-webdav-password'), false);

    const stored = JSON.parse(await kv.get('manage@sysConfig@others'));
    assert.equal(stored.cloudflareApiToken.CF_API_KEY, 'stored-cf-api-key');
    assert.equal(stored.cloudflareApiToken.CF_EMAIL, 'updated@example.com');
    assert.equal(stored.webDAV.password, 'stored-webdav-password');
    assert.equal(stored.webDAV.username, 'updated-dav-user');
    assert.equal(stored.webDAV.enabled, false);
    assert.equal(stored.publicBrowse.enabled, true);
  });
});
