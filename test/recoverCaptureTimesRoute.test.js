import assert from 'node:assert/strict';

import {
  onRequest,
  onRequestOptions,
  __resetS3ClientFactoryForTests,
  __setS3ClientFactoryForTests,
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

function buildCameraExifJpegBuffer() {
  const encoder = new TextEncoder();
  const tiffBytes = new Uint8Array(4096);
  const view = new DataView(tiffBytes.buffer);
  let dataOffset = 0;

  const make = asciiEntry(0x010F, 'Apple');
  const model = asciiEntry(0x0110, 'iPhone 15 Pro Max');
  const pointer = longEntry(0x8769, 0);
  const ifd0Entries = [make, model, pointer];
  const ifd0Offset = 8;
  const ifd0Size = 2 + ifd0Entries.length * 12 + 4;
  const exifEntries = [
    asciiEntry(0x9003, '2025:03:14 08:09:10'),
    asciiEntry(0xA434, 'iPhone 15 Pro Max back triple camera 6.765mm f/1.78'),
    rationalEntry(0x829D, 178, 100),
    rationalEntry(0x829A, 1, 121),
    shortEntry(0x8827, 64),
    rationalEntry(0x920A, 6764, 1000),
  ];
  const exifIfdOffset = ifd0Offset + ifd0Size;
  pointer.value = exifIfdOffset;
  const exifIfdSize = 2 + exifEntries.length * 12 + 4;
  dataOffset = exifIfdOffset + exifIfdSize;

  tiffBytes.set([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00], 0);
  writeIfd(view, tiffBytes, ifd0Offset, ifd0Entries);
  writeIfd(view, tiffBytes, exifIfdOffset, exifEntries);

  const tiff = tiffBytes.slice(0, dataOffset);
  const segmentLength = 2 + 6 + tiff.length;
  const bytes = new Uint8Array(2 + 2 + 2 + 6 + tiff.length + 2);
  let offset = 0;
  bytes[offset++] = 0xFF;
  bytes[offset++] = 0xD8;
  bytes[offset++] = 0xFF;
  bytes[offset++] = 0xE1;
  bytes[offset++] = (segmentLength >> 8) & 0xFF;
  bytes[offset++] = segmentLength & 0xFF;
  bytes.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00], offset);
  offset += 6;
  bytes.set(tiff, offset);
  bytes[bytes.length - 2] = 0xFF;
  bytes[bytes.length - 1] = 0xD9;
  return toArrayBuffer(bytes);

  function asciiEntry(tag, value) {
    return { tag, type: 2, count: encoder.encode(`${value}\0`).length, bytes: encoder.encode(`${value}\0`) };
  }

  function shortEntry(tag, value) {
    return { tag, type: 3, count: 1, value };
  }

  function longEntry(tag, value) {
    return { tag, type: 4, count: 1, value };
  }

  function rationalEntry(tag, numerator, denominator) {
    const bytes = new Uint8Array(8);
    const rationalView = new DataView(bytes.buffer);
    rationalView.setUint32(0, numerator, true);
    rationalView.setUint32(4, denominator, true);
    return { tag, type: 5, count: 1, bytes };
  }

  function writeIfd(targetView, targetBytes, offset, entries) {
    targetView.setUint16(offset, entries.length, true);
    let entryOffset = offset + 2;
    for (const entry of entries) {
      targetView.setUint16(entryOffset, entry.tag, true);
      targetView.setUint16(entryOffset + 2, entry.type, true);
      targetView.setUint32(entryOffset + 4, entry.count, true);

      const valueBytes = entry.bytes || encodeInlineEntry(entry);
      targetBytes.fill(0, entryOffset + 8, entryOffset + 12);
      if (valueBytes.length <= 4) {
        targetBytes.set(valueBytes, entryOffset + 8);
      } else {
        targetView.setUint32(entryOffset + 8, dataOffset, true);
        targetBytes.set(valueBytes, dataOffset);
        dataOffset += valueBytes.length;
      }
      entryOffset += 12;
    }
    targetView.setUint32(entryOffset, 0, true);
  }

  function encodeInlineEntry(entry) {
    if (entry.type === 3) {
      const bytes = new Uint8Array(2);
      new DataView(bytes.buffer).setUint16(0, entry.value, true);
      return bytes;
    }
    if (entry.type === 4) {
      const bytes = new Uint8Array(4);
      new DataView(bytes.buffer).setUint32(0, entry.value, true);
      return bytes;
    }
    return new Uint8Array(0);
  }
}

