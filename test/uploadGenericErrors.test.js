import assert from 'node:assert/strict';

import { initializeChunkedUpload, handleChunkUpload } from '../functions/upload/chunkUpload.js';
import { handleChunkMerge } from '../functions/upload/chunkMerge.js';
import { onRequestPost as hfCommitUploadPost, __resetHuggingFaceAPIFactoryForTests, __setHuggingFaceAPIFactoryForTests as __setDirectHuggingFaceAPIFactoryForTests } from '../functions/upload/huggingface/commitUpload.js';
import { onRequestPost as hfGetUploadUrlPost } from '../functions/upload/huggingface/getUploadUrl.js';
import {
  processFileUpload,
  __resetUploadClientFactoriesForTests,
  __setDiscordAPIFactoryForTests,
  __setHuggingFaceAPIFactoryForTests,
  __setS3ClientFactoryForTests,
} from '../functions/upload/index.js';

const INTERNAL_MESSAGE = 'storage backend failed for private_token_upload';

class MemoryKV {
  constructor(entries = {}) {
    this.store = new Map(Object.entries(entries));
    this.metadata = new Map();
    this.failPuts = new Set();
    this.failGets = new Set();
  }

  async get(key) {
    if (this.failGets.has(key)) {
      throw new Error(INTERNAL_MESSAGE);
    }
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async getWithMetadata(key) {
    if (!this.store.has(key)) {
      return null;
    }
    return {
      value: this.store.get(key),
      metadata: this.metadata.get(key) || {},
    };
  }

  async put(key, value, options = {}) {
    if (this.failPuts.has(key)) {
      throw new Error(INTERNAL_MESSAGE);
    }
    this.store.set(key, value);
    this.metadata.set(key, options.metadata || {});
  }

  async delete(key) {
    this.store.delete(key);
    this.metadata.delete(key);
  }

  async list() {
    return {
      keys: [],
      cursor: null,
      list_complete: true,
    };
  }
}

function createSecurityConfig() {
  return {
    auth: {
      user: { authCode: 'upload-token' },
      admin: { adminUsername: 'admin', adminPassword: 'admin-secret' },
    },
    upload: {
      moderate: { enabled: false },
    },
  };
}

function createUploadConfig(overrides = {}) {
  return {
    telegram: { loadBalance: { enabled: false }, channels: [] },
    cfr2: { loadBalance: { enabled: false }, channels: [] },
    s3: { loadBalance: { enabled: false }, channels: [] },
    discord: { loadBalance: { enabled: false }, channels: [] },
    huggingface: { loadBalance: { enabled: false }, channels: [] },
    ...overrides,
  };
}

function createEnv(uploadConfig = createUploadConfig()) {
  return {
    img_url: new MemoryKV({
      'manage@sysConfig@security': JSON.stringify(createSecurityConfig()),
      'manage@sysConfig@upload': JSON.stringify(uploadConfig),
    }),
    dev_mode: 'true',
  };
}

function createFileFormData(fileName = 'private.jpg', fileType = 'image/jpeg') {
  const formdata = new FormData();
  formdata.set('file', new File(['demo'], fileName, { type: fileType }));
  return formdata;
}

function createChunkFormData(values = {}) {
  const formdata = new FormData();
  formdata.set('originalFileName', values.originalFileName || 'private.jpg');
  formdata.set('originalFileType', values.originalFileType || 'image/jpeg');
  formdata.set('totalChunks', String(values.totalChunks || 1));
  if (values.uploadId) formdata.set('uploadId', values.uploadId);
  if (values.chunkIndex !== undefined) formdata.set('chunkIndex', String(values.chunkIndex));
  if (values.file) formdata.set('file', values.file);
  return formdata;
}

function createRequest(url, body, headers = {}) {
  return new Request(url, {
    method: 'POST',
    headers,
    body,
  });
}

function buildValidHuggingFaceDirectPath(fullId, uuid = '123e4567-e89b-42d3-a456-426614174000') {
  const lastSlashIndex = fullId.lastIndexOf('/');
  return lastSlashIndex === -1
    ? `${uuid}_${fullId}`
    : `${fullId.substring(0, lastSlashIndex + 1)}${uuid}_${fullId.substring(lastSlashIndex + 1)}`;
}

async function withFetchStub(run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    async json() {
      return {};
    },
  });
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function expectTextResponse(response, expected) {
  assert.equal(response.status, 500);
  const text = await response.text();
  assert.equal(text, expected);
  assert.ok(!text.includes(INTERNAL_MESSAGE));
}

