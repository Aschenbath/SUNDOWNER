import assert from 'node:assert/strict';

import { onRequest } from '../functions/api/userConfig.js';

class MemoryKV {
  constructor(initialEntries = {}) {
    this.store = new Map(Object.entries(initialEntries));
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
}

function createEnvWithRawPageValue(rawValue) {
  return {
    img_url: new MemoryKV({
      'manage@sysConfig@page': rawValue,
    }),
  };
}

describe('userConfig API', () => {
  it('returns parsed config values when stored JSON is valid', async () => {
    const response = await onRequest({
      env: createEnvWithRawPageValue(JSON.stringify({
        config: [
          { id: 'showDirectorySuggestions', value: 'true' },
          { id: 'announcement', value: '"hello"' },
        ],
      })),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.showDirectorySuggestions, true);
    assert.equal(payload.announcement, 'hello');
  });

  it('returns a stable error when stored config JSON is invalid', async () => {
    const response = await onRequest({
      env: createEnvWithRawPageValue(JSON.stringify({
        config: [
          { id: 'showDirectorySuggestions', value: '{bad' },
        ],
      })),
    });

    assert.equal(response.status, 500);
    const payload = await response.json();
    assert.equal(payload.success, false);
    assert.equal(payload.error, 'Invalid stored user configuration');
    const serialized = JSON.stringify(payload);
    assert.doesNotMatch(serialized, /Unexpected token|SyntaxError|\{bad|showDirectorySuggestions/);
  });
});
