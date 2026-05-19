import assert from 'node:assert/strict';

import {
  onRequest as moveOnRequest,
  __resetS3ClientFactoryForTests as resetMoveS3ClientFactory,
  __setS3ClientFactoryForTests as setMoveS3ClientFactory,
} from '../functions/api/manage/move/[[path]].js';
import {
  onRequest as renameOnRequest,
  __resetS3ClientFactoryForTests as resetRenameS3ClientFactory,
  __setS3ClientFactoryForTests as setRenameS3ClientFactory,
} from '../functions/api/manage/rename/[[path]].js';

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

function createS3Env() {
  const img_url = new MemoryKV();
  return {
    img_url,
    S3_ACCESS_KEY_ID: 'env-access',
    S3_SECRET_ACCESS_KEY: 'env-secret',
    S3_BUCKET_NAME: 'media',
    S3_ENDPOINT: 'https://s3.example.com',
    S3_REGION: 'auto',
  };
}

async function seedS3Record(env, fileId = 'photos/old.jpg') {
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

  await env.img_url.put(fileId, 'kv-value', {
    metadata: {
      Channel: 'S3',
      ChannelName: 'Archive S3',
      FileName: fileId.split('/').pop(),
      FileType: 'image/jpeg',
      TimeStamp: 1,
      Directory: 'photos/',
      S3Endpoint: 'https://s3.example.com',
      S3BucketName: 'media',
      S3FileKey: fileId,
      S3PathStyle: false,
      S3Region: 'auto',
      S3CdnFileUrl: `https://cdn.example.com/media/${fileId}`,
    },
  });
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
  if (originalCaches === undefined) {
    delete globalThis.caches;
  } else {
    globalThis.caches = originalCaches;
  }
});

