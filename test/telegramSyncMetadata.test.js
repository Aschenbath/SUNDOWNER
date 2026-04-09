import assert from 'node:assert/strict';

import exifr from 'exifr';

let inferTelegramFileType;
let buildTelegramImportMetadataHints;
let buildTelegramThumbnailMetadata;
let readTelegramImageMetadata;

describe('telegramSync metadata helpers', () => {
  const originalParse = exifr.parse;

  before(async () => {
    ({
      inferTelegramFileType,
      buildTelegramImportMetadataHints,
      buildTelegramThumbnailMetadata,
      readTelegramImageMetadata
    } = await import('../functions/utils/telegramImportedMedia.js'));
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

  it('marks Telegram photo imports as processed variants with weak EXIF retention', () => {
    const hints = buildTelegramImportMetadataHints('photo', {
      file_name: 'IMG_1001.JPG',
      mime_type: '',
    }, 'photos/file_18.jpg');

    assert.deepEqual(hints, {
      TgMediaKind: 'photo',
      TgPreservationHint: 'telegram-photo-variant',
      TgExifRetentionHint: 'unlikely-retained',
    });
  });

  it('marks Telegram document image imports as likely original with likely EXIF retention', () => {
    const hints = buildTelegramImportMetadataHints('document', {
      file_name: 'IMG_2038.HEIC',
      mime_type: '',
    }, 'photos/file_18.heic');

    assert.deepEqual(hints, {
      TgMediaKind: 'document',
      TgPreservationHint: 'original-likely',
      TgExifRetentionHint: 'likely-retained',
    });
  });

  it('stores Telegram thumbnail metadata when a document thumbnail is present', () => {
    const hints = buildTelegramThumbnailMetadata({
      file_name: 'IMG_2038.HEIC',
      thumbnail: {
        file_id: 'thumb-file-id',
        file_unique_id: 'thumb-unique-id',
        width: 320,
        height: 240,
        file_size: 12345,
      },
    });

    assert.deepEqual(hints, {
      TgThumbnailFileId: 'thumb-file-id',
      TgThumbnailFileType: 'image/jpeg',
      TgThumbnailFileUniqueId: 'thumb-unique-id',
      TgThumbnailWidth: 320,
      TgThumbnailHeight: 240,
      TgThumbnailFileSize: 12345,
    });
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
