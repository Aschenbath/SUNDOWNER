import assert from 'node:assert/strict';

import {
  onRequest,
  onRequestOptions,
} from '../functions/api/manage/migrate/recover-capture-times.js';
import { D1Database } from '../functions/utils/d1Database.js';
import { SqliteD1 } from '../server/sqliteD1.js';

class MemoryKV {
  constructor(entries = {}) {
    this.store = new Map(Object.entries(entries));
    this.metadata = new Map();
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async put(key, value, options = {}) {
    this.store.set(key, value);
    this.metadata.set(key, options.metadata || null);
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

  async list(options = {}) {
    const prefix = options.prefix || '';
    const limit = options.limit || 1000;
    const cursor = options.cursor || null;
    const keys = [...this.store.keys()]
      .filter((key) => key.startsWith(prefix))
      .sort()
      .filter((key) => !cursor || key > cursor);

    const page = keys.slice(0, limit + 1);
    const hasMore = page.length > limit;
    if (hasMore) {
      page.pop();
    }

    return {
      keys: page.map((name) => ({
        name,
        metadata: this.metadata.get(name) || {},
      })),
      cursor: hasMore && page.length > 0 ? page[page.length - 1] : null,
      list_complete: !hasMore,
    };
  }
}

function createIndexChunk(files) {
  return JSON.stringify(files.map((file) => ({
    id: file.id,
    metadata: file.metadata,
  })));
}

function toArrayBuffer(bytes) {
  const view = Uint8Array.from(bytes);
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

function buildExifJpegBuffer(dateTime = '2025:03:14 08:09:10') {
  const encoder = new TextEncoder();
  const ascii = encoder.encode(`${dateTime}\0`);
  const tiffLength = 8 + 2 + 1 * 12 + 4 + 2 + 1 * 12 + 4 + ascii.length;
  const segmentLength = 2 + 6 + tiffLength;
  const bytes = new Uint8Array(2 + 2 + 2 + 6 + tiffLength + 2);
  let offset = 0;

  bytes[offset++] = 0xFF;
  bytes[offset++] = 0xD8;
  bytes[offset++] = 0xFF;
  bytes[offset++] = 0xE1;
  bytes[offset++] = (segmentLength >> 8) & 0xFF;
  bytes[offset++] = segmentLength & 0xFF;
  bytes.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00], offset);
  offset += 6;

  const tiffStart = offset;
  bytes.set([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00], offset);
  offset += 8;

  const view = new DataView(bytes.buffer);
  view.setUint16(offset, 1, true);
  offset += 2;

  view.setUint16(offset, 0x8769, true);
  view.setUint16(offset + 2, 4, true);
  view.setUint32(offset + 4, 1, true);
  view.setUint32(offset + 8, 26, true);
  offset += 12;

  view.setUint32(offset, 0, true);
  offset += 4;

  view.setUint16(offset, 1, true);
  offset += 2;

  view.setUint16(offset, 0x9003, true);
  view.setUint16(offset + 2, 2, true);
  view.setUint32(offset + 4, ascii.length, true);
  view.setUint32(offset + 8, 44, true);
  offset += 12;

  view.setUint32(offset, 0, true);

  bytes.set(ascii, tiffStart + 44);
  bytes[bytes.length - 2] = 0xFF;
  bytes[bytes.length - 1] = 0xD9;
  return toArrayBuffer(bytes);
}

describe('recover capture times route', () => {
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
    const env = {
      img_d1: new SqliteD1(':memory:'),
      img_r2: {
        async get(key) {
          assert.equal(key, 'photos/no-exif.jpg');
          return {
            async arrayBuffer() {
              return buildExifJpegBuffer();
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

  it('repairs D1 image records from legacy KV index metadata before falling back to source scraping', async () => {
    const env = {
      img_url: new MemoryKV({
        'manage@index@meta': JSON.stringify({ chunkCount: 1 }),
        'manage@index_0': createIndexChunk([
          {
            id: 'photos/from-legacy-index.jpg',
            metadata: {
              Channel: 'TelegramNew',
              FileName: 'from-legacy-index.jpg',
              FileType: 'image/jpeg',
              TimeStamp: 1775628424666,
              Exif: {
                dateTime: '2024-01-05T06:07:08.000Z',
              },
            },
          },
        ]),
      }),
      img_d1: new SqliteD1(':memory:'),
    };
    const db = new D1Database(env.img_d1);
    await db.put('photos/from-legacy-index.jpg', '', {
      metadata: {
        Channel: 'TelegramNew',
        FileName: 'from-legacy-index.jpg',
        FileType: 'image/jpeg',
        TimeStamp: 1775628424666,
      },
    });

    const response = await onRequest({
      env,
      request: new Request('https://example.com/api/manage/migrate/recover-capture-times', {
        method: 'POST',
        body: JSON.stringify({ keys: ['photos/from-legacy-index.jpg'] }),
      }),
      waitUntil(promise) {
        return promise;
      },
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.recovered, 1);

    const updated = await db.getWithMetadata('photos/from-legacy-index.jpg');
    assert.equal(updated.metadata.Exif.dateTime, '2024-01-05T06:07:08.000Z');
  });

  it('returns CORS headers for OPTIONS', async () => {
    const response = onRequestOptions();
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
  });
});
