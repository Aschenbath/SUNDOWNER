import assert from 'node:assert/strict';
import fs from 'node:fs';

import { normalizeExternalUploadUrl, processFileUpload } from '../functions/upload/index.js';
import {
  __resetEmbeddedThumbnailExtractorForTests,
  __setEmbeddedThumbnailExtractorForTests,
} from '../functions/upload/exifExtractor.js';

class MemoryKV {
  constructor() {
    this.store = new Map();
    this.metadata = new Map();
    this.failPuts = new Set();
  }

  async put(key, value, options = {}) {
    if (this.failPuts.has(key)) {
      throw new Error(`KV put failed for ${key}`);
    }
    this.store.set(key, value);
    this.metadata.set(key, options.metadata || {});
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

  async delete(key) {
    this.store.delete(key);
    this.metadata.delete(key);
  }

  async list(options = {}) {
    const prefix = options.prefix || '';
    return {
      keys: [...this.store.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((name) => ({ name, metadata: this.metadata.get(name) || {} })),
      cursor: null,
      list_complete: true,
    };
  }
}

class MemoryR2 {
  constructor() {
    this.objects = new Map();
    this.deleteCalls = [];
  }

  async put(key, value) {
    this.objects.set(key, value);
  }

  async get(key) {
    return this.objects.get(key) || null;
  }

  async delete(key) {
    this.deleteCalls.push(key);
    this.objects.delete(key);
  }
}

describe('external upload URL normalization', () => {
  afterEach(() => {
    __resetEmbeddedThumbnailExtractorForTests();
  });

  it('normalizes valid HTTP(S) URLs before they are stored as metadata', () => {
    assert.equal(
      normalizeExternalUploadUrl('  https://cdn.example.com/photo.jpg?x=1  '),
      'https://cdn.example.com/photo.jpg?x=1'
    );
  });

  it('rejects missing, malformed, and non-HTTP(S) external URLs', () => {
    assert.equal(normalizeExternalUploadUrl(''), null);
    assert.equal(normalizeExternalUploadUrl('not a url'), null);
    assert.equal(normalizeExternalUploadUrl('ftp://cdn.example.com/photo.jpg'), null);
    assert.equal(normalizeExternalUploadUrl('javascript:alert(1)'), null);
  });

  it('accepts URL-only external uploads without requiring a file part', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: false,
      async json() {
        return {};
      },
    });

    try {
      const formdata = new FormData();
      formdata.set('url', 'https://cdn.example.com/album/photo%20one.jpg?token=keep');

      const env = {
        dev_mode: 'true',
        img_url: new MemoryKV(),
      };
      const waitUntilPromises = [];
      const requestUrl = new URL('https://sundowner.example/upload?uploadChannel=external&uploadFolder=links&uploadNameType=origin');
      const response = await processFileUpload({
        env,
        request: new Request(requestUrl, { method: 'POST' }),
        url: requestUrl,
        uploadConfig: {},
        waitUntil(promise) {
          waitUntilPromises.push(Promise.resolve(promise));
        },
      }, formdata);

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), [{ src: '/file/links/photo_one.jpg' }]);

      const stored = await env.img_url.getWithMetadata('links/photo_one.jpg');
      assert.equal(stored.metadata.Channel, 'External');
      assert.equal(stored.metadata.ChannelName, 'External');
      assert.equal(stored.metadata.ExternalLink, 'https://cdn.example.com/album/photo%20one.jpg?token=keep');

      await Promise.all(waitUntilPromises);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('infers HEIC file uploads when browsers omit the MIME type', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: false,
      async json() {
        return {};
      },
    });

