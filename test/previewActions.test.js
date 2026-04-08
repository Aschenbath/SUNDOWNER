import assert from 'node:assert/strict';

import { PreviewModal, TopSearchBar } from '../js/media-library/components.js';

describe('media library download actions', () => {
  it('renders a selection download action without replacing delete/add-to-album controls', () => {
    const html = TopSearchBar({
      state: {
        selectedIds: new Set(['managed-1']),
        searchQuery: '',
        primaryFilter: 'Photos',
        activeAlbumName: '',
        albumSelectionTarget: '',
      },
      canDeleteSelection: true,
      canDownloadSelection: true,
      canSetAlbumCover: false,
    });

    assert.match(html, /data-action="open-add-to-album"/);
    assert.match(html, /data-action="download-selected"/);
    assert.match(html, /data-action="delete-selected"/);
  });

  it('keeps preview header limited to four primary actions and exposes download in the footer', () => {
    const html = PreviewModal({
      item: {
        id: 'managed-1',
        type: 'photo',
        label: 'photo_27.jpg',
        sourceId: 'photos/2026/photo_27.jpg',
        sourceUrl: '/file/photos/2026/photo_27.jpg',
        thumbnailUrl: '/file/photos/2026/photo_27.jpg',
        width: 1080,
        height: 1440,
        displayTakenAt: 'April 5, 2026 08:25',
        mimeType: 'image/jpeg',
        location: 'Guangzhou',
        album: 'Library',
        sizeMb: 0.21,
        exif: null,
      },
      selected: false,
      favorited: false,
      currentIndex: 0,
      totalCount: 5,
      infoOpen: false,
      immersive: false,
    });

    assert.equal((html.match(/class="cml-preview__icon-action/g) || []).length, 4);
    assert.match(html, /data-action="download-preview"/);
    assert.match(html, /Download original/);
    assert.match(html, /class="cml-preview__main"/);
    assert.match(html, /class="cml-preview__info /);
  });

  it('hides default source albums and library path from preview details', () => {
    const html = PreviewModal({
      item: {
        id: 'managed-2',
        type: 'photo',
        label: 'photo_21.jpg',
        sourceId: 'tg_Telegram_env_21_AQAD5AxrG5dFgVZ8.jpg',
        sourceUrl: '/file/tg_Telegram_env_21_AQAD5AxrG5dFgVZ8.jpg',
        thumbnailUrl: '/file/tg_Telegram_env_21_AQAD5AxrG5dFgVZ8.jpg',
        width: 1920,
        height: 2560,
        displayTakenAt: 'April 4, 2026 19:35',
        mimeType: 'image/jpeg',
        album: 'Telegram_env',
        collectionAlbum: 'Telegram_env',
        sizeMb: 0.79,
        exif: null,
        tags: ['photo'],
      },
      selected: false,
      favorited: false,
      currentIndex: 11,
      totalCount: 19,
      infoOpen: true,
      immersive: false,
    });

    assert.doesNotMatch(html, /<dt class="cml-preview__info-label">Album<\/dt>/);
    assert.doesNotMatch(html, /Library path/);
    assert.doesNotMatch(html, />Telegram_env</);
    assert.doesNotMatch(html, /Telegram_env · 0\.79 MB/);
    assert.match(html, /0\.79 MB/);
  });

  it('keeps explicit collection albums visible in preview details', () => {
    const html = PreviewModal({
      item: {
        id: 'managed-3',
        type: 'photo',
        label: 'pond.jpg',
        sourceId: 'Telegram_env/scenery/pond.jpg',
        sourceUrl: '/file/Telegram_env/scenery/pond.jpg',
        thumbnailUrl: '/file/Telegram_env/scenery/pond.jpg',
        width: 1920,
        height: 2560,
        displayTakenAt: 'April 4, 2026 19:35',
        mimeType: 'image/jpeg',
        album: 'Telegram_env',
        collectionAlbum: 'scenery',
        sizeMb: 0.79,
        exif: null,
        tags: ['photo'],
      },
      selected: false,
      favorited: false,
      currentIndex: 0,
      totalCount: 1,
      infoOpen: true,
      immersive: false,
    });

    assert.match(html, /<dt class="cml-preview__info-label">Album<\/dt>/);
    assert.match(html, /scenery/);
    assert.doesNotMatch(html, /Library path/);
  });
});
