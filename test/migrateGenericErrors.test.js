import assert from 'node:assert/strict';

import { onRequest as recoverCaptureTimesOnRequest } from '../functions/api/manage/migrate/recover-capture-times.js';
import { onRequestPost as recoverTgFileIdsOnRequestPost } from '../functions/api/manage/migrate/recover-tg-file-ids.js';
import { onRequestPost as recoverTgThumbnailsOnRequestPost } from '../functions/api/manage/migrate/recover-tg-thumbnails.js';
import { onRequestGet as scanOrphanFilesOnRequestGet } from '../functions/api/manage/migrate/scan-orphan-files.js';

const INTERNAL_MESSAGE = 'D1 shard failed for private_token_789';

class ThrowingKV {
  async get() {
    throw new Error(INTERNAL_MESSAGE);
  }
}

class CandidateKV {
  constructor(records = {}, legacyRecords = []) {
    this.records = new Map(Object.entries(records));
    this.legacyRecords = legacyRecords;
  }

  async get(key) {
    if (key === 'manage@index@meta' && this.legacyRecords.length > 0) {
      return JSON.stringify({ chunkCount: 1 });
    }
    if (key === 'manage@index_0' && this.legacyRecords.length > 0) {
      return JSON.stringify(this.legacyRecords);
    }
    return null;
  }

  async getWithMetadata(key) {
    const record = this.records.get(key);
    if (!record) {
      return null;
    }
    return {
      value: record.value || '',
      metadata: { ...(record.metadata || {}) },
    };
  }

  async put() {
    throw new Error(INTERNAL_MESSAGE);
  }
}

function envWithThrowingIndex() {
  return {
    img_url: new ThrowingKV(),
  };
}

function postRequest(url, body) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function assertGenericScanError(response, expectedError) {
  assert.equal(response.status, 500);
  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error, expectedError);
  assert.ok(!JSON.stringify(payload).includes(INTERNAL_MESSAGE));
}

async function assertGenericCandidateFailure(response, expectedReason) {
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.failed.length, 1);
  assert.equal(payload.failed[0].reason, expectedReason);
  assert.ok(!JSON.stringify(payload).includes(INTERNAL_MESSAGE));
}

describe('migrate API generic scan errors', () => {
  let originalConsoleError;

  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = () => {};
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('hides raw storage errors from capture-time scan failures', async () => {
    const response = await recoverCaptureTimesOnRequest({
      env: envWithThrowingIndex(),
      request: postRequest('https://example.com/api/manage/migrate/recover-capture-times', {
        dryRun: true,
      }),
    });

    await assertGenericScanError(response, 'Failed to scan candidates');
  });

  it('hides raw storage errors from Telegram file-id scan failures', async () => {
    const response = await recoverTgFileIdsOnRequestPost({
      env: envWithThrowingIndex(),
      request: postRequest('https://example.com/api/manage/migrate/recover-tg-file-ids', {
        dryRun: true,
        targetChatId: 'target-chat',
      }),
    });

    await assertGenericScanError(response, 'Failed to scan candidates');
  });

  it('hides raw storage errors from Telegram thumbnail scan failures', async () => {
    const response = await recoverTgThumbnailsOnRequestPost({
      env: envWithThrowingIndex(),
      request: postRequest('https://example.com/api/manage/migrate/recover-tg-thumbnails', {
        dryRun: true,
        targetChatId: 'target-chat',
      }),
    });

    await assertGenericScanError(response, 'Failed to scan candidates');
  });

  it('hides raw storage errors from orphan-file scan failures', async () => {
    const response = await scanOrphanFilesOnRequestGet({
      env: envWithThrowingIndex(),
      request: new Request('https://example.com/api/manage/migrate/scan-orphan-files?limit=10'),
    });

    await assertGenericScanError(response, 'Failed to scan index');
  });

  it('hides raw per-candidate errors from Telegram file-id recovery responses', async () => {
    const fileId = 'photos/private.jpg';
    const response = await recoverTgFileIdsOnRequestPost({
      env: {
        img_url: new CandidateKV({
          [fileId]: {
            value: 'bytes',
            metadata: {
              Channel: 'TelegramNew',
              FileName: 'private.jpg',
            },
          },
        }),
      },
      request: postRequest('https://example.com/api/manage/migrate/recover-tg-file-ids', {
        targetChatId: 'target-chat',
        matches: [{
          key: fileId,
          fileId: 'A'.repeat(48),
          messageId: '123',
        }],
      }),
    });

    await assertGenericCandidateFailure(response, 'Failed to recover Telegram file_id');
  });

  it('hides raw per-candidate errors from Telegram thumbnail recovery responses', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      const textUrl = String(url);
      if (textUrl.includes('/forwardMessage')) {
        return new Response(JSON.stringify({
          ok: true,
          result: {
            message_id: 456,
            document: {
              thumbnail: {
                file_id: 'thumb-file-id',
                file_unique_id: 'thumb-unique-id',
                width: 120,
                height: 80,
                file_size: 1234,
              },
            },
          },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ ok: true, result: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const fileId = 'photos/private.heic';
      const response = await recoverTgThumbnailsOnRequestPost({
        env: {
          img_url: new CandidateKV({
            [fileId]: {
              value: 'bytes',
              metadata: {
                Channel: 'TelegramNew',
                FileName: 'private.heic',
                FileType: 'image/heic',
                TgMessageId: '123',
              },
            },
          }),
        },
        request: postRequest('https://example.com/api/manage/migrate/recover-tg-thumbnails', {
          targetChatId: 'target-chat',
          sourceChatId: 'source-chat',
          botToken: 'bot-token',
          keys: [fileId],
        }),
      });

      await assertGenericCandidateFailure(response, 'Failed to recover Telegram thumbnail');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('hides raw per-candidate errors from capture-time recovery responses', async () => {
    const fileId = 'photos/private.jpg';
    const response = await recoverCaptureTimesOnRequest({
      env: {
        img_url: new CandidateKV({
          [fileId]: {
            value: 'bytes',
            metadata: {
              Channel: 'External',
              FileName: 'private.jpg',
              FileType: 'image/jpeg',
            },
          },
        }, [{
          id: fileId,
          metadata: {
            DateTaken: '2026-01-02T03:04:05.000Z',
          },
        }]),
      },
      request: postRequest('https://example.com/api/manage/migrate/recover-capture-times', {
        keys: [fileId],
      }),
    });

    await assertGenericCandidateFailure(response, 'Failed to recover capture metadata');
  });
});
