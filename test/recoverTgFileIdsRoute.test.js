import assert from 'node:assert/strict';

import { onRequestPost } from '../functions/api/manage/migrate/recover-tg-file-ids.js';

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
  });
});
