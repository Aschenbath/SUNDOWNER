import assert from 'node:assert/strict';

import { importTelegramUpdate } from '../functions/utils/telegramSync.js';
import { MomentsStore } from '../functions/utils/momentsStore.js';
import { D1Database } from '../functions/utils/d1Database.js';
import { SqliteD1 } from '../server/sqliteD1.js';

async function seedUploadConfig(d1) {
  const db = new D1Database(d1);
  await db.put('manage@sysConfig@upload', JSON.stringify({
    telegram: {
      channels: [{
        name: 'SUNDOWNER',
        enabled: true,
        botToken: 'bot-token',
        chatId: '100',
        importDirectory: 'telegram-import/SUNDOWNER',
        syncEnabled: true,
        syncMode: 'webhook',
      }],
    },
  }));
}

describe('telegram webhook Moments album integration', () => {
  it('appends later media-group items into the same deterministic Moments post', async () => {
    const d1 = new SqliteD1(':memory:');
    await seedUploadConfig(d1);

    const filePaths = new Map([
      ['file-1', 'photos/file-1.jpg'],
      ['file-2', 'photos/file-2.jpg'],
    ]);

    globalThis.fetch = async (url) => {
      const normalized = String(url);
      if (normalized.includes('/getFile?')) {
        const fileId = new URL(normalized).searchParams.get('file_id');
        return new Response(JSON.stringify({ ok: true, result: { file_path: filePaths.get(fileId) } }), { status: 200 });
      }
      if (normalized.includes('/file/botbot-token/')) {
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${normalized}`);
    };

    const context = {
      env: { img_d1: d1 },
      waitUntil() {},
    };
    const channel = {
      name: 'SUNDOWNER',
      enabled: true,
      syncEnabled: true,
      botToken: 'bot-token',
      chatId: '100',
      importDirectory: 'telegram-import/SUNDOWNER',
      proxyUrl: '',
    };

    await importTelegramUpdate(context, channel, {
      update_id: 1,
      channel_post: {
        message_id: 10,
        media_group_id: 'group-1',
        date: 1715930000,
        caption: '/moments one',
        chat: { id: '100' },
        photo: [
          { file_id: 'file-1', file_unique_id: 'uniq-1', file_size: 1000, width: 100, height: 100 },
        ],
      },
    }, 'webhook');

    await importTelegramUpdate(context, channel, {
      update_id: 2,
      channel_post: {
        message_id: 11,
        media_group_id: 'group-1',
        date: 1715930001,
        caption: '',
        chat: { id: '100' },
        photo: [
          { file_id: 'file-2', file_unique_id: 'uniq-2', file_size: 1000, width: 100, height: 100 },
        ],
      },
    }, 'webhook');

    const store = new MomentsStore({ img_d1: d1 });
    const posts = await store.listPosts({ pageSize: 10 });

    assert.equal(posts.posts.length, 1);
    assert.deepEqual(posts.posts[0].attachments.map((attachment) => attachment.fileId), [
      'tg_SUNDOWNER_10_uniq-1.jpg',
      'tg_SUNDOWNER_11_uniq-2.jpg',
    ]);
  });

  it('merges the album even when a later image webhook arrives before the captioned lead item', async () => {
    const d1 = new SqliteD1(':memory:');
    await seedUploadConfig(d1);

    const filePaths = new Map([
      ['file-1', 'photos/file-1.jpg'],
      ['file-2', 'photos/file-2.jpg'],
    ]);

    globalThis.fetch = async (url) => {
      const normalized = String(url);
      if (normalized.includes('/getFile?')) {
        const fileId = new URL(normalized).searchParams.get('file_id');
        return new Response(JSON.stringify({ ok: true, result: { file_path: filePaths.get(fileId) } }), { status: 200 });
      }
      if (normalized.includes('/file/botbot-token/')) {
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${normalized}`);
    };

    const context = {
      env: { img_d1: d1 },
      waitUntil() {},
    };
    const channel = {
      name: 'SUNDOWNER',
      enabled: true,
      syncEnabled: true,
      botToken: 'bot-token',
      chatId: '100',
      importDirectory: 'telegram-import/SUNDOWNER',
      proxyUrl: '',
    };

    await importTelegramUpdate(context, channel, {
      update_id: 1,
      channel_post: {
        message_id: 11,
        media_group_id: 'group-2',
        date: 1715930001,
        caption: '',
        chat: { id: '100' },
        photo: [
          { file_id: 'file-2', file_unique_id: 'uniq-2', file_size: 1000, width: 100, height: 100 },
        ],
      },
    }, 'webhook');

    await importTelegramUpdate(context, channel, {
      update_id: 2,
      channel_post: {
        message_id: 10,
        media_group_id: 'group-2',
        date: 1715930000,
        caption: '/moments one',
        chat: { id: '100' },
        photo: [
          { file_id: 'file-1', file_unique_id: 'uniq-1', file_size: 1000, width: 100, height: 100 },
        ],
      },
    }, 'webhook');

    const store = new MomentsStore({ img_d1: d1 });
    const posts = await store.listPosts({ pageSize: 10 });

    assert.equal(posts.posts.length, 1);
    assert.deepEqual(posts.posts[0].attachments.map((attachment) => attachment.fileId).sort(), [
      'tg_SUNDOWNER_10_uniq-1.jpg',
      'tg_SUNDOWNER_11_uniq-2.jpg',
    ].sort());
  });

  it('uses a standalone /moments command for following HEIC document uploads', async () => {
    const d1 = new SqliteD1(':memory:');
    await seedUploadConfig(d1);

    const filePaths = new Map([
      ['doc-1', 'documents/IMG_1422.HEIC'],
      ['doc-2', 'documents/IMG_1423.HEIC'],
    ]);

    globalThis.fetch = async (url) => {
      const normalized = String(url);
      if (normalized.includes('/getFile?')) {
        const fileId = new URL(normalized).searchParams.get('file_id');
        return new Response(JSON.stringify({ ok: true, result: { file_path: filePaths.get(fileId) } }), { status: 200 });
      }
      if (normalized.includes('/file/botbot-token/')) {
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${normalized}`);
    };

    const context = {
      env: { img_d1: d1 },
      waitUntil() {},
    };
    const channel = {
      name: 'SUNDOWNER',
      enabled: true,
      syncEnabled: true,
      botToken: 'bot-token',
      chatId: '100',
      importDirectory: 'telegram-import/SUNDOWNER',
      proxyUrl: '',
    };

    await importTelegramUpdate(context, channel, {
      update_id: 1,
      channel_post: {
        message_id: 20,
        date: 1715930000,
        text: '/moments collage',
        chat: { id: '100' },
      },
    }, 'webhook');

    await importTelegramUpdate(context, channel, {
      update_id: 2,
      channel_post: {
        message_id: 21,
        date: 1715930001,
        caption: '',
        chat: { id: '100' },
        document: {
          file_id: 'doc-1',
          file_unique_id: 'uniq-doc-1',
          file_name: 'IMG_1422.HEIC',
          mime_type: '',
          file_size: 1024 * 1024,
          thumbnail: {
            file_id: 'thumb-1',
            file_unique_id: 'thumb-uniq-1',
            width: 320,
            height: 240,
            file_size: 12000,
          },
        },
      },
    }, 'webhook');

    await importTelegramUpdate(context, channel, {
      update_id: 3,
      channel_post: {
        message_id: 22,
        date: 1715930002,
        caption: '',
        chat: { id: '100' },
        document: {
          file_id: 'doc-2',
          file_unique_id: 'uniq-doc-2',
          file_name: 'IMG_1423.HEIC',
          mime_type: '',
          file_size: 1024 * 1024,
        },
      },
    }, 'webhook');

    const store = new MomentsStore({ img_d1: d1 });
    const posts = await store.listPosts({ pageSize: 10 });

    assert.equal(posts.posts.length, 1);
    assert.equal(posts.posts[0].body, 'collage');
    assert.deepEqual(posts.posts[0].attachments.map((attachment) => attachment.fileId), [
      'tg_SUNDOWNER_21_uniq-doc-1.heic',
      'tg_SUNDOWNER_22_uniq-doc-2.heic',
    ]);
    assert.deepEqual(posts.posts[0].attachments.map((attachment) => attachment.metadata.FileType), [
      'image/heic',
      'image/heic',
    ]);
  });
});
