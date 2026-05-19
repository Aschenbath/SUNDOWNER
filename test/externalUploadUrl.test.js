import assert from 'node:assert/strict';

import { normalizeExternalUploadUrl, processFileUpload } from '../functions/upload/index.js';

class MemoryKV {
  constructor() {
    this.store = new Map();
    this.metadata = new Map();
  }

  async put(key, value, options = {}) {
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

describe('external upload URL normalization', () => {
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
});
