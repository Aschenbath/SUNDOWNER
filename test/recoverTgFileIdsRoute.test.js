import assert from 'node:assert/strict';

import { onRequestPost } from '../functions/api/manage/migrate/recover-tg-file-ids.js';
import { resolveStoredTelegramReadTarget } from '../functions/utils/telegramFileId.js';

class MemoryKV {
  constructor(entries = {}) {
    this.store = new Map();
    this.metadata = new Map();
    this.putCalls = [];

    for (const [key, value] of Object.entries(entries)) {
      if (value && typeof value === 'object' && 'value' in value) {
        this.store.set(key, value.value);
        this.metadata.set(key, value.metadata || {});
      } else {
        this.store.set(key, value);
        this.metadata.set(key, {});
      }
    }
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async getWithMetadata(key) {
    if (!this.store.has(key)) {
      return null;
    }

    return {
      value: this.store.get(key),
      metadata: this.metadata.get(key) || {},
    };
  }

  async put(key, value, options = {}) {
    this.store.set(key, value);
    this.metadata.set(key, options.metadata || {});
    this.putCalls.push({ key, value, options });
  }

  async delete(key) {
    this.store.delete(key);
    this.metadata.delete(key);
  }
}

function createIndexChunk(files) {
  return JSON.stringify(files.map((file) => ({
    id: file.id,
    metadata: file.metadata,
  })));
}

function withFetchStub(handler, run) {
  const originalFetch = global.fetch;
  global.fetch = handler;
  return Promise.resolve()
    .then(run)
    .finally(() => {
      global.fetch = originalFetch;
    });
}

describe('recover tg file ids route', () => {
  it('requires targetChatId before running recovery', async () => {
    const response = await onRequestPost({
      env: { img_url: new MemoryKV() },
      request: new Request('https://example.com/api/manage/migrate/recover-tg-file-ids', {
        method: 'POST',
        body: JSON.stringify({ dryRun: true }),
      }),
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.success, false);
    assert.match(payload.error, /targetChatId is required/);
  });

  it('lists dry-run candidates without mutating Telegram metadata', async () => {
    const env = {
      img_url: new MemoryKV({
        'manage@index@meta': JSON.stringify({ chunkCount: 1 }),
        'manage@index_0': createIndexChunk([
          {
            id: 'telegram-import/Telegram_env/tg_Telegram_env_42_AgADCx0AAm2GsVY.jpg',
            metadata: {
              Channel: 'TelegramNew',
              ChannelName: 'Telegram_env',
              FileName: 'recoverable.jpg',
              TimeStamp: 1775628424000,
            },
          },
        ]),
      }),
    };

    const response = await onRequestPost({
      env,
      request: new Request('https://example.com/api/manage/migrate/recover-tg-file-ids', {
        method: 'POST',
        body: JSON.stringify({ dryRun: true, targetChatId: '123456789', limit: 10 }),
      }),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.total, 1);
    assert.equal(payload.dryRun, true);
    assert.equal(payload.skipped[0].id, 'telegram-import/Telegram_env/tg_Telegram_env_42_AgADCx0AAm2GsVY.jpg');
    assert.equal(payload.skipped[0].messageId, '42');
    assert.equal(payload.skipped[0].matchedByHint, false);
  });

  it('recovers timestamp-style orphan files from explicit message mapping without storing sensitive tokens', async () => {
    const fileKey = 'telegram-import/Telegram_env/1775628424666_city-kiss.jpg';
    const env = {
      img_url: new MemoryKV({
        [fileKey]: {
          value: '',
          metadata: {
            Channel: 'TelegramNew',
            ChannelName: 'Telegram_env',
            FileName: 'city-kiss.jpg',
            FileType: 'image/jpeg',
            TimeStamp: 1775628424666,
            Directory: 'telegram-import/Telegram_env/',
          },
        },
        'manage@sysConfig@upload': JSON.stringify({
          telegram: {
            channels: [
              {
                name: 'Telegram_env',
                botToken: 'secret-config-token',
                chatId: '-100123',
                enabled: true,
              },
            ],
          },
        }),
      }),
    };

    const fetchCalls = [];
    await withFetchStub(async (url) => {
      fetchCalls.push(String(url));
      if (String(url).includes('/forwardMessage?')) {
        return new Response(JSON.stringify({
          ok: true,
          result: {
            message_id: 901,
            document: {
              file_id: 'recovered-file-id-12345678901234567890',
            },
          },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (String(url).includes('/deleteMessage?')) {
        return new Response(JSON.stringify({ ok: true, result: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    }, async () => {
      const response = await onRequestPost({
        env,
        request: new Request('https://example.com/api/manage/migrate/recover-tg-file-ids', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetChatId: 'target-chat',
            matches: [
              {
                key: fileKey,
                messageId: '42',
                channelName: 'Telegram_env',
              },
            ],
          }),
        }),
      });

      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.success, true);
      assert.equal(payload.total, 1);
      assert.equal(payload.processed, 1);
      assert.equal(payload.recovered, 1);
      assert.deepEqual(payload.failed, []);
      assert.deepEqual(payload.skipped, []);
    });

    assert.equal(fetchCalls.length, 2);
    assert.match(fetchCalls[0], /forwardMessage/);
    assert.match(fetchCalls[1], /deleteMessage/);

    const stored = await env.img_url.getWithMetadata(fileKey);
    assert.equal(stored.metadata.TgFileId, 'recovered-file-id-12345678901234567890');
    assert.equal(stored.metadata.TgMessageId, '42');
    assert.equal(stored.metadata.TgChatId, '-100123');
    assert.equal(stored.metadata.ChannelName, 'Telegram_env');
    assert.equal(stored.metadata.TgBotToken, undefined);
    assert.equal(stored.metadata.TgProxyUrl, undefined);

    const readTarget = resolveStoredTelegramReadTarget(fileKey, stored.metadata);
    assert.equal(readTarget.fileId, 'recovered-file-id-12345678901234567890');
  });

  it('skips timestamp-style orphan files when no deterministic linkage is available', async () => {
    const fileKey = 'telegram-import/Telegram_env/1775628424666_city-kiss.jpg';
    const env = {
      img_url: new MemoryKV({
        [fileKey]: {
          value: '',
          metadata: {
            Channel: 'TelegramNew',
            ChannelName: 'Telegram_env',
            FileName: 'city-kiss.jpg',
            FileType: 'image/jpeg',
            TimeStamp: 1775628424666,
          },
        },
      }),
    };

    const response = await onRequestPost({
      env,
      request: new Request('https://example.com/api/manage/migrate/recover-tg-file-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetChatId: 'target-chat',
          keys: [fileKey],
        }),
      }),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.processed, 1);
    assert.equal(payload.recovered, 0);
    assert.deepEqual(payload.failed, []);
    assert.deepEqual(payload.skipped, [
      {
        id: fileKey,
        reason: 'cannot determine message ID from metadata or key',
      },
    ]);
  });
});
