import assert from 'node:assert/strict';

import { __setFileContentRetryDelayForTests, getFileContent } from '../functions/file/fileTools.js';

function withFetchStub(handler, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  return Promise.resolve()
    .then(run)
    .finally(() => {
      globalThis.fetch = originalFetch;
    });
}

describe('getFileContent retry backoff', () => {
  let recordedDelays;

  beforeEach(() => {
    recordedDelays = [];
    __setFileContentRetryDelayForTests(async (ms) => {
      recordedDelays.push(ms);
    });
  });

  afterEach(() => {
    __setFileContentRetryDelayForTests(null);
  });

  it('waits 250ms then 750ms between failing attempts before giving up', async () => {
    let attempts = 0;
    await withFetchStub(async () => {
      attempts += 1;
      return new Response('overloaded', { status: 500 });
    }, async () => {
      const result = await getFileContent(new Request('https://example.com/file/x.jpg'), 'https://upstream.example.com/x.jpg');
      assert.equal(result, null);
    });

    assert.equal(attempts, 3);
    assert.deepEqual(recordedDelays, [250, 750]);
  });

  it('backs off once when the second attempt succeeds', async () => {
    let attempts = 0;
    await withFetchStub(async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response('flaky', { status: 502 });
      }
      return new Response('ok-bytes', { status: 200 });
    }, async () => {
      const result = await getFileContent(new Request('https://example.com/file/x.jpg'), 'https://upstream.example.com/x.jpg');
      assert.equal(result.status, 200);
      assert.equal(await result.text(), 'ok-bytes');
    });

    assert.equal(attempts, 2);
    assert.deepEqual(recordedDelays, [250]);
  });

  it('returns 404 immediately without any backoff', async () => {
    let attempts = 0;
    await withFetchStub(async () => {
      attempts += 1;
      return new Response('missing', { status: 404 });
    }, async () => {
      const result = await getFileContent(new Request('https://example.com/file/x.jpg'), 'https://upstream.example.com/x.jpg');
      assert.equal(result.status, 404);
    });

    assert.equal(attempts, 1);
    assert.deepEqual(recordedDelays, []);
  });

  it('does not sleep after the final failed attempt', async () => {
    await withFetchStub(async () => {
      throw new Error('network down');
    }, async () => {
      const result = await getFileContent(new Request('https://example.com/file/x.jpg'), 'https://upstream.example.com/x.jpg', 1);
      assert.equal(result, null);
    });

    assert.deepEqual(recordedDelays, [250]);
  });
});
