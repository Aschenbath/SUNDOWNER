import assert from 'node:assert/strict';

import { onRequestPost } from '../functions/api/manage/migrate/recover-tg-thumbnails.js';
import { getDatabase } from '../functions/utils/databaseAdapter.js';
import { SqliteD1 } from '../server/sqliteD1.js';

class MemoryKV {
  constructor(entries = {}) {
    this.store = new Map();
    this.metadata = new Map();

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

describe('recover tg thumbnails route', () => {
  it('requires targetChatId before running thumbnail recovery', async () => {
    const response = await onRequestPost({
      env: { img_url: new MemoryKV() },
      request: new Request('https://example.com/api/manage/migrate/recover-tg-thumbnails', {
        method: 'POST',
        body: JSON.stringify({ dryRun: true }),
      }),
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.success, false);
    assert.match(payload.error, /targetChatId is required/);
  });

  it('finds dry-run thumbnail candidates for unsupported preview images', async () => {
    const env = {
      img_url: new MemoryKV({
        'manage@index@meta': JSON.stringify({ chunkCount: 1 }),
        'manage@index_0': createIndexChunk([
          {
            id: 'telegram-import/Telegram_env/tg_Telegram_env_55_AgADKB8AAmvIgVY.heic',
            metadata: {
              Channel: 'TelegramNew',
              ChannelName: 'Telegram_env',
              FileName: 'preview.heic',
              FileType: 'image/heic',
              TjMessageId: '',
              TimeStamp: 1775628424000,
            },
          },
        ]),
      }),
    };

    const response = await onRequestPost({
      env,
      request: new Request('https://example.com/api/manage/migrate/recover-tg-thumbnails', {
        method: 'POST',
        body: JSON.stringify({ dryRun: true, targetChatId: '123456789', limit: 10 }),
      }),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.total, 1);
    assert.equal(payload.dryRun, true);
    assert.equal(payload.skipped[0].id, 'telegram-import/Telegram_env/tg_Telegram_env_55_AgADKB8AAmvIgVY.heic');
  });

  it('recovers thumbnails without persisting stripped Telegram secrets', async () => {
    const fileKey = 'telegram-import/Telegram_env/tg_Telegram_env_55_AgADKB8AAmvIgVY.heic';
    const env = {
      img_d1: new SqliteD1(':memory:'),
      img_url: new MemoryKV({
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
    const db = getDatabase(env);
    await db.put(fileKey, '', {
      metadata: {
        Channel: 'TelegramNew',
        ChannelName: 'Telegram_env',
        FileName: 'preview.heic',
        FileType: 'image/heic',
        TimeStamp: 1775628424000,
      },
    });

    await withFetchStub(async (url) => {
      if (String(url).includes('/forwardMessage?')) {
        return new Response(JSON.stringify({
          ok: true,
          result: {
            message_id: 901,
            document: {
              thumbnail: {
                file_id: 'thumb-file-id-12345678901234567890',
                file_unique_id: 'thumb-unique-id',
                width: 320,
                height: 240,
                file_size: 12345,
              },
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
        request: new Request('https://example.com/api/manage/migrate/recover-tg-thumbnails', {
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
      assert.equal(payload.recovered, 1);
      assert.deepEqual(payload.failed, []);
      assert.deepEqual(payload.skipped, []);
    });

    const stored = await db.getWithMetadata(fileKey);
    assert.equal(stored.metadata.TgThumbnailFileId, 'thumb-file-id-12345678901234567890');
    assert.equal(stored.metadata.TgThumbnailFileUniqueId, 'thumb-unique-id');
    assert.equal(stored.metadata.TgChatId, '-100123');
    assert.equal(stored.metadata.ChannelName, 'Telegram_env');
    assert.equal(stored.metadata.TgBotToken, undefined);
    assert.equal(stored.metadata.TgProxyUrl, undefined);
  });
});
