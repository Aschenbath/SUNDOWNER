import assert from 'node:assert/strict';

import { onRequest as runOnRequest } from '../functions/api/manage/telegram-sync/run.js';
import { onRequest as statusOnRequest } from '../functions/api/manage/telegram-sync/status.js';
import { onRequest as webhookDeleteOnRequest } from '../functions/api/manage/telegram-sync/webhook/delete.js';
import { onRequest as webhookSetupOnRequest } from '../functions/api/manage/telegram-sync/webhook/setup.js';
import { onRequest as webhookDeliveryOnRequest } from '../functions/api/manage/telegram-sync/webhook/[[path]].js';

const INTERNAL_MESSAGE = 'KV upload config failed for private_token_telegram_sync';

class ThrowingKV {
  async get() {
    throw new Error(INTERNAL_MESSAGE);
  }
}

class MemoryKV {
  constructor(entries = {}) {
    this.store = new Map(Object.entries(entries));
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
}

function envWithThrowingConfig() {
  return {
    img_url: new ThrowingKV(),
  };
}

function request(url, options = {}) {
  return new Request(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function assertGenericInternalError(response) {
  assert.equal(response.status, 500);
  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, 'Internal server error.');
  assert.ok(!JSON.stringify(payload).includes(INTERNAL_MESSAGE));
}

async function withFetchStub(handler, run) {
  const originalFetch = global.fetch;
  global.fetch = handler;
  try {
    return await run();
  } finally {
    global.fetch = originalFetch;
  }
}

describe('telegram sync API generic 500 errors', () => {
  let originalConsoleError;

  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = () => {};
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('hides raw config errors from manual run responses', async () => {
    const response = await runOnRequest({
      env: envWithThrowingConfig(),
      request: request('https://example.com/api/manage/telegram-sync/run?channelName=Main', {
        method: 'POST',
      }),
    });

    await assertGenericInternalError(response);
  });

  it('hides raw config errors from status responses', async () => {
    const response = await statusOnRequest({
      env: envWithThrowingConfig(),
      request: request('https://example.com/api/manage/telegram-sync/status?channelName=Main'),
    });

    await assertGenericInternalError(response);
  });

  it('hides raw upstream webhook-info errors in status payloads', async () => {
    const upstreamMessage = 'Telegram API private_token_from_upstream';
    const env = {
      img_url: new MemoryKV({
        'manage@sysConfig@upload': JSON.stringify({
          telegram: {
            channels: [
              {
                name: 'Main',
                botToken: 'secret-bot-token',
                enabled: true,
              },
            ],
          },
        }),
      }),
    };

    await withFetchStub(async () => new Response(JSON.stringify({
      ok: false,
      description: upstreamMessage,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }), async () => {
      const response = await statusOnRequest({
        env,
        request: request('https://example.com/api/manage/telegram-sync/status?channelName=Main'),
      });

      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.success, true);
      assert.equal(payload.data.webhookInfo.error, 'Webhook info unavailable');
      assert.ok(!JSON.stringify(payload).includes(upstreamMessage));
    });
  });

  it('hides raw config errors from webhook setup responses', async () => {
    const response = await webhookSetupOnRequest({
      env: envWithThrowingConfig(),
      request: request('https://example.com/api/manage/telegram-sync/webhook/setup?channelName=Main', {
        method: 'POST',
      }),
    });

    await assertGenericInternalError(response);
  });

  it('hides raw config errors from webhook delete responses', async () => {
    const response = await webhookDeleteOnRequest({
      env: envWithThrowingConfig(),
      request: request('https://example.com/api/manage/telegram-sync/webhook/delete?channelName=Main', {
        method: 'POST',
      }),
    });

    await assertGenericInternalError(response);
  });

  it('hides raw config errors from webhook delivery responses', async () => {
    const response = await webhookDeliveryOnRequest({
      env: envWithThrowingConfig(),
      params: { path: ['Main'] },
      request: request('https://example.com/api/manage/telegram-sync/webhook/Main', {
        method: 'POST',
        headers: { 'X-Telegram-Bot-Api-Secret-Token': 'secret' },
        body: { update_id: 1, channel_post: { message_id: 2, chat: { id: '-100' } } },
      }),
    });

    await assertGenericInternalError(response);
  });

  it('parses string catch-all webhook paths as the full channel name', async () => {
    const env = {
      img_url: new MemoryKV({
        'manage@sysConfig@upload': JSON.stringify({
          telegram: {
            channels: [
              {
                name: 'Main',
                enabled: true,
                syncEnabled: true,
                webhookSecret: 'expected-secret',
                botToken: 'secret-bot-token',
                chatId: '-100',
              },
            ],
          },
        }),
      }),
    };

    const response = await webhookDeliveryOnRequest({
      env,
      params: { path: 'Main' },
      request: request('https://example.com/api/manage/telegram-sync/webhook/Main', {
        method: 'POST',
        headers: { 'X-Telegram-Bot-Api-Secret-Token': 'wrong-secret' },
        body: { update_id: 1, channel_post: { message_id: 2, chat: { id: '-100' } } },
      }),
    });

    assert.equal(response.status, 401);
    const payload = await response.json();
    assert.equal(payload.success, false);
    assert.equal(payload.error, 'Invalid Telegram webhook secret');
  });
});
