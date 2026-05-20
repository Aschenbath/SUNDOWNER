import assert from 'node:assert/strict';

import { onRequest } from '../functions/file/[[path]].js';
import {
  __resetEmbeddedThumbnailExtractorForTests,
  __setEmbeddedThumbnailExtractorForTests,
} from '../functions/upload/exifExtractor.js';

class MemoryKV {
  constructor(records = new Map()) {
    this.records = records;
  }

  async get(key) {
    return this.records.get(key)?.value ?? null;
  }

  async getWithMetadata(key) {
    const record = this.records.get(key);
    if (!record) {
      return null;
    }
    return {
      value: record.value ?? null,
      metadata: record.metadata ?? null,
    };
  }

  async put() {}

  async delete() {}

  async list() {
    return { keys: [], list_complete: true, cursor: '' };
  }
}

class MockR2Object {
  constructor(bytes) {
    this.bytes = bytes;
    this.size = bytes.byteLength;
  }

  async arrayBuffer() {
    return this.bytes.buffer.slice(this.bytes.byteOffset, this.bytes.byteOffset + this.bytes.byteLength);
  }

  writeHttpMetadata() {}

  get body() {
    return new Response(this.bytes).body;
  }
}

function withFetchStub(handler, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  return Promise.resolve()
    .then(run)
    .finally(() => {
      globalThis.fetch = originalFetch;
    });
}

