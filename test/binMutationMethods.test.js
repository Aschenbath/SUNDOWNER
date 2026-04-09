import assert from 'node:assert/strict';

import { onRequest as onBatchRequest } from '../functions/api/manage/bin/batch.js';
import { onRequest as onEmptyRequest } from '../functions/api/manage/bin/empty.js';
import { onRequest as onRestoreRequest } from '../functions/api/manage/restore/[[path]].js';

function createContext(url, method = 'GET') {
  return {
    env: {
      img_url: {
        async get() {
          return null;
        },
        async put() {},
        async delete() {},
        async list() {
          return { keys: [], list_complete: true, cursor: '' };
        },
      },
    },
    params: { path: 'photos,file.jpg' },
    waitUntil() {},
    request: new Request(url, { method }),
  };
}

describe('bin mutation routes method guard', () => {
  it('rejects non-POST requests for batch mutations', async () => {
    const response = await onBatchRequest(createContext('http://localhost/api/manage/bin/batch', 'GET'));
    assert.equal(response.status, 405);
    const payload = await response.json();
    assert.equal(payload.success, false);
    assert.equal(payload.error, 'Method not allowed');
  });

  it('rejects non-POST requests for empty-bin mutations', async () => {
    const response = await onEmptyRequest(createContext('http://localhost/api/manage/bin/empty', 'GET'));
    assert.equal(response.status, 405);
    const payload = await response.json();
    assert.equal(payload.success, false);
    assert.equal(payload.error, 'Method not allowed');
  });

  it('rejects non-POST requests for restore mutations', async () => {
    const response = await onRestoreRequest(createContext('http://localhost/api/manage/restore/photos,file.jpg', 'GET'));
    assert.equal(response.status, 405);
    const payload = await response.json();
    assert.equal(payload.success, false);
    assert.equal(payload.error, 'Method not allowed');
  });
});
