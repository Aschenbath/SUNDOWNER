import assert from 'node:assert/strict';

import { onRequest as quotaOnRequest } from '../functions/api/manage/quota.js';

const INTERNAL_MESSAGE = 'KV list failed for private_token_456';

function createFailingKv() {
  return {
    async get() {
      return null;
    },
    async put() {},
    async delete() {},
    async list() {
      throw new Error(INTERNAL_MESSAGE);
    },
  };
}

describe('quota API generic errors', () => {
  let originalConsoleError;

  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = () => {};
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('does not expose rebuildIndex internal errors from quota recalculation', async () => {
    const response = await quotaOnRequest({
      env: { img_url: createFailingKv() },
      waitUntil() {},
      request: new Request('https://example.com/api/manage/quota', {
        method: 'POST',
      }),
    });

    const payload = await response.json();
    assert.equal(response.status, 500);
    assert.equal(payload.success, false);
    assert.equal(payload.error, 'Failed to rebuild index');
    assert.ok(!JSON.stringify(payload).includes(INTERNAL_MESSAGE));
  });
});
