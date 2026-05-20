import assert from 'node:assert/strict';

import {
  __resetEmbeddedThumbnailExtractorForTests,
  __setEmbeddedThumbnailModuleLoaderForTests,
  extractExifData,
} from '../functions/upload/exifExtractor.js';

function toArrayBuffer(bytes) {
  const view = Uint8Array.from(bytes);
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

function buildExifJpegBuffer(dateTime = '2026:04:06 10:41:00') {
  const encoder = new TextEncoder();
  const ascii = encoder.encode(`${dateTime}\0`);
  const tiffLength = 8 + 2 + 2 * 12 + 4 + 2 + 1 * 12 + 4 + ascii.length;
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
  view.setUint16(offset, 2, true);
  offset += 2;

  view.setUint16(offset, 0x8769, true);
  view.setUint16(offset + 2, 4, true);
  view.setUint32(offset + 4, 1, true);
  view.setUint32(offset + 8, 38, true);
  offset += 12;

  view.setUint16(offset, 0x0132, true);
  view.setUint16(offset + 2, 2, true);
  view.setUint32(offset + 4, ascii.length, true);
  view.setUint32(offset + 8, 56, true);
  offset += 12;

  view.setUint32(offset, 0, true);
  offset += 4;

  view.setUint16(offset, 1, true);
  offset += 2;

  view.setUint16(offset, 0x9003, true);
  view.setUint16(offset + 2, 2, true);
  view.setUint32(offset + 4, ascii.length, true);
  view.setUint32(offset + 8, 56, true);
  offset += 12;

  view.setUint32(offset, 0, true);

  bytes.set(ascii, tiffStart + 56);
  bytes[bytes.length - 2] = 0xFF;
  bytes[bytes.length - 1] = 0xD9;
  return toArrayBuffer(bytes);
}

function buildStructuredExifJpegBuffer() {
  const encoder = new TextEncoder();
  const tiffBytes = new Uint8Array(4096);
  const view = new DataView(tiffBytes.buffer);
  let dataOffset = 0;

  const make = asciiEntry(0x010F, 'Apple');
  const model = asciiEntry(0x0110, 'iPhone 15 Pro Max');
  const orientation = shortEntry(0x0112, 1);
  const pointer = longEntry(0x8769, 0);
  const ifd0Entries = [make, model, orientation, pointer];
  const ifd0Offset = 8;
  const ifd0Size = 2 + ifd0Entries.length * 12 + 4;

  const exifEntries = [
    asciiEntry(0x9003, '2026:04:06 10:41:00'),
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

const JPEG_BUFFER = buildExifJpegBuffer();
const JPEG_STRUCTURED_BUFFER = buildStructuredExifJpegBuffer();
const JPEG_CREATE_DATE_ONLY_BUFFER = buildExifJpegBuffer('2024:07:12 10:11:12');
const PNG_BUFFER = toArrayBuffer([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const EMPTY_BUFFER = new ArrayBuffer(0);

describe('extractExifData', () => {
  afterEach(() => {
    __resetEmbeddedThumbnailExtractorForTests();
  });

  it('extracts JPEG EXIF DateTimeOriginal into persisted metadata shape', async () => {
    const result = await extractExifData(JPEG_BUFFER, 'image/jpeg');

    assert.deepEqual(result, {
      dateTime: '2026-04-06T10:41:00.000Z',
    });
  });

  it('extracts JPEG camera, lens, and shooting EXIF into persisted metadata shape', async () => {
    const result = await extractExifData(JPEG_STRUCTURED_BUFFER, 'image/jpeg');

    assert.deepEqual(result, {
      dateTime: '2026-04-06T10:41:00.000Z',
      camera: {
        make: 'Apple',
        model: 'iPhone 15 Pro Max',
        lens: 'iPhone 15 Pro Max back triple camera 6.765mm f/1.78',
      },
      shooting: {
        fNumber: 1.78,
        exposureTime: '1/121',
        iso: 64,
        focalLength: 6.764,
      },
      orientation: 1,
    });
  });

  it('uses the lazy runtime parser for HEIC camera and shooting EXIF', async () => {
    let loads = 0;
    let parseCalls = 0;
    __setEmbeddedThumbnailModuleLoaderForTests(async () => {
      loads += 1;
      return {
        default: {
          parse: async (buffer, options) => {
            parseCalls += 1;
            assert.equal(buffer.byteLength, 16);
            assert.deepEqual(options.pick, [
              'DateTimeOriginal', 'CreateDate',
              'Make', 'Model', 'LensModel',
              'FNumber', 'ExposureTime', 'ISO', 'FocalLength',
              'GPSLatitude', 'GPSLongitude', 'GPSAltitude',
              'Orientation',
            ]);
            return {
              DateTimeOriginal: new Date('2026-04-07T11:12:13.000Z'),
              Make: 'Apple',
              Model: 'iPhone 15 Pro Max',
              LensModel: 'iPhone 15 Pro Max back triple camera 6.765mm f/1.78',
              FNumber: 1.78,
              ExposureTime: 1 / 121,
              ISO: 64,
              FocalLength: 6.764,
              Orientation: 1,
            };
          },
        },
      };
    });

    const result = await extractExifData(new ArrayBuffer(16), 'image/heic');

    assert.equal(loads, 1);
    assert.equal(parseCalls, 1);
    assert.deepEqual(result, {
      dateTime: '2026-04-07T11:12:13.000Z',
      camera: {
        make: 'Apple',
        model: 'iPhone 15 Pro Max',
        lens: 'iPhone 15 Pro Max back triple camera 6.765mm f/1.78',
      },
      shooting: {
        fNumber: 1.78,
        exposureTime: '1/121',
        iso: 64,
        focalLength: 6.764,
      },
      orientation: 1,
    });
  });

  it('returns null for supported image formats when no EXIF data is present', async () => {
    const pngResult = await extractExifData(PNG_BUFFER, 'image/png');
    assert.equal(pngResult, null);
  });

  it('falls back to DateTime when JPEG EXIF exists only in the 0th IFD', async () => {
    const result = await extractExifData(JPEG_CREATE_DATE_ONLY_BUFFER, 'image/jpeg');

    assert.deepEqual(result, {
      dateTime: '2024-07-12T10:11:12.000Z',
    });
  });

  it('returns null for unsupported formats', async () => {
    const gifResult = await extractExifData(PNG_BUFFER, 'image/gif');
    assert.equal(gifResult, null);
  });

  it('swallows malformed JPEG data and empty buffers by returning null', async () => {
    await assert.doesNotReject(async () => {
      assert.equal(await extractExifData(toArrayBuffer([0xff, 0xd8, 0xff, 0xe1]), 'image/jpeg'), null);
      assert.equal(await extractExifData(EMPTY_BUFFER, 'image/jpeg'), null);
    });
  });
});
