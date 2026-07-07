import assert from 'node:assert/strict';

import { onRequest as deleteOnRequest } from '../functions/api/manage/delete/[[path]].js';
import { onRequest as moveOnRequest } from '../functions/api/manage/move/[[path]].js';

class MemoryKV {
  async get() {
    return null;
  }

  async getWithMetadata() {
    return null;
  }

  async put() {}

  async delete() {}
}

function encodedCatchAllPath(fileId) {
  return fileId
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join(',');
}

function installListFetchRecorder(observedDirs) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request) => {
    const url = new URL(request.url);
    observedDirs.push({
      dir: url.searchParams.get('dir'),
      extra: url.searchParams.get('evil'),
    });
    return new Response(JSON.stringify({ files: [], directories: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

describe('folder management route URL encoding', () => {
  it('encodes folder delete list requests so legal ampersands stay inside dir', async () => {
    const observedDirs = [];
    const restoreFetch = installListFetchRecorder(observedDirs);
    try {
      const response = await deleteOnRequest({
        env: { img_url: new MemoryKV() },
        params: { path: encodedCatchAllPath('photos/a&evil=1') },
        request: new Request('https://example.com/api/manage/delete/photos/a%26evil%3D1?folder=true', {
          method: 'DELETE',
        }),
        waitUntil() {},
      });

      assert.equal(response.status, 200);
      assert.deepEqual(observedDirs, [{ dir: 'photos/a&evil=1', extra: null }]);
    } finally {
      restoreFetch();
    }
  });

  it('encodes folder move list requests so legal ampersands stay inside dir', async () => {
    const observedDirs = [];
    const restoreFetch = installListFetchRecorder(observedDirs);
    try {
      const response = await moveOnRequest({
        env: { img_url: new MemoryKV() },
        params: { path: encodedCatchAllPath('photos/a&evil=1') },
        request: new Request('https://example.com/api/manage/move/photos/a%26evil%3D1?folder=true&dist=archive', {
          method: 'POST',
        }),
        waitUntil() {},
      });

      assert.equal(response.status, 200);
      assert.deepEqual(observedDirs, [{ dir: 'photos/a&evil=1', extra: null }]);
    } finally {
      restoreFetch();
    }
  });
});
