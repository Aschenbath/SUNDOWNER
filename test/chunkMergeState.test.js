import assert from 'node:assert/strict';

import { classifyChunkMergeState, startMerge } from '../functions/upload/chunkMerge.js';

describe('chunk merge state handling', () => {
  it('classifies uploading chunks as recoverable in-progress merge state', () => {
    const state = classifyChunkMergeState([
      { status: 'completed' },
      { status: 'uploading' },
    ], 2);

    assert.equal(state.ready, false);
    assert.equal(state.recoverable, true);
    assert.equal(state.message, 'Chunk upload is still in progress, please retry merge later');
  });

  it('classifies timeout chunks as recoverable in-progress merge state', () => {
    const state = classifyChunkMergeState([
      { status: 'completed' },
      { status: 'timeout' },
    ], 2);

    assert.equal(state.ready, false);
    assert.equal(state.recoverable, true);
    assert.equal(state.message, 'Chunk upload is still in progress, please retry merge later');
  });

  it('classifies incomplete completed chunks as recoverable incomplete state', () => {
    const state = classifyChunkMergeState([
      { status: 'completed' },
      { status: 'failed' },
    ], 2);

    assert.equal(state.ready, false);
    assert.equal(state.recoverable, true);
    assert.equal(state.message, 'Chunk upload is incomplete');
  });

  it('does not cleanup session or chunks for recoverable merge results', async () => {
    const calls = [];
    const response = await startMerge(
      { env: {} },
      'upload-1',
      2,
      'test.mp4',
      'video/mp4',
      'telegram',
      {
        handleChannelMerge: async () => ({
          success: false,
          recoverable: true,
          error: 'Chunk upload is still in progress, please retry merge later',
        }),
        cleanupMultipart: async () => calls.push('cleanupMultipart'),
        cleanupChunks: async () => calls.push('cleanupChunks'),
        cleanupSession: async () => calls.push('cleanupSession'),
      }
    );

    assert.equal(response.status, 409);
    assert.equal(await response.text(), 'Chunk upload is still in progress, please retry merge later');
    assert.deepEqual(calls, []);
  });

  it('still cleans up session and chunks on successful merge', async () => {
    const calls = [];
    const response = await startMerge(
      { env: {} },
      'upload-1',
      2,
      'test.mp4',
      'video/mp4',
      'telegram',
      {
        handleChannelMerge: async () => ({
          success: true,
          result: [{ src: '/file/final.mp4' }],
        }),
        cleanupMultipart: async () => calls.push('cleanupMultipart'),
        cleanupChunks: async () => calls.push('cleanupChunks'),
        cleanupSession: async () => calls.push('cleanupSession'),
      }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [{ src: '/file/final.mp4' }]);
    assert.deepEqual(calls, ['cleanupChunks', 'cleanupSession']);
  });

  it('infers HEIC mime type before handing chunked uploads to the final merge path', async () => {
    let receivedFileType = '';
    const response = await startMerge(
      { env: {} },
      'upload-1',
      2,
      'IMG_2038.HEIC',
      'application/octet-stream',
      'telegram',
      {
        handleChannelMerge: async (_context, _uploadId, _totalChunks, _originalFileName, originalFileType) => {
          receivedFileType = originalFileType;
          return {
            success: true,
            result: [{ src: '/file/IMG_2038.HEIC' }],
          };
        },
        cleanupMultipart: async () => {},
        cleanupChunks: async () => {},
        cleanupSession: async () => {},
      }
    );

    assert.equal(response.status, 200);
    assert.equal(receivedFileType, 'image/heic');
  });
});
