import assert from 'node:assert/strict';

import { onRequest } from '../functions/file/[[path]].js';

class MemoryKV {
  constructor(records = new Map()) {
    this.records = records;
  }

  async get(key) {
    return this.records.get(key)?.value ?? null;
  }

  async getWithMetadata(key) {
    const record = this.records.get(key);
    if (!record) {
      return null;
    }
    return {
      value: record.value ?? null,
      metadata: record.metadata ?? null,
    };
  }

  async put() {}

  async delete() {}

  async list() {
    return { keys: [], list_complete: true, cursor: '' };
  }
}

function createEnvWithRecord(record = null) {
  const records = new Map();
  if (record) {
    records.set(record.key, record.value);
  }
  return {
    img_url: new MemoryKV(records),
    TG_BOT_TOKEN: 'test-bot-token',
  };
}

function createChunkedRecord({ rawValue, totalChunks = 2, channel = 'TelegramNew' } = {}) {
  return {
    key: 'chunked/test.mp4',
    value: {
      value: rawValue,
      metadata: {
        Channel: channel,
        IsChunked: true,
        TotalChunks: totalChunks,
        FileName: 'test.mp4',
        FileType: 'video/mp4',
        TimeStamp: Date.now(),
        ListType: 'None',
      },
    },
  };
}

describe('public file metadata parsing', () => {
  it('returns a stable error for malformed chunk metadata JSON', async () => {
    const response = await onRequest({
      env: createEnvWithRecord(createChunkedRecord({ rawValue: '{bad' })),
      params: { path: 'chunked/test.mp4' },
      request: new Request('http://localhost/file/chunked/test.mp4'),
      waitUntil() {},
      next() {},
      data: {},
    });

    assert.equal(response.status, 500);
    const text = await response.text();
    assert.equal(text, 'File metadata is unavailable');
    assert.doesNotMatch(text, /Invalid chunks data|Missing chunks|expected|got|SyntaxError|stack/);
  });

  it('returns a stable error when chunk metadata is not an array', async () => {
    const response = await onRequest({
      env: createEnvWithRecord(createChunkedRecord({ rawValue: '{"index":0}' })),
      params: { path: 'chunked/test.mp4' },
      request: new Request('http://localhost/file/chunked/test.mp4'),
      waitUntil() {},
      next() {},
      data: {},
    });

    assert.equal(response.status, 500);
    const text = await response.text();
    assert.equal(text, 'File metadata is unavailable');
    assert.doesNotMatch(text, /Invalid chunks data|Missing chunks|expected|got|SyntaxError|stack/);
  });

  it('returns a stable error when chunk count does not match expected metadata', async () => {
    const response = await onRequest({
      env: createEnvWithRecord(createChunkedRecord({
        rawValue: JSON.stringify([{ index: 0, size: 10, fileId: 'a', messageId: 'm1' }]),
        totalChunks: 2,
      })),
      params: { path: 'chunked/test.mp4' },
      request: new Request('http://localhost/file/chunked/test.mp4'),
      waitUntil() {},
      next() {},
      data: {},
    });

    assert.equal(response.status, 500);
    const text = await response.text();
    assert.equal(text, 'File metadata is unavailable');
    assert.doesNotMatch(text, /Invalid chunks data|Missing chunks|expected|got|SyntaxError|stack/);
  });
});
