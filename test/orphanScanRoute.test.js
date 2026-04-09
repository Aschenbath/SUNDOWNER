import assert from 'node:assert/strict';

import {
  onRequestGet,
  onRequestOptions,
} from '../functions/api/manage/migrate/scan-orphan-files.js';

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

describe('scan orphan files route', () => {
  it('finds timestamp-style Telegram records that cannot be recovered from tg_* keys', async () => {
    const env = {
      img_url: new MemoryKV({
        'manage@index@meta': JSON.stringify({ chunkCount: 1 }),
        'manage@index_0': createIndexChunk([
          {
            id: 'telegram-import/Telegram_env/1775628424666_city-kiss.jpg',
            metadata: {
              Channel: 'TelegramNew',
              ChannelName: 'Telegram_env',
              Directory: 'telegram-import/Telegram_env/',
              FileName: 'city-kiss.jpg',
              TimeStamp: 1775628424666,
              TgChatId: '-100123',
            },
          },
          {
            id: 'telegram-import/Telegram_env/tg_Telegram_env_42_AgADCx0AAm2GsVY.jpg',
            metadata: {
              Channel: 'TelegramNew',
              ChannelName: 'Telegram_env',
              Directory: 'telegram-import/Telegram_env/',
              FileName: 'recoverable.jpg',
              TimeStamp: 1775628424000,
            },
          },
          {
            id: 'telegram-import/Telegram_env/1775628424999_has-file-id.jpg',
            metadata: {
              Channel: 'TelegramNew',
              ChannelName: 'Telegram_env',
              Directory: 'telegram-import/Telegram_env/',
              FileName: 'already-ok.jpg',
              TimeStamp: 1775628424999,
              TgFileId: 'AgACAgQAAxkBAAIB',
            },
          },
        ]),
      }),
    };

    const response = await onRequestGet({
      env,
      request: new Request('http://localhost/api/manage/migrate/scan-orphan-files?limit=10', {
        method: 'GET',
      }),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.total, 1);
    assert.equal(payload.returned, 1);
    assert.equal(payload.files[0].id, 'telegram-import/Telegram_env/1775628424666_city-kiss.jpg');
    assert.equal(payload.files[0].recoverableByKey, false);
  });

  it('supports channelName and directory filters', async () => {
    const env = {
      img_url: new MemoryKV({
        'manage@index@meta': JSON.stringify({ chunkCount: 1 }),
        'manage@index_0': createIndexChunk([
          {
            id: 'telegram-import/Telegram_env/1775628424666_one.jpg',
            metadata: {
              Channel: 'TelegramNew',
              ChannelName: 'Telegram_env',
              Directory: 'telegram-import/Telegram_env/',
              FileName: 'one.jpg',
              TimeStamp: 1775628424666,
            },
          },
          {
            id: 'telegram-import/Other_channel/1775628424777_two.jpg',
            metadata: {
              Channel: 'TelegramNew',
              ChannelName: 'Other_channel',
              Directory: 'telegram-import/Other_channel/',
              FileName: 'two.jpg',
              TimeStamp: 1775628424777,
            },
          },
        ]),
      }),
    };

    const response = await onRequestGet({
      env,
      request: new Request('http://localhost/api/manage/migrate/scan-orphan-files?channelName=Telegram_env&directory=telegram-import/Telegram_env', {
        method: 'GET',
      }),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.total, 1);
    assert.equal(payload.files[0].channelName, 'Telegram_env');
    assert.equal(payload.files[0].directory, 'telegram-import/Telegram_env/');
  });

  it('returns CORS headers for OPTIONS', async () => {
    const response = onRequestOptions();

    assert.equal(response.status, 204);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, OPTIONS');
  });
});
