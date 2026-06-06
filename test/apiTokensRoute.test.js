import assert from 'node:assert/strict';

import { onRequest } from '../functions/api/manage/apiTokens.js';

class MemoryKV {
  constructor(initialEntries = {}) {
    this.store = new Map(Object.entries(initialEntries));
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async put(key, value) {
    this.store.set(key, value);
  }
}

function createEnvWithSecurityConfig(config) {
  return {
    img_url: new MemoryKV({
      'manage@sysConfig@security': JSON.stringify(config),
    }),
  };
}

describe('apiTokens route', () => {
  it('does not expose API token prefixes when listing existing tokens', async () => {
    const response = await onRequest({
      request: new Request('https://example.test/api/manage/apiTokens', { method: 'GET' }),
      env: createEnvWithSecurityConfig({
        apiTokens: {
          tokens: {
            token_1: {
              name: 'Photos sync',
              owner: 'Gilbert',
              permissions: ['list', 'manage'],
              createdAt: '2026-06-01T00:00:00.000Z',
              updatedAt: '2026-06-02T00:00:00.000Z',
              token: 'imgbed_1234567890abcdef1234567890abcdef',
              expiresAt: null,
              autoDelete: false,
            },
          },
        },
      }),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.tokens.length, 1);
    assert.equal(payload.tokens[0].id, 'token_1');
    assert.equal(payload.tokens[0].name, 'Photos sync');
    assert.equal('token' in payload.tokens[0], false);
    assert.doesNotMatch(JSON.stringify(payload), /imgbed_|1234567890abcde/);
  });

  it('still returns the full token exactly once when creating a new token', async () => {
    const response = await onRequest({
      request: new Request('https://example.test/api/manage/apiTokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Uploader',
          owner: 'Gilbert',
          permissions: ['manage'],
          expiresAt: null,
          autoDelete: false,
        }),
      }),
      env: createEnvWithSecurityConfig({ apiTokens: { tokens: {} } }),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.name, 'Uploader');
    assert.match(payload.token, /^imgbed_[0-9a-f]{32}$/);
  });

  it('does not expose the stored token when updating token metadata', async () => {
    const response = await onRequest({
      request: new Request('https://example.test/api/manage/apiTokens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: 'token_1',
          permissions: ['list'],
          expiresAt: '2026-12-31T00:00:00.000Z',
          autoDelete: true,
        }),
      }),
      env: createEnvWithSecurityConfig({
        apiTokens: {
          tokens: {
            token_1: {
              name: 'Photos sync',
              owner: 'Gilbert',
              permissions: ['manage'],
              createdAt: '2026-06-01T00:00:00.000Z',
              updatedAt: '2026-06-02T00:00:00.000Z',
              token: 'imgbed_1234567890abcdef1234567890abcdef',
              expiresAt: null,
              autoDelete: false,
            },
          },
        },
      }),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.token.id, 'token_1');
    assert.deepEqual(payload.token.permissions, ['list']);
    assert.equal('token' in payload.token, false);
    assert.doesNotMatch(JSON.stringify(payload), /imgbed_|1234567890abcde/);
  });
});
