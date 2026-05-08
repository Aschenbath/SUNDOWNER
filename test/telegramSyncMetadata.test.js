import assert from 'node:assert/strict';

let inferTelegramFileType;
let buildTelegramImportMetadataHints;
let buildTelegramThumbnailMetadata;
let readTelegramImageMetadata;

function toArrayBuffer(bytes) {
  const view = Uint8Array.from(bytes);
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

function buildExifJpegBuffer(dateTime = '2026:04:08 13:10:00') {
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

describe('telegramSync metadata helpers', () => {
  before(async () => {
    ({
      inferTelegramFileType,
      buildTelegramImportMetadataHints,
      buildTelegramThumbnailMetadata,
      readTelegramImageMetadata
    } = await import('../functions/utils/telegramImportedMedia.js'));
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

  it('extracts EXIF date metadata from Telegram image headers when available', async () => {
    const fakeTelegramApi = {
      async getFileHeaderByPath(filePath, maxBytes) {
        assert.equal(filePath, 'photos/file_18.jpg');
        assert.equal(maxBytes, 65536);
        return buildExifJpegBuffer();
      },
    };

    const result = await readTelegramImageMetadata(fakeTelegramApi, 'photos/file_18.jpg', 'image/jpeg');

    assert.equal(typeof result, 'object');
    assert.deepEqual(result.exifData, {
      dateTime: '2026-04-08T13:10:00.000Z',
    });
  });
});
