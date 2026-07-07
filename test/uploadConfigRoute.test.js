import assert from 'node:assert/strict';

import {
  getUploadConfig,
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

  it('masks upload channel secrets in management responses', async () => {
    const env = createEnv({
      TG_BOT_TOKEN: 'env-tg-token',
      TG_CHAT_ID: 'env-chat',
      TG_PROXY_URL: 'https://tg-proxy.example.com',
      S3_ACCESS_KEY_ID: 'env-s3-key',
      S3_SECRET_ACCESS_KEY: 'env-s3-secret',
      S3_BUCKET_NAME: 'env-bucket',
      DISCORD_BOT_TOKEN: 'env-discord-token',
      DISCORD_CHANNEL_ID: 'env-discord-channel',
      HF_TOKEN: 'env-hf-token',
      HF_REPO: 'env/repo',
      img_url: new MemoryKV({
        'manage@sysConfig@upload': JSON.stringify({
          telegram: {
            channels: [{
              id: 9,
              name: 'PrivateTelegram',
              type: 'telegram',
              botToken: 'kv-tg-token',
              webhookSecret: 'kv-webhook-secret',
              proxyUrl: 'https://kv-tg-proxy.example.com',
              enabled: true,
            }],
          },
          s3: {
            channels: [{
              id: 10,
              name: 'PrivateS3',
              type: 's3',
              accessKeyId: 'kv-s3-key',
              secretAccessKey: 'kv-s3-secret',
              endpoint: 'https://s3.example.com',
              bucketName: 'kv-bucket',
              enabled: true,
            }],
          },
          discord: {
            channels: [{
              id: 11,
              name: 'PrivateDiscord',
              type: 'discord',
              botToken: 'kv-discord-token',
              channelId: 'discord-channel',
              enabled: true,
            }],
          },
          huggingface: {
            channels: [{
              id: 12,
              name: 'PrivateHF',
              type: 'huggingface',
              token: 'kv-hf-token',
              repo: 'kv/repo',
              enabled: true,
            }],
          },
        }),
      }),
    });

    const response = await onRequest({
      env,
      request: new Request('http://localhost/api/manage/sysConfig/upload', {
        method: 'GET',
      }),
    });

    assert.equal(response.status, 200);
    const text = await response.text();
    for (const secret of [
      'env-tg-token',
      'env-s3-key',
      'env-s3-secret',
      'env-discord-token',
      'env-hf-token',
      'kv-tg-token',
      'kv-webhook-secret',
      'kv-s3-key',
      'kv-s3-secret',
      'kv-discord-token',
      'kv-hf-token',
    ]) {
      assert.equal(text.includes(secret), false, `${secret} leaked in upload config response`);
    }

    const payload = JSON.parse(text);
    assert.equal(payload.telegram.channels[0].botToken, 'Configured');
    assert.equal(payload.telegram.channels[1].botToken, 'Configured');
    assert.equal(payload.telegram.channels[1].webhookSecret, 'Configured');
    assert.equal(payload.s3.channels[0].accessKeyId, 'Configured');
    assert.equal(payload.s3.channels[0].secretAccessKey, 'Configured');
    assert.equal(payload.s3.channels[1].accessKeyId, 'Configured');
    assert.equal(payload.s3.channels[1].secretAccessKey, 'Configured');
    assert.equal(payload.discord.channels[0].botToken, 'Configured');
    assert.equal(payload.discord.channels[1].botToken, 'Configured');
    assert.equal(payload.huggingface.channels[0].token, 'Configured');
    assert.equal(payload.huggingface.channels[1].token, 'Configured');
    assert.equal(payload.telegram.channels[1].proxyUrl, 'https://kv-tg-proxy.example.com');
    assert.equal(payload.s3.channels[1].endpoint, 'https://s3.example.com');
  });

  it('keeps real upload secrets available to internal config consumers', async () => {
    const db = new MemoryKV({
      'manage@sysConfig@upload': JSON.stringify({
        telegram: {
          channels: [{
            name: 'PrivateTelegram',
            type: 'telegram',
            botToken: 'kv-tg-token',
            webhookSecret: 'kv-webhook-secret',
            enabled: true,
          }],
        },
        s3: {
          channels: [{
            name: 'PrivateS3',
            type: 's3',
            accessKeyId: 'kv-s3-key',
            secretAccessKey: 'kv-s3-secret',
            enabled: true,
          }],
        },
      }),
    });

    const config = await getUploadConfig(db, createEnv({
      TG_BOT_TOKEN: 'env-tg-token',
      S3_ACCESS_KEY_ID: 'env-s3-key',
      S3_SECRET_ACCESS_KEY: 'env-s3-secret',
    }));

    assert.equal(config.telegram.channels[0].botToken, 'env-tg-token');
    assert.equal(config.telegram.channels[1].botToken, 'kv-tg-token');
    assert.equal(config.telegram.channels[1].webhookSecret, 'kv-webhook-secret');
    assert.equal(config.s3.channels[0].accessKeyId, 'env-s3-key');
    assert.equal(config.s3.channels[0].secretAccessKey, 'env-s3-secret');
    assert.equal(config.s3.channels[1].accessKeyId, 'kv-s3-key');
    assert.equal(config.s3.channels[1].secretAccessKey, 'kv-s3-secret');
  });

  it('preserves stored upload secrets when management posts masked placeholders', async () => {
    const kv = new MemoryKV({
      'manage@sysConfig@upload': JSON.stringify({
        telegram: {
          channels: [{
            id: 1,
            name: 'PrivateTelegram',
            type: 'telegram',
            botToken: 'stored-tg-token',
            webhookSecret: 'stored-webhook-secret',
            enabled: true,
          }],
        },
        s3: {
          channels: [{
            id: 2,
            name: 'PrivateS3',
            type: 's3',
            accessKeyId: 'stored-s3-key',
            secretAccessKey: 'stored-s3-secret',
            enabled: true,
          }],
        },
        discord: {
          channels: [{
            id: 3,
            name: 'PrivateDiscord',
            type: 'discord',
            botToken: 'stored-discord-token',
            enabled: true,
          }],
        },
        huggingface: {
          channels: [{
            id: 4,
            name: 'PrivateHF',
            type: 'huggingface',
            token: 'stored-hf-token',
            enabled: true,
          }],
        },
      }),
    });

    const response = await onRequest({
      env: createEnv({ img_url: kv }),
      request: new Request('http://localhost/api/manage/sysConfig/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          telegram: {
            channels: [{
              id: 1,
              name: 'PrivateTelegram',
              type: 'telegram',
              botToken: 'Configured',
              webhookSecret: 'Configured',
              enabled: false,
            }],
          },
          s3: {
            channels: [{
              id: 2,
              name: 'PrivateS3',
              type: 's3',
              accessKeyId: 'Configured',
              secretAccessKey: 'Configured',
              enabled: true,
            }],
          },
          discord: {
            channels: [{
              id: 3,
              name: 'PrivateDiscord',
              type: 'discord',
              botToken: 'Configured',
              enabled: true,
            }],
          },
          huggingface: {
            channels: [{
              id: 4,
              name: 'PrivateHF',
              type: 'huggingface',
              token: 'Configured',
              enabled: true,
            }],
          },
        }),
      }),
    });

    assert.equal(response.status, 200);
    const responseText = await response.text();
    assert.equal(responseText.includes('stored-tg-token'), false);
    assert.equal(responseText.includes('stored-s3-secret'), false);

    const stored = JSON.parse(await kv.get('manage@sysConfig@upload'));
    assert.equal(stored.telegram.channels[0].botToken, 'stored-tg-token');
    assert.equal(stored.telegram.channels[0].webhookSecret, 'stored-webhook-secret');
    assert.equal(stored.s3.channels[0].accessKeyId, 'stored-s3-key');
    assert.equal(stored.s3.channels[0].secretAccessKey, 'stored-s3-secret');
    assert.equal(stored.discord.channels[0].botToken, 'stored-discord-token');
    assert.equal(stored.huggingface.channels[0].token, 'stored-hf-token');
    assert.equal(stored.telegram.channels[0].enabled, false);
  });
});
