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

  it('falls back to an embedded HEIC preview when a stored Telegram thumbnail cannot be read', async () => {
    const previewBytes = new Uint8Array([0xFF, 0xD8, 0xFA, 0xD9]);
    __setEmbeddedThumbnailExtractorForTests(async () => previewBytes);

    const records = new Map([
      ['telegram-import/SUNDOWNER/IMG_1422.HEIC', {
        value: '',
        metadata: {
          FileName: 'IMG_1422.HEIC',
          FileType: 'image/heic',
          Channel: 'TelegramNew',
          ChannelName: 'SUNDOWNER',
          TgFileId: 'original-file-id',
          TgThumbnailFileId: 'broken-thumbnail-file-id',
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
        if (fileId === 'broken-thumbnail-file-id') {
          return new Response(JSON.stringify({
            ok: false,
            description: 'Bad Request: file not found',
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
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
        request: new Request('https://example.com/file/telegram-import/SUNDOWNER/IMG_1422.HEIC?preview=1', {
          headers: {
            Referer: 'https://example.com/dashboard',
          },
        }),
        env,
        params: { path: 'telegram-import/SUNDOWNER/IMG_1422.HEIC' },
        waitUntil() {},
        next() {},
        data: {},
      });

      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Content-Type'), 'image/jpeg');
      assert.deepEqual(Array.from(new Uint8Array(await response.arrayBuffer())), Array.from(previewBytes));
    });

    assert.ok(fetchCalls.some((call) => call.includes('file_id=broken-thumbnail-file-id')));
    assert.ok(fetchCalls.some((call) => call.includes('file_id=original-file-id')));
  });

  it('falls back to the original Telegram JPEG when a stored document thumbnail cannot be read', async () => {
    const originalBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9]);
    const records = new Map([
      ['telegram-import/SUNDOWNER/IMG_1422.JPG', {
        value: '',
        metadata: {
          FileName: 'IMG_1422.JPG',
          FileType: 'image/jpeg',
          Channel: 'TelegramNew',
          ChannelName: 'SUNDOWNER',
          TgFileId: 'original-jpeg-file-id',
          TgThumbnailFileId: 'broken-thumbnail-file-id',
          TgThumbnailFileType: 'image/jpeg',
          ListType: 'Photo',
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
        if (fileId === 'broken-thumbnail-file-id') {
          return new Response(JSON.stringify({
            ok: false,
            description: 'Bad Request: file not found',
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({
          ok: true,
          result: {
            file_path: `documents/${fileId}.jpg`,
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (normalized.includes('/file/botenv-token/documents/original-jpeg-file-id.jpg')) {
        return new Response(originalBytes, {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        });
      }
      throw new Error(`Unexpected fetch: ${normalized}`);
    }, async () => {
      const response = await onRequest({
        request: new Request('https://example.com/file/telegram-import/SUNDOWNER/IMG_1422.JPG?preview=1', {
          headers: {
            Referer: 'https://example.com/dashboard',
          },
        }),
        env,
        params: { path: 'telegram-import/SUNDOWNER/IMG_1422.JPG' },
        waitUntil() {},
        next() {},
        data: {},
      });

      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Content-Type'), 'image/jpeg');
      assert.deepEqual(Array.from(new Uint8Array(await response.arrayBuffer())), Array.from(originalBytes));
    });

    assert.ok(fetchCalls.some((call) => call.includes('file_id=broken-thumbnail-file-id')));
    assert.ok(fetchCalls.some((call) => call.includes('file_id=original-jpeg-file-id')));
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
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
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

  it('attaches an immutable Cache-Control directive plus a content-addressed ETag to embedded previews', async () => {
    __setEmbeddedThumbnailExtractorForTests(async () => new Uint8Array([0xFF, 0xD8, 0xCA, 0xFE]));

    const records = new Map([
      ['photos/IMG_3000.HEIC', {
        value: '',
        metadata: {
          FileName: 'IMG_3000.HEIC',
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
          return key === 'photos/IMG_3000.HEIC'
            ? new MockR2Object(new Uint8Array([0x00, 0x01]))
            : null;
        },
      },
    };

    const response = await onRequest({
      request: new Request('https://example.com/file/photos/IMG_3000.HEIC?preview=embedded', {
        headers: { Referer: 'https://example.com/dashboard' },
      }),
      env,
      params: { path: 'photos/IMG_3000.HEIC' },
      waitUntil() {},
      next() {},
      data: {},
    });

    assert.equal(response.status, 200);
    const cacheControl = response.headers.get('Cache-Control') || '';
    assert.match(cacheControl, /immutable/, 'Cache-Control should declare immutable for content-addressed previews');
    assert.match(cacheControl, /max-age=\d+/);
    const etag = response.headers.get('ETag') || '';
    assert.equal(etag, '"photos/IMG_3000.HEIC-embedded-extracted-image-jpeg"', 'ETag must identify the extracted representation');
  });

  it('returns an accurate 304 after resolving the embedded representation MIME', async () => {
    __setEmbeddedThumbnailExtractorForTests(async () => new Uint8Array([0xFF, 0xD8, 0xCA, 0xFE]));
    let r2Calls = 0;
    const records = new Map([
      ['photos/IMG_3000.HEIC', {
        value: '',
        metadata: {
          FileName: 'IMG_3000.HEIC',
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
          r2Calls += 1;
          return key === 'photos/IMG_3000.HEIC'
            ? new MockR2Object(new Uint8Array([0x00, 0x01]))
            : null;
        },
      },
    };

    const response = await onRequest({
      request: new Request('https://example.com/file/photos/IMG_3000.HEIC?preview=embedded', {
        headers: {
          Referer: 'https://example.com/dashboard',
          'If-None-Match': '"photos/IMG_3000.HEIC-embedded-extracted-image-jpeg"',
        },
      }),
      env,
      params: { path: 'photos/IMG_3000.HEIC' },
      waitUntil() {},
      next() {},
      data: {},
    });

    assert.equal(response.status, 304, 'matching If-None-Match must return 304');
    assert.equal(response.headers.get('ETag'), '"photos/IMG_3000.HEIC-embedded-extracted-image-jpeg"', '304 ETag must match the resolved representation');
    assert.equal(response.headers.get('Content-Type'), 'image/jpeg', '304 must describe the cached JPEG preview, not the HEIC source');
    assert.match(response.headers.get('Cache-Control') || '', /immutable/);
    assert.equal(r2Calls, 1, 'a cold cache must resolve the representation before returning 304');
  });

  it('does not reuse a Telegram thumbnail MIME for an extracted embedded preview 304', async () => {
    const previewBytes = new Uint8Array([0xFF, 0xD8, 0xCA, 0xFE]);
    __setEmbeddedThumbnailExtractorForTests(async () => previewBytes);
    const records = new Map([
      ['photos/IMG_3001.HEIC', {
        value: '',
        metadata: {
          FileName: 'IMG_3001.HEIC',
          FileType: 'image/heic',
          Channel: 'CloudflareR2',
          TgThumbnailFileId: 'thumbnail-webp-id',
          TgThumbnailFileType: 'image/webp',
          ListType: 'None',
          Label: 'safe',
        },
      }],
    ]);
    const env = {
      img_url: new MemoryKV(records),
      img_r2: {
        async get(key) {
          return key === 'photos/IMG_3001.HEIC'
            ? new MockR2Object(new Uint8Array([0x00, 0x01]))
            : null;
        },
      },
    };
    const first = await onRequest({
      request: new Request('https://example.com/file/photos/IMG_3001.HEIC?preview=embedded', {
        headers: { Referer: 'https://example.com/dashboard' },
      }),
      env,
      params: { path: 'photos/IMG_3001.HEIC' },
      waitUntil() {},
      next() {},
      data: {},
    });
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('Content-Type'), 'image/jpeg');

    const second = await onRequest({
      request: new Request('https://example.com/file/photos/IMG_3001.HEIC?preview=embedded', {
        headers: {
          Referer: 'https://example.com/dashboard',
          'If-None-Match': first.headers.get('ETag'),
        },
      }),
      env,
      params: { path: 'photos/IMG_3001.HEIC' },
      waitUntil() {},
      next() {},
      data: {},
    });
    assert.equal(second.status, 304);
    assert.equal(second.headers.get('Content-Type'), 'image/jpeg');
  });

  it('caches the embedded preview in caches.default so repeat requests skip the source fetch', async () => {
    const previewBytes = new Uint8Array([0xFF, 0xD8, 0xCA, 0xC1, 0xFF, 0xD9]);
    let extractorCalls = 0;
    __setEmbeddedThumbnailExtractorForTests(async () => {
      extractorCalls += 1;
      return previewBytes;
    });

    const records = new Map([
      ['photos/IMG_4000.HEIC', {
        value: '',
        metadata: {
          FileName: 'IMG_4000.HEIC',
          FileType: 'image/heic',
          Channel: 'CloudflareR2',
          ListType: 'None',
          Label: 'safe',
        },
      }],
    ]);

    let r2Calls = 0;
    const env = {
      img_url: new MemoryKV(records),
      img_r2: {
        async get(key) {
          r2Calls += 1;
          return key === 'photos/IMG_4000.HEIC'
            ? new MockR2Object(new Uint8Array([0x10, 0x11, 0x12]))
            : null;
        },
      },
    };

    const cacheStore = new Map();
    const cachePuts = [];
    const fakeCache = {
      async match(request) {
        const key = request instanceof Request ? request.url : String(request);
        return cacheStore.get(key) || undefined;
      },
      async put(request, response) {
        const key = request instanceof Request ? request.url : String(request);
        cachePuts.push(key);
        cacheStore.set(key, response);
      },
    };
    const originalCaches = globalThis.caches;
    globalThis.caches = { default: fakeCache };

    const buildRequest = () => ({
      request: new Request('https://example.com/file/photos/IMG_4000.HEIC?preview=embedded', {
        headers: { Referer: 'https://example.com/dashboard' },
      }),
      env,
      params: { path: 'photos/IMG_4000.HEIC' },
      waitUntil(promise) { return Promise.resolve(promise).catch(() => {}); },
      next() {},
      data: {},
    });

    try {
      const first = await onRequest(buildRequest());
      assert.equal(first.status, 200);
      assert.deepEqual(Array.from(new Uint8Array(await first.arrayBuffer())), Array.from(previewBytes));
      assert.equal(extractorCalls, 1, 'first request runs the extractor');
      assert.equal(r2Calls, 1, 'first request loads the source from R2');
      assert.equal(cachePuts.length, 1, 'first request stashes the response into caches.default');

      const second = await onRequest(buildRequest());
      assert.equal(second.status, 200);
      assert.deepEqual(Array.from(new Uint8Array(await second.arrayBuffer())), Array.from(previewBytes));
      assert.equal(extractorCalls, 1, 'second request must serve from cache without re-running the extractor');
      assert.equal(r2Calls, 1, 'second request must not re-read the source from R2');
    } finally {
      if (originalCaches === undefined) {
        delete globalThis.caches;
      } else {
        globalThis.caches = originalCaches;
      }
    }
  });

  it('stashes a public, GET-shaped response so CF caches.default does not reject the write', async () => {
    const previewBytes = new Uint8Array([0xFF, 0xD8, 0xAB, 0xCD, 0xFF, 0xD9]);
    __setEmbeddedThumbnailExtractorForTests(async () => previewBytes);

    const records = new Map([
      ['photos/IMG_PRIV.HEIC', {
        value: '',
        metadata: {
          FileName: 'IMG_PRIV.HEIC',
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
          return key === 'photos/IMG_PRIV.HEIC'
            ? new MockR2Object(new Uint8Array([0x20, 0x21]))
            : null;
        },
      },
    };

    const cacheStore = new Map();
    const stashedResponses = [];
    const fakeCache = {
      async match(request) {
        const key = request instanceof Request ? request.url : String(request);
        return cacheStore.get(key) || undefined;
      },
      async put(request, response) {
        // 模拟 CF Cache API：private / no-store / no-cache 一律拒收，便于在测试里抓到回归。
        const cc = (response.headers.get('Cache-Control') || '').toLowerCase();
        if (/(\bprivate\b|\bno-store\b|\bno-cache\b)/.test(cc)) {
          throw new TypeError('Cannot cache response with Cache-Control: private/no-store/no-cache');
        }
        const key = request instanceof Request ? request.url : String(request);
        stashedResponses.push({ key, cacheControl: cc, status: response.status });
        cacheStore.set(key, response);
      },
    };
    const originalCaches = globalThis.caches;
    globalThis.caches = { default: fakeCache };

    const buildRequest = (init = {}) => ({
      request: new Request('https://example.com/file/photos/IMG_PRIV.HEIC?preview=embedded', {
        method: init.method || 'GET',
        headers: { Referer: 'https://example.com/dashboard' },
      }),
      env,
      params: { path: 'photos/IMG_PRIV.HEIC' },
      waitUntil(promise) { return Promise.resolve(promise).catch(() => {}); },
      next() {},
      data: {},
    });

    try {
      const first = await onRequest(buildRequest());
      assert.equal(first.status, 200);
      // 客户端响应保留原本的 private 语义，不把 cache 用的 public CC 漏出去。
      assert.match((first.headers.get('Cache-Control') || '').toLowerCase(), /private/);
      assert.equal(stashedResponses.length, 1, 'fake CF cache must accept the stash (public CC)');
      assert.match(stashedResponses[0].cacheControl, /public/);
      assert.match(stashedResponses[0].cacheControl, /immutable/);

      const second = await onRequest(buildRequest());
      assert.equal(second.status, 200);
      // 缓存命中也要给客户端回 private，按当前 Referer 重建头。
      assert.match((second.headers.get('Cache-Control') || '').toLowerCase(), /private/);
      assert.deepEqual(Array.from(new Uint8Array(await second.arrayBuffer())), Array.from(previewBytes));
    } finally {
      if (originalCaches === undefined) {
        delete globalThis.caches;
      } else {
        globalThis.caches = originalCaches;
      }
    }
  });

  it('returns 415 preview-unavailable instead of raw HEIC bytes when no renderable preview exists', async () => {
    __setEmbeddedThumbnailExtractorForTests(async () => null);

    const records = new Map([
      ['telegram-import/Telegram_env/IMG_9000.HEIC', {
        value: '',
        metadata: {
          FileName: 'IMG_9000.HEIC',
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
    const fileFetches = [];

    await withFetchStub(async (url, init) => {
      const normalized = String(url);
      if (normalized.includes('/getFile?')) {
        return new Response(JSON.stringify({
          ok: true,
          result: { file_path: 'documents/original-file-id.heic' },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (normalized.includes('/file/botenv-token/documents/original-file-id.heic')) {
        fileFetches.push(new Headers(init?.headers).get('range') || '');
        // 上游忽略 Range，直接 200 全量
        return new Response(new Uint8Array([0x00, 0x01, 0x02]), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${normalized}`);
    }, async () => {
      const response = await onRequest({
        request: new Request('https://example.com/file/telegram-import/Telegram_env/IMG_9000.HEIC?preview=1', {
          headers: { Referer: 'https://example.com/dashboard' },
        }),
        env,
        params: { path: 'telegram-import/Telegram_env/IMG_9000.HEIC' },
        waitUntil() {},
        next() {},
        data: {},
      });

      assert.equal(response.status, 415, 'preview route must not 200 with undecodable raw HEIC');
      assert.equal(response.headers.get('X-Preview-Unavailable'), 'heic');
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.deepEqual(await response.json(), { error: 'preview-unavailable', format: 'heic' });
    });

    assert.equal(fileFetches.length, 1, 'a Range-ignoring upstream must not trigger a second full download');
    assert.equal(fileFetches[0], 'bytes=0-262143', 'extraction source fetch must ask for a bounded Range first');
  });

  it('returns 415 for R2 HEIC embedded preview requests when extraction fails', async () => {
    __setEmbeddedThumbnailExtractorForTests(async () => null);

    const records = new Map([
      ['photos/IMG_9001.HEIC', {
        value: '',
        metadata: {
          FileName: 'IMG_9001.HEIC',
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
          return key === 'photos/IMG_9001.HEIC'
            ? new MockR2Object(new Uint8Array([0x00, 0x01]))
            : null;
        },
      },
    };

    const response = await onRequest({
      request: new Request('https://example.com/file/photos/IMG_9001.HEIC?preview=embedded', {
        headers: { Referer: 'https://example.com/dashboard' },
      }),
      env,
      params: { path: 'photos/IMG_9001.HEIC' },
      waitUntil() {},
      next() {},
      data: {},
    });

    assert.equal(response.status, 415);
    assert.equal(response.headers.get('X-Preview-Unavailable'), 'heic');
    assert.deepEqual(await response.json(), { error: 'preview-unavailable', format: 'heic' });
  });

  it('keeps serving raw HEIC originals for non-preview reads (client-side libheif decode)', async () => {
    __setEmbeddedThumbnailExtractorForTests(async () => null);

    const rawBytes = new Uint8Array([0x10, 0x11, 0x12]);
    const records = new Map([
      ['telegram-import/Telegram_env/IMG_9002.HEIC', {
        value: '',
        metadata: {
          FileName: 'IMG_9002.HEIC',
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

    await withFetchStub(async (url) => {
      const normalized = String(url);
      if (normalized.includes('/getFile?')) {
        return new Response(JSON.stringify({
          ok: true,
          result: { file_path: 'documents/original-file-id.heic' },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (normalized.includes('/file/botenv-token/documents/original-file-id.heic')) {
        return new Response(rawBytes, { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${normalized}`);
    }, async () => {
      const response = await onRequest({
        request: new Request('https://example.com/file/telegram-import/Telegram_env/IMG_9002.HEIC', {
          headers: { Referer: 'https://example.com/dashboard' },
        }),
        env,
        params: { path: 'telegram-import/Telegram_env/IMG_9002.HEIC' },
        waitUntil() {},
        next() {},
        data: {},
      });

      assert.equal(response.status, 200, 'non-preview GET must keep returning raw originals');
      assert.deepEqual(Array.from(new Uint8Array(await response.arrayBuffer())), Array.from(rawBytes));
    });
  });

  it('extracts the embedded preview from a 256KB Range fetch without downloading the full original', async () => {
    const previewBytes = new Uint8Array([0xFF, 0xD8, 0x77, 0xD9]);
    __setEmbeddedThumbnailExtractorForTests(async (buffer) => (buffer[0] === 0xAA ? previewBytes : null));

    const records = new Map([
      ['telegram-import/Telegram_env/IMG_9003.HEIC', {
        value: '',
        metadata: {
          FileName: 'IMG_9003.HEIC',
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
    const fileFetchRanges = [];

    await withFetchStub(async (url, init) => {
      const normalized = String(url);
      if (normalized.includes('/getFile?')) {
        return new Response(JSON.stringify({
          ok: true,
          result: { file_path: 'documents/original-file-id.heic' },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (normalized.includes('/file/botenv-token/documents/original-file-id.heic')) {
        const range = new Headers(init?.headers).get('range') || '';
        fileFetchRanges.push(range);
        if (range) {
          return new Response(new Uint8Array([0xAA, 0x01, 0x02]), { status: 206 });
        }
        return new Response(new Uint8Array([0xBB, 0x01, 0x02]), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${normalized}`);
    }, async () => {
      const response = await onRequest({
        request: new Request('https://example.com/file/telegram-import/Telegram_env/IMG_9003.HEIC?preview=1', {
          headers: { Referer: 'https://example.com/dashboard' },
        }),
        env,
        params: { path: 'telegram-import/Telegram_env/IMG_9003.HEIC' },
        waitUntil() {},
        next() {},
        data: {},
      });

      assert.equal(response.status, 200);
      assert.deepEqual(Array.from(new Uint8Array(await response.arrayBuffer())), Array.from(previewBytes));
    });

    assert.deepEqual(fileFetchRanges, ['bytes=0-262143'], 'only the bounded Range fetch may hit the original');
  });

  it('falls back to the full download when the ranged header holds no extractable preview', async () => {
    const previewBytes = new Uint8Array([0xFF, 0xD8, 0x66, 0xD9]);
    __setEmbeddedThumbnailExtractorForTests(async (buffer) => (buffer[0] === 0xBB ? previewBytes : null));

    const records = new Map([
      ['telegram-import/Telegram_env/IMG_9004.HEIC', {
        value: '',
        metadata: {
          FileName: 'IMG_9004.HEIC',
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
    const fileFetchRanges = [];
    // 206 且填满整个请求区间，代表 header 之外还有更多字节可回退下载
    const rangedBytes = new Uint8Array(262144);
    rangedBytes[0] = 0xAA;

    await withFetchStub(async (url, init) => {
      const normalized = String(url);
      if (normalized.includes('/getFile?')) {
        return new Response(JSON.stringify({
          ok: true,
          result: { file_path: 'documents/original-file-id.heic' },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (normalized.includes('/file/botenv-token/documents/original-file-id.heic')) {
        const range = new Headers(init?.headers).get('range') || '';
        fileFetchRanges.push(range);
        if (range) {
          return new Response(rangedBytes, { status: 206 });
        }
        return new Response(new Uint8Array([0xBB, 0x01, 0x02]), { status: 200 });
      }
      throw new Error(`Unexpected fetch: ${normalized}`);
    }, async () => {
      const response = await onRequest({
        request: new Request('https://example.com/file/telegram-import/Telegram_env/IMG_9004.HEIC?preview=1', {
          headers: { Referer: 'https://example.com/dashboard' },
        }),
        env,
        params: { path: 'telegram-import/Telegram_env/IMG_9004.HEIC' },
        waitUntil() {},
        next() {},
        data: {},
      });

      assert.equal(response.status, 200);
      assert.deepEqual(Array.from(new Uint8Array(await response.arrayBuffer())), Array.from(previewBytes));
    });

    assert.deepEqual(fileFetchRanges, ['bytes=0-262143', ''], 'ranged fetch first, full download as fallback');
  });

  it('serves the buffered refreshed body when 404-refresh preview extraction fails', async () => {
    __setEmbeddedThumbnailExtractorForTests(async () => null);

    const thumbBytes = new Uint8Array([0xFF, 0xD8, 0x21, 0x22, 0xFF, 0xD9]);
    const records = new Map([
      ['telegram-import/Telegram_env/IMG_9005.HEIC', {
        value: '',
        metadata: {
          FileName: 'IMG_9005.HEIC',
          FileType: 'image/heic',
          Channel: 'TelegramNew',
          ChannelName: 'Telegram_env',
          TgFileId: 'original-file-id',
          TgThumbnailFileId: 'thumb-file-id',
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
    let thumbGetFileCalls = 0;

    await withFetchStub(async (url) => {
      const normalized = String(url);
      if (normalized.includes('/getFile?')) {
        const fileId = new URL(normalized).searchParams.get('file_id');
        if (fileId === 'thumb-file-id') {
          thumbGetFileCalls += 1;
          return new Response(JSON.stringify({
            ok: true,
            result: {
              file_path: thumbGetFileCalls === 1 ? 'photos/stale-thumb.jpg' : 'photos/fresh-thumb.jpg',
            },
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        throw new Error(`Unexpected getFile for ${fileId}`);
      }
      if (normalized.includes('/file/botenv-token/photos/stale-thumb.jpg')) {
        return new Response('gone', { status: 404 });
      }
      if (normalized.includes('/file/botenv-token/photos/fresh-thumb.jpg')) {
        return new Response(thumbBytes, { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
      }
      throw new Error(`Unexpected fetch: ${normalized}`);
    }, async () => {
      const response = await onRequest({
        request: new Request('https://example.com/file/telegram-import/Telegram_env/IMG_9005.HEIC?preview=1', {
          headers: { Referer: 'https://example.com/dashboard' },
        }),
        env,
        params: { path: 'telegram-import/Telegram_env/IMG_9005.HEIC' },
        waitUntil() {},
        next() {},
        data: {},
      });

      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Content-Type'), 'image/jpeg');
      assert.deepEqual(
        Array.from(new Uint8Array(await response.arrayBuffer())),
        Array.from(thumbBytes),
        'fallthrough must rebuild from the buffered bytes, not the consumed stream',
      );
    });

    assert.equal(thumbGetFileCalls, 2);
  });

  it('stashes a freshly extracted 404-refresh preview into caches.default', async () => {
    const previewBytes = new Uint8Array([0xFF, 0xD8, 0x31, 0x32, 0xFF, 0xD9]);
    __setEmbeddedThumbnailExtractorForTests(async () => previewBytes);

    const records = new Map([
      ['telegram-import/Telegram_env/IMG_9006.HEIC', {
        value: '',
        metadata: {
          FileName: 'IMG_9006.HEIC',
          FileType: 'image/heic',
          Channel: 'TelegramNew',
          ChannelName: 'Telegram_env',
          TgFileId: 'original-file-id',
          TgThumbnailFileId: 'thumb-file-id',
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

    const cacheStore = new Map();
    const cachePuts = [];
    const fakeCache = {
      async match(request) {
        const key = request instanceof Request ? request.url : String(request);
        return cacheStore.get(key) || undefined;
      },
      async put(request, response) {
        const key = request instanceof Request ? request.url : String(request);
        cachePuts.push({ key, cacheControl: response.headers.get('Cache-Control') || '' });
        cacheStore.set(key, response);
      },
    };
    const originalCaches = globalThis.caches;
    globalThis.caches = { default: fakeCache };
    let thumbGetFileCalls = 0;

    try {
      await withFetchStub(async (url) => {
        const normalized = String(url);
        if (normalized.includes('/getFile?')) {
          const fileId = new URL(normalized).searchParams.get('file_id');
          if (fileId === 'thumb-file-id') {
            thumbGetFileCalls += 1;
            return new Response(JSON.stringify({
              ok: true,
              result: {
                file_path: thumbGetFileCalls === 1 ? 'photos/stale-thumb.jpg' : 'photos/fresh-thumb.jpg',
              },
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          throw new Error(`Unexpected getFile for ${fileId}`);
        }
        if (normalized.includes('/file/botenv-token/photos/stale-thumb.jpg')) {
          return new Response('gone', { status: 404 });
        }
        if (normalized.includes('/file/botenv-token/photos/fresh-thumb.jpg')) {
          return new Response(new Uint8Array([0x40, 0x41]), { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
        }
        throw new Error(`Unexpected fetch: ${normalized}`);
      }, async () => {
        const response = await onRequest({
          request: new Request('https://example.com/file/telegram-import/Telegram_env/IMG_9006.HEIC?preview=1', {
            headers: { Referer: 'https://example.com/dashboard' },
          }),
          env,
          params: { path: 'telegram-import/Telegram_env/IMG_9006.HEIC' },
          waitUntil(promise) { return Promise.resolve(promise).catch(() => {}); },
          next() {},
          data: {},
        });

        assert.equal(response.status, 200);
        assert.deepEqual(Array.from(new Uint8Array(await response.arrayBuffer())), Array.from(previewBytes));
      });

      const embeddedPuts = cachePuts.filter((entry) => entry.key.includes('/file/') && entry.key.includes('preview=embedded'));
      assert.equal(embeddedPuts.length, 1, '404-refresh extraction must stash under the canonical embedded key');
      assert.match(embeddedPuts[0].cacheControl, /public/);
      assert.match(embeddedPuts[0].cacheControl, /immutable/);
    } finally {
      if (originalCaches === undefined) {
        delete globalThis.caches;
      } else {
        globalThis.caches = originalCaches;
      }
    }
  });

  it('does not poison the GET cache when a HEAD request lands first', async () => {
    const previewBytes = new Uint8Array([0xFF, 0xD8, 0x12, 0x34, 0xFF, 0xD9]);
    let extractorCalls = 0;
    __setEmbeddedThumbnailExtractorForTests(async () => {
      extractorCalls += 1;
      return previewBytes;
    });

    const records = new Map([
      ['photos/IMG_HEAD.HEIC', {
        value: '',
        metadata: {
          FileName: 'IMG_HEAD.HEIC',
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
          return key === 'photos/IMG_HEAD.HEIC'
            ? new MockR2Object(new Uint8Array([0x30, 0x31]))
            : null;
        },
      },
    };

    const cacheStore = new Map();
    const fakeCache = {
      async match(request) {
        const key = request instanceof Request ? request.url : String(request);
        const cached = cacheStore.get(key);
        if (!cached) return undefined;
        return cached.clone();
      },
      async put(request, response) {
        const key = request instanceof Request ? request.url : String(request);
        cacheStore.set(key, response);
      },
    };
    const originalCaches = globalThis.caches;
    globalThis.caches = { default: fakeCache };

    const buildRequest = (method) => ({
      request: new Request('https://example.com/file/photos/IMG_HEAD.HEIC?preview=embedded', {
        method,
        headers: { Referer: 'https://example.com/dashboard' },
      }),
      env,
      params: { path: 'photos/IMG_HEAD.HEIC' },
      waitUntil(promise) { return Promise.resolve(promise).catch(() => {}); },
      next() {},
      data: {},
    });

    try {
      const head = await onRequest(buildRequest('HEAD'));
      assert.equal(head.status, 200);
      // HEAD 响应不应带 body
      const headBytes = await head.arrayBuffer();
      assert.equal(headBytes.byteLength, 0, 'HEAD response keeps its bodyless contract');

      const get = await onRequest(buildRequest('GET'));
      assert.equal(get.status, 200);
      const getBytes = new Uint8Array(await get.arrayBuffer());
      assert.deepEqual(Array.from(getBytes), Array.from(previewBytes), 'subsequent GET must return the real preview bytes, not the bodyless HEAD cache');
      // HEAD 那次抽过一次帧；GET 命中缓存不应再抽帧。
      assert.equal(extractorCalls, 1, 'GET must hit the cache stashed by HEAD instead of re-extracting');
    } finally {
      if (originalCaches === undefined) {
        delete globalThis.caches;
      } else {
        globalThis.caches = originalCaches;
      }
    }
  });
});
