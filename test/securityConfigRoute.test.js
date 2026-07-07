import assert from 'node:assert/strict';

import { onRequest } from '../functions/api/manage/sysConfig/security.js';

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

function createEnvWithSecurityConfig(config) {
  return {
    img_url: new MemoryKV({
      'manage@sysConfig@security': JSON.stringify(config),
    }),
  };
}

describe('sysConfig security route', () => {
  it('masks moderation API keys in management responses', async () => {
    const env = createEnvWithSecurityConfig({
      auth: {
        user: { authCode: 'stored-user-code' },
        admin: { adminUsername: 'admin', adminPassword: 'stored-admin-password' },
      },
      upload: {
        moderate: {
          enabled: true,
          channel: 'moderatecontent.com',
          moderateContentApiKey: 'stored-moderation-key',
          nsfwApiPath: '',
        },
      },
      access: { allowedDomains: '', whiteListMode: false },
      apiTokens: { tokens: {} },
    });

    const response = await onRequest({
      env,
      request: new Request('http://localhost/api/manage/sysConfig/security', { method: 'GET' }),
    });

    assert.equal(response.status, 200);
    const text = await response.text();
    assert.equal(text.includes('stored-moderation-key'), false);
    const payload = JSON.parse(text);
    assert.equal(payload.upload.moderate.moderateContentApiKey, 'Configured');
  });

  it('preserves stored auth secrets when management posts masked placeholders', async () => {
    const env = createEnvWithSecurityConfig({
      auth: {
        user: { authCode: 'stored-user-code' },
        admin: { adminUsername: 'admin', adminPassword: 'stored-admin-password' },
      },
      upload: {
        moderate: {
          enabled: false,
          channel: 'moderatecontent.com',
          moderateContentApiKey: 'stored-moderation-key',
          nsfwApiPath: '',
        },
      },
      access: { allowedDomains: 'example.com', whiteListMode: true },
      apiTokens: { tokens: {} },
    });

    const response = await onRequest({
      env,
      request: new Request('http://localhost/api/manage/sysConfig/security', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          auth: {
            user: { authCode: 'Configured' },
            admin: { adminUsername: 'new-admin', adminPassword: 'Configured' },
          },
          upload: {
            moderate: {
              enabled: true,
              channel: 'nsfwjs',
              moderateContentApiKey: 'Configured',
              nsfwApiPath: 'https://nsfw.example.com/check',
            },
          },
          access: { allowedDomains: 'example.org', whiteListMode: false },
        }),
      }),
    });

    assert.equal(response.status, 200);
    const stored = JSON.parse(await env.img_url.get('manage@sysConfig@security'));
    assert.equal(stored.auth.user.authCode, 'stored-user-code');
    assert.equal(stored.auth.admin.adminUsername, 'new-admin');
    assert.equal(stored.auth.admin.adminPassword, 'stored-admin-password');
    assert.equal(stored.upload.moderate.moderateContentApiKey, 'stored-moderation-key');
    assert.equal(stored.upload.moderate.enabled, true);
    assert.equal(stored.access.allowedDomains, 'example.org');
  });

  it('does not persist environment secrets when management posts a partial update', async () => {
    const kv = new MemoryKV();
    const env = {
      AUTH_CODE: 'env-user-code',
      BASIC_USER: 'env-admin',
      BASIC_PASS: 'env-admin-password',
      ModerateContentApiKey: 'env-moderation-key',
      img_url: kv,
    };

    const response = await onRequest({
      env,
      request: new Request('http://localhost/api/manage/sysConfig/security', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          access: { allowedDomains: 'example.org', whiteListMode: true },
        }),
      }),
    });

    assert.equal(response.status, 200);
    const storedRaw = await kv.get('manage@sysConfig@security');
    assert.equal(storedRaw.includes('env-user-code'), false);
    assert.equal(storedRaw.includes('env-admin-password'), false);
    assert.equal(storedRaw.includes('env-moderation-key'), false);

    const stored = JSON.parse(storedRaw);
    assert.deepEqual(stored.auth, {});
    assert.deepEqual(stored.upload, {});
    assert.deepEqual(stored.access, { allowedDomains: 'example.org', whiteListMode: true });
  });

  it('defaults direct file access to non-bearerless and preserves explicit legacy opt-out', async () => {
    const env = createEnvWithSecurityConfig({
      auth: { user: { authCode: '' }, admin: { adminUsername: '', adminPassword: '' } },
      access: { allowedDomains: '', whiteListMode: false },
      apiTokens: { tokens: {} },
    });

    const getResponse = await onRequest({
      env,
      request: new Request('http://localhost/api/manage/sysConfig/security', { method: 'GET' }),
    });

    assert.equal(getResponse.status, 200);
    const payload = await getResponse.json();
    assert.equal(payload.access.allowBearerlessFileAccess, false);

    const postResponse = await onRequest({
      env,
      request: new Request('http://localhost/api/manage/sysConfig/security', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          access: {
            allowedDomains: '',
            whiteListMode: false,
            allowBearerlessFileAccess: true,
          },
        }),
      }),
    });

    assert.equal(postResponse.status, 200);
    const stored = JSON.parse(await env.img_url.get('manage@sysConfig@security'));
    assert.deepEqual(stored.access, {
      allowedDomains: '',
      whiteListMode: false,
      allowBearerlessFileAccess: true,
    });
  });

  it('preserves stored bearerless file access opt-out when access POST omits the field', async () => {
    const env = createEnvWithSecurityConfig({
      auth: { user: { authCode: '' }, admin: { adminUsername: '', adminPassword: '' } },
      access: {
        allowedDomains: 'old.example.com',
        whiteListMode: false,
        allowBearerlessFileAccess: true,
      },
      apiTokens: { tokens: {} },
    });

    const response = await onRequest({
      env,
      request: new Request('http://localhost/api/manage/sysConfig/security', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          access: {
            allowedDomains: 'new.example.com',
            whiteListMode: true,
          },
        }),
      }),
    });

    assert.equal(response.status, 200);
    const stored = JSON.parse(await env.img_url.get('manage@sysConfig@security'));
    assert.deepEqual(stored.access, {
      allowedDomains: 'new.example.com',
      whiteListMode: true,
      allowBearerlessFileAccess: true,
    });
  });
});