describe('S3 manage move/rename routes', () => {
  it('renames S3 files using configured channel credentials when file metadata has no secrets', async () => {
    const env = createS3Env();
    await seedS3Record(env);
    const createdClients = [];
    const sentCommands = [];
    setRenameS3ClientFactory(createS3ClientFactory(createdClients, sentCommands));

    try {
      const response = await renameOnRequest({
        env,
        params: { path: 'photos,old.jpg' },
        request: new Request('https://sundowner.example/api/manage/rename/photos,old.jpg', {
          method: 'POST',
          body: JSON.stringify({ newFileId: 'photos/new.jpg' }),
        }),
        waitUntil(promise) { return promise; },
      });

      assert.equal(response.status, 200);
      assert.equal(createdClients[0].credentials.accessKeyId, 'config-access');
      assert.equal(createdClients[0].credentials.secretAccessKey, 'config-secret');
      assert.deepEqual(sentCommands, [
        { Bucket: 'media', CopySource: '/media/photos/old.jpg', Key: 'photos/new.jpg' },
        { Bucket: 'media', Key: 'photos/old.jpg' },
      ]);
      assert.equal(await env.img_url.get('photos/old.jpg'), null);
      const moved = await env.img_url.getWithMetadata('photos/new.jpg');
      assert.equal(moved.metadata.S3FileKey, 'photos/new.jpg');
      assert.equal(moved.metadata.S3CdnFileUrl, 'https://cdn.example.com/media/photos/new.jpg');
    } finally {
      resetRenameS3ClientFactory();
    }
  });

  it('moves S3 files using configured channel credentials when file metadata has no secrets', async () => {
    const env = createS3Env();
    await seedS3Record(env);
    const createdClients = [];
    const sentCommands = [];
    setMoveS3ClientFactory(createS3ClientFactory(createdClients, sentCommands));

    try {
      const response = await moveOnRequest({
        env,
        params: { path: 'photos,old.jpg' },
        request: new Request('https://sundowner.example/api/manage/move/photos,old.jpg?dist=archive'),
        waitUntil(promise) { return promise; },
      });

      assert.equal(response.status, 200);
      assert.equal(createdClients[0].credentials.accessKeyId, 'config-access');
      assert.equal(createdClients[0].credentials.secretAccessKey, 'config-secret');
      assert.deepEqual(sentCommands, [
        { Bucket: 'media', CopySource: '/media/photos/old.jpg', Key: 'archive/old.jpg' },
        { Bucket: 'media', Key: 'photos/old.jpg' },
      ]);
      assert.equal(await env.img_url.get('photos/old.jpg'), null);
      const moved = await env.img_url.getWithMetadata('archive/old.jpg');
      assert.equal(moved.metadata.S3FileKey, 'archive/old.jpg');
      assert.equal(moved.metadata.S3CdnFileUrl, 'https://cdn.example.com/media/archive/old.jpg');
    } finally {
      resetMoveS3ClientFactory();
    }
  });
  it('does not expose legacy S3 secrets in rename responses', async () => {
    const env = createS3Env();
    await seedS3Record(env);
    const record = await env.img_url.getWithMetadata('photos/old.jpg');
    record.metadata.S3AccessKeyId = 'legacy-access-secret';
    record.metadata.S3SecretAccessKey = 'legacy-secret-key';
    await env.img_url.put('photos/old.jpg', record.value, { metadata: record.metadata });

    const createdClients = [];
    const sentCommands = [];
    setRenameS3ClientFactory(createS3ClientFactory(createdClients, sentCommands));

    try {
      const response = await renameOnRequest({
        env,
        params: { path: 'photos,old.jpg' },
        request: new Request('https://sundowner.example/api/manage/rename/photos,old.jpg', {
          method: 'POST',
          body: JSON.stringify({ newFileId: 'photos/new.jpg' }),
        }),
        waitUntil(promise) { return promise; },
      });

      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.metadata.S3AccessKeyId, undefined);
      assert.equal(payload.metadata.S3SecretAccessKey, undefined);
      const moved = await env.img_url.getWithMetadata('photos/new.jpg');
      assert.equal(moved.metadata.S3AccessKeyId, undefined);
      assert.equal(moved.metadata.S3SecretAccessKey, undefined);
    } finally {
      resetRenameS3ClientFactory();
    }
  });

  it('rewrites stale S3Location when moving with the default AWS endpoint', async () => {
    const env = createS3Env();
    delete env.S3_ENDPOINT;
    await env.img_url.put('photos/old.jpg', 'kv-value', {
      metadata: {
        Channel: 'S3',
        ChannelName: 'S3_env',
        FileName: 'old.jpg',
        FileType: 'image/jpeg',
        TimeStamp: 1,
        Directory: 'photos/',
        S3BucketName: 'media',
        S3FileKey: 'photos/old.jpg',
        S3PathStyle: false,
        S3Region: 'us-east-1',
        S3Location: 'https://media.s3.amazonaws.com/photos/old.jpg',
      },
    });

    const createdClients = [];
    const sentCommands = [];
    setMoveS3ClientFactory(createS3ClientFactory(createdClients, sentCommands));

    try {
      const response = await moveOnRequest({
        env,
        params: { path: 'photos,old.jpg' },
        request: new Request('https://sundowner.example/api/manage/move/photos,old.jpg?dist=archive'),
        waitUntil(promise) { return promise; },
      });

      assert.equal(response.status, 200);
      assert.equal(createdClients[0].endpoint, undefined);
      const moved = await env.img_url.getWithMetadata('archive/old.jpg');
      assert.equal(moved.metadata.S3FileKey, 'archive/old.jpg');
      assert.equal(moved.metadata.S3Location, 'https://media.s3.amazonaws.com/archive/old.jpg');
    } finally {
      resetMoveS3ClientFactory();
    }
  });

  it('rewrites stale S3Location when renaming with the default AWS endpoint', async () => {
    const env = createS3Env();
    delete env.S3_ENDPOINT;
    await env.img_url.put('photos/old.jpg', 'kv-value', {
      metadata: {
        Channel: 'S3',
        ChannelName: 'S3_env',
        FileName: 'old.jpg',
        FileType: 'image/jpeg',
        TimeStamp: 1,
        Directory: 'photos/',
        S3BucketName: 'media',
        S3FileKey: 'photos/old.jpg',
        S3PathStyle: false,
        S3Region: 'us-east-1',
        S3Location: 'https://media.s3.amazonaws.com/photos/old.jpg',
      },
    });

    const createdClients = [];
    const sentCommands = [];
    setRenameS3ClientFactory(createS3ClientFactory(createdClients, sentCommands));

    try {
      const response = await renameOnRequest({
        env,
        params: { path: 'photos,old.jpg' },
        request: new Request('https://sundowner.example/api/manage/rename/photos,old.jpg', {
          method: 'POST',
          body: JSON.stringify({ newFileId: 'photos/new.jpg' }),
        }),
        waitUntil(promise) { return promise; },
      });

      assert.equal(response.status, 200);
      assert.equal(createdClients[0].endpoint, undefined);
      const payload = await response.json();
      assert.equal(payload.metadata.S3Location, 'https://media.s3.amazonaws.com/photos/new.jpg');
      const moved = await env.img_url.getWithMetadata('photos/new.jpg');
      assert.equal(moved.metadata.S3FileKey, 'photos/new.jpg');
      assert.equal(moved.metadata.S3Location, 'https://media.s3.amazonaws.com/photos/new.jpg');
    } finally {
      resetRenameS3ClientFactory();
    }
  });
});
