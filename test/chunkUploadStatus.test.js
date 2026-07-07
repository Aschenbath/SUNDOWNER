import assert from 'node:assert/strict';

import { checkChunkUploadStatuses, handleChunkUpload } from '../functions/upload/chunkUpload.js';

class ChunkStatusDB {
  constructor(records = {}, { readDelayMs = 10 } = {}) {
    this.records = new Map(Object.entries(records));
    this.activeGets = 0;
    this.maxActiveGets = 0;
    this.puts = [];
    this.readDelayMs = readDelayMs;
  }

  async getWithMetadata(key) {
    this.activeGets += 1;
    this.maxActiveGets = Math.max(this.maxActiveGets, this.activeGets);
    if (this.readDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.readDelayMs));
    }
    this.activeGets -= 1;
    return this.records.get(key) || null;
  }

  async get(key) {
    return this.records.get(key)?.value || null;
  }

  async put(key, value, options = {}) {
    this.puts.push({ key, value, options });
    this.records.set(key, { value, metadata: options.metadata || null });
  }

  async delete(key) {
    this.records.delete(key);
  }

  async list() {
    return {
      keys: [...this.records.keys()].map((name) => ({ name })),
      list_complete: true,
      cursor: '',
    };
  }
}

class FailingChunkStatusDB extends ChunkStatusDB {
  async getWithMetadata() {
    throw new Error('D1 secret table read failed: token=abc123');
  }
}

function createChunkRecord(index, metadata = {}) {
  return {
    value: new Uint8Array([index + 1]).buffer,
    metadata: {
      status: 'uploading',
      chunkSize: 1,
      uploadTime: 5,
      uploadStartTime: 1,
      uploadChannel: 'telegram',
      ...metadata,
    },
  };
}

function createChunkUploadFormData(overrides = {}) {
  const form = new FormData();
  form.set('file', overrides.file || new File(['chunk data'], 'chunk.bin', { type: 'application/octet-stream' }));
  form.set('chunkIndex', String(overrides.chunkIndex ?? 0));
  form.set('totalChunks', String(overrides.totalChunks ?? 1));
  form.set('uploadId', overrides.uploadId || 'upload-status-write');
  form.set('originalFileName', overrides.originalFileName || 'demo.bin');
  form.set('originalFileType', overrides.originalFileType || 'application/octet-stream');
  return form;
}

async function withUploadTimeoutTracking(callback) {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const timers = [];

  globalThis.setTimeout = (handler, delay, ...args) => {
    if (delay === 180000) {
      const timer = { handler, delay, args, cleared: false };
      timers.push(timer);
      return timer;
    }
    return originalSetTimeout(handler, delay, ...args);
  };
  globalThis.clearTimeout = (timer) => {
    if (timer && typeof timer === 'object' && 'cleared' in timer) {
      timer.cleared = true;
      return undefined;
    }
    return originalClearTimeout(timer);
  };

  try {
    return await callback(timers);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
}

describe('chunk upload status scanning', () => {
  it('reads chunk status records with bounded concurrency while preserving chunk order', async () => {
    const uploadId = 'status-bounded';
    const records = {};
    for (let index = 0; index < 7; index += 1) {
      records[`chunk_${uploadId}_${String(index).padStart(3, '0')}`] = createChunkRecord(index, {
        status: index % 2 === 0 ? 'completed' : 'uploading',
      });
    }
    const db = new ChunkStatusDB(records);

    const statuses = await checkChunkUploadStatuses({ img_url: db }, uploadId, 7);

    assert.ok(db.maxActiveGets > 1);
    assert.ok(db.maxActiveGets <= 3);
    assert.deepEqual(statuses.map((status) => status.index), [0, 1, 2, 3, 4, 5, 6]);
    assert.deepEqual(statuses.map((status) => status.status), [
      'completed',
      'uploading',
      'completed',
      'uploading',
      'completed',
      'uploading',
      'completed',
    ]);
  });

  it('keeps timeout detection and timeout metadata writes during concurrent scans', async () => {
    const uploadId = 'status-timeout';
    const chunkKey = `chunk_${uploadId}_000`;
    const db = new ChunkStatusDB({
      [chunkKey]: createChunkRecord(0, {
        status: 'uploading',
        timeoutThreshold: Date.now() - 1000,
      }),
    });

    const [status] = await checkChunkUploadStatuses({ img_url: db }, uploadId, 1);

    assert.equal(status.status, 'timeout');
    assert.equal(status.isTimeout, true);
    assert.equal(status.error, 'Chunk upload timed out');
    assert.equal(db.puts.length, 1);
    assert.equal(db.puts[0].key, chunkKey);
    assert.equal(db.puts[0].options.metadata.status, 'timeout');
    assert.equal(db.puts[0].options.expirationTtl, 3600);
  });

  it('does not expose raw backend errors from failed chunk metadata', async () => {
    const uploadId = 'status-failed';
    const chunkKey = `chunk_${uploadId}_000`;
    const rawError = 'S3 AccessDenied: bucket=sensitive-bucket token=abc123';
    const db = new ChunkStatusDB({
      [chunkKey]: createChunkRecord(0, {
        status: 'failed',
        error: rawError,
      }),
    });

    const [status] = await checkChunkUploadStatuses({ img_url: db }, uploadId, 1);

    assert.equal(status.status, 'failed');
    assert.equal(status.error, 'Chunk upload failed');
    assert.equal(db.records.get(chunkKey).metadata.error, rawError);
    assert.doesNotMatch(JSON.stringify(status), /AccessDenied|sensitive-bucket|abc123/);
  });

  it('does not expose raw backend errors when chunk status reads fail', async () => {
    const [status] = await checkChunkUploadStatuses({ img_url: new FailingChunkStatusDB() }, 'status-read-fail', 1);

    assert.equal(status.status, 'error');
    assert.equal(status.error, 'Failed to read chunk status');
    assert.doesNotMatch(JSON.stringify(status), /D1 secret|abc123/);
  });

  it('stores generic failure text when chunk storage upload fails', async () => {
    const uploadId = 'upload-status-write';
    const chunkKey = `chunk_${uploadId}_000`;
    const db = new ChunkStatusDB({
      [`upload_session_${uploadId}`]: {
        value: JSON.stringify({
          uploadId,
          originalFileName: 'demo.bin',
          originalFileType: 'application/octet-stream',
          totalChunks: 1,
          uploadChannel: 'telegram',
          status: 'initialized',
          expiresAt: Date.now() + 60000,
        }),
        metadata: null,
      },
    }, { readDelayMs: 0 });

    const response = await withUploadTimeoutTracking(async (timers) => {
      const uploadResponse = await handleChunkUpload({
        env: { img_url: db },
        url: new URL('https://example.test/upload?chunked=true&uploadChannel=telegram'),
        request: new Request('https://example.test/upload?chunked=true', {
          method: 'POST',
          body: createChunkUploadFormData({ uploadId }),
        }),
        waitUntil() {},
      });
      assert.equal(timers.length, 1);
      assert.equal(timers[0].cleared, true);
      return uploadResponse;
    });

    assert.equal(response.status, 200);
    const chunkRecord = db.records.get(chunkKey);
    assert.equal(chunkRecord.metadata.status, 'failed');
    assert.equal(chunkRecord.metadata.error, 'Chunk upload failed');
    assert.doesNotMatch(JSON.stringify(chunkRecord.metadata), /Cannot read|undefined|null/);
  });
});
