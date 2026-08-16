import assert from 'node:assert/strict';

import {
  return404,
  returnBlockImg,
  returnWhiteListImg,
} from '../functions/file/fileTools.js';

describe('dynamic file fallback cache policy', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('does not cache missing, blocked, or whitelist fallback responses', async () => {
    globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    });
    const url = new URL('https://example.com/file/photo.jpg');

    for (const fallback of [return404, returnBlockImg, returnWhiteListImg]) {
      const response = await fallback(url);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
    }
  });

  it('does not cache redirect fallbacks when the marker asset is unavailable', async () => {
    globalThis.fetch = async () => new Response('missing', { status: 503 });
    const url = new URL('https://example.com/file/photo.jpg');

    for (const fallback of [return404, returnBlockImg, returnWhiteListImg]) {
      const response = await fallback(url);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
    }
  });
});
