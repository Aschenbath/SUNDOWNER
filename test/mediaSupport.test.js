import assert from 'node:assert/strict';

import { shouldDisplayMediaItem, supportsBrowserImagePreview } from '../js/media-library/media-support.js';

describe('media support helpers', () => {
  it('treats HEIC and HEIF images as browser-unsupported previews', () => {
    assert.equal(supportsBrowserImagePreview('image/heic'), false);
    assert.equal(supportsBrowserImagePreview('image/heif'), false);
    assert.equal(supportsBrowserImagePreview('image/jpeg'), true);
  });

  it('keeps HEIC items visible even when the browser cannot render the original file', () => {
    assert.equal(shouldDisplayMediaItem({
      type: 'photo',
      mimeType: 'image/heic',
      browserPreviewSupported: false,
    }), true);

    assert.equal(shouldDisplayMediaItem({
      type: 'photo',
      mimeType: 'image/jpeg',
      browserPreviewSupported: true,
    }), true);

    assert.equal(shouldDisplayMediaItem({
      type: 'video',
      mimeType: 'video/mp4',
    }), true);
  });
});