    try {
      const formdata = new FormData();
      formdata.set('file', new File([new Uint8Array([0x00, 0x01, 0x02])], 'IMG_2038.HEIC', { type: '' }));

      const env = {
        dev_mode: 'true',
        img_url: new MemoryKV(),
        img_r2: new MemoryR2(),
      };
      const waitUntilPromises = [];
      const requestUrl = new URL('https://sundowner.example/upload?uploadChannel=cfr2&uploadFolder=photos&uploadNameType=origin');
      const response = await processFileUpload({
        env,
        request: new Request(requestUrl, { method: 'POST' }),
        url: requestUrl,
        uploadConfig: {
          cfr2: {
            channels: [{ name: 'R2_env', publicUrl: 'https://cdn.example.com' }],
          },
        },
        waitUntil(promise) {
          waitUntilPromises.push(Promise.resolve(promise));
        },
      }, formdata);

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), [{ src: '/file/photos/IMG_2038.HEIC' }]);

      const stored = await env.img_url.getWithMetadata('photos/IMG_2038.HEIC');
      assert.equal(stored.metadata.FileName, 'IMG_2038.HEIC');
      assert.equal(stored.metadata.FileType, 'image/heic');

      await Promise.all(waitUntilPromises);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('removes an R2 object when the metadata write fails after upload', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: false,
      async json() {
        return {};
      },
    });

    try {
      const formdata = new FormData();
      formdata.set('file', new File([new Uint8Array([0x00, 0x01, 0x02])], 'orphan.jpg', { type: 'image/jpeg' }));

      const env = {
        dev_mode: 'true',
        img_url: new MemoryKV(),
        img_r2: new MemoryR2(),
      };
      env.img_url.failPuts.add('photos/orphan.jpg');

      const requestUrl = new URL('https://sundowner.example/upload?uploadChannel=cfr2&uploadFolder=photos&uploadNameType=origin&autoRetry=false');
      const response = await processFileUpload({
        env,
        request: new Request(requestUrl, { method: 'POST' }),
        url: requestUrl,
        uploadConfig: {
          cfr2: {
            channels: [{ name: 'R2_env', publicUrl: 'https://cdn.example.com' }],
          },
        },
        waitUntil() {
          throw new Error('endUpload must not be scheduled after metadata write failure');
        },
      }, formdata);

      assert.equal(response.status, 500);
      assert.equal(env.img_r2.objects.has('photos/orphan.jpg'), false);
      assert.deepEqual(env.img_r2.deleteCalls, ['photos/orphan.jpg']);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('keeps HEIC uploads on Telegram document transport instead of photo transport', () => {
    const source = fs.readFileSync(new URL('../functions/upload/index.js', import.meta.url), 'utf8');

    assert.match(source, /fileType === 'image\/heic'/);
    assert.match(source, /fileType === 'image\/heif'/);
    assert.match(source, /sendFunction = \{ 'url': 'sendDocument', 'type': 'document' \}/);
  });

  it('returns immediately when Telegram metadata persistence fails', () => {
    const source = fs.readFileSync(new URL('../functions/upload/index.js', import.meta.url), 'utf8');
    const telegramMetadataStart = source.indexOf('metadata.Channel = "TelegramNew";');
    const dbPutStart = source.indexOf('await db.put(fullId, "", {', telegramMetadataStart);
    const catchStart = source.indexOf('} catch (error) {', dbPutStart);
    const waitUntilStart = source.indexOf('waitUntil(endUpload(context, fullId, metadata));', catchStart);

    assert.ok(telegramMetadataStart >= 0, 'Telegram metadata block should be present');
    assert.ok(dbPutStart > telegramMetadataStart, 'Telegram metadata db.put should be present');
    assert.ok(catchStart > dbPutStart, 'Telegram metadata catch block should be present');
    assert.ok(waitUntilStart > catchStart, 'Telegram waitUntil should remain after the persistence block');
    assert.match(source.slice(catchStart, waitUntilStart), /return res;/);
  });

  it('creates a stored preview thumbnail for ordinary Telegram HEIC uploads when Telegram omits one', async () => {
    const originalFetch = globalThis.fetch;
    const telegramCalls = [];
    __setEmbeddedThumbnailExtractorForTests(async () => new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9]));

    globalThis.fetch = async (url) => {
      const requestUrl = String(url);
      telegramCalls.push(requestUrl);

      if (requestUrl.includes('/sendDocument')) {
        return {
          ok: true,
          async json() {
            return {
              ok: true,
              result: {
                document: {
                  file_id: 'original-heic-file-id',
                  file_unique_id: 'original-heic-unique-id',
                  file_name: 'IMG_2038.HEIC',
                  file_size: 1024 * 1024,
                  mime_type: 'image/heic',
                },
              },
            };
          },
        };
      }

      if (requestUrl.includes('/sendPhoto')) {
        return {
          ok: true,
          async json() {
            return {
              ok: true,
              result: {
                photo: [
                  {
                    file_id: 'embedded-preview-file-id',
                    file_unique_id: 'embedded-preview-unique-id',
                    file_size: 4,
                  },
                ],
              },
            };
          },
        };
      }

      if (requestUrl.includes('/getFile')) {
        return {
          ok: true,
          async json() {
            return {
              ok: true,
              result: {
                file_path: 'documents/IMG_2038.HEIC',
              },
            };
          },
        };
      }

      return {
        ok: false,
        async json() {
          return {};
        },
      };
    };

    try {
      const formdata = new FormData();
      formdata.set('file', new File([new Uint8Array([0x00, 0x01, 0x02])], 'IMG_2038.HEIC', { type: '' }));

      const env = {
        dev_mode: 'true',
        img_url: new MemoryKV(),
      };
      const waitUntilPromises = [];
      const requestUrl = new URL('https://sundowner.example/upload?uploadChannel=telegram&uploadFolder=photos&uploadNameType=origin');
      const response = await processFileUpload({
        env,
        request: new Request(requestUrl, { method: 'POST' }),
        url: requestUrl,
        uploadConfig: {
          telegram: {
            loadBalance: { enabled: false },
            channels: [{ name: 'Telegram_env', botToken: '123:test-token', chatId: 'chat-id', proxyUrl: '' }],
          },
        },
        waitUntil(promise) {
          waitUntilPromises.push(Promise.resolve(promise));
        },
      }, formdata);

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), [{ src: '/file/photos/IMG_2038.HEIC' }]);

      const stored = await env.img_url.getWithMetadata('photos/IMG_2038.HEIC');
      assert.equal(stored.metadata.Channel, 'TelegramNew');
      assert.equal(stored.metadata.FileType, 'image/heic');
      assert.equal(stored.metadata.TgFileId, 'original-heic-file-id');
      assert.equal(stored.metadata.TgThumbnailFileId, 'embedded-preview-file-id');
      assert.equal(stored.metadata.TgThumbnailFileType, 'image/jpeg');
      assert.ok(telegramCalls.some((call) => call.includes('/sendDocument')));
      assert.ok(telegramCalls.some((call) => call.includes('/sendPhoto')));

      await Promise.all(waitUntilPromises);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('keeps ordinary JPEG uploads on Telegram document transport to preserve originals', async () => {
    const originalFetch = globalThis.fetch;
    const telegramCalls = [];

    globalThis.fetch = async (url) => {
      const requestUrl = String(url);
      telegramCalls.push(requestUrl);

      if (requestUrl.includes('/sendDocument')) {
        return {
          ok: true,
          async json() {
            return {
              ok: true,
              result: {
                document: {
                  file_id: 'original-jpeg-file-id',
                  file_unique_id: 'original-jpeg-unique-id',
                  file_name: 'IMG_1422.JPG',
                  file_size: 1024 * 1024,
                  mime_type: 'image/jpeg',
                  thumbnail: {
                    file_id: 'jpeg-thumbnail-file-id',
                    file_unique_id: 'jpeg-thumbnail-unique-id',
                    file_size: 12000,
                  },
                },
              },
            };
          },
        };
      }

      if (requestUrl.includes('/sendPhoto')) {
        throw new Error('JPEG uploads must not use Telegram sendPhoto');
      }

      if (requestUrl.includes('/getFile')) {
        return {
          ok: true,
          async json() {
            return {
              ok: true,
              result: {
                file_path: 'documents/IMG_1422.JPG',
              },
            };
          },
        };
      }

      return {
        ok: false,
        async json() {
          return {};
        },
      };
    };

    try {
      const formdata = new FormData();
      formdata.set('file', new File([new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9])], 'IMG_1422.JPG', { type: 'image/jpeg' }));

      const env = {
        dev_mode: 'true',
        img_url: new MemoryKV(),
      };
      const waitUntilPromises = [];
      const requestUrl = new URL('https://sundowner.example/upload?uploadChannel=telegram&uploadFolder=photos&uploadNameType=origin');
      const response = await processFileUpload({
        env,
        request: new Request(requestUrl, { method: 'POST' }),
        url: requestUrl,
        uploadConfig: {
          telegram: {
            loadBalance: { enabled: false },
            channels: [{ name: 'Telegram_env', botToken: '123:test-token', chatId: 'chat-id', proxyUrl: '' }],
          },
        },
        waitUntil(promise) {
          waitUntilPromises.push(Promise.resolve(promise));
        },
      }, formdata);

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), [{ src: '/file/photos/IMG_1422.JPG' }]);

      const stored = await env.img_url.getWithMetadata('photos/IMG_1422.JPG');
      assert.equal(stored.metadata.Channel, 'TelegramNew');
      assert.equal(stored.metadata.FileType, 'image/jpeg');
      assert.equal(stored.metadata.TgFileId, 'original-jpeg-file-id');
      assert.equal(stored.metadata.TgThumbnailFileId, 'jpeg-thumbnail-file-id');
      assert.equal(stored.metadata.TgThumbnailFileType, 'image/jpeg');
      assert.ok(telegramCalls.some((call) => call.includes('/sendDocument')));
      assert.equal(telegramCalls.some((call) => call.includes('/sendPhoto')), false);

      await Promise.all(waitUntilPromises);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

});
