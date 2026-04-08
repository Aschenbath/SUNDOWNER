import assert from 'node:assert/strict';

import exifr from 'exifr';

import { extractExifData } from '../functions/upload/exifExtractor.js';

function toArrayBuffer(bytes) {
  const view = Uint8Array.from(bytes);
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

const JPEG_BUFFER = toArrayBuffer([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x18, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
const PNG_BUFFER = toArrayBuffer([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const EMPTY_BUFFER = new ArrayBuffer(0);

describe('extractExifData', () => {
  const originalParse = exifr.parse;

  afterEach(() => {
    exifr.parse = originalParse;
  });

  it('maps parsed JPEG EXIF into the persisted metadata shape', async () => {
    exifr.parse = async (buffer) => {
      assert.equal(buffer.byteLength, JPEG_BUFFER.byteLength);
      return {
        DateTimeOriginal: new Date('2026-04-06T10:41:00.000Z'),
        Make: 'Canon',
        Model: 'EOS R6',
        LensModel: 'RF24-70mm F2.8 L IS USM',
        FNumber: 2.8,
        ExposureTime: 0.008,
        ISO: 250,
        FocalLength: 35,
        GPSLatitude: 23.1291,
        GPSLongitude: 113.2644,
        GPSAltitude: 18.7,
        Orientation: 1,
      };
    };

    const result = await extractExifData(JPEG_BUFFER, 'image/jpeg');

    assert.deepEqual(result, {
      dateTime: '2026-04-06T10:41:00.000Z',
      camera: {
        make: 'Canon',
        model: 'EOS R6',
        lens: 'RF24-70mm F2.8 L IS USM',
      },
      gps: {
        latitude: 23.1291,
        longitude: 113.2644,
        altitude: 19,
      },
      shooting: {
        fNumber: 2.8,
        exposureTime: '1/125',
        iso: 250,
        focalLength: 35,
      },
      orientation: 1,
    });
  });

  it('returns null for supported image formats when no EXIF data is present', async () => {
    let parseCalls = 0;
    exifr.parse = async () => {
      parseCalls += 1;
      return null;
    };

    const pngResult = await extractExifData(PNG_BUFFER, 'image/png');

    assert.equal(pngResult, null);
    assert.equal(parseCalls, 1);
  });

  it('returns null for unsupported formats without invoking the EXIF parser', async () => {
    let parseCalls = 0;
    exifr.parse = async () => {
      parseCalls += 1;
      return { DateTimeOriginal: new Date('2026-04-06T10:41:00.000Z') };
    };

    const gifResult = await extractExifData(PNG_BUFFER, 'image/gif');

    assert.equal(gifResult, null);
    assert.equal(parseCalls, 0);
  });

  it('swallows parser failures and empty buffers by returning null', async () => {
    exifr.parse = async (buffer) => {
      if (!buffer.byteLength) {
        throw new Error('empty buffer');
      }
      throw new Error('corrupt image');
    };

    await assert.doesNotReject(async () => {
      assert.equal(await extractExifData(JPEG_BUFFER, 'image/jpeg'), null);
      assert.equal(await extractExifData(EMPTY_BUFFER, 'image/jpeg'), null);
    });
  });
});
