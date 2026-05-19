import assert from 'node:assert/strict';

import {
  permanentlyDeleteFileRecord,
  __resetS3ClientFactoryForTests,
  __setS3ClientFactoryForTests,
} from '../functions/utils/mediaDeletion.js';

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
}

describe('S3 permanent deletion with legacy locator metadata', () => {
  let originalCaches;

  beforeEach(() => {
    originalCaches = globalThis.caches;
    globalThis.caches = {
      default: {
        async delete() { return true; },
        async put() {},
      },
    };
  });

  afterEach(() => {
    __resetS3ClientFactoryForTests();
    if (originalCaches === undefined) {
      delete globalThis.caches;
    } else {
      globalThis.caches = originalCaches;
    }
  });

  it('deletes S3 objects using channel locator config when old KV metadata was trimmed', async () => {
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
      },
    });

    const createdClients = [];
    const sentCommands = [];
    __setS3ClientFactoryForTests((options) => {
      createdClients.push(options);
      return {
        async send(command) {
          sentCommands.push(command.input);
          return {};
        },
      };
    });

    const ok = await permanentlyDeleteFileRecord({
      env,
      request: new Request('https://sundowner.example/api/manage/delete/photos,old.jpg?permanent=true'),
    }, 'photos/old.jpg');

    assert.equal(ok, true);
    assert.equal(createdClients[0].endpoint, 'https://s3.example.com');
    assert.deepEqual(sentCommands, [
      { Bucket: 'media', Key: 'photos/old.jpg' },
    ]);
    assert.equal(await env.img_url.get('photos/old.jpg'), null);
  });
});