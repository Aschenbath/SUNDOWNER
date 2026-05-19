import assert from 'node:assert/strict';

import {
  onRequest as moveOnRequest,
  __resetS3ClientFactoryForTests as resetMoveS3ClientFactory,
  __setS3ClientFactoryForTests as setMoveS3ClientFactory,
} from '../functions/api/manage/move/[[path]].js';

class MemoryKV {
  constructor() {
    this.values = new Map();
    this.metadata = new Map();
  }

  async put(key, value, options = {}) {
    this.values.set(key, value);
    if (options.metadata) {
      this.metadata.set(key, { ...options.metadata });
    }
  }

  async get(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  async getWithMetadata(key) {
    if (!this.values.has(key)) {
      return null;
    }
    return {
      value: this.values.get(key),
      metadata: this.metadata.get(key) || {},
    };
  }

  async delete(key) {
    this.values.delete(key);
    this.metadata.delete(key);
  }

  async list(options = {}) {
    const prefix = options.prefix || '';
    return {
      keys: [...this.values.keys()]
        .filter((key) => key.startsWith(prefix))
        .map((name) => ({ name, metadata: this.metadata.get(name) || {} })),
      cursor: null,
      list_complete: true,
    };
  }
}

function createS3ClientFactory(createdClients, sentCommands) {
  return (options) => {
    createdClients.push(options);
    return {
      async send(command) {
        sentCommands.push(command.input);
        return {};
      },
    };
  };
}

let originalCaches;
beforeEach(() => {
  originalCaches = globalThis.caches;
  globalThis.caches = {
    default: {
      async put() {},
    },
  };
});

afterEach(() => {
  resetMoveS3ClientFactory();
  if (originalCaches === undefined) {
    delete globalThis.caches;
  } else {
    globalThis.caches = originalCaches;
  }
});

describe('S3 manage routes with legacy locator metadata', () => {
  it('moves S3 files using channel locator config when old KV metadata was trimmed', async () => {
    const env = { img_url: new MemoryKV() };
    await env.img_url.put('manage@sysConfig@upload', JSON.stringify({
      s3: {
        channels: [
          {
            name: 'Archive S3',
            accessKeyId: 'config-access',
            secretAccessKey: 'config-secret',
            bucketName: 'media',
            endpoint: 'https://s3.example.com',
            region: 'auto',
            pathStyle: false,
            cdnDomain: 'https://cdn.example.com/media',
            enabled: true,
          },
        ],
      },
    }));
    await env.img_url.put('photos/old.jpg', 'kv-value', {
      metadata: {
        Channel: 'S3',
        ChannelName: 'Archive S3',
        FileName: 'old.jpg',
        FileType: 'image/jpeg',
        TimeStamp: 1,
        Directory: 'photos/',
      },
    });
    const createdClients = [];
    const sentCommands = [];
    setMoveS3ClientFactory(createS3ClientFactory(createdClients, sentCommands));

    const response = await moveOnRequest({
      env,
      params: { path: 'photos,old.jpg' },
      request: new Request('https://sundowner.example/api/manage/move/photos,old.jpg?dist=archive'),
      waitUntil(promise) { return promise; },
    });

    assert.equal(response.status, 200);
    assert.equal(createdClients[0].endpoint, 'https://s3.example.com');
    assert.deepEqual(sentCommands, [
      { Bucket: 'media', CopySource: '/media/photos/old.jpg', Key: 'archive/old.jpg' },
      { Bucket: 'media', Key: 'photos/old.jpg' },
    ]);
    const moved = await env.img_url.getWithMetadata('archive/old.jpg');
    assert.equal(moved.metadata.S3Endpoint, 'https://s3.example.com');
    assert.equal(moved.metadata.S3BucketName, 'media');
    assert.equal(moved.metadata.S3FileKey, 'archive/old.jpg');
    assert.equal(moved.metadata.S3CdnFileUrl, 'https://cdn.example.com/media/archive/old.jpg');
  });
});
