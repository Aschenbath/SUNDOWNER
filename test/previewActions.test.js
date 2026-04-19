import assert from 'node:assert/strict';
import fs from 'node:fs';

import { BinGrid, CollectionGrid, CollectionSummary, MediaTile, PreviewModal, PrivateAlbumGate, PrivateAlbumSummary, Sidebar, StorageCard, TopSearchBar, VideoAlbumGrid, VideoAlbumSummary, VideoCategoryBar } from '../js/media-library/components.js';

describe('media library download actions', () => {
  it('keeps the sidebar brand as a SUNDOWNER wordmark instead of rendering the uploaded image there', () => {
    const html = Sidebar({
      navigationModel: {
        primary: ['Photos', 'Collections', 'Mind', 'Private', 'Bin'],
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
    assert.match(html, /class="cml-preview__main"/);
    assert.match(html, /class="cml-preview__info /);
    assert.match(html, /Add a description/);
    assert.match(html, /Date &amp; time/);
    assert.match(html, /data-action="edit-capture-time"/);
    assert.doesNotMatch(html, /Hidden album/);
    assert.doesNotMatch(html, /data-action="toggle-private-photo"/);
    assert.match(html, /Details/);
    assert.doesNotMatch(html, /cml-preview__caption/);
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
    assert.match(summaryHtml, /All albums/);
    assert.match(summaryHtml, /class="cml-view-summary__title-button"/);
    assert.match(summaryHtml, /data-action="rename-album"/);
    assert.doesNotMatch(summaryHtml, />\s*Rename\s*</);
    assert.match(gridHtml, />2026-04-07</);
    assert.doesNotMatch(gridHtml, /19:35/);
    assert.match(gridHtml, /class="cml-collection-card__cover /);
    assert.doesNotMatch(gridHtml, />Cover</);
  });

  it('renders the albums root with a compact title-and-count header', () => {
    const rootHtml = CollectionSummary({
      collectionCount: 2
    });

    assert.match(rootHtml, />Albums</);
    assert.match(rootHtml, />2 albums</);
    assert.doesNotMatch(rootHtml, /Albums now show album categories first/);
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
    assert.match(html, /data-secondary="Videos"/);
    assert.match(html, /data-secondary="Favourites"/);
    assert.doesNotMatch(html, /logo-sundowner\.svg/);
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
    assert.match(summaryHtml, /All video albums/);
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
    assert.match(gateHtml, /Enter your password to view private photos and videos/);
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
    assert.match(appSource, /unlockPrivateRoute\(event\.target\.value\)/);
    assert.match(appSource, /e\.stopPropagation\(\);\s*unlockPrivateRoute\(\);/);
    assert.match(appSource, /state\.focusedTileId = null/);
  });

  it('keeps favourite toggles in preview on the local button path without a full render', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /const isCurrentPreviewItem = Boolean\(state\.previewId\)/);
    assert.match(appSource, /if \(isCurrentPreviewItem && syncPreviewFavoriteButton\(itemId\)\) \{\s*return;\s*\}/);
    assert.match(appSource, /const displayTotalCount = resolvedPreviewItems\.length \|\| \(resolvedPreviewItem \? 1 : 0\)/);
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
