import assert from 'node:assert/strict';

import { onRequestPost } from '../functions/api/manage/batch/index/finalize.js';

class MemoryKV {
  constructor() {
    this.store = new Map();
    this.operations = [];
    this.failPuts = new Set();
  }

  async put(key, value) {
    this.operations.push({ type: 'put', key });
    if (this.failPuts.has(key)) {
      throw new Error(`KV put failed for ${key}`);
    }
    this.store.set(key, value);
  }

  async get(key) {
    this.operations.push({ type: 'get', key });
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async delete(key) {
    this.operations.push({ type: 'delete', key });
    this.store.delete(key);
  }
}

function createFinalizeRequest(sessionId, totalChunks, totalFiles) {
  return new Request('https://example.com/api/manage/batch/index/finalize', {
    method: 'POST',
    body: JSON.stringify({ sessionId, totalChunks, totalFiles }),
  });
}

function createChunk(chunkId, data) {
  return JSON.stringify({
    chunkId,
    data,
    recordCount: data.length,
  });
}

describe('batch index finalize', () => {
  it('writes chunk bodies before metadata and cleans old chunks only after save succeeds', async () => {
    const img_url = new MemoryKV();
    await img_url.put('manage@index@meta', JSON.stringify({ chunkCount: 3 }));
    await img_url.put('manage@index_0', JSON.stringify([{ id: 'old/a.jpg', metadata: {} }]));
    await img_url.put('manage@index_1', JSON.stringify([{ id: 'old/b.jpg', metadata: {} }]));
    await img_url.put('manage@index_2', JSON.stringify([{ id: 'old/c.jpg', metadata: {} }]));
    await img_url.put('chunk_rebuild_demo_0', createChunk(0, [
      { id: 'photos/new.jpg', metadata: { FileName: 'new.jpg', FileSize: '1' } },
    ]));
    img_url.operations = [];

    const waitUntilPromises = [];
    const response = await onRequestPost({
      env: { img_url },
      request: createFinalizeRequest('rebuild_demo', 1, 1),
      waitUntil(promise) {
        waitUntilPromises.push(Promise.resolve(promise));
      },
    });

    assert.equal(response.status, 200);
    const operationKeys = img_url.operations
      .filter((operation) => operation.type === 'put' || operation.type === 'delete')
      .map((operation) => `${operation.type}:${operation.key}`);
    assert.ok(
      operationKeys.indexOf('put:manage@index_0') < operationKeys.indexOf('put:manage@index@meta'),
      'index chunk body must be written before metadata commit point'
    );
    assert.ok(
      operationKeys.indexOf('put:manage@index@meta') < operationKeys.indexOf('delete:manage@index_1'),
      'old chunk cleanup must run after the new metadata is committed'
    );
    assert.equal(img_url.store.has('manage@index_1'), false);
    assert.equal(img_url.store.has('manage@index_2'), false);
    await Promise.all(waitUntilPromises);
  });

  it('does not delete old index chunks when saving the new index fails', async () => {
    const img_url = new MemoryKV();
    await img_url.put('manage@index@meta', JSON.stringify({ chunkCount: 2 }));
    await img_url.put('manage@index_0', JSON.stringify([{ id: 'old/a.jpg', metadata: {} }]));
    await img_url.put('manage@index_1', JSON.stringify([{ id: 'old/b.jpg', metadata: {} }]));
    await img_url.put('chunk_rebuild_fail_0', createChunk(0, [
      { id: 'photos/new.jpg', metadata: { FileName: 'new.jpg', FileSize: '1' } },
    ]));
    img_url.failPuts.add('manage@index_0');
    img_url.operations = [];

    const response = await onRequestPost({
      env: { img_url },
      request: createFinalizeRequest('rebuild_fail', 1, 1),
      waitUntil() {
        throw new Error('temporary cleanup must not run after failed save');
      },
    });

    assert.equal(response.status, 500);
    const deleteKeys = img_url.operations
      .filter((operation) => operation.type === 'delete')
      .map((operation) => operation.key);
    assert.deepEqual(deleteKeys, []);
    assert.equal(img_url.store.has('manage@index_1'), true);
  });
});
