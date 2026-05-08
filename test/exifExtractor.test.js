import assert from 'node:assert/strict';

import { extractExifData } from '../functions/upload/exifExtractor.js';

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

const JPEG_BUFFER = buildExifJpegBuffer();
const JPEG_CREATE_DATE_ONLY_BUFFER = buildExifJpegBuffer('2024:07:12 10:11:12');
const PNG_BUFFER = toArrayBuffer([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const EMPTY_BUFFER = new ArrayBuffer(0);

describe('extractExifData', () => {
  it('extracts JPEG EXIF DateTimeOriginal into persisted metadata shape', async () => {
    const result = await extractExifData(JPEG_BUFFER, 'image/jpeg');

    assert.deepEqual(result, {
      dateTime: '2026-04-06T10:41:00.000Z',
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
