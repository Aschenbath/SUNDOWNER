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

function createExternalEnv(externalLink) {
  return {
    img_url: new MemoryKV(new Map([
      ['external/photo.jpg', {
        value: '',
        metadata: {
          Channel: 'External',
          ChannelName: 'External',
          FileName: 'photo.jpg',
          FileType: 'image/jpeg',
          ExternalLink: externalLink,
          ListType: 'None',
          Label: 'safe',
        },
      }],
    ])),
  };
}

describe('External file route', () => {
  it('returns 404 when the stored external URL is missing or malformed', async () => {
    const response = await onRequest({
      env: createExternalEnv('not a url'),
      params: { path: 'external/photo.jpg' },
      request: new Request('http://localhost/file/external/photo.jpg'),
      waitUntil() {},
      next() {},
      data: {},
    });

    assert.equal(response.status, 404);
    assert.equal(await response.text(), 'Error: Image Not Found');
  });

  it('keeps redirecting valid external HTTP URLs', async () => {
    const response = await onRequest({
      env: createExternalEnv('https://cdn.example.com/photo.jpg'),
      params: { path: 'external/photo.jpg' },
      request: new Request('http://localhost/file/external/photo.jpg'),
      waitUntil() {},
      next() {},
      data: {},
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), 'https://cdn.example.com/photo.jpg');
  });
});
