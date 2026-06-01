import assert from 'node:assert/strict';

import { onRequest } from '../functions/api/manage/tags/[[path]].js';
import { onRequest as autocompleteOnRequest } from '../functions/api/manage/tags/autocomplete.js';

class MemoryKV {
  constructor(initialEntries = {}) {
    this.store = new Map(Object.entries(initialEntries));
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async getWithMetadata() {
    return null;
  }

  async list(options = {}) {
    const prefix = options.prefix || '';
    return {
      keys: [...this.store.keys()]
        .filter((name) => !prefix || name.startsWith(prefix))
        .map((name) => ({ name, metadata: {} })),
      cursor: null,
      list_complete: true,
    };
  }
}

function createContext(path) {
  return {
    env: { img_url: new MemoryKV() },
    params: { path },
    waitUntil: async () => {},
    request: new Request('https://example.com/api/manage/tags/bad', { method: 'GET' }),
  };
}

describe('manage tags route', () => {
  it('returns 400 for malformed encoded file paths instead of throwing outside the handler', async () => {
    const response = await onRequest(createContext('%E0%A4%A'));
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error, 'Invalid file path');
  });

  it('rejects non-numeric autocomplete limits instead of returning an empty success page', async () => {
    const response = await autocompleteOnRequest({
      env: { img_url: new MemoryKV() },
      request: new Request('https://example.com/api/manage/tags/autocomplete?limit=abc', { method: 'GET' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error, 'Invalid limit');
  });
});