async function expectJsonError(response, expected) {
  assert.equal(response.status, 500);
  const payload = await response.json();
  assert.equal(payload.error, expected);
  assert.ok(!JSON.stringify(payload).includes(INTERNAL_MESSAGE));
}

describe('upload API generic 500 errors', () => {
  let originalConsoleError;
  let originalConsoleWarn;

  beforeEach(() => {
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;
    console.error = () => {};
    console.warn = () => {};
  });

  afterEach(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    __resetHuggingFaceAPIFactoryForTests();
    __resetUploadClientFactoriesForTests();
  });

  it('hides raw errors from HuggingFace direct upload URL failures', async () => {
    const env = createEnv(createUploadConfig({
      huggingface: {
        loadBalance: { enabled: false },
        channels: [{
          name: 'HF Direct',
          token: 'hf-secret',
          repo: 'owner/repo',
          isPrivate: true,
          enabled: true,
        }],
      },
    }));
    env.img_url.failGets.add('photos/private.jpg');

    const response = await hfGetUploadUrlPost({
      env,
      request: new Request('https://example.com/upload/huggingface/getUploadUrl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authCode: 'upload-token',
        },
        body: JSON.stringify({
          fileSize: 4,
          fileName: 'private.jpg',
          fileType: 'image/jpeg',
          sha256: 'abc123',
          fileSample: 'sample',
          uploadNameType: 'origin',
          uploadFolder: 'photos',
        }),
      }),
    });

    await expectJsonError(response, 'Internal server error.');
  });

  it('hides raw metadata errors from HuggingFace direct commit failures', async () => {
    const env = createEnv(createUploadConfig({
      huggingface: {
        loadBalance: { enabled: false },
        channels: [{
          name: 'HF Direct',
          token: 'hf-secret',
          repo: 'owner/repo',
          isPrivate: true,
          enabled: true,
        }],
      },
    }));
    env.img_url.failPuts.add('photos/private.jpg');
    __setDirectHuggingFaceAPIFactoryForTests(() => ({
      async commitLfsFile() {
        return { success: true };
      },
      async deleteFile() {
        return true;
      },
    }));

    const response = await hfCommitUploadPost({
      env,
      waitUntil() {},
      request: new Request('https://example.com/upload/huggingface/commitUpload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authCode: 'upload-token',
        },
        body: JSON.stringify({
          fullId: 'photos/private.jpg',
          filePath: buildValidHuggingFaceDirectPath('photos/private.jpg'),
          sha256: 'abc123',
          fileSize: 4,
          fileName: 'private.jpg',
          fileType: 'image/jpeg',
        }),
      }),
    });

    await expectJsonError(response, 'Failed to write metadata');
  });

  it('hides raw storage errors from chunk initialization failures', async () => {
    const env = createEnv();
    env.img_url.put = async () => {
      throw new Error(INTERNAL_MESSAGE);
    };

    await withFetchStub(async () => {
      const response = await initializeChunkedUpload({
        env,
        url: new URL('https://example.com/upload?initChunked=true'),
        request: createRequest('https://example.com/upload?initChunked=true', createChunkFormData()),
      });

      await expectTextResponse(response, 'Error: Failed to initialize chunked upload');
    });
  });

  it('hides raw storage errors from chunk upload failures', async () => {
    const env = createEnv();
    env.img_url.failGets.add('upload_session_upload-1');

    const response = await handleChunkUpload({
      env,
      url: new URL('https://example.com/upload?chunked=true'),
      request: createRequest('https://example.com/upload?chunked=true', createChunkFormData({
        uploadId: 'upload-1',
        chunkIndex: 0,
        file: new File(['chunk'], 'chunk.bin', { type: 'application/octet-stream' }),
      })),
      waitUntil() {},
    });

    await expectTextResponse(response, 'Error: Failed to upload chunk');
  });

  it('hides raw storage errors from chunk merge failures', async () => {
    const env = createEnv();
    env.img_url.failGets.add('upload_session_upload-1');

    const response = await handleChunkMerge({
      env,
      url: new URL('https://example.com/upload?chunked=true&merge=true'),
      request: createRequest('https://example.com/upload?chunked=true&merge=true', createChunkFormData({
        uploadId: 'upload-1',
      })),
      waitUntil() {},
    });

    await expectTextResponse(response, 'Error: Failed to merge chunks');
  });

  it('hides raw S3 upload errors from direct upload responses', async () => {
    const env = createEnv();
    const formdata = createFileFormData();
    __setS3ClientFactoryForTests(() => ({
      async send() {
        throw new Error(INTERNAL_MESSAGE);
      },
    }));

    await withFetchStub(async () => {
      const response = await processFileUpload({
        env,
        url: new URL('https://example.com/upload?uploadChannel=s3&uploadFolder=photos&uploadNameType=origin&autoRetry=false'),
        request: createRequest('https://example.com/upload', formdata),
        securityConfig: createSecurityConfig(),
        uploadConfig: createUploadConfig({
          s3: {
            loadBalance: { enabled: false },
            channels: [{
              name: 'S3',
              accessKeyId: 'key',
              secretAccessKey: 'secret',
              bucketName: 'media',
              endpoint: 'https://s3.example.com',
              region: 'auto',
            }],
          },
        }),
        waitUntil() {},
      }, formdata);

      await expectTextResponse(response, 'Error: Failed to upload to S3');
    });
  });

  it('hides raw Discord upload errors from direct upload responses', async () => {
    const env = createEnv();
    const formdata = createFileFormData();
    __setDiscordAPIFactoryForTests(() => ({
      async sendFile() {
        throw new Error(INTERNAL_MESSAGE);
      },
    }));

    await withFetchStub(async () => {
      const response = await processFileUpload({
        env,
        url: new URL('https://example.com/upload?uploadChannel=discord&uploadFolder=photos&uploadNameType=origin&autoRetry=false'),
        request: createRequest('https://example.com/upload', formdata),
        securityConfig: createSecurityConfig(),
        uploadConfig: createUploadConfig({
          discord: {
            loadBalance: { enabled: false },
            channels: [{
              name: 'Discord',
              botToken: 'discord-secret',
              channelId: 'channel-1',
            }],
          },
        }),
        waitUntil() {},
      }, formdata);

      await expectTextResponse(response, 'Error: Discord upload failed');
    });
  });

  it('hides raw HuggingFace upload errors from direct upload responses', async () => {
    const env = createEnv();
    const formdata = createFileFormData();
    __setHuggingFaceAPIFactoryForTests(() => ({
      async uploadFile() {
        throw new Error(INTERNAL_MESSAGE);
      },
    }));

    await withFetchStub(async () => {
      const response = await processFileUpload({
        env,
        url: new URL('https://example.com/upload?uploadChannel=huggingface&uploadFolder=photos&uploadNameType=origin&autoRetry=false'),
        request: createRequest('https://example.com/upload', formdata),
        securityConfig: createSecurityConfig(),
        uploadConfig: createUploadConfig({
          huggingface: {
            loadBalance: { enabled: false },
            channels: [{
              name: 'HuggingFace',
              token: 'hf-secret',
              repo: 'owner/repo',
              isPrivate: true,
            }],
          },
        }),
        waitUntil() {},
      }, formdata);

      await expectTextResponse(response, 'Error: HuggingFace upload failed');
    });
  });
});
