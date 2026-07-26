import assert from 'node:assert/strict';

import { onRequest } from '../functions/file/[[path]].js';

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

function createRecordingCache() {
  const store = new Map();
  const puts = [];
  const matchCalls = [];
  return {
    store,
    puts,
    matchCalls,
    async match(request) {
      const key = request instanceof Request ? request.url : String(request);
      matchCalls.push(key);
      const cached = store.get(key);
      return cached ? cached.clone() : undefined;
    },
    async put(request, response) {
      const key = request instanceof Request ? request.url : String(request);
      puts.push({ key, cacheControl: response.headers.get('Cache-Control') || '' });
      store.set(key, response);
    },
  };
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

function withFakeCaches(fakeCache, run) {
  const originalCaches = globalThis.caches;
  globalThis.caches = { default: fakeCache };
  return Promise.resolve()
    .then(run)
    .finally(() => {
      if (originalCaches === undefined) {
        delete globalThis.caches;
      } else {
        globalThis.caches = originalCaches;
      }
    });
}

describe('/file ?preview=1 Telegram thumbnail edge caching', () => {
  const thumbBytes = new Uint8Array([0xFF, 0xD8, 0x51, 0x52, 0x53, 0xFF, 0xD9]);

  function createThumbnailRecords() {
    return new Map([
      ['telegram-import/Telegram_env/IMG_5000.JPG', {
        value: '',
        metadata: {
          FileName: 'IMG_5000.JPG',
          FileType: 'image/jpeg',
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
  }

  function createEnv(records) {
    return {
      img_url: new MemoryKV(records),
      TG_BOT_TOKEN: 'env-token',
      TG_CHAT_ID: '-100123',
    };
  }

  function createFetchStub(fileFetches) {
    return async (url, init) => {
      const normalized = String(url);
      if (normalized.includes('/getFile?')) {
        const fileId = new URL(normalized).searchParams.get('file_id');
        return new Response(JSON.stringify({
          ok: true,
          result: { file_path: `photos/${fileId}.jpg` },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (normalized.includes('/file/botenv-token/photos/thumb-file-id.jpg')) {
        fileFetches.push(new Headers(init?.headers).get('range') || '');
        return new Response(thumbBytes, {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(thumbBytes.byteLength) },
        });
      }
      throw new Error(`Unexpected fetch: ${normalized}`);
    };
  }

  function buildContext(env, requestUrl) {
    return {
      request: new Request(requestUrl, {
        headers: { Referer: 'https://example.com/dashboard' },
      }),
      env,
      params: { path: 'telegram-import/Telegram_env/IMG_5000.JPG' },
      waitUntil(promise) { return Promise.resolve(promise).catch(() => {}); },
      next() {},
      data: {},
    };
  }

  it('stashes a public copy under a canonical preview=1 key and serves repeats from cache', async () => {
    const env = createEnv(createThumbnailRecords());
    const fakeCache = createRecordingCache();
    const fileFetches = [];
    let fetchCallCount = 0;

    await withFakeCaches(fakeCache, () => withFetchStub(async (url, init) => {
      fetchCallCount += 1;
      return createFetchStub(fileFetches)(url, init);
    }, async () => {
      const first = await onRequest(buildContext(
        env,
        'https://example.com/file/telegram-import/Telegram_env/IMG_5000.JPG?preview=1&sig=abc',
      ));
      assert.equal(first.status, 200);
      assert.deepEqual(Array.from(new Uint8Array(await first.arrayBuffer())), Array.from(thumbBytes));
      assert.equal(fileFetches.length, 1, 'first request downloads the thumbnail from Telegram');

      const thumbnailPuts = fakeCache.puts.filter((entry) => entry.key.includes('/file/'));
      assert.equal(thumbnailPuts.length, 1);
      assert.equal(
        thumbnailPuts[0].key,
        'https://example.com/file/telegram-import/Telegram_env/IMG_5000.JPG?preview=1',
        'canonical key keeps only preview=1 and strips other query params',
      );
      assert.match(thumbnailPuts[0].cacheControl, /public/);
      assert.match(thumbnailPuts[0].cacheControl, /max-age=86400/);
      assert.match(thumbnailPuts[0].cacheControl, /immutable/);

      const fetchesAfterFirst = fetchCallCount;
      const second = await onRequest(buildContext(
        env,
        'https://example.com/file/telegram-import/Telegram_env/IMG_5000.JPG?preview=1&sig=other',
      ));
      assert.equal(second.status, 200);
      assert.deepEqual(Array.from(new Uint8Array(await second.arrayBuffer())), Array.from(thumbBytes));
      assert.equal(fetchCallCount, fetchesAfterFirst, 'cache hit must not touch Telegram at all');
      // Dashboard 内部 Referer 命中缓存后仍按当前请求重建 private 语义
      assert.match((second.headers.get('Cache-Control') || '').toLowerCase(), /private/);
    }));
  });

  it('consults the thumbnail cache only after access checks pass', async () => {
    const records = createThumbnailRecords();
    records.get('telegram-import/Telegram_env/IMG_5000.JPG').metadata.ListType = 'Block';
    const env = createEnv(records);
    const fakeCache = createRecordingCache();
    // 预置一份命中项，若鉴权前查缓存就会错误地放行
    fakeCache.store.set(
      'https://example.com/file/telegram-import/Telegram_env/IMG_5000.JPG?preview=1',
      new Response(thumbBytes, { status: 200, headers: { 'Content-Type': 'image/jpeg' } }),
    );

    await withFakeCaches(fakeCache, () => withFetchStub(async (url) => {
      if (String(url).includes('/static/BlockImg.png')) {
        return new Response('missing', { status: 404 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }, async () => {
      const response = await onRequest(buildContext(
        env,
        'https://example.com/file/telegram-import/Telegram_env/IMG_5000.JPG?preview=1',
      ));

      assert.notEqual(response.status, 200, 'blocked records must never serve cached thumbnails');
      assert.equal(fakeCache.matchCalls.length, 0, 'cache lookup must happen after returnWithCheck gating');
    }));
  });
});
