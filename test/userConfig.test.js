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

  it('skips an invalid stored config value and still returns the valid ones', async () => {
    const response = await onRequest({
      env: createEnvWithRawPageValue(JSON.stringify({
        config: [
          { id: 'showDirectorySuggestions', value: 'true' },
          { id: 'broken', value: '{bad' },
          { id: 'announcement', value: '"hello"' },
        ],
      })),
    });

    // 公开未鉴权端点：单个坏值不能让整个端点 500、丢掉全部配置。
    assert.equal(response.status, 200);
    const payload = await response.json();
    // 好的配置照常返回
    assert.equal(payload.showDirectorySuggestions, true);
    assert.equal(payload.announcement, 'hello');
    // 坏的 key 被跳过、不出现在响应里
    assert.equal('broken' in payload, false);
    // 仍然不泄露内部错误细节 / 原始坏值
    const serialized = JSON.stringify(payload);
    assert.doesNotMatch(serialized, /Unexpected token|SyntaxError|\{bad/);
  });
});
