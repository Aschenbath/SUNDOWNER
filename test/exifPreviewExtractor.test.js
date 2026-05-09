import assert from 'node:assert/strict';

import {
  __resetEmbeddedThumbnailExtractorForTests,
  __setEmbeddedThumbnailExtractorForTests,
  __setEmbeddedThumbnailModuleLoaderForTests,
  extractEmbeddedPreview,
  supportsEmbeddedPreviewExtraction,
} from '../functions/upload/exifExtractor.js';

describe('embedded HEIC preview extraction', () => {
  afterEach(() => {
    __resetEmbeddedThumbnailExtractorForTests();
  });

  it('only enables embedded preview extraction for HEIC and HEIF', () => {
    assert.equal(supportsEmbeddedPreviewExtraction('image/heic'), true);
    assert.equal(supportsEmbeddedPreviewExtraction('image/heif'), true);
    assert.equal(supportsEmbeddedPreviewExtraction('image/jpeg'), false);
  });

  it('returns extracted preview bytes with a detected mime type', async () => {
    __setEmbeddedThumbnailExtractorForTests(async () => new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9]));

    const preview = await extractEmbeddedPreview(new Uint8Array([0x00, 0x01, 0x02]), 'image/heic');

    assert.ok(preview);
    assert.equal(preview.mimeType, 'image/jpeg');
    assert.deepEqual(Array.from(preview.bytes), [0xFF, 0xD8, 0xFF, 0xD9]);
  });

  it('lazy-loads the runtime thumbnail extractor when no test stub is set', async () => {
    let loads = 0;
    __setEmbeddedThumbnailModuleLoaderForTests(async () => {
      loads += 1;
      return {
        default: {
          thumbnail: async () => new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
        },
      };
    });

    const preview = await extractEmbeddedPreview(new Uint8Array([0x00, 0x01, 0x02]), 'image/heif');

    assert.ok(preview);
    assert.equal(preview.mimeType, 'image/png');
    assert.equal(loads, 1);
  });

  it('returns null without calling the extractor for unsupported mime types', async () => {
    let called = false;
    __setEmbeddedThumbnailExtractorForTests(async () => {
      called = true;
      return new Uint8Array([0xFF, 0xD8, 0xFF]);
    });

    const preview = await extractEmbeddedPreview(new Uint8Array([0x00]), 'image/jpeg');

    assert.equal(preview, null);
    assert.equal(called, false);
  });

  it('does not retry the module loader after a missing runtime thumbnail export', async () => {
    let loads = 0;
    __setEmbeddedThumbnailModuleLoaderForTests(async () => {
      loads += 1;
      return { default: {} };
    });

    const firstPreview = await extractEmbeddedPreview(new Uint8Array([0x00]), 'image/heic');
    const secondPreview = await extractEmbeddedPreview(new Uint8Array([0x01]), 'image/heic');

    assert.equal(firstPreview, null);
    assert.equal(secondPreview, null);
    assert.equal(loads, 1);
  });
});
