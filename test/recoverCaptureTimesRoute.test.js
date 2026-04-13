import assert from 'node:assert/strict';

import exifr from 'exifr';

import {
  onRequest,
  onRequestOptions,
} from '../functions/api/manage/migrate/recover-capture-times.js';
import { D1Database } from '../functions/utils/d1Database.js';
import { SqliteD1 } from '../server/sqliteD1.js';

class MemoryKV {
  constructor(entries = {}) {
    this.store = new Map(Object.entries(entries));
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
}

function createIndexChunk(files) {
  return JSON.stringify(files.map((file) => ({
    id: file.id,
    metadata: file.metadata,
  })));
}

describe('recover capture times route', () => {
  const originalParse = exifr.parse;

  afterEach(() => {
    exifr.parse = originalParse;
  });

  it('dry-run scans only images that still lack a recoverable capture time', async () => {
    const env = {
      img_url: new MemoryKV({
        'manage@index@meta': JSON.stringify({ chunkCount: 1 }),
        'manage@index_0': createIndexChunk([
          {
            id: 'photos/no-exif.jpg',
            metadata: {
              Channel: 'CloudflareR2',
              FileName: 'no-exif.jpg',
              FileType: 'image/jpeg',
              TimeStamp: 1775628424666,
            },
          },
          {
            id: 'photos/legacy-exif.jpg',
            metadata: {
              Channel: 'CloudflareR2',
              FileName: 'legacy-exif.jpg',
              FileType: 'image/jpeg',
              Exif: {
                DateTimeOriginal: '2024:07:12 18:04:33',
              },
              TimeStamp: 1775628424777,
            },
          },
          {
            id: 'photos/PXL_20240417_162455123.jpg',
            metadata: {
              Channel: 'CloudflareR2',
              FileName: 'PXL_20240417_162455123.jpg',
              FileType: 'image/jpeg',
              TimeStamp: 1775628424888,
            },
          },
        ]),
      }),
    };

    const response = await onRequest({
      env,
      request: new Request('https://example.com/api/manage/migrate/recover-capture-times', {
        method: 'POST',
        body: JSON.stringify({ dryRun: true, limit: 10 }),
      }),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.total, 1);
    assert.equal(payload.processed, 1);
    assert.equal(payload.skipped[0].id, 'photos/no-exif.jpg');
  });

  it('backfills Exif.dateTime for D1 image records when EXIF can be extracted from source bytes', async () => {
    exifr.parse = async () => ({
      DateTimeOriginal: new Date('2025-03-14T08:09:10.000Z'),
    });

    const env = {
      img_d1: new SqliteD1(':memory:'),
      img_r2: {
        async get(key) {
          assert.equal(key, 'photos/no-exif.jpg');
          return {
            async arrayBuffer() {
              return new Uint8Array([0xff, 0xd8, 0xff, 0xe1]).buffer;
            },
          };
        },
      },
    };
    const db = new D1Database(env.img_d1);
    await db.put('photos/no-exif.jpg', '', {
      metadata: {
        Channel: 'CloudflareR2',
        FileName: 'no-exif.jpg',
        FileType: 'image/jpeg',
        TimeStamp: 1775628424666,
      },
    });

    const response = await onRequest({
      env,
      request: new Request('https://example.com/api/manage/migrate/recover-capture-times', {
        method: 'POST',
        body: JSON.stringify({ keys: ['photos/no-exif.jpg'] }),
      }),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.recovered, 1);

    const updated = await db.getWithMetadata('photos/no-exif.jpg');
    assert.equal(updated.metadata.Exif.dateTime, '2025-03-14T08:09:10.000Z');
  });

  it('returns CORS headers for OPTIONS', async () => {
    const response = onRequestOptions();

    assert.equal(response.status, 204);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
  });
});
