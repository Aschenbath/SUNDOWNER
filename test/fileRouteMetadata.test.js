import assert from 'node:assert/strict';

import {
  __resetS3ClientFactoryForTests,
  __setS3ClientFactoryForTests,
  onRequest,
} from '../functions/file/[[path]].js';

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
  afterEach(() => {
    __resetS3ClientFactoryForTests();
  });

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

  it('returns 404 when S3 metadata exists but the object is missing', async () => {
    __setS3ClientFactoryForTests(() => ({
      async send() {
        const error = new Error('missing object');
        error.name = 'NoSuchKey';
        error.$metadata = { httpStatusCode: 404 };
        throw error;
      },
    }));

    const response = await onRequest({
      env: {
        img_url: new MemoryKV(new Map([
          ['s3/missing.jpg', {
            value: '',
            metadata: {
              Channel: 'S3',
              ChannelName: 'S3_env',
              FileName: 'missing.jpg',
              FileType: 'image/jpeg',
              S3Endpoint: 'https://s3.example.com',
              S3BucketName: 'media',
              S3FileKey: 'missing.jpg',
              ListType: 'None',
              Label: 'safe',
            },
          }],
        ])),
        S3_ACCESS_KEY_ID: 'test-access-key',
        S3_SECRET_ACCESS_KEY: 'test-secret-key',
      },
      params: { path: 's3/missing.jpg' },
      request: new Request('http://localhost/file/s3/missing.jpg'),
      waitUntil() {},
      next() {},
      data: {},
    });

    assert.equal(response.status, 404);
    assert.equal(await response.text(), 'Error: Image Not Found');
  });
});
