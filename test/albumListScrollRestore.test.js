import assert from 'node:assert/strict';
import { resolveAlbumListScrollY } from '../js/media-library/preview-overlay.js';

describe('album list scroll restore', () => {
  it('returns 0 when no saved value', () => {
    assert.equal(resolveAlbumListScrollY({}), 0);
    assert.equal(resolveAlbumListScrollY({ savedAlbumListScrollY: undefined }), 0);
  });

  it('returns the saved value when present and non-negative', () => {
    assert.equal(resolveAlbumListScrollY({ savedAlbumListScrollY: 420 }), 420);
    assert.equal(resolveAlbumListScrollY({ savedAlbumListScrollY: 0 }), 0);
  });

  it('clamps negative to 0', () => {
    assert.equal(resolveAlbumListScrollY({ savedAlbumListScrollY: -5 }), 0);
  });

  it('clamps non-numeric to 0', () => {
    assert.equal(resolveAlbumListScrollY({ savedAlbumListScrollY: 'banana' }), 0);
    assert.equal(resolveAlbumListScrollY({ savedAlbumListScrollY: NaN }), 0);
  });
});
