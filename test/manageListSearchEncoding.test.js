import assert from 'node:assert/strict';

import { onRequest as listOnRequest } from '../functions/api/manage/list.js';

class MemoryKV {
  constructor(initialEntries = {}) {
    this.store = new Map(Object.entries(initialEntries));
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async put(key, value) {
    this.store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }

  async delete(key) {
    this.store.delete(key);
  }

  async list() {
    return { keys: [], cursor: null, list_complete: true };
  }
}

function createIndexChunk(files) {
  return JSON.stringify(files.map((file) => ({
    id: file.id,
    metadata: file.metadata,
  })));
}

describe('manage list search encoding', () => {
  it('treats encoded percent signs as literal search text', async () => {
    const env = {
      img_url: new MemoryKV({
        'manage@index@meta': JSON.stringify({ chunkCount: 1 }),
        'manage@index_0': createIndexChunk([
          {
            id: 'photos/100%.jpg',
            metadata: {
              FileName: '100%.jpg',
              FileType: 'image/jpeg',
              Directory: 'photos/',
              TimeStamp: 1,
            },
          },
        ]),
      }),
    };

    const response = await listOnRequest({
      env,
      waitUntil: async () => {},
      request: new Request('https://example.test/api/manage/list?dir=photos&search=%25&count=-1'),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(payload.files.map((file) => file.name ?? file.id), ['photos/100%.jpg']);
  });
});
