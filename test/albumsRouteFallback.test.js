import assert from 'node:assert/strict';

import { onRequest } from '../functions/api/manage/albums/[[path]].js';

class MemoryKV {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async put(key, value) {
    this.store.set(key, String(value));
  }

  async delete(key) {
    this.store.delete(key);
  }

  async list() {
    return {
      keys: [...this.store.keys()].map((name) => ({ name })),
      list_complete: true,
      cursor: '',
    };
  }
}

function createEnv() {
  return { img_url: new MemoryKV() };
}

describe('albums [[path]] fallback route', () => {
  it('accepts root-level state persistence when no album id is present', async () => {
    const env = createEnv();

    const postResponse = await onRequest({
      env,
      params: {},
      request: new Request('http://localhost/api/manage/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: {
            favorites: ['managed-a', 'managed-b'],
          },
        }),
      }),
    });

    assert.equal(postResponse.status, 200);
    const postPayload = await postResponse.json();
    assert.deepEqual(postPayload.favorites, ['managed-a', 'managed-b']);

    const getResponse = await onRequest({
      env,
      params: {},
      request: new Request('http://localhost/api/manage/albums', {
        method: 'GET',
      }),
    });

    assert.equal(getResponse.status, 200);
    const getPayload = await getResponse.json();
    assert.deepEqual(getPayload.favorites, ['managed-a', 'managed-b']);
  });

  it('parses string catch-all paths as the album id', async () => {
    const env = createEnv();

    await onRequest({
      env,
      params: {},
      request: new Request('http://localhost/api/manage/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: {
            albumNames: ['Trips'],
            albumAssignments: {
              'photo-a.jpg': ['Trips'],
              'photo-b.jpg': ['Trips'],
            },
          },
        }),
      }),
    });

    const response = await onRequest({
      env,
      params: { path: 'Trips' },
      request: new Request('http://localhost/api/manage/albums/Trips', {
        method: 'GET',
      }),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.album.name, 'Trips');
    assert.deepEqual(payload.fileIds, ['photo-a.jpg', 'photo-b.jpg']);
  });
});
