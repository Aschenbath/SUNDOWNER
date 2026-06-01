import assert from 'node:assert/strict';

import { onRequest } from '../functions/api/manage/mind.js';

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
}

function createContext(body) {
  return {
    env: { img_url: new MemoryKV() },
    request: new Request('https://example.com/api/manage/mind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  };
}

describe('manage mind route', () => {
  it('rejects unknown explicit actions instead of appending them as messages', async () => {
    const context = createContext({ action: 'typo', text: 'should not append' });
    const response = await onRequest(context);
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error, 'Unsupported Mind action');

    const stored = await context.env.img_url.get('manage@sysConfig@mind');
    assert.equal(stored, null);
  });

  it('keeps missing-action POST bodies on the legacy append path', async () => {
    const context = createContext({ text: 'legacy append' });
    const response = await onRequest(context);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.messages.length, 1);
    assert.equal(payload.messages[0].text, 'legacy append');
    assert.equal(payload.messages[0].source, 'web');
  });
});
