import assert from 'node:assert/strict';

import { purgeCFCache } from '../functions/utils/purgeCache.js';

class MemoryKV {
  constructor(entries = {}) {
    this.entries = entries;
  }

  async get(key) {
    return this.entries[key] || null;
  }

  async put() {}

  async delete() {}

  async list() {
    return { keys: [], list_complete: true, cursor: '' };
  }
}

describe('purgeCFCache', () => {
  it('serializes purge files with JSON.stringify so special URL characters remain valid JSON', async () => {
    const originalFetch = globalThis.fetch;
    let observedBody = '';
    globalThis.fetch = async (_url, options = {}) => {
      observedBody = options.body;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    };
    try {
      const cdnUrl = 'https://cdn.example.com/photos/weird"\\\\name.jpg';
      await purgeCFCache({
        img_url: new MemoryKV({
          'manage@sysConfig@others': JSON.stringify({
            cloudflareApiToken: {
              CF_ZONE_ID: 'zone',
              CF_EMAIL: 'gilbert@example.com',
              CF_API_KEY: 'secret',
            },
          }),
        }),
      }, cdnUrl);

      assert.deepEqual(JSON.parse(observedBody), { files: [cdnUrl] });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
