import assert from 'node:assert/strict';

import {
  convertImageBodyToBrowserPreview,
  isBrowserPreviewConvertibleImage,
  readBinaryBody,
  wantsBrowserPreview,
} from '../functions/utils/filePreview.js';

describe('file preview helpers', () => {
  it('flags HEIC and HEIF images for browser preview conversion', () => {
    assert.equal(isBrowserPreviewConvertibleImage('image/heic'), true);
    assert.equal(isBrowserPreviewConvertibleImage('image/heif'), true);
    assert.equal(isBrowserPreviewConvertibleImage('image/jpeg'), false);
  });

  it('requires an explicit preview query and a non-range GET request', () => {
    const previewRequest = new Request('http://localhost/file/photo.HEIC?preview=1');
    const previewUrl = new URL(previewRequest.url);
    assert.equal(wantsBrowserPreview(previewRequest, previewUrl, 'image/heic'), true);

    const rangeRequest = new Request('http://localhost/file/photo.HEIC?preview=1', {
      headers: { Range: 'bytes=0-127' },
    });
    assert.equal(wantsBrowserPreview(rangeRequest, new URL(rangeRequest.url), 'image/heic'), false);

    const plainRequest = new Request('http://localhost/file/photo.HEIC');
    assert.equal(wantsBrowserPreview(plainRequest, new URL(plainRequest.url), 'image/heic'), false);
  });

  it('normalizes binary bodies into Uint8Array', async () => {
    const sample = new Uint8Array([1, 2, 3, 4]);
    assert.deepEqual(await readBinaryBody(sample), sample);
    assert.deepEqual(await readBinaryBody(sample.buffer), sample);
    assert.deepEqual(await readBinaryBody(new Response(sample)), sample);
  });

  it('converts an image buffer into a browser-preview webp payload', async () => {
    const pngPixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2m5QAAAABJRU5ErkJggg==',
      'base64',
    );

    const preview = await convertImageBodyToBrowserPreview(pngPixel);

    assert.ok(preview.byteLength > 0);
    assert.equal(preview[0], 0x52);
    assert.equal(preview[1], 0x49);
    assert.equal(preview[2], 0x46);
    assert.equal(preview[3], 0x46);
  });
});
