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

describe('Discord file route', () => {
  it('returns 404 when Discord metadata exists but the attachment URL cannot be resolved', async () => {
    const records = new Map([
      ['discord/missing.jpg', {
        value: '',
        metadata: {
          FileName: 'missing.jpg',
          FileType: 'image/jpeg',
          Channel: 'Discord',
          DiscordChannelId: '123',
          DiscordMessageId: '456',
          ChannelName: 'Discord_env',
          ListType: 'None',
          Label: 'safe',
        },
      }],
    ]);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (String(url).includes('/api/v10/channels/123/messages/456')) {
        return new Response(JSON.stringify({ attachments: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    };

    try {
      const response = await onRequest({
        env: {
          img_url: new MemoryKV(records),
          DISCORD_BOT_TOKEN: 'bot-token',
        },
        params: { path: 'discord/missing.jpg' },
        request: new Request('http://localhost/file/discord/missing.jpg', {
          headers: {
            Referer: 'http://localhost/dashboard',
          },
        }),
        waitUntil() {},
        next() {},
        data: {},
      });

      assert.equal(response.status, 404);
      assert.equal(await response.text(), 'Error: Image Not Found');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
