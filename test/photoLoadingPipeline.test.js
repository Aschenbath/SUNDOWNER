import assert from 'node:assert/strict';
import { MediaTile } from '../js/media-library/components.js';

describe('photo grid request budget', () => {
  const item = {
    id: 'telegram-photo', type: 'photo', label: 'photo.jpg',
    sourceUrl: '/file/photos/photo.jpg', thumbnailUrl: '/file/photos/photo.jpg',
    blurThumbUrl: '/file/photos/photo.jpg?preview=1',
    width: 4032, height: 3024, browserPreviewSupported: true,
  };
  function render(overrides = {}, loaded = false) {
    return MediaTile({
      item: { ...item, ...overrides }, selected: false,
      layout: { width: 320, height: 240 },
      state: {
        loadedMediaIds: new Set(loaded ? [item.id] : []),
        fullLoadedMediaIds: new Set(loaded ? [item.id] : []),
      },
    });
  }
  for (const loaded of [false, true]) {
    it(`keeps Telegram thumbnails without downloading originals (loaded=${loaded})`, () => {
      const html = render({}, loaded);
      assert.match(html, / src="\/file\/photos\/photo\.jpg\?preview=1"/);
      assert.match(html, /data-canonical-src="\/file\/photos\/photo\.jpg\?preview=1"/);
      assert.match(html, /data-original-src="\/file\/photos\/photo\.jpg"/);
      assert.doesNotMatch(html, /data-full-src=|is-blur-placeholder/);
    });
  }
  it('retains the original when no stored thumbnail exists', () => {
    assert.match(render({ blurThumbUrl: '' }), / src="\/file\/photos\/photo\.jpg"/);
  });
  it('does not leave tiny inline placeholders as the final grid image', () => {
    assert.match(render({ blurThumbUrl: 'data:image/jpeg;base64,dGlueQ==' }), /data-full-src="\/file\/photos\/photo\.jpg"/);
  });

  for (const attempt of [0, 2, 3]) {
    it(`suspends failed tiles across rerenders and preserves retry count ${attempt}`, () => {
      const html = MediaTile({
        item, selected: true, layout: { width: 320, height: 240 },
        state: {
          loadedMediaIds: new Set([item.id]), fullLoadedMediaIds: new Set([item.id]),
          failedMediaIds: new Set([item.id]), imageRetryAttempts: new Map([[item.id, attempt]]),
        },
      });
      assert.match(html, /has-load-error/);
      assert.match(html, /data-load-suspended="1"/);
      assert.match(html, new RegExp(`data-retry-attempt="${attempt}"`));
      assert.match(html, /data-canonical-src="\/file\/photos\/photo\.jpg\?preview=1"/);
      assert.match(html, /data-original-src="\/file\/photos\/photo\.jpg"/);
      assert.doesNotMatch(html, /\ssrc=|\ssrcset=|is-img-loaded|is-full-loaded/);
      if (attempt === 3) assert.match(html, /is-retry-exhausted/);
    });
  }

  it('preserves the HEIC decoder retry target without automatically reloading it', () => {
    const html = MediaTile({
      item: { ...item, sourceUrl: '/file/photo.heic', thumbnailUrl: '/file/photo.heic?preview=1', browserPreviewSupported: false },
      selected: false, layout: { width: 320, height: 240 },
      state: { failedMediaIds: new Set([item.id]), imageRetryAttempts: new Map([[item.id, 1]]) },
    });
    assert.match(html, /data-heic-tile-decode-src="\/file\/photo\.heic"/);
    assert.match(html, /data-heic-tile-decode-status="error"/);
    assert.doesNotMatch(html, /\ssrc=|onerror=/);
  });
});
