import assert from 'node:assert/strict';
import fs from 'node:fs';

import { AudioPlayerPanel, BinGrid, CollectionGrid, CollectionSummary, DocumentsListView, MediaTile, MindChatView, MobileAudioMiniPlayer, MobileBottomNav, MusicListView, MusicSummary, PreviewModal, PrivateAlbumGate, PrivateAlbumSummary, SearchResultsView, Sidebar, SidebarAudioPlayer, StorageCard, StorageTrigger, TopSearchBar, VideoAlbumGrid, VideoAlbumSummary, VideoCategoryBar } from '../js/media-library/components.js';

describe('media library download actions', () => {
  it('keeps the sidebar brand as a SUNDOWNER wordmark instead of rendering the uploaded image there', () => {
    const html = Sidebar({
      navigationModel: {
        primary: ['Photos', 'Collections', 'Music', 'Mind', 'Private', 'Bin'],
        secondary: ['TODO', 'Videos', 'Documents', 'Favourites']
      },
      state: {
        primaryFilter: 'Photos',
        secondaryFilter: '',
        privateViewOpen: false,
        mindSettings: { contactName: 'Mind' },
      },
      storageSummary: null,
    });

    assert.match(html, /class="cml-sidebar__brand-name"[^>]*>SUNDOWNER</);
    assert.doesNotMatch(html, /cml-sidebar__brand-logo/);
    assert.match(html, /cml-sidebar__section cml-sidebar__section--primary/);
    assert.match(html, /cml-sidebar__section cml-sidebar__section--secondary/);
  });

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
    assert.doesNotMatch(html, /data-action="toggle-private-selection"/);
    assert.match(html, /data-action="download-selected"/);
    assert.match(html, /data-action="delete-selected"/);
  });

  it('adds selection context and emphasis to album selection toolbar state', () => {
    const html = TopSearchBar({
      state: {
        selectedIds: new Set(['managed-1']),
        searchQuery: '',
        primaryFilter: 'Collections',
        secondaryFilter: '',
        activeAlbumName: 'scenery',
        albumSelectionTarget: '',
        videoAlbumSelectionTarget: '',
        privateSelectionMode: false,
      },
      canDeleteSelection: true,
      canDownloadSelection: true,
      canSetAlbumCover: true,
    });

    assert.match(html, /cml-topbar__selection-copy/);
    assert.match(html, /Album · scenery/);
    assert.match(html, /cml-topbar__secondary-button cml-topbar__secondary-button--emphasis/);
    assert.match(html, /data-action="set-album-cover"/);
  });

  it('only exposes remove-from-Private on the unlocked Private page', () => {
    const html = TopSearchBar({
      state: {
        selectedIds: new Set(['private-1']),
        searchQuery: '',
        primaryFilter: 'Photos',
        secondaryFilter: '',
        activeAlbumName: '',
        albumSelectionTarget: '',
        privateViewOpen: true,
        privateRouteUnlocked: true,
      },
      canDeleteSelection: true,
      canDownloadSelection: true,
      canSetAlbumCover: false,
    });

    assert.match(html, /data-action="toggle-private-selection"/);
    assert.match(html, /Remove from Private/);
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
        takenAt: '2026-04-05T00:25:00.000Z',
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

    assert.ok((html.match(/class="cml-preview__icon-action/g) || []).length >= 6);
    assert.match(html, /data-action="download-preview"/);
    assert.match(html, /Download original/);
    assert.match(html, />Download<\/span>/);
    assert.match(html, /class="cml-preview__main"/);
    assert.match(html, /class="cml-preview__info /);
    assert.match(html, /Add a description/);
    assert.match(html, /Date &amp; time/);
    assert.match(html, /data-action="edit-capture-time"/);
    assert.match(html, /cml-preview__header-meta/);
    assert.match(html, /cml-preview__header-count/);
    assert.match(html, /cml-preview__header-label/);
    assert.match(html, /cml-preview__icon-action cml-preview__icon-action--album/);
    assert.match(html, /cml-preview__icon-action cml-preview__icon-action--info/);
    assert.doesNotMatch(html, /Hidden album/);
    assert.doesNotMatch(html, /data-action="toggle-private-photo"/);
    assert.match(html, /Details/);
    assert.doesNotMatch(html, /cml-preview__caption/);
  });

  it('renders Bin preview with restore and delete-forever actions only', () => {
    const html = PreviewModal({
      item: {
        id: 'bin-1',
        type: 'photo',
        label: 'deleted-photo.jpg',
        sourceId: 'deleted-photo.jpg',
        sourceUrl: '/file/deleted-photo.jpg',
        thumbnailUrl: '/file/deleted-photo.jpg',
        width: 1080,
        height: 1440,
        takenAt: '2026-04-25T08:25:00.000Z',
        displayTakenAt: 'April 25, 2026 16:25',
        mimeType: 'image/jpeg',
        sizeMb: 0.21,
      },
      selected: false,
      favorited: false,
      currentIndex: 0,
      totalCount: 3,
      isBinView: true,
      infoOpen: true,
      immersive: false,
    });

    assert.match(html, /data-action="restore-bin-preview"/);
    assert.match(html, /data-action="request-delete-bin-preview-permanently"/);
    assert.doesNotMatch(html, /data-action="open-preview-add-to-album"/);
    assert.doesNotMatch(html, /data-action="toggle-favorite"/);
    assert.doesNotMatch(html, /data-action="edit-capture-time"/);
    assert.doesNotMatch(html, /data-action="edit-tags"/);
  });

  it('marks favorited preview stars as pressed so the UI can render a filled active state', () => {
    const html = PreviewModal({
      item: {
        id: 'managed-fav-1',
        type: 'photo',
        label: 'IMG_0625.JPEG',
        sourceId: 'photos/2026/IMG_0625.JPEG',
        sourceUrl: '/file/photos/2026/IMG_0625.JPEG',
        thumbnailUrl: '/file/photos/2026/IMG_0625.JPEG',
        width: 1080,
        height: 1440,
        displayTakenAt: 'April 8, 2026 18:42',
        mimeType: 'image/jpeg',
      },
      selected: false,
      favorited: true,
      currentIndex: 1,
      totalCount: 5,
      infoOpen: false,
      immersive: false,
    });

    assert.match(html, /cml-preview__icon-action is-favorited/);
    assert.match(html, /aria-label="Remove from favourites"/);
    assert.match(html, /aria-pressed="true"/);
  });

  it('renders a dedicated editable category section for video previews', () => {
    const html = PreviewModal({
      item: {
        id: 'managed-video-1',
        type: 'video',
        label: 'travel.mp4',
        sourceId: 'videos/travel.mp4',
        sourceUrl: '/file/videos/travel.mp4',
        thumbnailUrl: '/file/videos/travel.mp4?preview=1',
        posterUrl: '/file/videos/travel.mp4?preview=1',
        width: 1920,
        height: 1080,
        displayTakenAt: 'April 13, 2026 21:00',
        takenAt: '2026-04-13T13:00:00.000Z',
        mimeType: 'video/mp4',
        videoCategory: 'Travel vlog',
        sizeMb: 12.3,
        exif: null,
      },
      selected: false,
      favorited: false,
      currentIndex: 0,
      totalCount: 1,
      infoOpen: true,
      immersive: false,
    });

    assert.match(html, /Video album/);
    assert.match(html, /Travel vlog/);
    assert.match(html, /data-action="edit-video-category"/);
    assert.match(html, /Click to switch video album/);
  });

  it('renders preview tags as an editable metadata section instead of passive chips only', () => {
    const html = PreviewModal({
      item: {
        id: 'managed-tags-1',
        type: 'photo',
        label: 'night-walk.jpg',
        sourceId: 'photos/night-walk.jpg',
        sourceUrl: '/file/photos/night-walk.jpg',
        thumbnailUrl: '/file/photos/night-walk.jpg',
        width: 1080,
        height: 1440,
        displayTakenAt: 'April 8, 2026 18:42',
        mimeType: 'image/jpeg',
        explicitTags: ['night', 'guangzhou'],
        tags: ['night', 'guangzhou'],
      },
      selected: false,
      favorited: false,
      currentIndex: 1,
      totalCount: 5,
      infoOpen: true,
      immersive: false,
    });

    assert.match(html, /cml-preview__info-section--tags/);
    assert.match(html, /data-action="edit-tags"/);
    assert.match(html, />night</);
    assert.match(html, /Click to edit tags for search and organization/);
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
    assert.doesNotMatch(html, /Overview/);
    assert.match(html, /0\.79 MB/);
    assert.match(html, /Backed up \(0\.79 MB\)/);
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

    assert.match(html, /Details/);
    assert.match(html, /scenery/);
    assert.doesNotMatch(html, /Library path/);
  });

  it('renders add-to-album as a preview side drawer with search and album summaries', () => {
    const html = PreviewModal({
      item: {
        id: 'managed-4',
        type: 'photo',
        label: 'photo_27.jpg',
        sourceId: 'photos/2026/photo_27.jpg',
        sourceUrl: '/file/photos/2026/photo_27.jpg',
        thumbnailUrl: '/file/photos/2026/photo_27.jpg',
        width: 1080,
        height: 1440,
        displayTakenAt: 'April 5, 2026 08:25',
        mimeType: 'image/jpeg',
        sizeMb: 0.21,
        exif: null,
      },
      selected: true,
      favorited: false,
      currentIndex: 0,
      totalCount: 5,
      infoOpen: false,
      immersive: false,
      albumDrawerOpen: true,
      albumEntries: [
        { name: 'scenery', itemCount: 12, coverUrl: '/file/scenery.jpg', scope: 'mine' },
        { name: 'travel', itemCount: 4, coverUrl: '/file/travel.jpg', scope: 'mine' }
      ],
      albumDraftName: '',
      albumDialogError: '',
      albumDrawerSearch: '',
      albumDrawerCreateMode: false
    });

    assert.match(html, /cml-preview__album-panel is-open/);
    assert.match(html, /Search albums/);
    assert.match(html, /Last modified/);
    assert.match(html, /New album/);
    assert.match(html, /12 items/);
    assert.match(html, /data-action="assign-album"/);
    assert.doesNotMatch(html, /class="cml-dialog__panel cml-album-dialog"/);
  });


  it('shows already-added state inside the preview album drawer entries', () => {
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
      },
      selected: true,
      favorited: false,
      currentIndex: 0,
      totalCount: 5,
      infoOpen: false,
      immersive: false,
      albumDrawerOpen: true,
      albumEntries: [
        { name: 'scenery', itemCount: 12, coverUrl: '', selected: true },
        { name: 'travel', itemCount: 3, coverUrl: '', selected: false }
      ],
      albumDraftName: '',
      albumDialogError: '',
      albumDrawerSearch: '',
      albumDrawerCreateMode: false,
    });

    assert.match(html, /cml-preview__album-entry is-selected/);
    assert.match(html, /Already added/);
    assert.match(html, /aria-pressed="true"/);
  });
  it('shows preview drawer create mode and validation state', () => {
    const html = PreviewModal({
      item: {
        id: 'managed-5',
        type: 'photo',
        label: 'photo_28.jpg',
        sourceId: 'photos/2026/photo_28.jpg',
        sourceUrl: '/file/photos/2026/photo_28.jpg',
        thumbnailUrl: '/file/photos/2026/photo_28.jpg',
        width: 1080,
        height: 1440,
        displayTakenAt: 'April 5, 2026 08:26',
        mimeType: 'image/jpeg',
        sizeMb: 0.22,
        exif: null,
      },
      selected: true,
      favorited: false,
      currentIndex: 1,
      totalCount: 5,
      infoOpen: false,
      immersive: false,
      albumDrawerOpen: true,
      albumEntries: [],
      albumDraftName: 'Weekend in Guangzhou',
      albumDialogError: 'Album name is required.',
      albumDrawerSearch: '',
      albumDrawerCreateMode: true
    });

    assert.match(html, /New album name/);
    assert.match(html, /Create and add/);
    assert.match(html, /Album name is required\./);
    assert.match(html, /No albums are available yet\./);
  });

  it('renders video album copy in selection and preview album drawers', () => {
    const topbarHtml = TopSearchBar({
      state: {
        selectedIds: new Set(['video-1']),
        searchQuery: '',
        primaryFilter: 'Photos',
        secondaryFilter: 'Videos',
        activeAlbumName: '',
        albumSelectionTarget: '',
        privateViewOpen: false
      },
      canDeleteSelection: true,
      canDownloadSelection: true,
      canSetAlbumCover: false,
    });
    const previewHtml = PreviewModal({
      item: {
        id: 'managed-video-2',
        type: 'video',
        label: 'travel.mp4',
        sourceId: 'videos/travel.mp4',
        sourceUrl: '/file/videos/travel.mp4',
        thumbnailUrl: '/file/videos/travel.mp4?preview=1',
        posterUrl: '/file/videos/travel.mp4?preview=1',
        width: 1920,
        height: 1080,
        mimeType: 'video/mp4'
      },
      selected: true,
      favorited: false,
      currentIndex: 0,
      totalCount: 1,
      albumDrawerOpen: true,
      albumEntries: [{ name: 'Travel vlog', itemCount: 3, coverUrl: '/file/travel.jpg', scope: 'mine' }],
      albumDialogTarget: 'video'
    });

    assert.match(topbarHtml, />Add to video album</);
    assert.match(previewHtml, /Add to video album/);
    assert.match(previewHtml, /Search video albums/);
    assert.match(previewHtml, /New video album/);
  });

  it('renders HEIC originals with a stable inline-preview fallback instead of a broken image tag', () => {
    const html = PreviewModal({
      item: {
        id: 'managed-6',
        type: 'photo',
        label: 'IMG_2038.HEIC',
        sourceId: 'telegram-import/Telegram_env/IMG_2038.HEIC',
        sourceUrl: '/file/telegram-import/Telegram_env/IMG_2038.HEIC',
        thumbnailUrl: '/file/telegram-import/Telegram_env/IMG_2038.HEIC?preview=1',
        width: 3024,
        height: 4032,
        displayTakenAt: 'April 8, 2026 21:10',
        mimeType: 'image/heic',
        sizeMb: 3.8,
        location: '23.1291掳N, 113.2644掳E',
        exif: {
          gps: {
            latitude: 23.1291,
            longitude: 113.2644,
          },
        },
        browserPreviewSupported: false,
      },
      selected: false,
      favorited: false,
      currentIndex: 0,
      totalCount: 1,
      infoOpen: true,
      immersive: false,
    });

    assert.match(html, /<img class="cml-preview__media"/);
    assert.match(html, /HEIC original/);
    assert.match(html, /onerror=/);
    assert.match(html, /23\.1291掳N, 113\.2644掳E/);
    assert.match(html, /Download original/);
  });

  it('renders HEIC tiles with the preview route instead of hiding them', () => {
    const html = MediaTile({
      item: {
        id: 'managed-heic-hidden',
        type: 'photo',
        label: 'IMG_2038.HEIC',
        sourceUrl: '/file/telegram-import/Telegram_env/IMG_2038.HEIC',
        thumbnailUrl: '/file/telegram-import/Telegram_env/IMG_2038.HEIC?preview=1',
        width: 3024,
        height: 4032,
        displayTakenAt: 'April 8, 2026 21:10',
        mimeType: 'image/heic',
        browserPreviewSupported: false,
      },
      selected: false,
      layout: { width: 220, height: 280 }
    });

    assert.match(html, /data-action="open-preview"/);
    assert.match(html, /IMG_2038\.HEIC\?preview=1/);
    assert.match(html, /<img class="cml-media-tile__image"/);
  });

  it('renders media tiles with a direct preview opener on the tile element', () => {
    const html = MediaTile({
      item: {
        id: 'managed-7',
        type: 'photo',
        label: 'pond.jpg',
        album: 'scenery',
        sourceUrl: '/file/scenery/pond.jpg',
        thumbnailUrl: '/file/scenery/pond.jpg',
        width: 1200,
        height: 900,
        displayTakenAt: 'April 8, 2026 21:42',
      },
      selected: false,
      layout: { width: 240, height: 180 }
    });

    assert.match(html, /data-action="open-preview"/);
    assert.match(html, /data-action="toggle-select"/);
  });

  it('renders remembered full-loaded tiles without falling back to blur placeholders again', () => {
    const html = MediaTile({
      item: {
        id: 'managed-7b',
        type: 'photo',
        label: 'river.jpg',
        sourceUrl: '/file/scenery/river.jpg',
        thumbnailUrl: '/file/scenery/river.jpg?preview=1',
        blurThumbUrl: '/file/scenery/river.jpg?preview=tiny',
        width: 1200,
        height: 900,
        displayTakenAt: 'April 8, 2026 21:42',
      },
      selected: false,
      layout: { width: 240, height: 180 },
      state: {
        loadedMediaIds: new Set(['managed-7b']),
        fullLoadedMediaIds: new Set(['managed-7b'])
      }
    });

    assert.match(html, /class="cml-media-tile is-img-loaded is-full-loaded"/);
    assert.match(html, /src="\/file\/scenery\/river\.jpg\?preview=1"/);
    assert.doesNotMatch(html, /is-blur-placeholder/);
    assert.doesNotMatch(html, /data-full-src=/);
  });

  it('keeps collection cards on date-only metadata, uses clickable album titles, and omits the cover summary line', () => {
    const summaryHtml = CollectionSummary({
      activeAlbumName: 'scenery',
      collectionCount: 3,
      itemCount: 12,
      coverLabel: 'IMG_0626.JPEG',
      hasCustomCover: true,
    });
    const gridHtml = CollectionGrid({
      collections: [{
        name: 'scenery',
        itemCount: 12,
        createdAt: '2026-04-07T19:35:00+08:00',
        lastModifiedAt: Date.parse('2026-04-09T08:00:00+08:00'),
        coverItem: null,
        hasCustomCover: false,
      }]
    });

    assert.doesNotMatch(summaryHtml, /Custom cover/);
    assert.doesNotMatch(summaryHtml, /IMG_0626\.JPEG/);
    assert.doesNotMatch(summaryHtml, />Album</);
    assert.doesNotMatch(summaryHtml, /All albums/);
    assert.match(summaryHtml, /data-action="close-collection"/);
    assert.match(summaryHtml, /class="cml-view-summary__title-button"/);
    assert.match(summaryHtml, /data-action="rename-album"/);
    assert.doesNotMatch(summaryHtml, />\s*Rename\s*</);
    assert.match(gridHtml, />2026-04-07</);
    assert.doesNotMatch(gridHtml, /19:35/);
    assert.match(gridHtml, /class="cml-collection-card__cover /);
    assert.doesNotMatch(gridHtml, />Cover</);
  });

  it('uses Mind instead of Bin in the mobile nav and nests a Bin entry into the mobile albums wall', () => {
    const mobileNavHtml = MobileBottomNav({
      navigationModel: {
        primary: ['Photos', 'Collections', 'Music', 'Mind', 'Private', 'Bin'],
        secondary: ['Videos', 'Documents', 'Favourites']
      },
      state: {
        primaryFilter: 'Mind',
        secondaryFilter: '',
        mindSettings: { contactName: 'Willian' }
      }
    });
    const gridHtml = CollectionGrid({
      collections: [{
        name: 'scenery',
        itemCount: 12,
        createdAt: '2026-04-07T19:35:00+08:00',
        lastModifiedAt: Date.parse('2026-04-09T08:00:00+08:00'),
        coverItem: null,
        hasCustomCover: false,
      }],
      showBinEntry: true
    });

    assert.match(mobileNavHtml, /data-primary="Mind"/);
    assert.match(mobileNavHtml, /data-primary="Music"/);
    assert.match(mobileNavHtml, />Willian</);
    assert.doesNotMatch(mobileNavHtml, /data-primary="Bin"/);
    assert.match(gridHtml, /data-primary="Bin"/);
    assert.match(gridHtml, /Recently deleted/);
    assert.match(gridHtml, />Bin</);
    assert.doesNotMatch(gridHtml, /Open deleted photos and videos/);
  });

  it('renders a dedicated music list and player queue for audio items', () => {
    const items = [
      {
        id: 'audio-1',
        type: 'audio',
        label: 'track-01.mp3',
        audioTitle: 'Darcy’s Letter',
        audioArtist: 'Dario Marianelli',
        audioAlbum: 'Pride & Prejudice',
        audioDuration: 236
      },
      {
        id: 'audio-2',
        type: 'audio',
        label: 'track-02.mp3',
        audioTitle: 'Leaving Netherfield',
        audioArtist: 'Dario Marianelli',
        audioAlbum: 'Pride & Prejudice',
        audioDuration: 184
      }
    ];
    const listHtml = MusicListView({
      items,
      state: {},
      audioState: { currentId: 'audio-1', isPlaying: true }
    });
    const panelHtml = AudioPlayerPanel({
      currentItem: items[0],
      queueItems: items,
      currentTime: 42,
      duration: 236,
      isPlaying: true,
      mode: 'shuffle',
      volume: 0.5
    });

    assert.match(listHtml, /cml-music-list/);
    assert.match(listHtml, /data-action="play-audio-item"/);
    assert.match(listHtml, /Darcy’s Letter/);
    assert.match(listHtml, /Dario Marianelli/);
    assert.match(listHtml, /cml-music-queue/);
    assert.match(listHtml, /Queue follows the visible track order\./);
    assert.match(listHtml, /class="cml-music-queue__play"/);
    assert.match(listHtml, /data-action="audio-remove-queue-item"/);
    assert.match(panelHtml, /Audio player/);
    assert.match(panelHtml, /Queue/);
    assert.match(panelHtml, /data-action="audio-toggle-play"/);
    assert.match(panelHtml, /data-action="audio-set-mode"/);
    assert.match(panelHtml, /data-audio-progress/);
    assert.match(panelHtml, /data-audio-volume/);
  });

  it('renders metadata-specific rename dialog copy for track title, artist, and album edits', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /state\.renameItemField === 'Artist'[\s\S]*'Edit artist'/);
    assert.match(appSource, /state\.renameItemField === 'Album'[\s\S]*'Edit album'/);
    assert.match(appSource, /state\.renameItemField === 'Artist'[\s\S]*'Artist'/);
    assert.match(appSource, /state\.renameItemField === 'Album'[\s\S]*'Album'/);
  });

  it('keeps the music summary renderable before any track is selected', () => {
    const html = AudioPlayerPanel({
      currentItem: null,
      queueItems: [],
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      mode: 'queue',
      volume: 1
    });
    const summaryHtml = MusicSummary({
      totalCount: 0,
      currentItem: null,
      queueItems: [],
      isPlaying: false,
      mode: 'queue'
    });

    assert.match(summaryHtml, /cml-music-summary/);
    assert.match(summaryHtml, /<p class="cml-music-summary__eyebrow">Music<\/p>/);
    assert.match(summaryHtml, /Music Library/);
    assert.match(summaryHtml, /0 items available in your private cloud library\./);
    assert.match(html, /Select a track/);
  });

  it('shows a mobile mini player entry point for the current track', () => {
    const html = MobileAudioMiniPlayer({
      currentItem: {
        id: 'audio-1',
        type: 'audio',
        label: 'track-01.mp3',
        audioTitle: 'Darcy’s Letter',
        audioArtist: 'Dario Marianelli',
        audioAlbum: 'Pride & Prejudice'
      },
      isPlaying: false
    });

    assert.match(html, /cml-mobile-audio-player/);
    assert.match(html, /data-primary="Music"/);
    assert.match(html, /data-action="audio-prev"/);
    assert.match(html, /data-action="audio-next"/);
    assert.match(html, /Darcy’s Letter/);
  });

  it('renders a desktop sidebar audio dock for non-music routes', () => {
    const dockHtml = SidebarAudioPlayer({
      currentItem: {
        id: 'audio-1',
        type: 'audio',
        label: 'track-01.mp3',
        audioTitle: 'Darcy’s Letter',
        audioArtist: 'Dario Marianelli',
        audioAlbum: 'Pride & Prejudice',
        audioDuration: 238
      },
      currentTime: 67,
      duration: 238,
      isPlaying: true,
      mode: 'shuffle',
      volume: 0.56
    });
    const sidebarHtml = Sidebar({
      navigationModel: {
        primary: ['Photos', 'Collections', 'Music', 'Mind', 'Private', 'Bin'],
        secondary: ['TODO', 'Videos', 'Documents', 'Favourites']
      },
      state: {
        primaryFilter: 'Photos',
        secondaryFilter: '',
        privateViewOpen: false,
        storagePanelOpen: false,
        mindSettings: {}
      },
      storageSummary: {
        usedMb: 131,
        totalCount: 43,
        isLoading: false
      },
      desktopAudioDock: dockHtml
    });

    assert.match(dockHtml, /cml-sidebar-audio-player/);
    assert.match(dockHtml, /data-action="audio-toggle-play"/);
    assert.match(dockHtml, /data-audio-progress/);
    assert.match(dockHtml, /data-audio-volume/);
    assert.doesNotMatch(dockHtml, /cml-sidebar-audio-player__queue/);
    assert.doesNotMatch(dockHtml, /cml-sidebar-audio-player__mode/);
    assert.doesNotMatch(dockHtml, /cml-sidebar-audio-player__cover/);
    assert.match(sidebarHtml, /cml-sidebar-audio-player/);
    assert.doesNotMatch(sidebarHtml, /cml-storage-strip/);
  });

  it('keeps the desktop style control visible in the default topbar at medium desktop widths', () => {
    const html = TopSearchBar({
      state: {
        primaryFilter: 'Photos',
        secondaryFilter: '',
        activeAlbumName: '',
        albumSelectionTarget: '',
        videoAlbumSelectionTarget: '',
        privateSelectionMode: false,
        selectedIds: new Set(),
        searchDraft: '',
        searchQuery: '',
        layoutWidth: 1100,
        uiTheme: 'horizon',
        uiThemeColor: 'horizon',
        uiThemeMode: 'auto',
        uiResolvedThemeMode: 'light',
        uiThemeMenuOpen: false
      }
    });

    assert.match(html, /data-action="toggle-ui-theme-menu"/);
    assert.match(html, /<span>Style<\/span>/);
    assert.match(html, /data-action="open-upload"/);
  });

  it('renders separate theme color and mode sections inside the desktop style menu', () => {
    const html = TopSearchBar({
      state: {
        primaryFilter: 'Photos',
        secondaryFilter: '',
        activeAlbumName: '',
        albumSelectionTarget: '',
        videoAlbumSelectionTarget: '',
        privateSelectionMode: false,
        selectedIds: new Set(),
        searchDraft: '',
        searchQuery: '',
        layoutWidth: 1280,
        uiTheme: 'horizon',
        uiThemeColor: 'horizon',
        uiThemeMode: 'auto',
        uiResolvedThemeMode: 'light',
        uiThemeMenuOpen: true
      }
    });

    assert.match(html, /Theme color/);
    assert.match(html, /Mode/);
    assert.match(html, /data-action="set-ui-theme-color"/);
    assert.match(html, /data-action="set-ui-theme-mode"/);
    assert.match(html, /Auto · Light/);
  });

  it('renders a dedicated mobile albums header and a first-card create entry on small screens', () => {
    const topbarHtml = TopSearchBar({
      state: {
        primaryFilter: 'Collections',
        secondaryFilter: '',
        activeAlbumName: '',
        albumSelectionTarget: '',
        videoAlbumSelectionTarget: '',
        privateSelectionMode: false,
        selectedIds: new Set(),
        searchDraft: '',
        searchQuery: '',
        layoutWidth: 390,
        mobileAlbumSearchOpen: false
      }
    });
    const gridHtml = CollectionGrid({
      collections: [{
        name: 'scenery',
        itemCount: 12,
        createdAt: '2026-04-07T19:35:00+08:00',
        lastModifiedAt: Date.parse('2026-04-09T08:00:00+08:00'),
        coverItem: null,
        hasCustomCover: false,
      }],
      showBinEntry: true,
      showCreateEntry: true
    });

    assert.match(topbarHtml, /cml-topbar--mobile-albums/);
    assert.match(topbarHtml, /data-primary="Photos"/);
    assert.match(topbarHtml, /data-action="open-mobile-album-search"/);
    assert.match(topbarHtml, /data-action="open-create-album"/);
    assert.doesNotMatch(topbarHtml, />\s*Upload\s*</);
    assert.match(gridHtml, /cml-collection-card--create/);
    assert.match(gridHtml, />New album</);
  });

  it('keeps desktop Mind style in the topbar but adds a mobile-style plus launcher inside the composer', () => {
    const topbarHtml = TopSearchBar({
      state: {
        primaryFilter: 'Mind',
        secondaryFilter: '',
        mindSettingsOpen: false,
        layoutWidth: 1280,
        mindSettings: {
          contactName: 'Willian',
          contactAvatarData: ''
        }
      }
    });
    const mindHtml = MindChatView({
      messages: [],
      draft: '',
      settingsBusy: false,
      deletingIds: new Set(),
      settingsOpen: false,
      settings: {
        contactName: 'Willian',
        sendButtonColor: 'green',
        backgroundPreset: 'ios-sky',
        backgroundPosition: 'center center'
      },
      settingsDraft: {
        contactName: 'Willian',
        sendButtonColor: 'green',
        backgroundPreset: 'ios-sky',
        backgroundPosition: 'center center'
      }
    });

    assert.match(topbarHtml, /<span>Style<\/span>/);
    assert.match(mindHtml, /cml-mind__composer-plus/);
    assert.match(mindHtml, /data-action="toggle-mind-settings"/);
    assert.match(mindHtml, /data-action="send-mind-message"/);
  });

  it('keeps mobile preview actions grouped on the right without a left-side back button or top date text', () => {
    const html = PreviewModal({
      item: {
        id: 'mobile-preview-1',
        type: 'photo',
        label: 'night-river.jpg',
        sourceId: 'photos/night-river.jpg',
        sourceUrl: '/file/photos/night-river.jpg',
        thumbnailUrl: '/file/photos/night-river.jpg',
        width: 1080,
        height: 1440,
        displayTakenAt: 'April 4, 2026 18:40',
        location: 'People Bridge',
        mimeType: 'image/jpeg',
      },
      selected: false,
      favorited: true,
      currentIndex: 24,
      totalCount: 29,
      infoOpen: false,
      immersive: false,
      albumDrawerOpen: false,
      albumEntries: [],
    });

    assert.match(html, /cml-preview__header-actions cml-preview__header-actions--mobile/);
    assert.match(html, /data-action="open-preview-add-to-album"/);
    assert.match(html, /data-action="request-delete-preview"/);
    assert.match(html, /data-action="rotate-preview"/);
    assert.match(html, /data-action="toggle-info"/);
    assert.match(html, /data-action="toggle-immersive"/);
    assert.match(html, /data-action="close-preview"/);
    assert.doesNotMatch(html, /cml-preview__mobile-back/);
    assert.doesNotMatch(html, /cml-preview__mobile-date/);
    assert.doesNotMatch(html, /cml-preview__mobile-location/);
  });

  it('renders mobile Mind as a fixed chat shell with an internal back header', () => {
    const mobileTopbarHtml = TopSearchBar({
      state: {
        primaryFilter: 'Mind',
        secondaryFilter: '',
        mindSettingsOpen: false,
        layoutWidth: 390,
        mindSettings: {
          contactName: 'Willian',
          contactAvatarData: ''
        }
      }
    });
    const mobileMindHtml = MindChatView({
      messages: [],
      draft: '',
      settingsBusy: false,
      deletingIds: new Set(),
      settingsOpen: false,
      settings: {
        contactName: 'Willian',
        sendButtonColor: 'green',
        backgroundPreset: 'ios-sky',
        backgroundPosition: 'center center'
      },
      settingsDraft: {
        contactName: 'Willian',
        sendButtonColor: 'green',
        backgroundPreset: 'ios-sky',
        backgroundPosition: 'center center'
      },
      layoutWidth: 390
    });

    assert.equal(mobileTopbarHtml, '');
    assert.match(mobileMindHtml, /cml-mind--mobile-fixed/);
    assert.match(mobileMindHtml, /data-action="leave-mobile-mind"/);
    assert.match(mobileMindHtml, /cml-mind__mobile-header/);
    assert.match(mobileMindHtml, />Willian</);
    assert.doesNotMatch(mobileMindHtml, />\s*Style\s*</);
  });

  it('renders the albums root with a compact title-and-count header', () => {

    const rootHtml = CollectionSummary({
      collectionCount: 2
    });

    assert.match(rootHtml, />Albums</);
    assert.match(rootHtml, />2 albums</);
    assert.doesNotMatch(rootHtml, /Albums now show album categories first/);
  });

  it('renders grouped desktop search results without surfacing Bin or Mind sections', () => {
    const photoItem = {
      id: 'photo-1',
      type: 'photo',
      label: 'Sunset.jpg',
      sourceUrl: '/file/photo-1.jpg',
      thumbnailUrl: '/file/photo-1.jpg',
      width: 1200,
      height: 900
    };
    const videoItem = {
      id: 'video-1',
      type: 'video',
      label: 'Trip.mp4',
      sourceUrl: '/file/video-1.mp4',
      thumbnailUrl: '/file/video-1.mp4?preview=1',
      posterUrl: '/file/video-1.mp4?preview=1',
      width: 1280,
      height: 720
    };
    const timelineSection = (anchorId, label, item) => ({
      anchorId,
      year: '2026',
      label,
      scrubberLabel: '2026',
      metaLine: '1 item',
      items: [item],
      visibleRows: [{
        items: [{
          item,
          width: 260,
          height: 180
        }]
      }],
      topSpacerHeight: 0,
      bottomSpacerHeight: 0
    });
    const html = SearchResultsView({
      query: 'trip',
      totalCount: 5,
      photoSections: [timelineSection('search-photo-1', 'Today', photoItem)],
      photoCount: 1,
      videoSections: [timelineSection('search-video-1', 'This week', videoItem)],
      videoCount: 1,
      audioItems: [{
        id: 'audio-1',
        type: 'audio',
        label: 'midnight-demo.m4a',
        audioTitle: 'Midnight Demo',
        audioArtist: 'Will',
        audioAlbum: 'Night drive',
        audioDuration: 126,
        takenAt: '2026-04-23T10:00:00.000Z'
      }],
      audioCount: 1,
      fileItems: [{
        id: 'file-1',
        type: 'document',
        isDocumentLike: true,
        label: 'Notes.pdf',
        directory: 'Trips/2026',
        takenAt: '2026-04-23T09:00:00.000Z',
        sizeMb: 1.2
      }],
      fileCount: 1,
      albumCards: [{
        name: 'April',
        itemCount: 3,
        createdAt: '2026-04-20T00:00:00.000Z',
        lastModifiedAt: 1713830400000,
        coverItem: photoItem
      }],
      albumCount: 1,
      state: {
        selectedIds: new Set(),
        favoriteIds: new Set(),
        activeSectionAnchor: '',
        layoutWidth: 1280
      },
      layoutWidth: 1280,
      audioState: {
        currentId: '',
        isPlaying: false
      },
      playlists: [],
      activePlaylistName: ''
    });

    assert.match(html, /data-search-results-view="global"/);
    assert.match(html, /data-search-group="photos"/);
    assert.match(html, /data-search-group="videos"/);
    assert.match(html, /data-search-group="music"/);
    assert.match(html, /data-search-group="files"/);
    assert.match(html, /data-search-group="albums"/);
    assert.doesNotMatch(html, /data-search-group="bin"/);
    assert.doesNotMatch(html, /data-search-group="mind"/);
    assert.match(html, /Grouped results across photos, videos, music, files, and albums while browsing Library\./);
  });

  it('renders structured search filter chips for metadata facets', () => {
    const html = SearchResultsView({
      query: '',
      totalCount: 2,
      filterParts: ['Camera: Canon', 'Tag: night', 'Has location'],
      hasActiveFilters: true,
      photoSections: [],
      photoCount: 0,
      videoSections: [],
      videoCount: 0,
      audioItems: [],
      audioCount: 0,
      fileItems: [{
        id: 'file-1',
        type: 'document',
        isDocumentLike: true,
        label: 'Notes.pdf',
        directory: 'Trips/2026',
        takenAt: '2026-04-23T09:00:00.000Z',
        sizeMb: 1.2
      }],
      fileCount: 1,
      albumCards: [],
      albumCount: 0,
      state: {
        selectedIds: new Set(),
        favoriteIds: new Set(),
        activeSectionAnchor: '',
        layoutWidth: 1280
      },
      layoutWidth: 1280,
      audioState: {
        currentId: '',
        isPlaying: false
      },
      playlists: [],
      activePlaylistName: ''
    });

    assert.match(html, /cml-search-summary__tags/);
    assert.match(html, /Camera: Canon/);
    assert.match(html, /Tag: night/);
    assert.match(html, /Has location/);
  });

  it('renders search summary affordances for clear, refine, jump, and limited-result messaging', () => {
    const html = SearchResultsView({
      query: 'river',
      totalCount: 3,
      filterParts: ['Tag: night'],
      hasActiveFilters: true,
      photoSections: [{
        anchorId: '2026-apr-1',
        year: '2026',
        label: 'April 2026',
        items: [{
          id: 'photo-1',
          type: 'photo',
          label: 'river.jpg',
          sourceUrl: '/file/river.jpg',
          thumbnailUrl: '/file/river.jpg',
          width: 1200,
          height: 900,
          displayTakenAt: 'April 23, 2026 09:00',
          takenAt: '2026-04-23T09:00:00.000Z'
        }],
        visibleRows: [{
          items: [{
            item: {
              id: 'photo-1',
              type: 'photo',
              label: 'river.jpg',
              sourceUrl: '/file/river.jpg',
              thumbnailUrl: '/file/river.jpg',
              width: 1200,
              height: 900,
              displayTakenAt: 'April 23, 2026 09:00',
              takenAt: '2026-04-23T09:00:00.000Z'
            },
            width: 240,
            height: 180
          }]
        }],
        topSpacerHeight: 0,
        bottomSpacerHeight: 0
      }],
      photoCount: 1,
      videoSections: [],
      videoCount: 0,
      audioItems: [{
        id: 'audio-1',
        type: 'audio',
        label: 'river-demo.m4a',
        audioTitle: 'River demo',
        audioArtist: 'Will',
        audioAlbum: 'Night drive',
        audioDuration: 126,
        takenAt: '2026-04-23T10:00:00.000Z'
      }],
      audioCount: 1,
      fileItems: [],
      fileCount: 0,
      albumCards: [],
      albumCount: 0,
      state: {
        selectedIds: new Set(),
        favoriteIds: new Set(),
        activeSectionAnchor: '',
        layoutWidth: 1280
      },
      layoutWidth: 1280,
      audioState: {
        currentId: '',
        isPlaying: false
      },
      playlists: [],
      activePlaylistName: '',
      contextLabel: 'Photos',
      resultsLimited: true,
      resultSource: 'indexed'
    });

    assert.match(html, /Grouped results across photos, videos, music, files, and albums while browsing Photos\./);
    assert.match(html, /data-action="clear-search-filters"/);
    assert.match(html, /data-action="focus-search-input"/);
    assert.match(html, /data-action="jump-search-group"/);
    assert.match(html, /Back to library/);
    assert.match(html, /Refine search/);
    assert.match(html, /Incomplete results/);
    assert.match(html, /newest 3 indexed results/);
  });

  it('renders album renaming inline at the title position instead of a dialog overlay', () => {
    const inlineHtml = CollectionSummary({
      activeAlbumName: 'scenery',
      itemCount: 12,
      renameAlbumDialogOpen: true,
      renameAlbumDraftName: 'scenery',
      renameAlbumError: '',
      renameAlbumBusy: false
    });
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(inlineHtml, /cml-view-summary__rename-input/);
    assert.match(inlineHtml, /data-focus-key="rename-album-inline"/);
    assert.doesNotMatch(inlineHtml, /Save/);
    assert.doesNotMatch(inlineHtml, /Cancel/);
    assert.doesNotMatch(appSource, /RenameAlbumDialog\(\{ state \}\)/);
  });

  it('keeps the selection add-to-album dialog path wired through preferPreviewRender state', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /function openAlbumDialog\(mode = 'create', \{ origin = '', preferPreviewRender = false \} = \{\}\)/);
    assert.doesNotMatch(appSource, /preferTransientRender/);
    assert.match(appSource, /function animateContentViewTransition\(\)/);
    assert.match(appSource, /if \(actionTarget\.dataset\.secondary\) \{[\s\S]*state\.primaryFilter = 'Photos';/);
    assert.match(appSource, /function syncSelectionUi\(changedItemIds = \[\]\)/);
    assert.match(appSource, /if \(!syncSelectionUi\(\[itemId\]\)\) \{\s*render\(\);/);
    assert.match(appSource, /function syncAlbumAssignments\(items = getAllItems\(\), \{ pruneMissing = false \} = \{\}\)/);
    assert.match(appSource, /syncAlbumAssignments\(remainingItems, \{ pruneMissing: true \}\)/);
    assert.doesNotMatch(appSource, /if \(syncAlbumAssignments\(items\.map\(\(item\) => applyAlbumOverride\(item\)\)\)\)/);
  });

  it('shows only remaining days on bin tiles without exposing file names', () => {
    const binItem = {
      id: 'bin-1',
      type: 'photo',
      label: 'photo_29.jpg',
      sourceUrl: '/file/bin/photo_29.jpg',
      thumbnailUrl: '/file/bin/photo_29.jpg',
      width: 1200,
      height: 900,
      daysLeft: 45,
      year: 2026,
      timelineLabel: 'Today'
    };
    const html = BinGrid({
      items: [binItem],
      binSelectedIds: new Set(),
      isBinLoading: false,
      layoutWidth: 1200,
      sections: [{
        anchorId: 'bin-2026-today',
        year: '2026',
        label: 'Today',
        metaLine: '45 days left before permanent deletion',
        items: [binItem],
        visibleRows: [{
          items: [{
            item: binItem,
            width: 240,
            height: 180
          }]
        }],
        topSpacerHeight: 0,
        bottomSpacerHeight: 0
      }]
    });

    assert.match(html, /45 days left/);
    assert.doesNotMatch(html, /cml-bin-media-tile__name/);
    assert.match(html, /aria-label="45 days left before permanent deletion"/);
    assert.match(html, /aria-label="Select item with 45 days left remaining"/);
  });

  it('keeps the bin root on the shared plain-summary header treatment', () => {
    const html = BinGrid({
      items: [{
        id: 'bin-2',
        type: 'photo',
        label: 'old-photo.jpg',
        sourceUrl: '/file/bin/old-photo.jpg',
        thumbnailUrl: '/file/bin/old-photo.jpg',
        width: 1200,
        height: 900,
        daysLeft: 12,
        year: 2026,
        timelineLabel: 'Today'
      }],
      binSelectedIds: new Set(),
      isBinLoading: false,
      layoutWidth: 1280,
      activeSectionAnchor: '',
      sections: []
    });

    assert.match(html, /cml-view-summary cml-view-summary--plain cml-bin-view__summary/);
    assert.match(html, />Recently deleted</);
    assert.match(html, /waiting to expire from the library/);
  });

  it('uses a clean metadata separator in documents header copy instead of mojibake', () => {
    const html = DocumentsListView({
      items: [
        {
          id: 'doc-1',
          type: 'document',
          isDocumentLike: true,
          label: 'VPN基本原理.pdf',
          directory: '',
          takenAt: '2026-04-23T09:00:00.000Z',
          sizeMb: 40.3,
        },
        {
          id: 'doc-2',
          type: 'document',
          isDocumentLike: true,
          label: '.claude.zip',
          directory: '',
          takenAt: '2026-04-23T09:30:00.000Z',
          sizeMb: 0,
        }
      ],
      state: {
        docsCurrentDir: '',
        layoutWidth: 1280,
        docsNewFolderOpen: false,
        docsFolders: new Set(),
        selectedIds: new Set(),
      }
    });

    assert.match(html, /2 files · 40\.3 MB/);
    assert.doesNotMatch(html, /2 files 路 40\.3 MB/);
  });

  it('adds scoped selection copy to the documents header when files are selected inside a folder', () => {
    const html = DocumentsListView({
      items: [
        {
          id: 'doc-1',
          type: 'document',
          isDocumentLike: true,
          label: 'notes.pdf',
          directory: 'school/sem1',
          takenAt: '2026-04-23T09:00:00.000Z',
          sizeMb: 1.2,
        },
        {
          id: 'doc-2',
          type: 'document',
          isDocumentLike: true,
          label: 'summary.pdf',
          directory: 'school/sem1',
          takenAt: '2026-04-23T09:30:00.000Z',
          sizeMb: 2.4,
        }
      ],
      state: {
        docsCurrentDir: 'school/sem1',
        layoutWidth: 1280,
        docsNewFolderOpen: false,
        docsFolders: new Set(['school', 'school/sem1']),
        selectedIds: new Set(['doc-1']),
      }
    });

    assert.match(html, /1 selected · 2 items · 3\.6 MB/);
    assert.match(html, /Selected files stay scoped to sem1\./);
    assert.match(html, /data-action="docs-clear-selection"/);
  });

  it('shows Albums and Private in the sidebar, keeps secondary filters visible in Bin, and uses the text wordmark', () => {
    const html = Sidebar({
      navigationModel: {
        primary: ['Photos', 'Collections', 'Private', 'Bin'],
        secondary: ['Videos', 'Favourites']
      },
      state: {
        primaryFilter: 'Bin',
        secondaryFilter: '',
        privateViewOpen: false,
        searchQuery: '',
        mindSettings: { contactName: 'Mind' }
      },
      storageSummary: {
        usedMb: 50.9,
        totalQuotaGb: 0,
        totalCount: 20,
        isLoading: false
      },
      searchQuery: ''
    });

    assert.match(html, /cml-sidebar__brand-wordmark/);
    assert.match(html, /Times New Roman/);
    assert.match(html, />Albums</);
    assert.match(html, />Private</);
    assert.doesNotMatch(html, />TODO</);
    assert.match(html, /data-secondary="Videos"/);
    assert.match(html, /data-secondary="Favourites"/);
    assert.doesNotMatch(html, /cml-sidebar__subnav-accent/);
    assert.doesNotMatch(html, /cml-sidebar__subnav-icon-wrap/);
    assert.doesNotMatch(html, /cml-sidebar__subnav-arrow/);
    assert.doesNotMatch(html, /logo-sundowner\.svg/);
  });

  it('keeps primary and secondary nav fast-paths aware of active desktop search state', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /function saveJson\(key, value\)/);
    assert.match(appSource, /function hasActiveSearchUiState\(\)/);
    assert.match(appSource, /function savePreviewTags\(itemId, tagInput, previousItem = null\)/);
    assert.match(appSource, /function syncDocsRowSelectionState\(row, selected\)/);
    assert.match(appSource, /&& !hasActiveSearchUiState\(\)\s*&& !state\.secondaryFilter/);
    assert.match(appSource, /&& !hasActiveSearchUiState\(\)\s*&& !state\.activeAlbumName/);
    assert.match(appSource, /data-search-view="\$\{viewModel\.isGlobalSearchView \? '1' : '0'\}"/);
    assert.match(appSource, /const domSearchView = contentInner instanceof HTMLElement/);
    assert.match(appSource, /pushNavigationHash\(\);\s*applyLocationRouteToMountedUi\(\);/);
    assert.match(appSource, /if \(!syncSelectionUi\(changedIds\)\) \{\s*render\(\);\s*\}/);
    assert.match(appSource, /const visibleDocRows = \[\.\.\.refs\.root\.querySelectorAll\('\.cml-docs-row\[data-id\]'\)\];/);
    assert.match(appSource, /function scrollToSearchGroup\(groupKey\)/);
    assert.match(appSource, /case 'focus-search-input':/);
    assert.match(appSource, /case 'jump-search-group':/);
    assert.match(appSource, /function dismissThemeMenu\(\{ allowRenderFallback = true \} = \{\}\) \{/);
    assert.match(appSource, /const shouldCloseThemeMenu = state\.uiThemeMenuOpen && !clickedInsideThemeSwitcher;/);
    assert.match(appSource, /if \(shouldCloseThemeMenu\) \{\s*dismissThemeMenu\(\{ allowRenderFallback: true \}\);/);
    assert.match(appSource, /state\.librarySyncMeta = \{/);
    assert.doesNotMatch(appSource, /if \(normalizedType === 'success'\) \{/);
  });

  it('uses optimistic local deletion and parallel delete requests for faster photo removal', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
    const deleteSectionMatch = appSource.match(/async function deleteSelectedItems\(options = \{\}\) \{[\s\S]*?\n\}/);
    const deleteSection = deleteSectionMatch ? deleteSectionMatch[0] : '';

    assert.match(appSource, /function applyDeletedItemsLocally\(\{/);
    assert.match(appSource, /applyDeletedItemsLocally\(\{\s*deletedIds: requestedIds,/);
    assert.match(appSource, /const deleteResults = await Promise\.all\(selectedItems\.map\(async \(item\) => \{/);
    assert.match(appSource, /showToast\(\s*permanent\s*\?/);
    assert.match(appSource, /Moved \$\{deletedIds\.size\} item/);
    assert.ok(deleteSection);
    assert.doesNotMatch(deleteSection, /window\.setTimeout\(\(\) => syncLiveMedia\(/);
  });

  it('wires Bin tiles and preview navigation to the Bin item source', () => {
    const componentsSource = fs.readFileSync(new URL('../js/media-library/components.js', import.meta.url), 'utf8');
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(componentsSource, /function BinMediaTile\(\{ item, selected, layout \}\) \{/);
    assert.match(componentsSource, /data-action="open-preview"/);
    assert.match(appSource, /function getPreviewItems\(items = getAccessibleItems\(\)\) \{\s*return state\.primaryFilter === 'Bin' \? state\.binItems : getFilteredItems\(items\);/);
    assert.match(appSource, /isBinView: state\.primaryFilter === 'Bin'/);
    assert.match(appSource, /function movePreview\(direction\) \{\s*const items = getPreviewItems\(\);/);
  });

  it('keeps Bin mutation flows local-first and avoids success-path live sync', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
    const restoreSection = appSource.match(/async function restoreBinSelection\(\) \{[\s\S]*?\n\}/)?.[0] || '';
    const deleteSection = appSource.match(/async function deleteBinSelectionPermanently\(\) \{[\s\S]*?\n\}/)?.[0] || '';
    const emptySection = appSource.match(/async function emptyBin\(\) \{[\s\S]*?\n\}/)?.[0] || '';

    assert.match(appSource, /function snapshotBinMutationState\(\) \{/);
    assert.match(appSource, /function applyBinItemsLocally\(\{/);
    assert.match(appSource, /function renderBinMutationState\(\) \{/);
    assert.match(restoreSection, /applyBinItemsLocally\(\{\s*removedIds: requestedIds,/);
    assert.match(deleteSection, /applyBinItemsLocally\(\{\s*removedIds: requestedIds,/);
    assert.match(emptySection, /applyBinItemsLocally\(\{\s*removedIds: requestedIds,/);
    assert.doesNotMatch(restoreSection, /syncLiveMedia\(/);
    assert.doesNotMatch(deleteSection, /syncLiveMedia\(/);
    assert.doesNotMatch(emptySection, /syncLiveMedia\(/);
  });

  it('keeps preview metadata saves on the preview-patch path before full render fallback', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /function refreshPreviewAfterMetadataPatch\(itemId, options = \{\}\) \{/);
    assert.match(appSource, /refreshPreviewAfterMetadataPatch\(itemId\);/);
    assert.match(appSource, /if \(!refreshPreviewAfterMetadataPatch\(itemId\)\) \{\s*render\(\);\s*\}/);
    assert.doesNotMatch(appSource, /showToast\('Description saved'/);
    assert.doesNotMatch(appSource, /showToast\('Date & time saved'/);
    assert.doesNotMatch(appSource, /showToast\(nextCategory \? 'Video category saved'/);
    assert.doesNotMatch(appSource, /showToast\(nextTags\.length \? 'Tags saved'/);
  });

  it('anchors preview close back to the current tile or section before dismissing the overlay', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /function findPreviewSectionAnchor\(itemId\) \{/);
    assert.match(appSource, /function restorePreviewPosition\(itemId\) \{/);
    assert.match(appSource, /tile\.scrollIntoView\(\{ block: 'center', inline: 'nearest', behavior: 'smooth' \}\);/);
    assert.match(appSource, /scrollToYear\(targetAnchor\);\s*scheduleTimelineRender\(\);/);
    assert.match(appSource, /animatePreviewCloseToTile\(finalizeClosePreview\);/);
    assert.match(appSource, /window\.requestAnimationFrame\(\(\) => \{\s*restorePreviewPosition\(previewId\);/);
    assert.match(appSource, /preview\.classList\.add\('is-closing'\);/);
    assert.match(appSource, /preview\.classList\.add\('is-entering'\);/);
    assert.doesNotMatch(appSource, /previewTransitionRect/);
    assert.doesNotMatch(appSource, /runPreviewSharedElementTransition/);
  });

  it('closes the confirm dialog immediately before background delete work starts', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /const deleteOrigin = state\.confirmDialogOrigin;/);
    assert.match(appSource, /const permanentDelete = state\.confirmDialogMode === 'delete-permanently';/);
    assert.match(appSource, /resetConfirmDialog\(\);\s*if \(!\(preferPreviewRender && renderPreviewTransientLayers\(\)\)\) \{\s*render\(\);\s*\}\s*void deleteSelectedItems\(\{/);
  });

  it('renders storage usage numbers once the summary has loaded', () => {
    const html = StorageCard({
      usedMb: 1536,
      totalQuotaGb: 0,
      totalCount: 27,
      isLoading: false
    });

    assert.match(html, /1\.5 GB \/ INFINITE/);
    assert.match(html, />27 items</);
    assert.doesNotMatch(html, /Calculating\.\.\./);
  });

  it('renders a compact storage trigger in the topbar instead of keeping storage in the sidebar footer', () => {
    const triggerHtml = StorageTrigger({
      usedMb: 1536,
      totalCount: 27,
      isLoading: false
    });
    const topbarHtml = TopSearchBar({
      state: {
        primaryFilter: 'Photos',
        secondaryFilter: '',
        activeAlbumName: '',
        albumSelectionTarget: '',
        videoAlbumSelectionTarget: '',
        privateSelectionMode: false,
        selectedIds: new Set(),
        searchDraft: '',
        searchQuery: '',
        layoutWidth: 1280,
        uiThemeMenuOpen: false,
        uiTheme: 'editorial-dark',
        adminUsername: 'admin',
        adminDisplayName: 'Admin',
        adminAvatarData: '',
        avatarMenuOpen: false,
        mindSettings: { contactName: 'Mind' },
        storagePanelOpen: false,
      },
      storageSummary: {
        usedMb: 1536,
        totalCount: 27,
        isLoading: false
      },
      canDeleteSelection: false,
      canDownloadSelection: false,
      canSetAlbumCover: false,
    });
    const sidebarHtml = Sidebar({
      navigationModel: {
        primary: ['Photos', 'Collections'],
        secondary: ['Videos']
      },
      state: {
        primaryFilter: 'Photos',
        secondaryFilter: '',
        privateViewOpen: false,
        storagePanelOpen: false,
        mindSettings: { contactName: 'Mind' }
      },
      storageSummary: {
        usedMb: 1536,
        totalCount: 27,
        isLoading: false
      },
      searchQuery: ''
    });

    assert.match(triggerHtml, /cml-storage-trigger/);
    assert.match(triggerHtml, /1\.5 GB · 27 items/);
    assert.match(topbarHtml, /cml-storage-trigger/);
    assert.doesNotMatch(sidebarHtml, /cml-storage-strip/);
  });

  it('wraps the default desktop topbar into lead and trailing clusters for a calmer shell layout', () => {
    const html = TopSearchBar({
      state: {
        primaryFilter: 'Photos',
        secondaryFilter: '',
        activeAlbumName: '',
        albumSelectionTarget: '',
        videoAlbumSelectionTarget: '',
        privateSelectionMode: false,
        selectedIds: new Set(),
        searchDraft: '',
        searchQuery: '',
        layoutWidth: 1280,
        uiThemeMenuOpen: false,
        uiTheme: 'editorial-dark',
        adminUsername: 'admin',
        adminDisplayName: 'Admin',
        adminAvatarData: '',
        avatarMenuOpen: false,
        mindSettings: { contactName: 'Mind' },
      },
      canDeleteSelection: false,
      canDownloadSelection: false,
      canSetAlbumCover: false,
    });

    assert.match(html, /cml-topbar__lead/);
    assert.match(html, /cml-topbar__trailing/);
    assert.match(html, /cml-topbar__search/);
    assert.match(html, /cml-avatar-wrap/);
  });

  it('marks preview editable metadata blocks with dedicated editable section classes', () => {
    const html = PreviewModal({
      item: {
        id: 'managed-preview-structure',
        type: 'photo',
        label: 'memoir.jpg',
        sourceId: 'photos/memoir.jpg',
        sourceUrl: '/file/photos/memoir.jpg',
        thumbnailUrl: '/file/photos/memoir.jpg',
        width: 1080,
        height: 1440,
        displayTakenAt: 'April 8, 2026 18:42',
        mimeType: 'image/jpeg',
        description: 'A quiet frame.',
        explicitTags: ['memoir'],
        tags: ['memoir'],
      },
      selected: false,
      favorited: false,
      currentIndex: 1,
      totalCount: 5,
      infoOpen: true,
      immersive: false,
    });

    assert.match(html, /cml-preview__info-section--description cml-preview__info-section--editable/);
    assert.match(html, /cml-preview__info-section--tags cml-preview__info-section--editable/);
    assert.match(html, /cml-preview__info-section--passive/);
  });

  it('renders a video category filter rail with active chips and counts', () => {
    const html = VideoCategoryBar({
      categories: [
        { label: 'Travel vlog', count: 5 },
        { label: 'Screen recording', count: 2 }
      ],
      activeCategory: 'Travel vlog',
      totalCount: 7
    });

    assert.match(html, /All videos/);
    assert.match(html, /7 items/);
    assert.match(html, /data-action="filter-video-category"/);
    assert.match(html, /Travel vlog/);
    assert.match(html, /5 videos/);
    assert.match(html, /is-active/);
  });

  it('renders a video album wall and active album summary for visual grouping', () => {
    const gridHtml = VideoAlbumGrid({
      albums: [
        {
          name: 'Travel vlog',
          routeValue: 'Travel vlog',
          itemCount: 5,
          createdAt: '2026-04-13T12:00:00.000Z',
          lastModifiedAt: 1776072000000,
          coverItem: {
            id: 'managed-video-7',
            type: 'video',
            label: 'travel.mp4',
            sourceId: 'videos/travel.mp4',
            sourceUrl: '/file/videos/travel.mp4',
            thumbnailUrl: '/file/videos/travel.mp4?preview=1',
            posterUrl: '/file/videos/travel.mp4?preview=1',
            width: 1920,
            height: 1080,
            mimeType: 'video/mp4'
          }
        },
        {
          name: 'Ungrouped',
          routeValue: '__ungrouped__',
          itemCount: 2,
          isUngrouped: true,
          createdAt: '',
          lastModifiedAt: 1776072000000,
          coverItem: null
        }
      ]
    });
    const summaryHtml = VideoAlbumSummary({
      activeCategory: 'Travel vlog',
      albumCount: 3,
      groupedVideoCount: 9,
      totalVideoCount: 5
    });

    assert.match(gridHtml, /data-action="open-video-album"/);
    assert.match(gridHtml, /Travel vlog/);
    assert.match(gridHtml, /Video album/);
    assert.match(gridHtml, /data-category="__ungrouped__"/);
    assert.match(gridHtml, /Needs grouping/);
    assert.doesNotMatch(summaryHtml, /All video albums/);
    assert.match(summaryHtml, /data-action="close-video-album"/);
    assert.match(summaryHtml, /5 videos in this album/);
  });

  it('keeps video category filter state wired through route persistence and media filtering', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
    const componentsSource = fs.readFileSync(new URL('../js/media-library/components.js', import.meta.url), 'utf8');

    assert.match(appSource, /videoCategoryFilter/);
    assert.match(appSource, /UNGROUPED_VIDEO_ALBUM_KEY/);
    assert.match(appSource, /UNGROUPED_VIDEO_ROUTE_SEGMENT/);
    assert.match(appSource, /#\/videos\/' \+ encodeURIComponent\(routeValue\)/);
    assert.match(appSource, /state\.videoCategoryFilter = normalizeVideoAlbumRouteValue\(parts\.slice\(1\)\.join\('\/'\)\)/);
    assert.match(appSource, /if \(!ignoreVideoCategoryFilter && state\.videoCategoryFilter\)/);
    assert.match(appSource, /function buildVideoAlbumSummaries/);
    assert.match(appSource, /function isVideoAlbumRootView/);
    assert.match(appSource, /function openVideoAlbum/);
    assert.match(appSource, /function closeVideoAlbum/);
    assert.match(componentsSource, /data-action="open-video-album"/);
  });

  it('renders a hidden-album password gate and summary behind the visible Private sidebar entry', () => {
    const gateHtml = PrivateAlbumGate({ error: 'Wrong password.' });
    const summaryHtml = PrivateAlbumSummary({ itemCount: 3, locked: false });
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(gateHtml, /data-form="private-access"/);
    assert.match(gateHtml, /data-private-access="password"/);
    assert.match(gateHtml, /Unlock private album/);
    assert.match(gateHtml, />Unlock</);
    assert.match(gateHtml, /Wrong password\./);
    assert.match(gateHtml, /Enter your password to view hidden photos and videos/);
    assert.doesNotMatch(gateHtml, /Enter hidden album/);
    assert.match(summaryHtml, /Hidden album/);
    assert.match(summaryHtml, /3 items hidden from the main library/);
    assert.match(appSource, /PRIVATE_ROUTE_SEGMENT = 'private'/);
    assert.match(appSource, /PRIVATE_ALBUM_PASSWORD = '210217'/);
    assert.match(appSource, /#\/photos\/\$\{PRIVATE_ROUTE_SEGMENT\}/);
    assert.match(appSource, /nextPrimary === 'Private'/);
    assert.match(appSource, /toggle-private-selection/);
    assert.match(appSource, /privateRouteUnlocked = false/);
    assert.doesNotMatch(appSource, /PrivateAlbumSummary\(\{ itemCount: 0, locked: true \}\)/);
  });

  it('keeps Private password Enter isolated from tile preview shortcuts', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /event\.target instanceof HTMLInputElement && event\.target\.dataset\.privateAccess === 'password'/);
    assert.match(appSource, /state\.privatePasswordError = 'Enter the password first\.'/);
    assert.match(appSource, /unlockPrivateRoute\(event\.target\.value\)/);
    assert.match(appSource, /e\.stopPropagation\(\);\s*unlockPrivateRoute\(\);/);
    assert.match(appSource, /state\.focusedTileId = null/);
  });

  it('keeps queue removal and audio end handling wired in app state', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /function handleAudioEnded\(\) \{/);
    assert.match(appSource, /state\.audioMode === AUDIO_MODE_REPEAT_ONE/);
    assert.match(appSource, /function removeAudioQueueItem\(itemId\) \{/);
    assert.match(appSource, /const currentQueueItems = getAudioQueueItems\(getAccessibleItems\(\)\);/);
    assert.match(appSource, /state\.audioQueueIds = nextQueueIds;/);
    assert.match(appSource, /const nextItemId = nextQueueIds\[fallbackIndex\] \|\| nextQueueIds\[0\];/);
    assert.match(appSource, /case 'audio-set-mode':/);
    assert.match(appSource, /case 'audio-remove-queue-item':/);
  });


  it('keeps active playlist music context scoped to playlist membership only', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /function getMusicContextItems\(items = getAccessibleItems\(\)\) \{/);
    assert.match(appSource, /if \(!activePlaylistName\) \{\s*return visibleAudioItems;/);
    assert.match(appSource, /return items\s*\.filter\(\(item\) => item\.type === 'audio'\)\s*\.filter\(\(item\) => itemBelongsToPlaylist\(item, activePlaylistName\)\);/);
    assert.match(appSource, /if \(state\.primaryFilter === 'Music' && getActivePlaylistName\(\)\) \{\s*return getMusicContextItems\(items\);\s*\}/);
    assert.match(appSource, /const musicItems = isMusicView\s*\? getMusicContextItems\(accessibleItems\)\s*:\s*\[\];/);
  });


  it('keeps favourite toggles in preview on the local button path without a full render', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /const isCurrentPreviewItem = Boolean\(state\.previewId\)/);
    assert.match(appSource, /if \(isCurrentPreviewItem && syncPreviewFavoriteButton\(itemId\)\) \{\s*return;\s*\}/);
    assert.match(appSource, /const displayTotalCount = resolvedPreviewItems\.length \|\| \(resolvedPreviewItem \? 1 : 0\)/);
  });

  it('keeps the TODO filter internal while exposing Unsorted and hides Bin-only shortcut leaks', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
    const componentsSource = fs.readFileSync(new URL('../js/media-library/components.js', import.meta.url), 'utf8');
    const sidebarHtml = Sidebar({
      navigationModel: {
        primary: ['Photos'],
        secondary: ['TODO', 'Videos']
      },
      state: {
        primaryFilter: 'Photos',
        secondaryFilter: 'TODO',
        privateViewOpen: false,
        mindSettings: { contactName: 'Mind' }
      },
      storageSummary: null,
      searchQuery: ''
    });

    assert.match(componentsSource, /const secondaryLabelMap = \{\s*TODO: 'Unsorted'/);
    assert.match(sidebarHtml, />Unsorted</);
    assert.doesNotMatch(sidebarHtml, />TODO</);
    assert.match(appSource, /function getVisibleSecondaryFilters\(items\) \{\s*return navigationModel\.secondary\.filter\(\(label\) => \{/);
    assert.match(appSource, /if \(label === 'TODO'\) \{\s*return items\.some\(\(item\) => isTodoPhotoItem\(item\)\);/);
    assert.match(appSource, /const isBinPreview = state\.primaryFilter === 'Bin';/);
    assert.match(appSource, /else if \(!isBinPreview && \(event\.key === 'f' \|\| event\.key === 'F'\)\) \{/);
    assert.match(appSource, /else if \(!isBinPreview && \(event\.key === 'e' \|\| event\.key === 'E'\)\) \{/);
    assert.match(appSource, /else if \(!isBinPreview && \(event\.key === 'r' \|\| event\.key === 'R'\)\) \{/);
    assert.match(appSource, /else if \(isBinPreview && \(event\.key === 'Backspace' \|\| event\.key === 'Delete'\)\) \{/);
  });

  it('applies library search on a debounced live path instead of requiring Enter only', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /const SEARCH_INPUT_DEBOUNCE_MS = 160;/);
    assert.match(appSource, /let pendingSearchApplyTimer = 0;/);
    assert.match(appSource, /function restoreSearchInputFocus\(selectionStart = null, selectionEnd = null\) \{/);
    assert.match(appSource, /function scheduleSearchQueryApply\(nextQuery, \{ selectionStart = null, selectionEnd = null \} = \{\}\) \{/);
    assert.match(appSource, /scheduleSearchQueryApply\(input\.value, \{\s*selectionStart: input\.selectionStart,\s*selectionEnd: input\.selectionEnd\s*\}\);/);
    assert.match(appSource, /applySearchQuery\(nextQuery, \{\s*preserveFocus: true,\s*selectionStart,\s*selectionEnd\s*\}\);/);
    assert.match(appSource, /window\.requestAnimationFrame\(\(\) => \{\s*restoreSearchInputFocus\(selectionStart, selectionEnd\);/);
  });

  it('renders an inline clear affordance inside populated search fields', () => {
    const componentsSource = fs.readFileSync(new URL('../js/media-library/components.js', import.meta.url), 'utf8');
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(componentsSource, /function renderInlineSearchClearButton\(rawValue = ''\) \{/);
    assert.match(componentsSource, /data-action="clear-search-input"/);
    assert.match(appSource, /function clearSearchInputAndFocus\(\) \{/);
    assert.match(appSource, /case 'clear-search-input':/);
    assert.match(appSource, /clearSearchInputAndFocus\(\);/);
  });

  it('gives preview description editing the same explicit cancel/save affordance as other metadata editors', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /const actions = document\.createElement\('div'\);\s*actions\.className = 'cml-preview__info-editor-actions';/);
    assert.match(appSource, /cancelButton\.textContent = 'Cancel';/);
    assert.match(appSource, /saveButton\.textContent = 'Save';/);
    assert.match(appSource, /if \(mode === 'cancel'\) \{\s*patchDescriptionDisplay\(descSection, currentDesc\);/);
    assert.match(appSource, /cancelButton\.addEventListener\('click', \(\) => \{/);
    assert.match(appSource, /saveButton\.addEventListener\('click', \(\) => \{/);
    assert.match(appSource, /descSection\.append\(textarea, actions\);/);
  });

  it('opens document rows on double-click without changing the single-click selection contract', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /function handleDoubleClick\(event\) \{/);
    assert.match(appSource, /const docsRow = event\.target\.closest\('\.cml-docs-row\[data-id\]'\);/);
    assert.match(appSource, /if \(!itemId \|\| state\.secondaryFilter !== 'Documents'\) \{/);
    assert.match(appSource, /downloadPreviewItem\(itemId\);/);
    assert.match(appSource, /refs\.root\.addEventListener\('dblclick', handleDoubleClick, true\);/);
  });

  it('exposes picker actions for video albums and Private media', () => {
    const videoRootHtml = TopSearchBar({
      state: {
        primaryFilter: 'Photos',
        secondaryFilter: 'Videos',
        videoCategoryFilter: '',
        activeAlbumName: '',
        albumSelectionTarget: '',
        videoAlbumSelectionTarget: '',
        privateSelectionMode: false,
        privateViewOpen: false,
        privateRouteUnlocked: false,
        selectedIds: new Set(),
        searchDraft: '',
        searchQuery: '',
      },
    });
    const videoDetailHtml = TopSearchBar({
      state: {
        primaryFilter: 'Photos',
        secondaryFilter: 'Videos',
        videoCategoryFilter: 'little doggy',
        activeAlbumName: '',
        albumSelectionTarget: '',
        videoAlbumSelectionTarget: '',
        privateSelectionMode: false,
        privateViewOpen: false,
        privateRouteUnlocked: false,
        selectedIds: new Set(),
        searchDraft: '',
        searchQuery: '',
      },
    });
    const privateHtml = TopSearchBar({
      state: {
        primaryFilter: 'Photos',
        secondaryFilter: '',
        videoCategoryFilter: '',
        activeAlbumName: '',
        albumSelectionTarget: '',
        videoAlbumSelectionTarget: '',
        privateSelectionMode: false,
        privateViewOpen: true,
        privateRouteUnlocked: true,
        selectedIds: new Set(),
        searchDraft: '',
        searchQuery: '',
      },
    });
    const pickerHtml = TopSearchBar({
      state: {
        primaryFilter: 'Photos',
        secondaryFilter: 'Videos',
        videoCategoryFilter: '',
        activeAlbumName: '',
        albumSelectionTarget: '',
        videoAlbumSelectionTarget: 'little doggy',
        privateSelectionMode: false,
        privateViewOpen: false,
        privateRouteUnlocked: false,
        selectedIds: new Set(['video-1']),
        searchDraft: '',
        searchQuery: '',
      },
    });

    assert.match(videoRootHtml, /New video album/);
    assert.match(videoDetailHtml, /data-action="open-add-to-current-video-album"/);
    assert.match(videoDetailHtml, /Add videos/);
    assert.match(privateHtml, /data-action="open-add-to-private"/);
    assert.match(privateHtml, /Add photos\/videos/);
    assert.match(pickerHtml, /Add to little doggy/);
  });
});
