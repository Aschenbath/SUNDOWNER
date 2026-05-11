import assert from 'node:assert/strict';

import {
  buildPickerPreserveFlags,
  canUseDistinctAlbumPicker,
  getAlbumSelectionTarget,
  getVideoAlbumSelectionTarget,
  hasAnyPickerTarget,
  isPhotosRouteReplay,
  resetAddToTargetModes,
} from '../js/media-library/picker-state.js';

describe('picker state helpers', () => {
  it('resets all picker target and mode fields by default', () => {
    const state = {
      albumSelectionTarget: 'album-a',
      videoAlbumSelectionTarget: 'Travel',
      privateSelectionMode: true,
      albumPickerDistinctOnly: true,
    };

    resetAddToTargetModes(state);

    assert.equal(state.albumSelectionTarget, '');
    assert.equal(state.videoAlbumSelectionTarget, '');
    assert.equal(state.privateSelectionMode, false);
    assert.equal(state.albumPickerDistinctOnly, false);
  });

  it('preserve flags keep only the requested picker fields', () => {
    const state = {
      albumSelectionTarget: 'album-a',
      videoAlbumSelectionTarget: 'Travel',
      privateSelectionMode: true,
      albumPickerDistinctOnly: true,
    };

    resetAddToTargetModes(state, {
      preserveAlbumSelectionTarget: true,
      preserveVideoAlbumSelectionTarget: true,
      preservePrivateSelectionMode: true,
      preserveAlbumPickerDistinctOnly: true,
    });

    assert.equal(state.albumSelectionTarget, 'album-a');
    assert.equal(state.videoAlbumSelectionTarget, 'Travel');
    assert.equal(state.privateSelectionMode, true);
    assert.equal(state.albumPickerDistinctOnly, true);
  });

  it('detects whether any picker target is active', () => {
    assert.equal(hasAnyPickerTarget({}), false);
    assert.equal(hasAnyPickerTarget({ albumSelectionTarget: 'album-a' }), true);
    assert.equal(hasAnyPickerTarget({ videoAlbumSelectionTarget: 'Travel' }), true);
    assert.equal(hasAnyPickerTarget({ privateSelectionMode: true }), true);
  });

  it('normalizes album and video target getters', () => {
    assert.equal(getAlbumSelectionTarget({ albumSelectionTarget: '  album-a  ' }), 'album-a');
    assert.equal(getVideoAlbumSelectionTarget({ videoAlbumSelectionTarget: '  Travel  ' }), 'Travel');
  });

  it('trims overlong video album targets before picker checks use them', () => {
    const longTarget = '  ' + 'Road Trip '.repeat(8) + '  ';
    const normalized = getVideoAlbumSelectionTarget({ videoAlbumSelectionTarget: longTarget });

    assert.equal(normalized.length, 48);
    assert.equal(normalized, 'Road Trip Road Trip Road Trip Road Trip Road Tri');
    assert.equal(hasAnyPickerTarget({ videoAlbumSelectionTarget: longTarget }), true);
    assert.equal(canUseDistinctAlbumPicker({
      albumSelectionTarget: 'album-a',
      videoAlbumSelectionTarget: longTarget,
    }), false);
  });

  it('detects photos route replay correctly', () => {
    assert.equal(isPhotosRouteReplay('photos'), true);
    assert.equal(isPhotosRouteReplay('photos/private'), true);
    assert.equal(isPhotosRouteReplay('photos/anything'), true);
    assert.equal(isPhotosRouteReplay('albums/scenery'), false);
    assert.equal(isPhotosRouteReplay('videos/travel'), false);
    assert.equal(isPhotosRouteReplay('PHOTOS/private'), true);
    assert.equal(isPhotosRouteReplay(''), true);
  });

  it('builds preserve flags only for photos route replay with existing picker state', () => {
    const state = {
      albumSelectionTarget: 'album-a',
      videoAlbumSelectionTarget: 'Travel',
      privateSelectionMode: true,
      albumPickerDistinctOnly: true,
    };

    assert.deepEqual(buildPickerPreserveFlags(state, 'photos'), {
      preserveAlbumSelectionTarget: true,
      preserveVideoAlbumSelectionTarget: true,
      preservePrivateSelectionMode: true,
      preserveAlbumPickerDistinctOnly: true,
    });

    assert.deepEqual(buildPickerPreserveFlags(state, 'albums/scenery'), {
      preserveAlbumSelectionTarget: false,
      preserveVideoAlbumSelectionTarget: false,
      preservePrivateSelectionMode: false,
      preserveAlbumPickerDistinctOnly: false,
    });
  });

  it('allows distinct picker mode only for album-target picker state', () => {
    assert.equal(canUseDistinctAlbumPicker({ albumSelectionTarget: 'album-a' }), true);
    assert.equal(canUseDistinctAlbumPicker({ albumSelectionTarget: 'album-a', videoAlbumSelectionTarget: 'Travel' }), false);
    assert.equal(canUseDistinctAlbumPicker({ albumSelectionTarget: 'album-a', privateSelectionMode: true }), false);
    assert.equal(canUseDistinctAlbumPicker({ videoAlbumSelectionTarget: 'Travel' }), false);
  });
});
