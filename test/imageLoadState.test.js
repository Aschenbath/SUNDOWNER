import assert from 'node:assert/strict';

describe('media image load state', () => {
  let buildImageRetryUrl;
  let canRetryImage;
  let getNextImageSource;

  before(async () => {
    ({
      buildImageRetryUrl,
      canRetryImage,
      getNextImageSource,
    } = await import('../js/media-library/image-load-state.js'));
  });

  it('replaces stale retry tokens while preserving unrelated query parameters', () => {
    assert.equal(
      buildImageRetryUrl('/file/photos/example.jpg?quality=80&retry=old', 2, 'https://gallery.example'),
      'https://gallery.example/file/photos/example.jpg?quality=80&retry=2',
    );
  });

  it('accepts rendered http image URLs and rejects executable protocols', () => {
    assert.equal(
      buildImageRetryUrl('https://cdn.example/photo.jpg', 1, 'https://gallery.example'),
      'https://cdn.example/photo.jpg?retry=1',
    );
    assert.equal(buildImageRetryUrl('javascript:alert(1)', 1, 'https://gallery.example'), '');
    assert.equal(buildImageRetryUrl('data:text/html,broken', 1, 'https://gallery.example'), '');
  });

  it('tries an unused original source before retrying the canonical source', () => {
    assert.deepEqual(getNextImageSource({
      canonicalSrc: '/file/thumb.jpg',
      originalSrc: '/file/original.jpg',
      triedOriginal: '',
    }), {
      source: '/file/original.jpg',
      usesOriginal: true,
    });

    assert.deepEqual(getNextImageSource({
      canonicalSrc: '/file/thumb.jpg',
      originalSrc: '/file/original.jpg',
      triedOriginal: '1',
    }), {
      source: '/file/thumb.jpg',
      usesOriginal: false,
    });
  });

  it('bounds manual retries and rejects invalid attempts', () => {
    assert.equal(canRetryImage(0, 3), true);
    assert.equal(canRetryImage(2, 3), true);
    assert.equal(canRetryImage(3, 3), false);
    assert.equal(canRetryImage(-1, 3), false);
    assert.equal(canRetryImage(Number.NaN, 3), false);
  });
});
