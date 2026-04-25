import assert from 'node:assert/strict';

import { PREVIEW_PANEL_SECTION_SELECTORS } from '../js/media-library/preview-overlay.js';
import { PreviewModal } from '../js/media-library/components.js';

describe('preview overlay sync selectors', () => {
  it('keeps the add-to-album side panel in preview transient sync', () => {
    assert.deepEqual(PREVIEW_PANEL_SECTION_SELECTORS, [
      '.cml-preview__main',
      '.cml-preview__info',
      '.cml-preview__album-panel'
    ]);
  });

  it('renders album panel with is-open when albumDrawerOpen is true', () => {
    const html = PreviewModal({
      item: {
        id: 'test-1',
        type: 'photo',
        label: 'test.jpg',
        sourceId: 'photos/test.jpg',
        sourceUrl: '/file/photos/test.jpg',
        thumbnailUrl: '/file/photos/test.jpg',
        width: 1080,
        height: 1440,
        displayTakenAt: 'April 5, 2026 08:25',
        mimeType: 'image/jpeg',
        sizeMb: 0.5,
        exif: null,
      },
      selected: true,
      favorited: false,
      currentIndex: 0,
      totalCount: 1,
      infoOpen: false,
      immersive: false,
      albumDrawerOpen: true,
      albumEntries: [],
      albumDraftName: '',
      albumDialogError: '',
      albumDrawerSearch: '',
      albumDrawerCreateMode: false,
    });

    assert.match(html, /cml-preview__album-panel is-open/);
    assert.match(html, /has-album/);
    assert.doesNotMatch(html, /has-info/);
  });

  it('keeps preview info and album drawer mutually exclusive in rendered state', () => {
    const html = PreviewModal({
      item: {
        id: 'test-3',
        type: 'photo',
        label: 'test.jpg',
        sourceId: 'photos/test.jpg',
        sourceUrl: '/file/photos/test.jpg',
        thumbnailUrl: '/file/photos/test.jpg',
        width: 1080,
        height: 1440,
        displayTakenAt: 'April 5, 2026 08:25',
        mimeType: 'image/jpeg',
        sizeMb: 0.5,
        exif: null,
      },
      selected: false,
      favorited: false,
      currentIndex: 0,
      totalCount: 1,
      infoOpen: true,
      immersive: false,
      albumDrawerOpen: false,
      albumEntries: [],
    });

    assert.match(html, /cml-preview__header-meta/);
    assert.match(html, /cml-preview__header-count/);
    assert.match(html, /cml-preview__icon-action cml-preview__icon-action--info is-selected/);
    assert.doesNotMatch(html, /cml-preview__icon-action cml-preview__icon-action--album is-selected/);
  });

});