describe('/file HEIC preview responses', () => {
  afterEach(() => {
    __resetEmbeddedThumbnailExtractorForTests();
  });

  it('serves an extracted JPEG preview while keeping the original file path', async () => {
    __setEmbeddedThumbnailExtractorForTests(async () => new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9]));

    const records = new Map([
      ['photos/IMG_2038.HEIC', {
        value: '',
        metadata: {
          FileName: 'IMG_2038.HEIC',
          FileType: 'image/heic',
          Channel: 'CloudflareR2',
          ListType: 'None',
          Label: 'safe',
        },
      }],
    ]);

    const env = {
      img_url: new MemoryKV(records),
      img_r2: {
        async get(key) {
          if (key !== 'photos/IMG_2038.HEIC') {
            return null;
          }
          return new MockR2Object(new Uint8Array([0x00, 0x01, 0x02]));
        },
      },
    };

      const response = await onRequest({
        request: new Request('https://example.com/file/photos/IMG_2038.HEIC?preview=embedded', {
        headers: {
          Referer: 'https://example.com/dashboard',
        },
      }),
      env,
      params: { path: 'photos/IMG_2038.HEIC' },
      waitUntil() {},
      next() {},
      data: {},
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'image/jpeg');
    assert.match(response.headers.get('Content-Disposition') || '', /IMG_2038\.jpg/);
    assert.equal((await response.arrayBuffer()).byteLength, 4);
  });

  it('serves an extracted JPEG for HEIC thumbnail preview reads without stored thumbnails', async () => {
    const previewBytes = new Uint8Array([0xFF, 0xD8, 0xFE, 0xD9]);
    __setEmbeddedThumbnailExtractorForTests(async () => previewBytes);

    const records = new Map([
      ['telegram-import/Telegram_env/IMG_2038.HEIC', {
        value: '',
        metadata: {
          FileName: 'IMG_2038.HEIC',
          FileType: 'image/heic',
          Channel: 'TelegramNew',
          ChannelName: 'Telegram_env',
          TgFileId: 'original-file-id',
          ListType: 'None',
          Label: 'safe',
        },
      }],
    ]);

    const env = {
      img_url: new MemoryKV(records),
      TG_BOT_TOKEN: 'env-token',
      TG_CHAT_ID: '-100123',
    };
    const fetchCalls = [];

    await withFetchStub(async (url) => {
      const normalized = String(url);
      fetchCalls.push(normalized);
      if (normalized.includes('/getFile?')) {
        const fileId = new URL(normalized).searchParams.get('file_id');
        return new Response(JSON.stringify({
          ok: true,
          result: {
            file_path: `documents/${fileId}.heic`,
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (normalized.includes('/file/botenv-token/documents/original-file-id.heic')) {
        return new Response(new Uint8Array([0x00, 0x01, 0x02]), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${normalized}`);
    }, async () => {
      const response = await onRequest({
        request: new Request('https://example.com/file/telegram-import/Telegram_env/IMG_2038.HEIC?preview=1', {
          headers: {
            Referer: 'https://example.com/dashboard',
          },
        }),
        env,
        params: { path: 'telegram-import/Telegram_env/IMG_2038.HEIC' },
        waitUntil() {},
        next() {},
        data: {},
      });

      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Content-Type'), 'image/jpeg');
      assert.deepEqual(Array.from(new Uint8Array(await response.arrayBuffer())), Array.from(previewBytes));
    });

    assert.ok(fetchCalls.some((call) => call.includes('file_id=original-file-id')));
  });

  it('prefers an embedded preview from the Telegram original for full preview reads', async () => {
    const previewBytes = new Uint8Array([0xFF, 0xD8, 0xFE, 0xD9]);
    __setEmbeddedThumbnailExtractorForTests(async () => previewBytes);

    const records = new Map([
      ['telegram-import/Telegram_env/IMG_2038.HEIC', {
        value: '',
        metadata: {
          FileName: 'IMG_2038.HEIC',
          FileType: 'image/heic',
          Channel: 'TelegramNew',
          ChannelName: 'Telegram_env',
          TgFileId: 'original-file-id',
          TgThumbnailFileId: 'thumbnail-file-id',
          TgThumbnailFileType: 'image/jpeg',
          ListType: 'None',
          Label: 'safe',
        },
      }],
    ]);

    const env = {
      img_url: new MemoryKV(records),
      TG_BOT_TOKEN: 'env-token',
      TG_CHAT_ID: '-100123',
    };
    const fetchCalls = [];

    await withFetchStub(async (url) => {
      const normalized = String(url);
      fetchCalls.push(normalized);
      if (normalized.includes('/getFile?')) {
        const fileId = new URL(normalized).searchParams.get('file_id');
        return new Response(JSON.stringify({
          ok: true,
          result: {
            file_path: `documents/${fileId}.heic`,
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (normalized.includes('/file/botenv-token/documents/original-file-id.heic')) {
        return new Response(new Uint8Array([0x00, 0x01, 0x02]), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${normalized}`);
    }, async () => {
      const response = await onRequest({
        request: new Request('https://example.com/file/telegram-import/Telegram_env/IMG_2038.HEIC?preview=embedded', {
          headers: {
            Referer: 'https://example.com/dashboard',
          },
        }),
        env,
        params: { path: 'telegram-import/Telegram_env/IMG_2038.HEIC' },
        waitUntil() {},
        next() {},
        data: {},
      });

      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Content-Type'), 'image/jpeg');
      assert.deepEqual(Array.from(new Uint8Array(await response.arrayBuffer())), Array.from(previewBytes));
    });

    assert.ok(fetchCalls.some((call) => call.includes('file_id=original-file-id')));
    assert.equal(fetchCalls.some((call) => call.includes('file_id=thumbnail-file-id')), false);
  });

  it('returns 404 when the R2 object is missing even if metadata still exists', async () => {
    const records = new Map([
      ['photos/missing.HEIC', {
        value: '',
        metadata: {
          FileName: 'missing.HEIC',
          FileType: 'image/heic',
          Channel: 'CloudflareR2',
          ListType: 'None',
          Label: 'safe',
        },
      }],
    ]);

    const env = {
      img_url: new MemoryKV(records),
      img_r2: {
        async get() {
          return null;
        },
      },
    };

    const response = await onRequest({
      request: new Request('https://example.com/file/photos/missing.HEIC', {
        headers: {
          Referer: 'https://example.com/dashboard',
        },
      }),
      env,
      params: { path: 'photos/missing.HEIC' },
      waitUntil() {},
      next() {},
      data: {},
    });

    assert.equal(response.status, 404);
    assert.equal(await response.text(), 'Error: Image Not Found');
  });

  it('serves an embedded HEIC preview even when stored metadata only has octet-stream', async () => {
    const previewBytes = new Uint8Array([0xFF, 0xD8, 0xFE, 0xD9]);
    __setEmbeddedThumbnailExtractorForTests(async () => previewBytes);

    const records = new Map([
      ['photos/IMG_2038.HEIC', {
        value: '',
        metadata: {
          FileName: 'IMG_2038.HEIC',
          FileType: 'application/octet-stream',
          Channel: 'CloudflareR2',
          ListType: 'None',
          Label: 'safe',
        },
      }],
    ]);

    const env = {
      img_url: new MemoryKV(records),
      img_r2: {
        async get() {
          return new MockR2Object(new Uint8Array([0x00, 0x01, 0x02]));
        },
      },
    };

    const response = await onRequest({
      request: new Request('https://example.com/file/photos/IMG_2038.HEIC?preview=embedded', {
        headers: {
          Referer: 'https://example.com/dashboard',
        },
      }),
      env,
      params: { path: 'photos/IMG_2038.HEIC' },
      waitUntil() {},
      next() {},
      data: {},
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'image/jpeg');
    assert.deepEqual(Array.from(new Uint8Array(await response.arrayBuffer())), Array.from(previewBytes));
  });
});
