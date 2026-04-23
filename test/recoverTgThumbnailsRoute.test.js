import assert from 'node:assert/strict';

import { onRequestPost } from '../functions/api/manage/migrate/recover-tg-thumbnails.js';

class MemoryKV {
  constructor(entries = {}) {
    this.store = new Map(Object.entries(entries));
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
}

function createIndexChunk(files) {
  return JSON.stringify(files.map((file) => ({
    id: file.id,
    metadata: file.metadata,
  })));
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
});
