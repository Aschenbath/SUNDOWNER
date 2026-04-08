import assert from 'node:assert/strict';

import exifr from 'exifr';

let inferTelegramFileType;
let readTelegramImageMetadata;

describe('telegramSync metadata helpers', () => {
  const originalParse = exifr.parse;

  before(async () => {
    ({ inferTelegramFileType, readTelegramImageMetadata } = await import('../functions/utils/telegramImportedMedia.js'));
  });

  afterEach(() => {
    exifr.parse = originalParse;
  });

  it('falls back to HEIC mime type when Telegram document metadata omits it', () => {
    const mimeType = inferTelegramFileType('document', {
      file_name: 'IMG_2038.HEIC',
      mime_type: '',
    }, 'photos/file_18.heic');

    assert.equal(mimeType, 'image/heic');
  });

  it('extracts EXIF metadata from Telegram image headers when available', async () => {
    exifr.parse = async (buffer) => {
      assert.equal(buffer.byteLength, 4);
      return {
        DateTimeOriginal: new Date('2026-04-08T13:10:00.000Z'),
        GPSLatitude: 23.1291,
        GPSLongitude: 113.2644,
      };
    };

    const fakeTelegramApi = {
      async getFileHeaderByPath(filePath, maxBytes) {
        assert.equal(filePath, 'photos/file_18.heic');
        assert.equal(maxBytes, 65536);
        return new Uint8Array([0x00, 0x00, 0x00, 0x18]).buffer;
      },
    };

    const result = await readTelegramImageMetadata(fakeTelegramApi, 'photos/file_18.heic', 'image/heic');

    assert.equal(typeof result, 'object');
    assert.deepEqual(result.exifData, {
      dateTime: '2026-04-08T13:10:00.000Z',
      gps: {
        latitude: 23.1291,
        longitude: 113.2644,
      },
    });
  });
});
