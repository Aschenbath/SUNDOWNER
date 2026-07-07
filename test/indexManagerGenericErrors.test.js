import assert from 'node:assert/strict';

import { onRequest as listOnRequest } from '../functions/api/manage/list.js';

const INTERNAL_MESSAGE = 'index metadata read failed for private_token_456';

function createFailingKv() {
  return {
    async get() {
      throw new Error(INTERNAL_MESSAGE);
    },
    async put() {},
    async delete() {},
    async list() {
      return { keys: [], cursor: null, list_complete: true };
    },
  };
}

describe('index manager generic errors', () => {
  let originalConsoleError;

  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = () => {};
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('does not expose index storage stats backend errors', async () => {
    const response = await listOnRequest({
      env: { img_url: createFailingKv() },
      waitUntil() {},
      request: new Request('https://example.com/api/manage/list?action=index-storage-stats'),
    });

    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.success, false);
    assert.equal(payload.error, 'Failed to retrieve index storage stats');
    assert.ok(!JSON.stringify(payload).includes(INTERNAL_MESSAGE));
  });
});
