import assert from 'node:assert/strict';

import { checkChunkUploadStatuses } from '../functions/upload/chunkUpload.js';

class ChunkStatusDB {
  constructor(records = {}) {
    this.records = new Map(Object.entries(records));
    this.activeGets = 0;
    this.maxActiveGets = 0;
    this.puts = [];
  }

  async getWithMetadata(key) {
    this.activeGets += 1;
    this.maxActiveGets = Math.max(this.maxActiveGets, this.activeGets);
    await new Promise((resolve) => setTimeout(resolve, 10));
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
    assert.equal(db.puts.length, 1);
    assert.equal(db.puts[0].key, chunkKey);
    assert.equal(db.puts[0].options.metadata.status, 'timeout');
    assert.equal(db.puts[0].options.expirationTtl, 3600);
  });
});