describe('recover capture times route', () => {
  it('dry-run scans images missing capture time or structured camera EXIF', async () => {
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
    assert.equal(payload.total, 2);
    assert.equal(payload.processed, 2);
    assert.deepEqual(payload.skipped.map((entry) => entry.id), [
      'photos/no-exif.jpg',
      'photos/legacy-exif.jpg',
    ]);
  });

  it('includes date-only EXIF images so camera metadata can be backfilled', async () => {
    const env = {
      img_url: new MemoryKV({
        'manage@index@meta': JSON.stringify({ chunkCount: 1 }),
        'manage@index_0': createIndexChunk([
          {
            id: 'photos/date-only-exif.jpg',
            metadata: {
              Channel: 'CloudflareR2',
              FileName: 'date-only-exif.jpg',
              FileType: 'image/jpeg',
              Exif: {
                dateTime: '2025-03-14T08:09:10.000Z',
              },
              TimeStamp: 1775628424666,
            },
          },
          {
            id: 'photos/full-exif.jpg',
            metadata: {
              Channel: 'CloudflareR2',
              FileName: 'full-exif.jpg',
              FileType: 'image/jpeg',
              Exif: {
                dateTime: '2025-03-14T08:09:10.000Z',
                camera: { make: 'Apple', model: 'iPhone 15 Pro Max' },
              },
              TimeStamp: 1775628424777,
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
    assert.equal(payload.skipped[0].id, 'photos/date-only-exif.jpg');
  });

  it('backfills camera EXIF for images that already have capture time metadata', async () => {
    const env = {
      img_d1: new SqliteD1(':memory:'),
      img_r2: {
        async get(key) {
          assert.equal(key, 'photos/date-only-exif.jpg');
          return {
            async arrayBuffer() {
              return buildCameraExifJpegBuffer();
            },
          };
        },
      },
    };
    const db = new D1Database(env.img_d1);
    await db.put('photos/date-only-exif.jpg', '', {
      metadata: {
        Channel: 'CloudflareR2',
        FileName: 'date-only-exif.jpg',
        FileType: 'image/jpeg',
        Exif: {
          dateTime: '2025-03-14T08:09:10.000Z',
        },
        TimeStamp: 1775628424666,
      },
    });

    const response = await onRequest({
      env,
      request: new Request('https://example.com/api/manage/migrate/recover-capture-times', {
        method: 'POST',
        body: JSON.stringify({ keys: ['photos/date-only-exif.jpg'] }),
      }),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.recovered, 1);

    const updated = await db.getWithMetadata('photos/date-only-exif.jpg');
    assert.deepEqual(updated.metadata.Exif.camera, {
      make: 'Apple',
      model: 'iPhone 15 Pro Max',
      lens: 'iPhone 15 Pro Max back triple camera 6.765mm f/1.78',
    });
    assert.deepEqual(updated.metadata.Exif.shooting, {
      fNumber: 1.78,
      exposureTime: '1/121',
      iso: 64,
      focalLength: 6.764,
    });
    assert.equal(updated.metadata.Exif.dateTime, '2025-03-14T08:09:10.000Z');
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

  it('backfills S3 image records using channel locator config when metadata was trimmed', async () => {
    const env = {
      img_url: new MemoryKV({
        'manage@sysConfig@upload': JSON.stringify({
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
        }),
      }),
      img_d1: new SqliteD1(':memory:'),
    };
    const db = new D1Database(env.img_d1);
    await db.put('photos/s3-exif.jpg', '', {
      metadata: {
        Channel: 'S3',
        ChannelName: 'Archive S3',
        FileName: 's3-exif.jpg',
        FileType: 'image/jpeg',
        TimeStamp: 1775628424666,
      },
    });

    const createdClients = [];
    const sentCommands = [];
    __setS3ClientFactoryForTests((options) => {
      createdClients.push(options);
      return {
        async send(command) {
          sentCommands.push(command.input);
          return {
            Body: new Uint8Array(buildExifJpegBuffer()),
          };
        },
      };
    });

    try {
      const response = await onRequest({
        env,
        request: new Request('https://example.com/api/manage/migrate/recover-capture-times', {
          method: 'POST',
          body: JSON.stringify({ keys: ['photos/s3-exif.jpg'] }),
        }),
        waitUntil(promise) {
          return promise;
        },
      });

      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.success, true);
      assert.equal(payload.recovered, 1);
      assert.equal(createdClients[0].endpoint, 'https://s3.example.com');
      assert.deepEqual(sentCommands[0], {
        Bucket: 'media',
        Key: 'photos/s3-exif.jpg',
        Range: 'bytes=0-65535',
      });

      const updated = await db.getWithMetadata('photos/s3-exif.jpg');
      assert.equal(updated.metadata.Exif.dateTime, '2025-03-14T08:09:10.000Z');
    } finally {
      __resetS3ClientFactoryForTests();
    }
  });
  it('returns CORS headers for OPTIONS', async () => {
    const response = onRequestOptions();
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
  });
});
