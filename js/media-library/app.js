import { createTimelineLabel, navigationModel, storageSummary as defaultStorageSummary } from './data.js';
import {
  AdminPanel,
  AlbumDialog,
  BinGrid,
  CollectionGrid,
  CollectionSummary,
  ConfirmDialog,
  EmptyState,
  LoginOverlay,
  MediaGrid,
  MediaTimelineSection,
  renderMediaRows,
  PreviewModal,
  SearchSummary,
  Sidebar,
  StoragePanel,
  TopSearchBar,
  YearScroller,
  buildJustifiedRows
} from './components.js?v=11';
import {
  countActiveMediaSearchFilters,
  matchesMediaSearchFilters,
  parseMediaSearchQuery,
  summarizeMediaSearch,
} from './search-filters.js';
import { PREVIEW_PANEL_SECTION_SELECTORS } from './preview-overlay.js';
import { findPreviewMatch } from './preview-resolution.js';
import { getLookupKeys as buildMediaLookupKeys } from './media-lookup.js';
import { shouldDisplayMediaItem, supportsBrowserImagePreview } from './media-support.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_INDEX = Object.fromEntries(MONTH_NAMES.map((month, index) => [month.toLowerCase(), index]));
const WEEKDAY_INDEX = Object.fromEntries(WEEKDAY_NAMES.map((weekday, index) => [weekday.toLowerCase(), index]));

const FAVORITES_STORAGE_KEY = 'codex-media-library-favorites';
const ALBUMS_STORAGE_KEY = 'codex-media-library-albums';
const ALBUM_ASSIGNMENTS_STORAGE_KEY = 'codex-media-library-album-assignments';
const ALBUM_COVERS_STORAGE_KEY = 'codex-media-library-album-covers';
const LEGACY_ALBUM_STORAGE_KEYS = [
  FAVORITES_STORAGE_KEY,
  ALBUMS_STORAGE_KEY,
  ALBUM_ASSIGNMENTS_STORAGE_KEY,
  ALBUM_COVERS_STORAGE_KEY
];
const API_PAGE_SIZE = 400;
const API_MAX_ITEMS = 1600;
const API_REQUEST_TIMEOUT_MS = 8000;
const STORAGE_REQUEST_TIMEOUT_MS = 5000;
const COLLECTION_PAGE_SIZE = 24;
const TIMELINE_ROW_GAP = 2;
const TIMELINE_SECTION_CHROME_ESTIMATE = 92;
const TIMELINE_SECTION_GAP = 28;
const BIN_TIMELINE_SECTION_GAP = 24;
const TIMELINE_VIRTUAL_OVERSCAN = 960;
const TIMELINE_VIRTUALIZATION_ITEM_THRESHOLD = 120;
const TILE_SELECTION_CHECK_MARKUP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.4 12.8 3.7 3.7 7.5-8.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
const TILE_SELECTION_RING_MARKUP = '<span class="cml-media-tile__select-ring"></span>';

function createEmptyAdminProfileDraft() {
  return {
    username: '',
    displayName: '',
    avatarData: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };
}

function createEmptyAdminPageDraft() {
  return {
    siteTitle: '',
    ownerName: '',
    logoUrl: '',
    announcement: '',
    adminBkImg: '',
    adminLoginBkImg: ''
  };
}

function createEmptyAdminCloudDraft() {
  return {
    publicBrowseEnabled: false,
    publicBrowseAllowedDir: '',
    randomImageEnabled: false,
    randomImageAllowedDir: '',
    telemetryEnabled: false
  };
}

const LIVE_MEDIA_QUERY = [
  '#app .list-view img[src]',
  '#app .history-container img[src]',
  '#app .upload-list-item img[src]',
  '#app .el-image__inner[src]',
  '#app .image-wrapper img[src]',
  '#app .gallery-container img[src]'
].join(', ');

const LIVE_SURFACE_QUERY = [
  '#app .list-view',
  '#app .history-container',
  '#app .upload-list-dashboard',
  '#app .upload-home',
  '#app .container[data-v-ad54b28c]',
  '#app .public-browse'
].join(', ');

const EXCLUDED_MEDIA_ROOT = [
  '.codex-home-shell',
  '.codex-home-shell-v2',
  '.codex-dashboard-shell-v2',
  '.codex-brand-lockup',
  '.el-empty',
  '.empty-state'
].join(', ');

const FILE_EXTENSION_PATTERN = /\.(?:jpg|jpeg|png|webp|gif|bmp|avif|heic|heif|mp4|mov|m4v|webm|avi)$/i;
const VIDEO_EXTENSION_PATTERN = /\.(?:mp4|mov|m4v|webm|avi)$/i;
const DOCUMENT_HINT_PATTERN = /\b(document|documents|scan|receipt|invoice|contract|paper|archive|notes?)\b/i;

function loadJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function loadStringSet(key) {
  const values = loadJson(key, []);
  return new Set(Array.isArray(values) ? values.map(String) : []);
}

function loadStringArray(key) {
  const values = loadJson(key, []);
  return Array.isArray(values)
    ? values.map((value) => normalizeText(value)).filter(Boolean)
    : [];
}

function loadStringRecord(key) {
  const value = loadJson(key, {});
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value)
      .map(([entryKey, entryValue]) => [normalizeText(entryKey), normalizeText(entryValue)])
      .filter(([entryKey, entryValue]) => entryKey && entryValue)
  );
}

function loadAlbumCoverRecord() {
  const value = loadJson(ALBUM_COVERS_STORAGE_KEY, {});
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value)
      .map(([albumName, itemKey]) => [normalizeAlbumKey(albumName), normalizeText(itemKey)])
      .filter(([albumName, itemKey]) => albumName && itemKey)
  );
}

function readLegacyAlbumState() {
  return {
    albumNames: loadStringArray(ALBUMS_STORAGE_KEY),
    albumAssignments: loadStringRecord(ALBUM_ASSIGNMENTS_STORAGE_KEY),
    albumCovers: loadAlbumCoverRecord(),
    favorites: [...loadStringSet(FAVORITES_STORAGE_KEY)]
  };
}

function clearLegacyAlbumState() {
  LEGACY_ALBUM_STORAGE_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
  });
}

const legacyAlbumState = readLegacyAlbumState();

const state = {
  primaryFilter: 'Photos',
  secondaryFilter: '',
  activeAlbumName: '',
  albumSelectionTarget: '',
  searchQuery: '',
  searchDraft: '',
  selectedIds: new Set(),
  favoriteIds: new Set(),
  albumNames: [],
  albumAssignments: {},
  albumCovers: {},
  albumDialogOpen: false,
  albumDialogMode: 'create',
  albumDialogOrigin: '',
  albumDraftName: '',
  albumDialogError: '',
  albumDrawerSearch: '',
  albumDrawerScope: 'all',
  albumDrawerCreateMode: false,
  confirmDialogOpen: false,
  confirmDialogMode: '',
  confirmDialogOrigin: '',
  confirmDialogTitle: '',
  confirmDialogCopy: '',
  confirmDialogConfirmLabel: '',
  confirmDialogSelectionCount: 0,
  confirmDialogBusy: false,
  previewId: null,
  previewTransitionRect: null,
  previewTransitionSrc: '',
  loadedCount: COLLECTION_PAGE_SIZE,
  activeYear: null,
  activeSectionAnchor: '',
  activeScrubberLabel: '',
  isYearScrubbing: false,
  scrubberVisible: false,
  virtualScrollTop: 0,
  virtualViewportHeight: 0,
  focusedTileId: null,
  mediaItems: [],
  liveMediaSignature: '',
  isLibraryLoading: true,
  storageSummary: { ...defaultStorageSummary },
  liveSyncAttempts: 0,
  layoutWidth: 0,
  binItems: [],
  isBinLoading: false,
  binSelectedIds: new Set(),
  toastMessage: '',
  toastType: 'error',
  toastTimeoutId: 0,
  infoOpen: false,
  previewImmersive: false,
  lastSelectedId: null,
  needsLogin: false,
  loginError: '',
  loginUsername: '',
  loginPassword: '',
  isLoggingIn: false,
  adminUsername: '',
  adminDisplayName: '',
  adminAvatarData: '',
  avatarMenuOpen: false,
  adminPanelOpen: false,
  adminPanelTab: 'account',
  adminPanelLoading: false,
  adminPanelBusy: false,
  adminPanelError: '',
  adminMigrationStatus: null,
  adminMigrationLoading: false,
  adminMigrationError: '',
  adminOrphanScanLoading: false,
  adminOrphanScanError: '',
  adminOrphanScanResult: null,
  adminTelegramChannels: [],
  adminTelegramLoading: false,
  adminTelegramError: '',
  adminTelegramBusy: false,
  renameAlbumDialogOpen: false,
  renameAlbumTarget: '',
  renameAlbumDraftName: '',
  renameAlbumError: '',
  renameAlbumBusy: false,
  adminProfileDraft: createEmptyAdminProfileDraft(),
  adminPageDraft: createEmptyAdminPageDraft(),
  adminCloudDraft: createEmptyAdminCloudDraft(),
  adminPageConfigSource: [],
  adminOthersConfigSource: null,
  storagePanelOpen: false,
  dimensionCache: new Map()
};

let dimensionPatchTimer = 0;

const refs = {
  root: null,
  scrollRegion: null,
  sectionAnchors: [],
  contentInner: null,
  sectionItemIds: new Map(),
  timelineLayoutSections: [],
  timelineVirtualSignature: '',
  timelineVirtualEnabled: false
};

let mounted = false;
let historyPatched = false;
let liveObserver = null;
let liveSyncRaf = 0;
let liveSyncPromise = null;
let pendingSyncForceRender = false;
let timelineRenderRaf = 0;
let scrollRestoring = false;
const sectionRangeCache = new Map(); // anchorId → { startIndex, endIndex }
let persistedAlbumStatePromise = null;
let pendingPersistedAlbumSnapshot = null;
const ADMIN_ORPHAN_SCAN_LIMIT = 20;

const touchZoom = {
  active: false,
  isPinch: false,
  isPan: false,
  startDist: 0,
  startScale: 1,
  currentScale: 1,
  startMidX: 0,
  startMidY: 0,
  startTx: 0,
  startTy: 0,
  tx: 0,
  ty: 0,
  lastTap: 0
};

function _tzDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function _tzMid(touches) {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2
  };
}

function _tzApply(el) {
  el.style.transform = `scale(${touchZoom.currentScale}) translate(${touchZoom.tx / touchZoom.currentScale}px,${touchZoom.ty / touchZoom.currentScale}px)`;
  el.style.cursor = touchZoom.currentScale > 1.05 ? 'zoom-out' : 'zoom-in';
}

function _tzReset(el) {
  touchZoom.currentScale = 1;
  touchZoom.tx = 0;
  touchZoom.ty = 0;
  el.style.transition = 'transform 280ms ease';
  el.style.transform = '';
  window.setTimeout(() => { el.style.transition = ''; }, 290);
}

function setupPreviewTouchHandlers() {
  if (!refs.root || !state.previewId) {
    return;
  }
  const stage = refs.root.querySelector('.cml-preview__stage');
  const mediaEl = stage ? stage.querySelector('.cml-preview__media') : null;
  if (!stage || !mediaEl) {
    return;
  }

  stage.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      touchZoom.isPinch = true;
      touchZoom.isPan = false;
      touchZoom.startDist = _tzDist(e.touches);
      touchZoom.startScale = touchZoom.currentScale;
      const mid = _tzMid(e.touches);
      touchZoom.startMidX = mid.x;
      touchZoom.startMidY = mid.y;
      touchZoom.startTx = touchZoom.tx;
      touchZoom.startTy = touchZoom.ty;
    } else if (e.touches.length === 1) {
      touchZoom.isPinch = false;
      touchZoom.startMidX = e.touches[0].clientX;
      touchZoom.startMidY = e.touches[0].clientY;
      if (touchZoom.currentScale > 1.05) {
        touchZoom.isPan = true;
        touchZoom.startTx = touchZoom.tx;
        touchZoom.startTy = touchZoom.ty;
      } else {
        touchZoom.isPan = false;
      }
    }
  }, { passive: false });

  stage.addEventListener('touchmove', (e) => {
    if (touchZoom.isPinch && e.touches.length === 2) {
      e.preventDefault();
      const dist = _tzDist(e.touches);
      const scale = Math.max(1, Math.min(6, touchZoom.startScale * (dist / touchZoom.startDist)));
      touchZoom.currentScale = scale;
      const mid = _tzMid(e.touches);
      touchZoom.tx = touchZoom.startTx + (mid.x - touchZoom.startMidX);
      touchZoom.ty = touchZoom.startTy + (mid.y - touchZoom.startMidY);
      _tzApply(mediaEl);
    } else if (touchZoom.isPan && e.touches.length === 1) {
      e.preventDefault();
      touchZoom.tx = touchZoom.startTx + (e.touches[0].clientX - touchZoom.startMidX);
      touchZoom.ty = touchZoom.startTy + (e.touches[0].clientY - touchZoom.startMidY);
      _tzApply(mediaEl);
    }
  }, { passive: false });

  stage.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (e.changedTouches.length === 1 && e.touches.length === 0) {
      if (now - touchZoom.lastTap < 280) {
        if (touchZoom.currentScale > 1.05) {
          _tzReset(mediaEl);
        } else {
          touchZoom.currentScale = 2.5;
          touchZoom.tx = 0;
          touchZoom.ty = 0;
          mediaEl.style.transition = 'transform 240ms ease';
          _tzApply(mediaEl);
          window.setTimeout(() => { mediaEl.style.transition = ''; }, 250);
        }
        touchZoom.lastTap = 0;
      } else {
        touchZoom.lastTap = now;
      }
    }
    if (e.touches.length === 0) {
      touchZoom.isPinch = false;
      if (touchZoom.currentScale < 1.05) {
        _tzReset(mediaEl);
        // swipe nav when not zoomed
        const swipeX = e.changedTouches[0].clientX - touchZoom.startMidX;
        const swipeY = Math.abs(e.changedTouches[0].clientY - touchZoom.startMidY);
        if (Math.abs(swipeX) > 48 && Math.abs(swipeX) > swipeY * 1.5) {
          movePreview(swipeX < 0 ? 1 : -1);
        }
      }
      touchZoom.isPan = false;
    }
  }, { passive: true });
}

async function fetchAdminIdentity() {
  try {
    const res = await fetch('/api/manage/account', { credentials: 'same-origin' });
    if (res.ok) {
      const data = await res.json();
      if (data.username) {
        applyAdminIdentity(data, { shouldRender: true });
        return;
      }
    }
  } catch { /* silent */ }

  try {
    const res = await fetch('/api/manage/me', { credentials: 'same-origin' });
    if (res.ok) {
      const data = await res.json();
      if (data.username) {
        applyAdminIdentity({ username: data.username, displayName: data.username, avatarData: '' }, { shouldRender: true });
      }
    }
  } catch { /* silent */ }
}

function captureDimension(img, tile) {
  const id = tile?.dataset?.tileId || tile?.dataset?.id;
  if (!id) return;
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!nw || !nh) return;
  const item = state.mediaItems.find((m) => m.id === id) || state.binItems.find((m) => m.id === id);
  if (!item) return;
  const storedAspect = item.width / item.height;
  const naturalAspect = nw / nh;
  if (Math.abs(storedAspect - naturalAspect) < 0.05) return;
  state.dimensionCache.set(id, { width: nw, height: nh });
  clearTimeout(dimensionPatchTimer);
  dimensionPatchTimer = window.setTimeout(applyDimensionPatch, 150);
}

function applyDimensionPatch() {
  if (state.dimensionCache.size === 0) return;
  let changed = false;
  state.dimensionCache.forEach(({ width, height }, id) => {
    const mediaIdx = state.mediaItems.findIndex((m) => m.id === id);
    if (mediaIdx !== -1) {
      state.mediaItems[mediaIdx] = { ...state.mediaItems[mediaIdx], width, height };
      changed = true;
    }
    const binIdx = state.binItems.findIndex((m) => m.id === id);
    if (binIdx !== -1) {
      state.binItems[binIdx] = { ...state.binItems[binIdx], width, height };
      changed = true;
    }
  });
  state.dimensionCache.clear();
  if (changed) render();
}

function setupImageLoadAnimations() {
  if (!refs.root) {
    return;
  }
  // Collect cached-image dimension mismatches synchronously so we can patch
  // before the browser paints — portrait photos then never appear as squares.
  let hasCachedMismatch = false;
  refs.root.querySelectorAll('.cml-media-tile__image').forEach((img) => {
    const tile = img.closest('.cml-media-tile');
    if (!tile) {
      return;
    }
    if (img.complete && img.naturalWidth > 0) {
      // Skip fade-in for already-cached images (avoids flash on every render)
      img.style.transition = 'none';
      tile.classList.add('is-img-loaded');
      const id = tile.dataset?.tileId || tile.dataset?.id;
      if (id) {
        const nw = img.naturalWidth;
        const nh = img.naturalHeight;
        const item = state.mediaItems.find((m) => m.id === id) || state.binItems.find((m) => m.id === id);
        if (item && nw && nh && Math.abs(item.width / item.height - nw / nh) >= 0.05) {
          state.dimensionCache.set(id, { width: nw, height: nh });
          hasCachedMismatch = true;
        }
      }
      return;
    }
    img.addEventListener('load', () => {
      tile.classList.add('is-img-loaded');
      captureDimension(img, tile);
    }, { once: true });
    img.addEventListener('error', () => tile.classList.add('is-img-loaded'), { once: true });
  });
  // Apply cached mismatches synchronously — render() runs before the browser
  // gets a chance to paint, so the user never sees the wrong aspect ratio.
  if (hasCachedMismatch) {
    clearTimeout(dimensionPatchTimer);
    applyDimensionPatch();
  }

  // Videos: seek to first frame to get a thumbnail
  refs.root.querySelectorAll('.cml-media-tile video').forEach((video) => {
    const tile = video.closest('.cml-media-tile');
    if (!tile) {
      return;
    }
    const markLoaded = () => tile.classList.add('is-img-loaded');
    if (video.readyState >= 2) {
      markLoaded();
      return;
    }
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = 0.001;
    }, { once: true });
    video.addEventListener('seeked', markLoaded, { once: true });
    window.setTimeout(markLoaded, 3000); // fallback
  });
}

function snapshotRect(element) {
  if (!(element instanceof Element)) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return null;
  }
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  };
}

function getMediaSourceFromTile(tile) {
  if (!(tile instanceof Element)) {
    return '';
  }
  const img = tile.querySelector('img');
  if (img instanceof HTMLImageElement) {
    return img.currentSrc || img.src || '';
  }
  const video = tile.querySelector('video');
  if (video instanceof HTMLVideoElement) {
    return video.poster || video.currentSrc || video.src || '';
  }
  return '';
}

function resolvePreviewItem(items = getAllItems(), {
  id = state.previewId,
  sourceHint = state.previewTransitionSrc
} = {}) {
  return findPreviewMatch(items, { id, sourceHint });
}

function getPreviewMediaElement() {
  if (!refs.root) {
    return null;
  }
  const stage = refs.root.querySelector('.cml-preview__stage');
  if (!stage) {
    return null;
  }
  const mediaEl = stage.querySelector('.cml-preview__media');
  return mediaEl instanceof HTMLElement ? mediaEl : null;
}

function runPreviewSharedElementTransition({ src, startRect, endRect, startRadius = 0, endRadius = 0 }) {
  if (!src || !startRect || !endRect) {
    return null;
  }
  const ghost = document.createElement('img');
  ghost.src = src;
  ghost.alt = '';
  ghost.style.position = 'fixed';
  ghost.style.left = `${startRect.left}px`;
  ghost.style.top = `${startRect.top}px`;
  ghost.style.width = `${startRect.width}px`;
  ghost.style.height = `${startRect.height}px`;
  ghost.style.objectFit = 'cover';
  ghost.style.transformOrigin = 'top left';
  ghost.style.zIndex = '999999';
  ghost.style.pointerEvents = 'none';
  ghost.style.borderRadius = `${startRadius}px`;
  ghost.style.willChange = 'transform, border-radius, opacity';
  document.body.appendChild(ghost);

  const dx = endRect.left - startRect.left;
  const dy = endRect.top - startRect.top;
  const scaleX = endRect.width / startRect.width;
  const scaleY = endRect.height / startRect.height;

  const animation = ghost.animate(
    [
      { transform: 'translate(0px, 0px) scale(1)', borderRadius: `${startRadius}px`, opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`, borderRadius: `${endRadius}px`, opacity: 1 }
    ],
    { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' }
  );

  const finalize = () => {
    ghost.remove();
  };
  animation.finished.then(finalize).catch(finalize);
  return animation;
}

function animatePreviewOpenFromTile() {
  if (!refs.root || previewTransitionInFlight) {
    return;
  }
  const panel = refs.root.querySelector('.cml-preview__panel');
  const backdrop = refs.root.querySelector('.cml-preview__backdrop');
  if (!(panel instanceof HTMLElement) || typeof panel.animate !== 'function') {
    return;
  }

  previewTransitionInFlight = true;

  backdrop?.animate?.(
    [{ opacity: 0 }, { opacity: 1 }],
    { duration: 150, easing: 'ease-out', fill: 'both' }
  );
  const mediaEl = getPreviewMediaElement();
  const endRect = snapshotRect(mediaEl);
  const startRect = state.previewTransitionRect;
  const shouldSharedTransition = Boolean(startRect && endRect && state.previewTransitionSrc);
  let animation = null;

  if (shouldSharedTransition && mediaEl) {
    const computed = window.getComputedStyle(mediaEl);
    const endRadius = parseFloat(computed.borderRadius || '0') || 0;
    mediaEl.style.opacity = '0';
    animation = runPreviewSharedElementTransition({
      src: state.previewTransitionSrc,
      startRect,
      endRect,
      startRadius: 0,
      endRadius,
    });
    panel.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 160, easing: 'ease-out', fill: 'both' }
    );
    animation?.finished
      .catch(() => {})
      .finally(() => {
        if (mediaEl) {
          mediaEl.style.opacity = '';
        }
      });
  } else {
    animation = panel.animate(
      [
        {
          transform: 'translateY(16px) scale(0.985)',
          opacity: 0
        },
        {
          transform: 'translateY(0px) scale(1)',
          opacity: 1
        }
      ],
      {
        duration: 180,
        easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)',
        fill: 'both'
      }
    );
  }

  (animation?.finished || Promise.resolve())
    .catch(() => {})
    .finally(() => {
      previewTransitionInFlight = false;
    });
}

function animatePreviewCloseToTile(onComplete) {
  if (previewTransitionInFlight) {
    return;
  }
  if (!refs.root) {
    onComplete();
    return;
  }
  const panel = refs.root.querySelector('.cml-preview__panel');
  const backdrop = refs.root.querySelector('.cml-preview__backdrop');
  if (!(panel instanceof HTMLElement) || typeof panel.animate !== 'function') {
    onComplete();
    return;
  }

  previewTransitionInFlight = true;

  const mediaEl = getPreviewMediaElement();
  const startRect = snapshotRect(mediaEl);
  const tile = state.previewId
    ? refs.root.querySelector(`.cml-media-tile[data-tile-id="${state.previewId}"]`)
    : null;
  const endRect = snapshotRect(tile);
  const shouldSharedTransition = Boolean(startRect && endRect && state.previewTransitionSrc);

  backdrop?.animate?.(
    [{ opacity: 1 }, { opacity: 0 }],
    { duration: 120, easing: 'ease-in', fill: 'both' }
  );

  let animation = null;
  if (shouldSharedTransition && mediaEl) {
    const computed = window.getComputedStyle(mediaEl);
    const startRadius = parseFloat(computed.borderRadius || '0') || 0;
    mediaEl.style.opacity = '0';
    animation = runPreviewSharedElementTransition({
      src: state.previewTransitionSrc,
      startRect,
      endRect,
      startRadius,
      endRadius: 0,
    });
  } else {
    animation = panel.animate(
      [
        {
          transform: 'translateY(0px) scale(1)',
          opacity: 1
        },
        {
          transform: 'translateY(14px) scale(0.985)',
          opacity: 0
        }
      ],
      {
        duration: 140,
        easing: 'ease-in',
        fill: 'both'
      }
    );
  }

  (animation?.finished || Promise.resolve())
    .catch(() => {})
    .finally(() => {
      if (mediaEl) {
        mediaEl.style.opacity = '';
      }
      previewTransitionInFlight = false;
      onComplete();
    });
}

function setPreviewInfoOpen(isOpen, { allowRenderFallback = true } = {}) {
  const nextOpen = Boolean(isOpen);
  state.infoOpen = nextOpen;
  if (!refs.root) {
    if (allowRenderFallback) {
      render();
    }
    return;
  }
  const preview = refs.root.querySelector('.cml-preview');
  const infoPanel = refs.root.querySelector('.cml-preview__info');
  const toggleButton = refs.root.querySelector('.cml-preview__icon-action[data-action="toggle-info"]');

  if (!(preview instanceof HTMLElement) || !(infoPanel instanceof HTMLElement) || !(toggleButton instanceof HTMLElement)) {
    if (allowRenderFallback) {
      render();
    }
    return;
  }

  preview.classList.toggle('has-info', nextOpen);
  infoPanel.classList.toggle('is-open', nextOpen);
  infoPanel.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');
  toggleButton.classList.toggle('is-selected', nextOpen);
  toggleButton.setAttribute('aria-label', nextOpen ? 'Hide details' : 'Show details');
  toggleButton.setAttribute('aria-pressed', nextOpen ? 'true' : 'false');
}

let yearScrollerDragActive = false;
let scrubberHideTimeoutId = 0;
let previewTransitionInFlight = false;
let lastContentViewKey = '';
let contentTransitionTimeoutId = 0;

function clearScrubberHideTimeout() {
  if (scrubberHideTimeoutId) {
    window.clearTimeout(scrubberHideTimeoutId);
    scrubberHideTimeoutId = 0;
  }
}

function setScrubberVisible(isVisible) {
  state.scrubberVisible = Boolean(isVisible);
  if (!refs.root) {
    return;
  }
  const scroller = refs.root.querySelector('.cml-scrubber');
  if (scroller) {
    scroller.classList.toggle('is-visible', state.scrubberVisible);
  }
}

function revealScrubber({ keepAlive = false } = {}) {
  clearScrubberHideTimeout();
  setScrubberVisible(true);
  if (keepAlive || state.isYearScrubbing) {
    return;
  }
  scrubberHideTimeoutId = window.setTimeout(() => {
    if (state.isYearScrubbing) {
      return;
    }
    setScrubberVisible(false);
  }, 900);
}

function setYearScrubberEngaged(isEngaged) {
  state.isYearScrubbing = Boolean(isEngaged);
  if (state.isYearScrubbing) {
    revealScrubber({ keepAlive: true });
  } else {
    revealScrubber();
  }
  if (!refs.root) {
    return;
  }
  const scroller = refs.root.querySelector('.cml-scrubber');
  if (!scroller) {
    return;
  }
  scroller.classList.toggle('is-scrubbing', state.isYearScrubbing);
}

function setupYearScrollerDrag() {
  if (!refs.root) {
    return;
  }
  const scroller = refs.root.querySelector('.cml-scrubber');
  if (!scroller) {
    return;
  }
  revealScrubber();

  scroller.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) {
      return;
    }
    yearScrollerDragActive = true;
    setYearScrubberEngaged(true);
    scroller.setPointerCapture(e.pointerId);
    scroller.style.cursor = 'grabbing';
    hitYearButton(scroller, e.clientY);
  });

  scroller.addEventListener('pointermove', (e) => {
    if (!yearScrollerDragActive) {
      return;
    }
    hitYearButton(scroller, e.clientY);
  });

  const endDrag = () => {
    if (!yearScrollerDragActive) {
      return;
    }
    yearScrollerDragActive = false;
    setYearScrubberEngaged(false);
    scroller.style.cursor = '';
  };

  scroller.addEventListener('pointerup', endDrag);
  scroller.addEventListener('pointercancel', endDrag);
  scroller.addEventListener('pointerleave', () => {
    if (!yearScrollerDragActive) {
      setYearScrubberEngaged(false);
    }
  });
  scroller.addEventListener('pointerenter', () => {
    if (!yearScrollerDragActive) {
      revealScrubber();
    }
  });
}

function hitYearButton(scroller, clientY) {
  const ticks = scroller.querySelectorAll('.cml-scrubber__tick[data-anchor]');
  let hit = null;
  for (const tick of ticks) {
    const rect = tick.getBoundingClientRect();
    if (clientY >= rect.top - 12 && clientY <= rect.bottom + 12) {
      hit = tick;
      break;
    }
  }
  if (hit && hit.dataset.anchor && hit.dataset.anchor !== state.activeSectionAnchor) {
    state.activeSectionAnchor = hit.dataset.anchor;
    state.activeYear = hit.dataset.year || state.activeYear;
    state.activeScrubberLabel = normalizeText(hit.dataset.label || hit.dataset.year || state.activeScrubberLabel);
    scrollToYear(hit.dataset.anchor);
    updateScrubberThumb();
  }
  revealScrubber({ keepAlive: yearScrollerDragActive });
}

let storageSyncPromise = null;

function shouldMount(pathname = window.location.pathname, search = window.location.search) {
  if (window.sessionStorage.getItem('cmlSkipMount') === '1') {
    window.sessionStorage.removeItem('cmlSkipMount');
    return false;
  }
  const params = new URLSearchParams(search);
  if (params.get('cmlNative') === '1') {
    return false;
  }
  if (pathname.startsWith('/login') || pathname.startsWith('/browse')) {
    return false;
  }
  if (pathname === '/' && hasPendingUploadRequest()) {
    return false;
  }
  return pathname === '/' || pathname.startsWith('/dashboard');
}

function normalizePreferredLibraryRoute() {
  const pathname = window.location.pathname || '/';
  if (pathname !== '/' || hasPendingUploadRequest()) {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get('cmlNative') === '1') {
    return false;
  }
  window.history.replaceState({}, '', '/dashboard');
  return true;
}

function ensureRoot() {
  let root = document.getElementById('codex-media-library-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'codex-media-library-root';
    document.body.appendChild(root);
  }
  refs.root = root;
  return root;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function formatScrubberLabel(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${MONTH_SHORT_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function toBoolean(value) {
  return value === true || value === 'true' || value === 1;
}

function formatStorageLabel(valueMb) {
  const numeric = Math.max(0, Number(valueMb) || 0);
  if (numeric >= 1024 * 1024) {
    return `${(numeric / (1024 * 1024)).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')} TB`;
  }
  if (numeric >= 1024) {
    return `${(numeric / 1024).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')} GB`;
  }
  return `${numeric.toFixed(numeric >= 100 ? 0 : numeric >= 10 ? 1 : 2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')} MB`;
}

function formatQuotaSummary(totalQuotaGb) {
  return 'INFINITE cloud ceiling';
}

function itemCountLabel(count) {
  const numeric = Math.max(0, Number(count) || 0);
  return `${numeric} item${numeric === 1 ? '' : 's'}`;
}

function buildStorageInsights() {
  const liveItems = safeArray(state.mediaItems);
  const binItems = safeArray(state.binItems);
  const totalUsedMb = Math.max(0, Number(state.storageSummary?.usedMb) || 0);
  const totalQuotaGb = Math.max(0, Number(state.storageSummary?.totalQuotaGb) || 0);
  const liveCount = liveItems.length;
  const binCount = binItems.length;
  const totalCount = liveCount + binCount;
  const allItems = [...liveItems, ...binItems];

  const sumSizeMb = (items) => items.reduce((sum, item) => sum + Math.max(0, Number(item?.sizeMb) || 0), 0);
  const totalKnownMb = sumSizeMb(allItems);
  const estimateSizeMb = (items) => {
    const knownMb = sumSizeMb(items);
    if (knownMb > 0 || !totalKnownMb || !totalUsedMb || !items.length || !totalCount) {
      return knownMb;
    }
    return (totalUsedMb * items.length) / totalCount;
  };

  const categories = [
    {
      title: 'Large photos and videos',
      copy: 'Items above 25 MB that are taking the most room.',
      iconName: 'photos',
      items: allItems.filter((item) => Math.max(0, Number(item?.sizeMb) || 0) >= 25)
    },
    {
      title: 'Videos',
      copy: 'Video files usually account for the largest storage share.',
      iconName: 'play',
      items: allItems.filter((item) => item?.type === 'video')
    },
    {
      title: 'Documents',
      copy: 'Document-like captures and scans currently in the library.',
      iconName: 'documents',
      items: allItems.filter((item) => item?.isDocumentLike)
    },
    {
      title: 'Recycle bin',
      copy: 'Deleted items that still occupy cloud storage until expiry.',
      iconName: 'trash',
      items: binItems
    }
  ].map((entry) => {
    const sizeMb = estimateSizeMb(entry.items);
    return {
      iconName: entry.iconName,
      title: entry.title,
      copy: entry.copy,
      sizeLabel: entry.items.length ? formatStorageLabel(sizeMb) : '0 MB',
      countLabel: itemCountLabel(entry.items.length)
    };
  });

  return {
    totalUsageLabel: formatStorageLabel(totalUsedMb),
    quotaLabel: formatQuotaSummary(totalQuotaGb),
    totalCount,
    totalCountLabel: `${itemCountLabel(totalCount)} across library and bin`,
    categories
  };
}

function getPageConfigValue(config, id) {
  const record = safeArray(config).find((item) => item && item.id === id);
  const value = record && Object.prototype.hasOwnProperty.call(record, 'value') ? record.value : '';
  return value == null ? '' : String(value);
}

function createAdminPageDraft(config) {
  return {
    siteTitle: getPageConfigValue(config, 'siteTitle'),
    ownerName: getPageConfigValue(config, 'ownerName'),
    logoUrl: getPageConfigValue(config, 'logoUrl'),
    announcement: getPageConfigValue(config, 'announcement'),
    adminBkImg: getPageConfigValue(config, 'adminBkImg'),
    adminLoginBkImg: getPageConfigValue(config, 'adminLoginBkImg')
  };
}

function applyAdminPageDraftToConfig(config, draft) {
  const valueMap = {
    siteTitle: draft.siteTitle,
    ownerName: draft.ownerName,
    logoUrl: draft.logoUrl,
    announcement: draft.announcement,
    adminBkImg: draft.adminBkImg,
    adminLoginBkImg: draft.adminLoginBkImg
  };
  return {
    config: safeArray(config).map((item) => (
      item && Object.prototype.hasOwnProperty.call(valueMap, item.id)
        ? { ...item, value: valueMap[item.id] }
        : item
    ))
  };
}

function createAdminCloudDraft(settings) {
  return {
    publicBrowseEnabled: Boolean(settings?.publicBrowse?.enabled),
    publicBrowseAllowedDir: normalizeText(settings?.publicBrowse?.allowedDir),
    randomImageEnabled: Boolean(settings?.randomImageAPI?.enabled),
    randomImageAllowedDir: normalizeText(settings?.randomImageAPI?.allowedDir),
    telemetryEnabled: Boolean(settings?.telemetry?.enabled)
  };
}

function applyAdminCloudDraftToSettings(settings, draft) {
  return {
    ...(settings || {}),
    telemetry: {
      ...(settings?.telemetry || {}),
      enabled: Boolean(draft.telemetryEnabled),
      fixed: false
    },
    randomImageAPI: {
      ...(settings?.randomImageAPI || {}),
      enabled: Boolean(draft.randomImageEnabled),
      allowedDir: normalizeText(draft.randomImageAllowedDir),
      fixed: false
    },
    publicBrowse: {
      ...(settings?.publicBrowse || {}),
      enabled: Boolean(draft.publicBrowseEnabled),
      allowedDir: normalizeText(draft.publicBrowseAllowedDir),
      fixed: false
    }
  };
}

function resetAdminPasswordDraft() {
  state.adminProfileDraft.currentPassword = '';
  state.adminProfileDraft.newPassword = '';
  state.adminProfileDraft.confirmPassword = '';
}

function applyAdminIdentity(profile, { shouldRender = false } = {}) {
  const username = normalizeText(profile?.username);
  const displayName = normalizeText(profile?.displayName) || username;
  const avatarData = normalizeText(profile?.avatarData);
  state.adminUsername = username;
  state.adminDisplayName = displayName;
  state.adminAvatarData = avatarData;
  if (shouldRender && refs.root) {
    render();
  }
}

function hydrateAdminProfileDraft(profile) {
  state.adminProfileDraft = {
    ...createEmptyAdminProfileDraft(),
    username: normalizeText(profile?.username),
    displayName: normalizeText(profile?.displayName) || normalizeText(profile?.username),
    avatarData: normalizeText(profile?.avatarData)
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

function normalizeAlbumKey(value) {
  return normalizeText(value).toLowerCase();
}

function decodeValue(value) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

function hashString(value) {
  let hash = 0;
  const input = String(value || '');
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function getPersistentItemKey(item) {
  return normalizeText(item?.sourceId || item?.id || '');
}

function isSameRecord(left, right) {
  const leftEntries = Object.entries(left || {});
  const rightEntries = Object.entries(right || {});
  return leftEntries.length === rightEntries.length
    && leftEntries.every(([key, value]) => right[key] === value);
}

function getStoredAlbumCoverKey(albumName) {
  const albumKey = normalizeAlbumKey(albumName);
  return albumKey ? normalizeText(state.albumCovers[albumKey] || '') : '';
}

function findAlbumCoverItem(albumName, items) {
  const albumKey = normalizeAlbumKey(albumName);
  const albumItems = safeArray(items).filter((item) => normalizeAlbumKey(resolveCollectionAlbum(item)) === albumKey);
  if (!albumItems.length) {
    return { item: null, isCustom: false };
  }
  const customCoverKey = getStoredAlbumCoverKey(albumName);
  if (customCoverKey) {
    const customItem = albumItems.find((item) => getPersistentItemKey(item) === customCoverKey);
    if (customItem) {
      return { item: customItem, isCustom: true };
    }
  }
  return { item: albumItems[0], isCustom: false };
}

function getAssignedAlbumName(item) {
  const key = getPersistentItemKey(item);
  return key ? normalizeText(state.albumAssignments[key] || '') : '';
}

function getStoredCollectionAlbum(item) {
  return normalizeText(item?.collectionAlbum || item?.tgAlbumPath || item?.metadataAlbum || '');
}

function resolveCollectionAlbum(item) {
  return getAssignedAlbumName(item) || getStoredCollectionAlbum(item);
}

function resolveItemAlbum(item) {
  return resolveCollectionAlbum(item) || normalizeText(item?.album || '') || 'Library';
}

function applyAlbumOverride(item) {
  const album = resolveItemAlbum(item);
  const collectionAlbum = resolveCollectionAlbum(item);
  if (album !== item.album || collectionAlbum !== normalizeText(item?.collectionAlbum || '')) {
    return { ...item, album, collectionAlbum };
  }
  return item;
}

function getAvailableAlbumNames(items = state.mediaItems) {
  const names = [];
  const seen = new Set();
  const pushAlbum = (value) => {
    const albumName = normalizeText(value);
    const lookupKey = albumName.toLowerCase();
    if (!albumName || seen.has(lookupKey)) {
      return;
    }
    seen.add(lookupKey);
    names.push(albumName);
  };

  state.albumNames.forEach(pushAlbum);
  safeArray(items).forEach((item) => pushAlbum(resolveCollectionAlbum(item)));
  Object.values(state.albumAssignments).forEach(pushAlbum);
  return names;
}

function getAlbumSortTimestamp(item) {
  const value = item?.takenAt || item?.createdAt || item?.updatedAt || '';
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildPreviewAlbumEntries(items = getAllItems()) {
  const groups = new Map();
  const ensureGroup = (value) => {
    const albumName = normalizeText(value);
    const lookupKey = albumName.toLowerCase();
    if (!albumName) {
      return null;
    }
    if (!groups.has(lookupKey)) {
      groups.set(lookupKey, {
        name: albumName,
        items: [],
        lastModifiedAt: 0,
        scope: 'mine'
      });
    }
    return groups.get(lookupKey);
  };

  state.albumNames.forEach((albumName) => {
    ensureGroup(albumName);
  });

  safeArray(items).forEach((item) => {
    const group = ensureGroup(resolveCollectionAlbum(item));
    if (!group) {
      return;
    }
    group.items.push(item);
    group.lastModifiedAt = Math.max(group.lastModifiedAt, getAlbumSortTimestamp(item));
  });

  return [...groups.values()]
    .map((group) => {
      const { item: coverItem } = findAlbumCoverItem(group.name, group.items);
      return {
        name: group.name,
        itemCount: group.items.length,
        coverUrl: normalizeText(coverItem?.thumbnailUrl || coverItem?.posterUrl || coverItem?.sourceUrl || ''),
        lastModifiedAt: group.lastModifiedAt,
        scope: group.scope
      };
    })
    .sort((left, right) => {
      if (right.lastModifiedAt !== left.lastModifiedAt) {
        return right.lastModifiedAt - left.lastModifiedAt;
      }
      return left.name.localeCompare(right.name);
    });
}

function persistAlbumNames() {
  queuePersistedAlbumState();
}

function persistAlbumAssignments() {
  queuePersistedAlbumState();
}

function persistAlbumCovers() {
  queuePersistedAlbumState();
}

function ensureAlbumName(value) {
  const albumName = normalizeText(value).replace(/\s+/g, ' ');
  if (!albumName) {
    return '';
  }
  const existing = state.albumNames.find((item) => item.toLowerCase() === albumName.toLowerCase());
  if (existing) {
    return existing;
  }
  state.albumNames = [...state.albumNames, albumName];
  persistAlbumNames();
  return albumName;
}

function stripExtension(value) {
  return String(value || '').replace(FILE_EXTENSION_PATTERN, '');
}

function encodePathForRoute(fileId) {
  return String(fileId || '')
    .split('/')
    .filter(Boolean)
    .map((part) => {
      try {
        return encodeURIComponent(decodeURIComponent(part));
      } catch {
        return encodeURIComponent(part);
      }
    })
    .join('/');
}

function buildFileRoute(fileId, queryParams = null) {
  const encodedPath = encodePathForRoute(fileId);
  const baseRoute = encodedPath ? `/file/${encodedPath}` : '/file/';
  if (!queryParams || baseRoute === '/file/') {
    return baseRoute;
  }
  const params = new URLSearchParams();
  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });
  const queryString = params.toString();
  return queryString ? `${baseRoute}?${queryString}` : baseRoute;
}

function buildDownloadRoute(fileId) {
  const baseRoute = buildFileRoute(fileId);
  return baseRoute === '/file/' ? baseRoute : `${baseRoute}?download=1`;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseTimestamp(value, fallbackIndex = 0) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric < 1000000000000 ? numeric * 1000 : numeric;
  }
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return Date.now() - fallbackIndex * 60000;
}

function getDateDisplay(date) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} ${hh}:${mm}`;
}

function createDatePartsFromDate(date, now = new Date()) {
  return {
    takenAt: date.toISOString(),
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    monthLabel: MONTH_NAMES[date.getMonth()],
    timelineLabel: createTimelineLabel(date, now),
    displayTakenAt: getDateDisplay(date)
  };
}

function resolveRelativeWeekday(label, now = new Date()) {
  const weekday = WEEKDAY_INDEX[label.toLowerCase()];
  if (weekday === undefined) {
    return null;
  }
  const date = new Date(now);
  date.setHours(12, 0, 0, 0);
  let diff = (date.getDay() - weekday + 7) % 7;
  if (diff === 0) {
    diff = 7;
  }
  date.setDate(date.getDate() - diff);
  return date;
}

function parseDateMetadata(candidates, domIndex) {
  const now = new Date();
  const absolutePattern = /((?:20\d{2}|\d{2})[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01]))(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/;
  const monthYearPattern = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i;
  const yearPattern = /\b(20\d{2})\b/;

  for (const rawCandidate of candidates) {
    const candidate = normalizeText(rawCandidate);
    if (!candidate) {
      continue;
    }

    const absoluteMatch = candidate.match(absolutePattern);
    if (absoluteMatch) {
      const [yearText, monthText, dayText] = absoluteMatch[1].replace(/[/.]/g, '-').split('-');
      const year = yearText.length === 2 ? Number(`20${yearText}`) : Number(yearText);
      const month = Number(monthText);
      const day = Number(dayText);
      const date = new Date(year, month - 1, day, 12, 0, 0, 0);
      if (absoluteMatch[2]) {
        const [hours, minutes, seconds = '0'] = absoluteMatch[2].split(':');
        date.setHours(Number(hours), Number(minutes), Number(seconds), 0);
      }
      return createDatePartsFromDate(date, now);
    }

    if (/\btoday\b/i.test(candidate)) {
      const date = new Date(now);
      date.setHours(12, 0, 0, 0);
      const parts = createDatePartsFromDate(date, now);
      parts.timelineLabel = 'Today';
      parts.displayTakenAt = 'Today';
      return parts;
    }

    if (/\byesterday\b/i.test(candidate)) {
      const date = new Date(now);
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - 1);
      const parts = createDatePartsFromDate(date, now);
      parts.timelineLabel = 'Yesterday';
      parts.displayTakenAt = 'Yesterday';
      return parts;
    }

    const monthYearMatch = candidate.match(monthYearPattern);
    if (monthYearMatch) {
      const month = MONTH_INDEX[monthYearMatch[1].toLowerCase()];
      const year = Number(monthYearMatch[2]);
      const date = new Date(year, month, 1, 12, 0, 0, 0);
      return createDatePartsFromDate(date, now);
    }

    const weekdayLabel = WEEKDAY_NAMES.find((weekday) => new RegExp(`\\b${weekday}\\b`, 'i').test(candidate));
    if (weekdayLabel) {
      const date = resolveRelativeWeekday(weekdayLabel, now);
      if (date) {
        return createDatePartsFromDate(date, now);
      }
    }

    const yearMatch = candidate.match(yearPattern);
    if (yearMatch) {
      const year = Number(yearMatch[1]);
      const date = new Date(year, 0, 1, 12, 0, 0, 0);
      return createDatePartsFromDate(date, now);
    }
  }

  const fallbackDate = new Date(now.getTime() - domIndex * 60000);
  return createDatePartsFromDate(fallbackDate, now);
}

function extractFileNameFromPath(pathLike) {
  const raw = String(pathLike || '').split('#')[0].split('?')[0];
  const parts = raw.split('/');
  return decodeValue(parts[parts.length - 1] || '');
}

function getDownloadFileName(item) {
  return normalizeText(item?.label || extractFileNameFromPath(item?.sourceId) || 'library-item');
}

function collectMetadataCandidates(node) {
  const candidates = new Set();
  const addCandidate = (value) => {
    const text = normalizeText(value);
    if (text) {
      candidates.add(text);
    }
  };

  if (node instanceof HTMLImageElement) {
    addCandidate(node.currentSrc || node.src);
    addCandidate(node.alt);
    addCandidate(node.title);
  }

  let current = node instanceof Element ? node : null;
  for (let depth = 0; current && depth < 6; depth += 1, current = current.parentElement) {
    addCandidate(current.getAttribute('title'));
    addCandidate(current.getAttribute('aria-label'));
    addCandidate(current.getAttribute('data-filename'));
    addCandidate(current.getAttribute('data-name'));
    addCandidate(current.getAttribute('data-id'));
    addCandidate(current.textContent);

    if (current.previousElementSibling instanceof HTMLElement) {
      addCandidate(current.previousElementSibling.textContent);
    }
    if (current.nextElementSibling instanceof HTMLElement) {
      addCandidate(current.nextElementSibling.textContent);
    }
  }

  return [...candidates];
}

function inferFileLabel(candidates, sourceValue) {
  const filePattern = /([A-Za-z0-9][A-Za-z0-9 _-]{0,160}\.(?:jpg|jpeg|png|webp|gif|bmp|avif|heic|heif|mp4|mov|m4v|webm|avi))/i;
  for (const candidate of candidates) {
    const match = candidate.match(filePattern);
    if (match) {
      return match[1];
    }
  }
  const fromSource = extractFileNameFromPath(sourceValue);
  if (FILE_EXTENSION_PATTERN.test(fromSource)) {
    return fromSource;
  }
  return 'Library item';
}

function inferMediaType(candidates, sourceValue, node) {
  const candidateBlob = candidates.join(' ');
  if (VIDEO_EXTENSION_PATTERN.test(candidateBlob) || VIDEO_EXTENSION_PATTERN.test(sourceValue)) {
    return 'video';
  }
  if (node instanceof Element && node.closest('[class*="video"], [data-type="video"]')) {
    return 'video';
  }
  return 'photo';
}

function inferLocationFromCandidates(candidates) {
  const locationPattern = /\b([A-Z][A-Za-z]+(?:,\s*[A-Z][A-Za-z]+)+)\b/;
  for (const candidate of candidates) {
    const match = normalizeText(candidate).match(locationPattern);
    if (match) {
      return match[1];
    }
  }
  return '';
}

function inferTagsFromFileName(fileLabel, type) {
  const base = stripExtension(fileLabel);
  const tags = base
    .split(/[_\-\s]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part && !/^\d+$/.test(part) && part.length > 1)
    .slice(0, 6);
  if (type === 'video' && !tags.includes('video')) {
    tags.push('video');
  }
  return tags;
}

function extractLiveMediaItems() {
  const seen = new Set();
  const items = [];
  const nodes = document.querySelectorAll(LIVE_MEDIA_QUERY);

  nodes.forEach((node, domIndex) => {
    if (!(node instanceof HTMLImageElement)) {
      return;
    }
    if (node.closest(EXCLUDED_MEDIA_ROOT)) {
      return;
    }

    const src = node.currentSrc || node.getAttribute('src') || '';
    if (!src || /logo-sundowner\.svg/i.test(src) || seen.has(src)) {
      return;
    }

    const rect = node.getBoundingClientRect();
    const width = node.naturalWidth || Number(node.getAttribute('width')) || Math.round(rect.width) || 1200;
    const height = node.naturalHeight || Number(node.getAttribute('height')) || Math.round(rect.height) || 900;
    if (width < 72 || height < 72) {
      return;
    }

    const candidates = collectMetadataCandidates(node);
    const fileLabel = inferFileLabel(candidates, src);
    const type = inferMediaType(candidates, src, node);
    const dateParts = parseDateMetadata(candidates, domIndex);
    const album = stripExtension(fileLabel) || 'Library';
    const mimeType = type === 'photo'
      ? inferMimeTypeFromReference(src, fileLabel, '')
      : '';
    const browserPreviewSupported = type !== 'photo' || supportsBrowserImagePreview(mimeType);

    seen.add(src);
    const nextItem = {
      id: `live-${hashString(src)}`,
      sourceId: src,
      sourceUrl: src,
      thumbnailUrl: src,
      posterUrl: '',
      type,
      width,
      height,
      takenAt: dateParts.takenAt,
      displayTakenAt: dateParts.displayTakenAt,
      timelineLabel: dateParts.timelineLabel,
      year: dateParts.year,
      month: dateParts.month,
      day: dateParts.day,
      monthLabel: dateParts.monthLabel,
      album,
      tags: inferTagsFromFileName(fileLabel, type),
      location: inferLocationFromCandidates(candidates),
      favorite: false,
      personLabels: [],
      label: fileLabel,
      sizeMb: 0,
      mimeType,
      browserPreviewSupported,
      isDocumentLike: DOCUMENT_HINT_PATTERN.test(`${src} ${fileLabel}`),
      sortOrder: Date.parse(dateParts.takenAt),
      domIndex
    };
    if (shouldDisplayMediaItem(nextItem)) {
      items.push(nextItem);
    }
  });

  return items
    .sort((left, right) => {
      if (right.sortOrder !== left.sortOrder) {
        return right.sortOrder - left.sortOrder;
      }
      return left.domIndex - right.domIndex;
    })
    .map(({ sortOrder, domIndex, ...item }) => item);
}

function hasUnderlyingSurface() {
  return Boolean(document.querySelector(LIVE_SURFACE_QUERY));
}

function buildDomLookup(items) {
  const lookup = new Map();
  items.forEach((item) => {
    buildMediaLookupKeys(item.sourceId, item.label, item.label).forEach((key) => {
      if (key && !lookup.has(key)) {
        lookup.set(key, item);
      }
    });
  });
  return lookup;
}

function toPositiveNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getActiveAlbumName() {
  return state.primaryFilter === 'Collections' ? normalizeText(state.activeAlbumName) : '';
}

function getAlbumSelectionTarget() {
  return normalizeText(state.albumSelectionTarget);
}

function resetSearchQuery() {
  state.searchQuery = '';
  state.searchDraft = '';
}

function applySearchQuery(nextQuery) {
  state.searchQuery = normalizeText(nextQuery);
  state.searchDraft = nextQuery;
  clearSelection({ shouldRender: false });
  resetLoadedCount();
  render();
}

function matchesSearchQuery(item, query) {
  if (!query) {
    return true;
  }

  const haystack = [
    item.type,
    item.album,
    item.label,
    item.location,
    item.year,
    item.monthLabel,
    item.day,
    item.timelineLabel,
    ...item.tags,
    ...item.personLabels
  ].join(' ').toLowerCase();

  return haystack.includes(query);
}

function buildStorageSummaryUpdate({ usedMb = 0, totalQuotaGb = 0, totalCount = 0, isLoading = false } = {}) {
  return {
    usedMb: Math.max(0, toFiniteNumber(usedMb, 0)),
    totalQuotaGb: Math.max(0, toFiniteNumber(totalQuotaGb, 0)),
    totalCount: Math.max(0, Math.round(toFiniteNumber(totalCount, 0))),
    isLoading: Boolean(isLoading)
  };
}

function sameStorageSummary(left, right) {
  return left.usedMb === right.usedMb
    && left.totalQuotaGb === right.totalQuotaGb
    && left.totalCount === right.totalCount
    && left.isLoading === right.isLoading;
}

function extractConfiguredQuotaGb(uploadConfig) {
  return ['cfr2', 's3']
    .flatMap((sectionKey) => safeArray(uploadConfig?.[sectionKey]?.channels))
    .reduce((sum, channel) => {
      const limit = Number(channel?.quota?.limitGB);
      if (channel?.enabled === false || !channel?.quota?.enabled || !Number.isFinite(limit) || limit <= 0) {
        return sum;
      }
      return sum + limit;
    }, 0);
}

async function apiFetch(url, options = {}) {
  const {
    timeoutMs = 0,
    headers = {},
    signal,
    ...fetchOptions
  } = options;
  let timeoutId = 0;
  let timeoutController = null;
  let requestSignal = signal;

  if (timeoutMs > 0) {
    timeoutController = new AbortController();
    requestSignal = timeoutController.signal;
    if (signal instanceof AbortSignal) {
      if (signal.aborted) {
        timeoutController.abort(signal.reason);
      } else {
        signal.addEventListener('abort', () => timeoutController.abort(signal.reason), { once: true });
      }
    }
    timeoutId = window.setTimeout(() => {
      timeoutController.abort(new DOMException('Request timed out', 'AbortError'));
    }, timeoutMs);
  }

  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...fetchOptions,
      signal: requestSignal,
      headers: {
        Accept: 'application/json',
        ...headers
      }
    });
    if (response.status === 401) {
      state.needsLogin = true;
      render();
      throw new Error('Unauthorized');
    }
    return response;
  } catch (error) {
    if (timeoutMs > 0 && error?.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
}

async function fetchJson(url, options = {}) {
  const response = await apiFetch(url, options);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json();
}

async function postJson(url, payload) {
  const response = await apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    throw new Error(data?.error || `${url} returned ${response.status}`);
  }
  return data;
}

async function loadAdminPanelData() {
  if (state.adminPanelLoading) {
    return;
  }

  state.adminPanelLoading = true;
  state.adminPanelError = '';
  state.adminMigrationError = '';
  render();

  try {
    const [accountResult, pageConfigResult, otherSettingsResult, migrationStatusResult, telegramStatusResult] = await Promise.allSettled([
      fetchJson('/api/manage/account'),
      fetchJson('/api/manage/sysConfig/page'),
      fetchJson('/api/manage/sysConfig/others'),
      fetchJson('/api/manage/migrate/status'),
      fetchJson('/api/manage/telegram-sync/status')
    ]);

    const coreFailure = [accountResult, pageConfigResult, otherSettingsResult].find((result) => result.status === 'rejected');
    if (coreFailure) {
      throw coreFailure.reason;
    }

    const account = accountResult.value;
    const pageConfig = pageConfigResult.value;
    const otherSettings = otherSettingsResult.value;

    applyAdminIdentity(account);
    hydrateAdminProfileDraft(account);
    state.adminPageConfigSource = safeArray(pageConfig?.config);
    state.adminPageDraft = createAdminPageDraft(state.adminPageConfigSource);
    state.adminOthersConfigSource = otherSettings || {};
    state.adminCloudDraft = createAdminCloudDraft(otherSettings || {});

    if (migrationStatusResult.status === 'fulfilled') {
      state.adminMigrationStatus = migrationStatusResult.value || null;
      state.adminMigrationError = '';
    } else {
      state.adminMigrationStatus = null;
      state.adminMigrationError = migrationStatusResult.reason?.message || 'Failed to load migration status';
    }

    if (telegramStatusResult.status === 'fulfilled') {
      const tgData = telegramStatusResult.value;
      state.adminTelegramChannels = Array.isArray(tgData.data) ? tgData.data : (tgData.data ? [tgData.data] : []);
      state.adminTelegramError = '';
    } else {
      state.adminTelegramChannels = [];
    }
  } catch (error) {
    state.adminPanelError = error.message || 'Failed to load admin settings';
  } finally {
    state.adminPanelLoading = false;
    render();
  }
}

async function refreshAdminMigrationStatus({ notify = false } = {}) {
  if (state.adminMigrationLoading) {
    return;
  }

  state.adminMigrationLoading = true;
  state.adminMigrationError = '';
  render();

  try {
    state.adminMigrationStatus = await fetchJson('/api/manage/migrate/status');
    if (notify) {
      showToast('Migration status refreshed', 'success');
    }
  } catch (error) {
    state.adminMigrationError = error.message || 'Failed to load migration status';
  } finally {
    state.adminMigrationLoading = false;
    render();
  }
}

async function runAdminOrphanScan(limit = ADMIN_ORPHAN_SCAN_LIMIT) {
  if (state.adminOrphanScanLoading) {
    return;
  }

  const safeLimit = Number.parseInt(limit, 10);
  const finalLimit = Number.isNaN(safeLimit) ? ADMIN_ORPHAN_SCAN_LIMIT : Math.max(1, Math.min(100, safeLimit));

  state.adminOrphanScanLoading = true;
  state.adminOrphanScanError = '';
  render();

  try {
    state.adminOrphanScanResult = await fetchJson(`/api/manage/migrate/scan-orphan-files?limit=${finalLimit}`);
    const total = Number(state.adminOrphanScanResult?.total) || 0;
    showToast(total > 0 ? `Found ${total} orphan Telegram records` : 'No orphan Telegram records found', 'success');
  } catch (error) {
    state.adminOrphanScanError = error.message || 'Failed to scan orphan Telegram files';
  } finally {
    state.adminOrphanScanLoading = false;
    render();
  }
}

async function refreshAdminTelegram() {
  if (state.adminTelegramLoading) {
    return;
  }
  state.adminTelegramLoading = true;
  state.adminTelegramError = '';
  render();

  try {
    const data = await fetchJson('/api/manage/telegram-sync/status');
    const items = Array.isArray(data.data) ? data.data : (data.data ? [data.data] : []);
    state.adminTelegramChannels = items;
  } catch (error) {
    state.adminTelegramError = error.message || 'Failed to load Telegram status';
  } finally {
    state.adminTelegramLoading = false;
    render();
  }
}

async function adminTelegramAction(action, channelName) {
  if (state.adminTelegramBusy) {
    return;
  }
  state.adminTelegramBusy = true;
  state.adminTelegramError = '';
  render();

  try {
    const enc = encodeURIComponent(channelName);
    if (action === 'setup') {
      await postJson(`/api/manage/telegram-sync/webhook/setup?channelName=${enc}`, {});
      showToast('Webhook registered', 'success');
    } else if (action === 'delete') {
      await postJson(`/api/manage/telegram-sync/webhook/delete?channelName=${enc}`, {});
      showToast('Webhook deleted', 'success');
    } else if (action === 'run') {
      await postJson(`/api/manage/telegram-sync/run?channelName=${enc}`, {});
      showToast('Manual sync completed', 'success');
    }
    await refreshAdminTelegram();
  } catch (error) {
    state.adminTelegramError = error.message || `Action ${action} failed`;
    showToast(state.adminTelegramError, 'error');
  } finally {
    state.adminTelegramBusy = false;
    render();
  }
}

async function submitLogin() {
  if (state.isLoggingIn) {
    return;
  }
  state.isLoggingIn = true;
  state.loginError = '';
  render();

  try {
    const res = await fetch('/api/manage/auth-session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: state.loginUsername, password: state.loginPassword })
    });

    if (res.status === 401) {
      state.loginError = 'Invalid username or password';
    } else if (res.ok) {
      state.needsLogin = false;
      state.loginError = '';
      applyAdminIdentity({
        username: state.loginUsername,
        displayName: state.loginUsername,
        avatarData: ''
      });
      state.loginUsername = '';
      state.loginPassword = '';
      void fetchAdminIdentity();
      void syncStorageSummary({ forceRender: true });
      void syncLiveMedia({ forceRender: true });
    } else {
      state.loginError = 'Login failed, please try again';
    }
  } catch {
    state.loginError = 'Network error, please try again';
  }

  state.isLoggingIn = false;
  render();
}

async function performLogout() {
  try {
    await fetch('/api/manage/logout', { method: 'GET', credentials: 'same-origin' });
  } catch { /* ignore */ }
  state.needsLogin = true;
  state.adminUsername = '';
  state.adminDisplayName = '';
  state.adminAvatarData = '';
  state.avatarMenuOpen = false;
  state.adminPanelOpen = false;
  state.storagePanelOpen = false;
  state.adminPanelError = '';
  state.adminPanelBusy = false;
  state.adminProfileDraft = createEmptyAdminProfileDraft();
  state.loginUsername = '';
  state.loginPassword = '';
  state.loginError = '';
  render();
}

async function performStorageSummarySync({ forceRender = false } = {}) {
  let nextSummary = buildStorageSummaryUpdate({ ...state.storageSummary, isLoading: false });

  try {
    const [quotaResult, uploadResult] = await Promise.allSettled([
      fetchJson('/api/manage/quota', { timeoutMs: STORAGE_REQUEST_TIMEOUT_MS }),
      fetchJson('/api/manage/sysConfig/upload', { timeoutMs: STORAGE_REQUEST_TIMEOUT_MS })
    ]);

    const quotaPayload = quotaResult.status === 'fulfilled' ? quotaResult.value : null;
    const uploadPayload = uploadResult.status === 'fulfilled' ? uploadResult.value : null;

    nextSummary = buildStorageSummaryUpdate({
      usedMb: quotaPayload ? quotaPayload.totalSizeMB : state.storageSummary.usedMb,
      totalQuotaGb: uploadPayload ? extractConfiguredQuotaGb(uploadPayload) : state.storageSummary.totalQuotaGb,
      totalCount: quotaPayload ? quotaPayload.totalCount : state.storageSummary.totalCount,
      isLoading: false
    });
  } catch (error) {
    console.warn('[media-library] storage summary sync failed', error);
  }

  if (!sameStorageSummary(state.storageSummary, nextSummary)) {
    state.storageSummary = nextSummary;
    if (refs.root) {
      render();
    }
    return;
  }

  if (forceRender && refs.root) {
    render();
  }
}

function syncStorageSummary(options = {}) {
  if (storageSyncPromise) {
    return storageSyncPromise;
  }

  storageSyncPromise = performStorageSummarySync(options)
    .catch((error) => {
      console.error('[media-library] storage summary request failed', error);
    })
    .finally(() => {
      storageSyncPromise = null;
    });

  return storageSyncPromise;
}

function inferAlbumFromFileId(fileId, metadata) {
  const directAlbum = normalizeText(metadata.Album || metadata.album || '');
  if (directAlbum) {
    return directAlbum;
  }
  const parts = String(fileId || '').split('/').filter(Boolean).map(decodeValue);
  if (parts.length > 1) {
    return normalizeText(parts[parts.length - 2]) || 'Library';
  }
  const channelName = normalizeText(metadata.ChannelName || '');
  return channelName || 'Library';
}

function formatGPSCoords(lat, lng) {
  const numLat = Number(lat);
  const numLng = Number(lng);
  if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) return '';
  const latDir = numLat >= 0 ? 'N' : 'S';
  const lngDir = numLng >= 0 ? 'E' : 'W';
  return `${Math.abs(numLat).toFixed(4)}\u00b0${latDir}, ${Math.abs(numLng).toFixed(4)}\u00b0${lngDir}`;
}

function inferLocationFromMetadata(metadata, domMatch) {
  const direct = [metadata.Location, metadata.Place, metadata.City, metadata.Country]
    .map((value) => normalizeText(value))
    .find(Boolean);
  if (direct) return direct;
  if (domMatch?.location) return domMatch.location;
  const gps = metadata.Exif?.gps;
  if (gps?.latitude != null && gps?.longitude != null) {
    return formatGPSCoords(gps.latitude, gps.longitude);
  }
  return '';
}

function inferTagsFromMetadata(metadata, fileLabel, type) {
  const tags = safeArray(metadata.Tags)
    .map((tag) => normalizeText(tag).toLowerCase())
    .filter(Boolean);
  const fallbackTags = inferTagsFromFileName(fileLabel, type);
  return [...new Set([...tags, ...fallbackTags])].slice(0, 8);
}

function isDocumentLikeSource(fileId, fileLabel, tags) {
  return DOCUMENT_HINT_PATTERN.test(`${fileId} ${fileLabel} ${tags.join(' ')}`);
}

function inferMimeTypeFromReference(fileId, fileName, rawMimeType) {
  const normalized = normalizeText(rawMimeType).toLowerCase();
  if (normalized && normalized !== 'application/octet-stream') {
    return normalized;
  }
  const reference = `${normalizeText(fileName)} ${normalizeText(fileId)}`.toLowerCase();
  if (/\.(?:jpg|jpeg)\b/.test(reference)) return 'image/jpeg';
  if (/\.png\b/.test(reference)) return 'image/png';
  if (/\.webp\b/.test(reference)) return 'image/webp';
  if (/\.gif\b/.test(reference)) return 'image/gif';
  if (/\.bmp\b/.test(reference)) return 'image/bmp';
  if (/\.avif\b/.test(reference)) return 'image/avif';
  if (/\.heic\b/.test(reference)) return 'image/heic';
  if (/\.heif\b/.test(reference)) return 'image/heif';
  if (/\.mp4\b/.test(reference)) return 'video/mp4';
  if (/\.mov\b/.test(reference)) return 'video/quicktime';
  if (/\.m4v\b/.test(reference)) return 'video/x-m4v';
  if (/\.webm\b/.test(reference)) return 'video/webm';
  if (/\.avi\b/.test(reference)) return 'video/x-msvideo';
  return normalized;
}

function resolvePhotoPreviewUrl(fileId, mimeType, fallbackUrl = '') {
  const sourceUrl = buildFileRoute(fileId);
  const normalizedFallback = normalizeText(fallbackUrl);
  if (!supportsBrowserImagePreview(mimeType)) {
    return normalizedFallback && normalizedFallback !== sourceUrl
      ? normalizedFallback
      : buildFileRoute(fileId, { preview: '1' });
  }
  // For browser-native image formats, prefer the canonical /file route.
  // Upstream DOM thumbnail URLs can be stale or provider-specific and were
  // causing permanently broken JPG tiles in the photo timeline.
  return sourceUrl;
}

function buildIndexedMediaItem(record, domLookup, index) {
  const metadata = record && typeof record === 'object' ? (record.metadata || {}) : {};
  const fileId = normalizeText(record?.name || record?.id || '');
  if (!fileId) {
    return null;
  }

  const fileName = normalizeText(metadata.FileName || extractFileNameFromPath(fileId) || 'Library item');
  const mimeType = inferMimeTypeFromReference(fileId, fileName, metadata.FileType || '');
  if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) {
    return null;
  }

  const lookupKeys = buildMediaLookupKeys(fileId, fileName, fileName);
  const domMatch = lookupKeys.map((key) => domLookup.get(key)).find(Boolean) || null;
  const type = mimeType.startsWith('video/') ? 'video' : 'photo';
  const width = toPositiveNumber(metadata.Width, toPositiveNumber(domMatch?.width, type === 'video' ? 1280 : 1200));
  const height = toPositiveNumber(metadata.Height, toPositiveNumber(domMatch?.height, type === 'video' ? 720 : 900));
  const exifTime = metadata.Exif?.dateTime ? new Date(metadata.Exif.dateTime).getTime() : NaN;
  const timestamp = Number.isFinite(exifTime) ? exifTime : parseTimestamp(metadata.TimeStamp, index);
  const date = new Date(timestamp);
  const dateParts = createDatePartsFromDate(date);
  const sourceUrl = buildFileRoute(fileId);
  const tags = inferTagsFromMetadata(metadata, fileName, type);
  const label = fileName || inferAlbumFromFileId(fileId, metadata);
  const browserPreviewSupported = type !== 'photo' || supportsBrowserImagePreview(mimeType);
  const thumbnailUrl = type === 'photo'
    ? resolvePhotoPreviewUrl(fileId, mimeType, domMatch?.thumbnailUrl || '')
    : (domMatch?.thumbnailUrl || sourceUrl);
  const posterUrl = type === 'video'
    ? (domMatch && domMatch.thumbnailUrl !== sourceUrl ? domMatch.thumbnailUrl : '')
    : (thumbnailUrl !== sourceUrl ? thumbnailUrl : '');

  const nextItem = {
    id: `managed-${hashString(fileId)}`,
    sourceId: fileId,
    sourceUrl,
    thumbnailUrl,
    posterUrl,
    type,
    mimeType,
    width,
    height,
    takenAt: dateParts.takenAt,
    displayTakenAt: dateParts.displayTakenAt,
    timelineLabel: dateParts.timelineLabel,
    year: dateParts.year,
    month: dateParts.month,
    day: dateParts.day,
    monthLabel: dateParts.monthLabel,
    album: inferAlbumFromFileId(fileId, metadata),
    collectionAlbum: normalizeText(metadata.TgAlbumPath || metadata.Album || ''),
    tags,
    location: inferLocationFromMetadata(metadata, domMatch),
    favorite: false,
    personLabels: safeArray(metadata.PersonLabels).map(normalizeText).filter(Boolean),
    label,
    sizeMb: Math.max(0, Number(metadata.FileSize) || Number(metadata.FileSizeMB) || 0),
    exif: metadata.Exif || null,
    browserPreviewSupported,
    isDocumentLike: isDocumentLikeSource(fileId, fileName, tags),
    sortOrder: timestamp,
    domIndex: index
  };
  return shouldDisplayMediaItem(nextItem) ? nextItem : null;
}

async function fetchListPage(start) {
  const params = new URLSearchParams({
    start: String(start),
    count: String(API_PAGE_SIZE),
    recursive: 'true',
    fileType: 'image,video'
  });
  const response = await apiFetch(`/api/manage/list?${params.toString()}`, {
    timeoutMs: API_REQUEST_TIMEOUT_MS
  });

  if (!response.ok) {
    throw new Error(`List API returned ${response.status}`);
  }

  return response.json();
}

async function fetchIndexedMediaItems(domItems) {
  const domLookup = buildDomLookup(domItems);
  const files = [];
  let start = 0;

  while (start < API_MAX_ITEMS) {
    const payload = await fetchListPage(start);
    const pageFiles = safeArray(payload?.files);
    if (!pageFiles.length) {
      break;
    }

    files.push(...pageFiles);
    const returnedCount = toPositiveNumber(payload?.returnedCount, pageFiles.length);
    const totalCount = toPositiveNumber(payload?.totalCount, files.length);
    const shouldStop = returnedCount < API_PAGE_SIZE || files.length >= totalCount || files.length >= API_MAX_ITEMS;
    if (shouldStop) {
      break;
    }

    start += returnedCount;
  }

  return files
    .slice(0, API_MAX_ITEMS)
    .map((record, index) => buildIndexedMediaItem(record, domLookup, index))
    .filter(Boolean)
    .sort((left, right) => {
      if (right.sortOrder !== left.sortOrder) {
        return right.sortOrder - left.sortOrder;
      }
      return left.label.localeCompare(right.label);
    })
    .map(({ sortOrder, domIndex, ...item }) => item);
}

function getAllItems() {
  return state.mediaItems.map((item) => applyAlbumOverride(item));
}

function syncAlbumAssignments(items = getAllItems(), { pruneMissing = false } = {}) {
  if (!pruneMissing) {
    return false;
  }
  const validKeys = new Set(
    safeArray(items)
      .map((item) => getPersistentItemKey(item))
      .filter(Boolean)
  );

  const nextAssignments = Object.fromEntries(
    Object.entries(state.albumAssignments).filter(([itemKey]) => validKeys.has(normalizeText(itemKey)))
  );

  if (isSameRecord(nextAssignments, state.albumAssignments)) {
    return false;
  }

  state.albumAssignments = nextAssignments;
  persistAlbumAssignments();
  return true;
}

function syncAlbumCovers(items = getAllItems()) {
  const validKeysByAlbum = new Map();

  safeArray(items).forEach((item) => {
    const albumKey = normalizeAlbumKey(resolveCollectionAlbum(item));
    const itemKey = getPersistentItemKey(item);
    if (!albumKey || !itemKey) {
      return;
    }
    if (!validKeysByAlbum.has(albumKey)) {
      validKeysByAlbum.set(albumKey, new Set());
    }
    validKeysByAlbum.get(albumKey).add(itemKey);
  });

  const nextAlbumCovers = Object.fromEntries(
    Object.entries(state.albumCovers).filter(([albumKey, itemKey]) => validKeysByAlbum.get(albumKey)?.has(normalizeText(itemKey)))
  );

  if (isSameRecord(nextAlbumCovers, state.albumCovers)) {
    return false;
  }

  state.albumCovers = nextAlbumCovers;
  persistAlbumCovers();
  return true;
}

function getSelectedItems() {
  const lookup = new Map(getAllItems().map((item) => [item.id, item]));
  return [...state.selectedIds].map((id) => lookup.get(id)).filter(Boolean);
}

function getDownloadableItems(items = []) {
  const seenKeys = new Set();
  return safeArray(items).filter((item) => {
    const sourceId = normalizeText(item?.sourceId);
    if (!sourceId) {
      return false;
    }
    const lookupKey = sourceId.toLowerCase();
    if (seenKeys.has(lookupKey)) {
      return false;
    }
    seenKeys.add(lookupKey);
    return true;
  });
}

function triggerBrowserDownload(item) {
  if (typeof document === 'undefined') {
    return false;
  }

  const sourceId = normalizeText(item?.sourceId);
  if (!sourceId) {
    return false;
  }

  const anchor = document.createElement('a');
  anchor.href = buildDownloadRoute(sourceId);
  anchor.download = getDownloadFileName(item);
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  window.setTimeout(() => anchor.remove(), 0);
  return true;
}

function startDownloads(items, { source = 'selection' } = {}) {
  const downloadables = getDownloadableItems(items);
  if (!downloadables.length) {
    showToast('No original files are available to download.');
    return;
  }

  downloadables.forEach((item, index) => {
    window.setTimeout(() => {
      triggerBrowserDownload(item);
    }, index * 180);
  });

  if (downloadables.length === 1) {
    showToast(source === 'preview' ? 'Downloading original file.' : 'Downloading selected file.', 'success');
  } else {
    showToast(`Starting ${downloadables.length} downloads.`, 'success');
  }
}

function canDeleteItem(item) {
  return Boolean(item && item.id.startsWith('managed-') && normalizeText(item.sourceId));
}

function buildDeleteRoute(fileId) {
  const encodedPath = String(fileId || '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join(',');
  return encodedPath ? `/api/manage/delete/${encodedPath}` : '/api/manage/delete';
}

function buildBinItem(record) {
  const fileId = normalizeText(record?.id || '');
  if (!fileId) {
    return null;
  }
  const metadata = record?.metadata || {};
  const fileName = normalizeText(metadata.FileName || extractFileNameFromPath(fileId) || 'Deleted item');
  const mimeType = inferMimeTypeFromReference(fileId, fileName, metadata.FileType || '');
  if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) {
    return null;
  }
  const type = mimeType.startsWith('video/') ? 'video' : 'photo';
  const sourceUrl = buildFileRoute(fileId);
  const browserPreviewSupported = type !== 'photo' || supportsBrowserImagePreview(mimeType);
  const thumbnailUrl = type === 'photo'
    ? resolvePhotoPreviewUrl(fileId, mimeType)
    : sourceUrl;
  const deletedAt = Number(record.deletedAt) || Date.now();
  const deletedDate = new Date(deletedAt);
  const deletedYear = deletedDate.getFullYear();
  const nextItem = {
    id: fileId,
    label: fileName,
    thumbnailUrl,
    sourceUrl,
    posterUrl: thumbnailUrl !== sourceUrl ? thumbnailUrl : '',
    type,
    width: toPositiveNumber(metadata.Width, type === 'video' ? 1280 : 1200),
    height: toPositiveNumber(metadata.Height, type === 'video' ? 720 : 900),
    sizeMb: Math.max(0, Number(metadata.FileSize) || Number(metadata.FileSizeMB) || 0),
    mimeType,
    browserPreviewSupported,
    daysLeft: Math.max(0, Number(record.daysLeft) || 0),
    deletedAt,
    takenAt: deletedDate.toISOString(),
    year: String(deletedYear),
    timelineLabel: createTimelineLabel(deletedDate),
    isDocumentLike: DOCUMENT_HINT_PATTERN.test(`${fileId} ${fileName}`)
  };
  return shouldDisplayMediaItem(nextItem) ? nextItem : null;
}

async function fetchBinItems() {
  if (state.isBinLoading) {
    return;
  }
  state.isBinLoading = true;
  render();
  try {
    const response = await apiFetch('/api/manage/bin/list?limit=200');
    if (!response.ok) {
      throw new Error(`Bin list failed with ${response.status}`);
    }
    const payload = await response.json().catch(() => ({}));
    const records = safeArray(payload?.files);
    state.binItems = records
      .map(buildBinItem)
      .filter(Boolean)
      .sort((left, right) => right.deletedAt - left.deletedAt);
  } catch (error) {
    console.error('[media-library] fetchBinItems failed', error);
    state.binItems = [];
    showToast('Failed to load Bin. Refresh and try again.');
  } finally {
    state.isBinLoading = false;
    render();
  }
}

async function restoreBinSelection() {
  const fileIds = [...state.binSelectedIds];
  if (!fileIds.length) {
    return;
  }
  state.confirmDialogBusy = true;
  render();
  try {
    const response = await apiFetch('/api/manage/bin/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore', fileIds }),
      timeoutMs: 15000
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || `Restore failed with ${response.status}`);
    }
    const restoredIds = new Set(safeArray(payload?.succeededIds).map(normalizeText).filter(Boolean));
    const failedIds = safeArray(payload?.failedIds).map(normalizeText).filter(Boolean);
    state.binItems = state.binItems.filter((item) => !restoredIds.has(item.id));
    state.binSelectedIds = new Set([...state.binSelectedIds].filter((id) => failedIds.includes(id)));
    if (restoredIds.size) {
      showToast(`Restored ${restoredIds.size} item${restoredIds.size === 1 ? '' : 's'} from Bin.`, 'success');
      window.setTimeout(() => syncLiveMedia({ forceRender: true }), 260);
    }
    if (failedIds.length) {
      showToast(`Failed to restore ${failedIds.length} item${failedIds.length === 1 ? '' : 's'}. Try again.`, 'error');
      void fetchBinItems();
    }
  } catch (error) {
    console.error('[media-library] restoreBinSelection failed', error);
    showToast('Failed to restore the selected Bin items.');
  } finally {
    state.confirmDialogBusy = false;
    render();
    void syncStorageSummary({ forceRender: true });
  }
}

async function deleteBinSelectionPermanently() {
  const fileIds = [...state.binSelectedIds];
  if (!fileIds.length) {
    return;
  }
  state.confirmDialogBusy = true;
  render();
  try {
    const response = await apiFetch('/api/manage/bin/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', fileIds }),
      timeoutMs: 15000
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || `Delete failed with ${response.status}`);
    }
    const deletedIds = new Set(safeArray(payload?.succeededIds).map(normalizeText).filter(Boolean));
    const failedIds = safeArray(payload?.failedIds).map(normalizeText).filter(Boolean);
    state.binItems = state.binItems.filter((item) => !deletedIds.has(item.id));
    state.binSelectedIds = new Set([...state.binSelectedIds].filter((id) => failedIds.includes(id)));
    if (deletedIds.size) {
      showToast(`Deleted ${deletedIds.size} item${deletedIds.size === 1 ? '' : 's'} forever.`, 'success');
    }
    if (failedIds.length) {
      showToast(`Failed to delete ${failedIds.length} Bin item${failedIds.length === 1 ? '' : 's'} forever.`, 'error');
      void fetchBinItems();
    }
  } catch (error) {
    console.error('[media-library] deleteBinSelectionPermanently failed', error);
    showToast('Failed to permanently delete the selected Bin items.');
  } finally {
    state.confirmDialogBusy = false;
    render();
    void syncStorageSummary({ forceRender: true });
  }
}

async function emptyBin() {
  if (!state.binItems.length) {
    return;
  }
  state.confirmDialogBusy = true;
  render();
  try {
    const response = await apiFetch('/api/manage/bin/empty', { method: 'POST', timeoutMs: 15000 });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || `Empty bin failed with ${response.status}`);
    }
    const deletedIds = new Set(safeArray(payload?.deletedIds).map(normalizeText).filter(Boolean));
    const failedIds = safeArray(payload?.failedIds).map(normalizeText).filter(Boolean);
    if (failedIds.length) {
      state.binItems = state.binItems.filter((item) => !deletedIds.has(item.id));
      state.binSelectedIds = new Set(failedIds);
      showToast(`Deleted ${deletedIds.size} item${deletedIds.size === 1 ? '' : 's'}, but ${failedIds.length} failed.`, 'error');
      void fetchBinItems();
    } else {
      state.binItems = [];
      state.binSelectedIds.clear();
      showToast('Bin emptied.', 'success');
    }
  } catch (error) {
    console.error('[media-library] emptyBin failed', error);
    showToast('Failed to empty Bin.');
  } finally {
    state.confirmDialogBusy = false;
    resetConfirmDialog();
    render();
    void syncStorageSummary({ forceRender: true });
  }
}

function requestEmptyBin() {
  if (!state.binItems.length) {
    return;
  }
  openConfirmDialog({
    mode: 'empty-bin',
    title: 'Empty bin?',
    copy: `${state.binItems.length} item${state.binItems.length === 1 ? '' : 's'} will be permanently deleted and cannot be restored.`,
    confirmLabel: 'Empty bin',
    selectionCount: state.binItems.length
  });
}

function requestDeleteBinSelectionPermanently() {
  const fileIds = [...state.binSelectedIds];
  if (!fileIds.length) {
    return;
  }
  openConfirmDialog({
    mode: 'delete-bin-permanently',
    title: 'Delete forever?',
    copy: `${fileIds.length} Bin item${fileIds.length === 1 ? '' : 's'} will be permanently deleted and cannot be restored.`,
    confirmLabel: 'Delete forever',
    selectionCount: fileIds.length
  });
}

function focusSearchInput() {
  const searchInput = refs.root
    ? refs.root.querySelector('.cml-sidebar__search-input, .cml-topbar__search-input')
    : null;
  if (searchInput instanceof HTMLInputElement) {
    searchInput.focus();
    searchInput.select();
  }
}

function getPhotoLibraryUrl(pathname) {
  const url = new URL(window.location.origin + pathname);
  url.searchParams.delete('cmlNative');
  url.searchParams.delete('cmlUpload');
  url.hash = '';
  return `${url.pathname}${url.search}${url.hash}`;
}

function getNativeUrl(pathname) {
  const url = new URL(window.location.origin + pathname);
  url.searchParams.set('cmlNative', '1');
  return `${url.pathname}${url.search}`;
}

function openNativeView(pathname) {
  window.location.assign(getNativeUrl(pathname));
}

function hasPendingUploadRequest() {
  const url = new URL(window.location.href);
  return url.searchParams.get('cmlUpload') === '1' || url.hash === '#upload';
}

function clearPendingUploadRequest() {
  const url = new URL(window.location.href);
  let changed = false;
  if (url.searchParams.get('cmlUpload') === '1') {
    url.searchParams.delete('cmlUpload');
    changed = true;
  }
  if (url.hash === '#upload') {
    url.hash = '';
    changed = true;
  }
  if (changed) {
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }
}

function findNativeUploadInput() {
  const selectors = [
    '#app .upload input[type="file"]',
    '#app .el-upload input[type="file"]',
    '#app input[type="file"]'
  ];
  return selectors
    .map((selector) => document.querySelector(selector))
    .find((input) => input instanceof HTMLInputElement && input.type === 'file' && !input.disabled) || null;
}

function consumePendingUploadRequest() {
  if (!hasPendingUploadRequest()) {
    return;
  }

  let attempts = 0;
  const tryOpen = () => {
    const input = findNativeUploadInput();
    if (input) {
      input.click();
      clearPendingUploadRequest();
      return;
    }
    attempts += 1;
    if (attempts < 12) {
      window.setTimeout(tryOpen, 220);
      return;
    }
    clearPendingUploadRequest();
    openNativeView('/');
  };

  window.setTimeout(tryOpen, 120);
}

function requestNativeUpload() {
  const input = findNativeUploadInput();
  if (input) {
    input.click();
    return;
  }
  const url = new URL(window.location.origin + '/');
  url.searchParams.set('cmlUpload', '1');
  window.location.assign(`${url.pathname}${url.search}`);
}

function resetLoadedCount() {
  state.loadedCount = COLLECTION_PAGE_SIZE;
}

function persistFavorites() {
  queuePersistedAlbumState();
}

function hasPersistedAlbumData(snapshot) {
  return Boolean(
    safeArray(snapshot?.albumNames).length
    || Object.keys(snapshot?.albumAssignments || {}).length
    || Object.keys(snapshot?.albumCovers || {}).length
    || safeArray(snapshot?.favorites).length
  );
}

function applyPersistedAlbumState(payload) {
  const albumNames = loadStringArrayFromApi(payload?.albumNames);
  const albumAssignments = loadStringRecordFromApi(payload?.albumAssignments);
  const albumCovers = loadAlbumCoverRecordFromApi(payload?.albumCovers);
  const favorites = loadFavoriteSetFromApi(payload?.favorites);

  state.albumNames = albumNames;
  state.albumAssignments = albumAssignments;
  state.albumCovers = albumCovers;
  state.favoriteIds = favorites;
}

function loadStringArrayFromApi(values) {
  return Array.isArray(values)
    ? values.map((value) => normalizeText(value)).filter(Boolean)
    : [];
}

function loadStringRecordFromApi(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value)
      .map(([entryKey, entryValue]) => [normalizeText(entryKey), normalizeText(entryValue)])
      .filter(([entryKey, entryValue]) => entryKey && entryValue)
  );
}

function loadAlbumCoverRecordFromApi(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value)
      .map(([albumName, itemKey]) => [normalizeAlbumKey(albumName), normalizeText(itemKey)])
      .filter(([albumName, itemKey]) => albumName && itemKey)
  );
}

function loadFavoriteSetFromApi(values) {
  return new Set(Array.isArray(values) ? values.map((value) => normalizeText(value)).filter(Boolean) : []);
}

function snapshotPersistedAlbumState() {
  return {
    albumNames: [...state.albumNames],
    albumAssignments: { ...state.albumAssignments },
    albumCovers: { ...state.albumCovers },
    favorites: [...state.favoriteIds]
  };
}

async function flushPersistedAlbumState() {
  while (pendingPersistedAlbumSnapshot) {
    const nextSnapshot = pendingPersistedAlbumSnapshot;
    pendingPersistedAlbumSnapshot = null;
    try {
      const payload = await postJson('/api/manage/albums', { state: nextSnapshot });
      if (!pendingPersistedAlbumSnapshot) {
        applyPersistedAlbumState(payload);
        clearLegacyAlbumState();
      }
    } catch (error) {
      console.error('[media-library] failed to persist album state', error);
      showToast(error.message || 'Failed to save album changes');
    }
  }
}

function queuePersistedAlbumState() {
  pendingPersistedAlbumSnapshot = snapshotPersistedAlbumState();
  if (persistedAlbumStatePromise) {
    return persistedAlbumStatePromise;
  }

  persistedAlbumStatePromise = flushPersistedAlbumState()
    .finally(() => {
      persistedAlbumStatePromise = null;
      if (pendingPersistedAlbumSnapshot) {
        queuePersistedAlbumState();
      }
    });

  return persistedAlbumStatePromise;
}

async function loadPersistedAlbumState({ forceRender = false } = {}) {
  try {
    let payload = await fetchJson('/api/manage/albums');
    if (!hasPersistedAlbumData(payload) && hasPersistedAlbumData(legacyAlbumState)) {
      payload = await postJson('/api/manage/albums', { migrate: legacyAlbumState });
      clearLegacyAlbumState();
    }
    applyPersistedAlbumState(payload);
    const canValidateAlbumCovers = state.mediaItems.length > 0 || !state.isLibraryLoading;
    if (canValidateAlbumCovers && syncAlbumCovers()) {
      queuePersistedAlbumState();
    }
  } catch (error) {
    console.error('[media-library] failed to load album state', error);
    if (hasPersistedAlbumData(legacyAlbumState)) {
      applyPersistedAlbumState(legacyAlbumState);
    }
  } finally {
    if (forceRender && refs.root) {
      render();
    }
  }
}

function focusAlbumInput({ focusKey = '', selectionStart = null, selectionEnd = null, select = false } = {}) {
  if (!refs.root) {
    return;
  }
  const selectors = [];
  const normalizedFocusKey = normalizeText(focusKey);
  if (normalizedFocusKey === 'search') {
    selectors.push('[data-focus-key="album-search"]');
  } else if (normalizedFocusKey === 'create') {
    selectors.push('[data-focus-key="album-create"]');
  } else if (state.albumDialogOrigin === 'preview') {
    selectors.push(state.albumDrawerCreateMode ? '[data-focus-key="album-create"]' : '[data-focus-key="album-search"]');
  }
  selectors.push('.cml-album-dialog__input');
  const input = selectors
    .map((selector) => refs.root.querySelector(selector))
    .find((node) => node instanceof HTMLInputElement);
  if (input instanceof HTMLInputElement) {
    input.focus();
    if (Number.isInteger(selectionStart) && Number.isInteger(selectionEnd)) {
      const start = Math.max(0, Math.min(input.value.length, Number(selectionStart)));
      const end = Math.max(start, Math.min(input.value.length, Number(selectionEnd)));
      input.setSelectionRange(start, end);
    } else if (select) {
      input.select();
    }
  }
}

function renderAlbumDialogState({ preferPreviewRender = false, focusKey = '', selectionStart = null, selectionEnd = null, select = false } = {}) {
  const renderedPreview = preferPreviewRender && renderPreviewTransientLayers();
  if (!renderedPreview) {
    render();
  }
  if (focusKey) {
    window.setTimeout(() => {
      focusAlbumInput({ focusKey, selectionStart, selectionEnd, select });
    }, 30);
  }
}

function clearSelection({ shouldRender = true } = {}) {
  if (!state.selectedIds.size) {
    return;
  }
  const clearedIds = [...state.selectedIds];
  state.selectedIds.clear();
  state.lastSelectedId = null;
  if (shouldRender) {
    if (!syncSelectionUi(clearedIds)) {
      render();
    }
  }
}

function openAlbumDialog(mode = 'create', { origin = '', preferPreviewRender = false } = {}) {
  state.albumDialogOpen = true;
  state.albumDialogMode = mode;
  state.albumDialogOrigin = normalizeText(origin || '');
  state.albumDraftName = '';
  state.albumDialogError = '';
  state.albumDrawerSearch = '';
  state.albumDrawerScope = 'all';
  state.albumDrawerCreateMode = state.albumDialogOrigin === 'preview' && mode === 'create';
  renderAlbumDialogState({
    preferPreviewRender,
    focusKey: state.albumDialogOrigin === 'preview'
      ? (state.albumDrawerCreateMode ? 'create' : 'search')
      : 'create',
    select: state.albumDialogOrigin !== 'preview'
  });
}

function closeAlbumDialog() {
  if (!state.albumDialogOpen) {
    return;
  }
  const previewAlbumFlow = state.albumDialogOrigin === 'preview';
  state.albumDialogOpen = false;
  state.albumDialogOrigin = '';
  state.albumDialogError = '';
  state.albumDraftName = '';
  state.albumDrawerSearch = '';
  state.albumDrawerScope = 'all';
  state.albumDrawerCreateMode = false;
  if (previewAlbumFlow) {
    clearSelection({ shouldRender: false });
    if (syncPreviewAlbumDrawer(false)) {
      return;
    }
  }
  renderAlbumDialogState({ preferPreviewRender: previewAlbumFlow });
}

function setAlbumDrawerScope(scope) {
  if (!state.albumDialogOpen || state.albumDialogOrigin !== 'preview') {
    return;
  }
  const normalizedScope = normalizeText(scope || 'all').toLowerCase();
  const nextScope = ['all', 'mine', 'shared'].includes(normalizedScope) ? normalizedScope : 'all';
  if (state.albumDrawerScope === nextScope) {
    return;
  }
  state.albumDrawerScope = nextScope;
  renderAlbumDialogState({ preferPreviewRender: true, focusKey: 'search' });
}

function setPreviewAlbumCreateMode(forceOpen) {
  if (!state.albumDialogOpen || state.albumDialogOrigin !== 'preview') {
    return;
  }
  const nextValue = typeof forceOpen === 'boolean' ? forceOpen : !state.albumDrawerCreateMode;
  if (state.albumDrawerCreateMode === nextValue) {
    return;
  }
  state.albumDrawerCreateMode = nextValue;
  state.albumDialogError = '';
  if (!nextValue) {
    state.albumDraftName = '';
  }
  renderAlbumDialogState({
    preferPreviewRender: true,
    focusKey: nextValue ? 'create' : 'search',
    select: nextValue
  });
}

function openConfirmDialog(options = {}) {
  state.confirmDialogOpen = true;
  state.confirmDialogMode = normalizeText(options.mode || '');
  state.confirmDialogOrigin = normalizeText(options.origin || '');
  state.confirmDialogTitle = normalizeText(options.title || 'Confirm action');
  state.confirmDialogCopy = normalizeText(options.copy || '');
  state.confirmDialogConfirmLabel = normalizeText(options.confirmLabel || 'Confirm');
  state.confirmDialogSelectionCount = Number(options.selectionCount) || 0;
  state.confirmDialogBusy = false;
  if (!(state.confirmDialogOrigin === 'preview' && renderPreviewTransientLayers())) {
    render();
  }
}

function resetConfirmDialog() {
  state.confirmDialogOpen = false;
  state.confirmDialogMode = '';
  state.confirmDialogOrigin = '';
  state.confirmDialogTitle = '';
  state.confirmDialogCopy = '';
  state.confirmDialogConfirmLabel = '';
  state.confirmDialogSelectionCount = 0;
  state.confirmDialogBusy = false;
}

function closeConfirmDialog() {
  if (!state.confirmDialogOpen || state.confirmDialogBusy) {
    return;
  }
  const preferPreviewRender = state.confirmDialogOrigin === 'preview';
  if (preferPreviewRender) {
    clearSelection({ shouldRender: false });
  }
  resetConfirmDialog();
  if (!(preferPreviewRender && renderPreviewTransientLayers())) {
    render();
  }
}

function showToast(message, type = 'error') {
  if (state.toastTimeoutId) {
    window.clearTimeout(state.toastTimeoutId);
  }
  state.toastMessage = String(message || '');
  state.toastType = String(type || 'error');
  render();
  state.toastTimeoutId = window.setTimeout(() => {
    state.toastMessage = '';
    state.toastTimeoutId = 0;
    render();
  }, 4500);
}

function dismissToast() {
  if (state.toastTimeoutId) {
    window.clearTimeout(state.toastTimeoutId);
    state.toastTimeoutId = 0;
  }
  state.toastMessage = '';
  render();
}

function openAdminPanel(tab = 'account') {
  state.avatarMenuOpen = false;
  state.storagePanelOpen = false;
  state.adminPanelOpen = true;
  state.adminPanelTab = normalizeText(tab) || 'account';
  state.adminPanelError = '';
  render();
  void loadAdminPanelData();
}

function closeAdminPanel() {
  if (!state.adminPanelOpen || state.adminPanelBusy) {
    return;
  }
  state.adminPanelOpen = false;
  state.adminPanelError = '';
  resetAdminPasswordDraft();
  render();
}

function toggleStoragePanel(forceOpen = null) {
  const nextOpen = typeof forceOpen === 'boolean' ? forceOpen : !state.storagePanelOpen;
  if (nextOpen) {
    state.avatarMenuOpen = false;
    state.adminPanelOpen = false;
  }
  state.storagePanelOpen = nextOpen;
  render();
}

async function triggerAdminAvatarUpload() {
  const input = refs.root ? refs.root.querySelector('[data-admin-avatar-input]') : null;
  if (input instanceof HTMLInputElement) {
    input.click();
  }
}

async function handleAdminAvatarSelection(file) {
  if (!file) {
    return;
  }
  if (!file.type.startsWith('image/')) {
    state.adminPanelError = 'Please choose an image file';
    render();
    return;
  }
  if (file.size > 512 * 1024) {
    state.adminPanelError = 'Avatar image must be 512 KB or smaller';
    render();
    return;
  }

  try {
    state.adminProfileDraft.avatarData = await readFileAsDataUrl(file);
    state.adminPanelError = '';
  } catch (error) {
    state.adminPanelError = error.message || 'Failed to read avatar image';
  }
  render();
}

function updateAdminDraftField(section, field, rawValue) {
  if (!section || !field) {
    return;
  }
  if (state.adminPanelError) {
    state.adminPanelError = '';
  }
  if (section === 'account') {
    state.adminProfileDraft[field] = rawValue;
    return;
  }
  if (section === 'site') {
    state.adminPageDraft[field] = rawValue;
    return;
  }
  if (section === 'cloud') {
    state.adminCloudDraft[field] = rawValue;
  }
}

async function saveAdminAccount() {
  if (state.adminPanelBusy) {
    return;
  }

  const username = normalizeText(state.adminProfileDraft.username);
  const displayName = normalizeText(state.adminProfileDraft.displayName);
  if (!username) {
    state.adminPanelError = 'Username is required';
    render();
    return;
  }
  if (!displayName) {
    state.adminPanelError = 'Display name is required';
    render();
    return;
  }
  if (state.adminProfileDraft.newPassword && state.adminProfileDraft.newPassword !== state.adminProfileDraft.confirmPassword) {
    state.adminPanelError = 'New password and confirmation do not match';
    render();
    return;
  }

  state.adminPanelBusy = true;
  state.adminPanelError = '';
  render();

  try {
    const profile = await postJson('/api/manage/account', {
      username,
      displayName,
      avatarData: state.adminProfileDraft.avatarData,
      currentPassword: state.adminProfileDraft.currentPassword,
      newPassword: state.adminProfileDraft.newPassword
    });
    applyAdminIdentity(profile);
    hydrateAdminProfileDraft(profile);
    showToast('Admin account updated', 'success');
  } catch (error) {
    state.adminPanelError = error.message || 'Failed to update account';
  } finally {
    state.adminPanelBusy = false;
    render();
  }
}

async function saveAdminSiteSettings() {
  if (state.adminPanelBusy) {
    return;
  }
  state.adminPanelBusy = true;
  state.adminPanelError = '';
  render();

  try {
    const payload = applyAdminPageDraftToConfig(state.adminPageConfigSource, state.adminPageDraft);
    const response = await postJson('/api/manage/sysConfig/page', payload);
    state.adminPageConfigSource = safeArray(response?.config);
    state.adminPageDraft = createAdminPageDraft(state.adminPageConfigSource);
    showToast('Site settings updated', 'success');
  } catch (error) {
    state.adminPanelError = error.message || 'Failed to update site settings';
  } finally {
    state.adminPanelBusy = false;
    render();
  }
}

async function saveAdminCloudSettings() {
  if (state.adminPanelBusy) {
    return;
  }
  state.adminPanelBusy = true;
  state.adminPanelError = '';
  render();

  try {
    const payload = applyAdminCloudDraftToSettings(state.adminOthersConfigSource, state.adminCloudDraft);
    const response = await postJson('/api/manage/sysConfig/others', payload);
    state.adminOthersConfigSource = response || {};
    state.adminCloudDraft = createAdminCloudDraft(state.adminOthersConfigSource);
    showToast('Cloud settings updated', 'success');
  } catch (error) {
    state.adminPanelError = error.message || 'Failed to update cloud settings';
  } finally {
    state.adminPanelBusy = false;
    render();
  }
}

function openCollection(albumName) {
  const normalizedName = normalizeText(albumName);
  if (!normalizedName) {
    return;
  }
  state.primaryFilter = 'Collections';
  state.activeAlbumName = normalizedName;
  state.albumSelectionTarget = '';
  state.secondaryFilter = '';
  resetSearchQuery();
  state.previewId = null;
  clearSelection({ shouldRender: false });
  resetLoadedCount();
  render();
  if (refs.scrollRegion) {
    refs.scrollRegion.scrollTo({ top: 0, behavior: 'auto' });
  }
}

function closeCollection() {
  if (!state.activeAlbumName) {
    return;
  }
  state.activeAlbumName = '';
  state.albumSelectionTarget = '';
  resetSearchQuery();
  state.previewId = null;
  clearSelection({ shouldRender: false });
  resetLoadedCount();
  render();
  if (refs.scrollRegion) {
    refs.scrollRegion.scrollTo({ top: 0, behavior: 'auto' });
  }
}

function openAlbumSelection(albumName = getActiveAlbumName()) {
  const normalizedName = normalizeText(albumName);
  if (!normalizedName) {
    return;
  }
  state.albumSelectionTarget = normalizedName;
  state.primaryFilter = 'Photos';
  state.activeAlbumName = '';
  state.secondaryFilter = '';
  resetSearchQuery();
  state.previewId = null;
  clearSelection({ shouldRender: false });
  resetLoadedCount();
  render();
  if (refs.scrollRegion) {
    refs.scrollRegion.scrollTo({ top: 0, behavior: 'auto' });
  }
}

function closeAlbumSelection() {
  const targetAlbum = getAlbumSelectionTarget();
  if (!targetAlbum) {
    return;
  }
  state.albumSelectionTarget = '';
  state.primaryFilter = 'Collections';
  state.activeAlbumName = targetAlbum;
  state.secondaryFilter = '';
  resetSearchQuery();
  state.previewId = null;
  clearSelection({ shouldRender: false });
  resetLoadedCount();
  render();
  if (refs.scrollRegion) {
    refs.scrollRegion.scrollTo({ top: 0, behavior: 'auto' });
  }
}

function confirmAlbumSelection() {
  const targetAlbum = getAlbumSelectionTarget();
  if (!targetAlbum || !state.selectedIds.size) {
    return false;
  }
  return commitSelectionToAlbum(targetAlbum);
}

function commitSelectionToAlbum(albumName) {
  const selectedItems = getSelectedItems();
  if (!selectedItems.length) {
    return false;
  }
  const previewAlbumFlow = state.albumDialogOrigin === 'preview' && Boolean(state.previewId);
  const canonicalAlbumName = ensureAlbumName(albumName);
  if (!canonicalAlbumName) {
    state.albumDialogError = 'Album name is required.';
    renderAlbumDialogState({
      preferPreviewRender: previewAlbumFlow,
      focusKey: 'create',
      select: true
    });
    return false;
  }
  const nextAssignments = { ...state.albumAssignments };
  selectedItems.forEach((item) => {
    const key = getPersistentItemKey(item);
    if (key) {
      nextAssignments[key] = canonicalAlbumName;
    }
  });
  state.albumAssignments = nextAssignments;
  persistAlbumAssignments();
  state.albumDialogOpen = false;
  state.albumDialogOrigin = '';
  state.albumDialogError = '';
  state.albumDraftName = '';
  state.albumSelectionTarget = '';
  state.albumDrawerSearch = '';
  state.albumDrawerScope = 'all';
  state.albumDrawerCreateMode = false;
  clearSelection({ shouldRender: false });
  if (previewAlbumFlow) {
    renderAlbumDialogState({ preferPreviewRender: true });
    return true;
  }
  state.primaryFilter = 'Collections';
  state.activeAlbumName = canonicalAlbumName;
  state.secondaryFilter = '';
  resetLoadedCount();
  render();
  return true;
}

function submitAlbumDialog() {
  const draftName = normalizeText(state.albumDraftName);
  if (state.albumDialogMode === 'assign') {
    return commitSelectionToAlbum(draftName);
  }
  const canonicalAlbumName = ensureAlbumName(draftName);
  if (!canonicalAlbumName) {
    state.albumDialogError = 'Album name is required.';
    renderAlbumDialogState({
      preferPreviewRender: state.albumDialogOrigin === 'preview',
      focusKey: 'create',
      select: true
    });
    return false;
  }
  state.albumDialogOpen = false;
  state.albumDialogError = '';
  state.albumDraftName = '';
  state.albumSelectionTarget = '';
  state.albumDrawerSearch = '';
  state.albumDrawerScope = 'all';
  state.albumDrawerCreateMode = false;
  state.primaryFilter = 'Collections';
  state.activeAlbumName = canonicalAlbumName;
  state.secondaryFilter = '';
  resetLoadedCount();
  render();
  return true;
}

function assignSelectionToAlbum(albumName) {
  return commitSelectionToAlbum(albumName);
}

function setSelectedItemAsAlbumCover() {
  const activeAlbumName = getActiveAlbumName();
  const selectedItems = getSelectedItems();
  if (!activeAlbumName || selectedItems.length !== 1) {
    return false;
  }

  const [selectedItem] = selectedItems;
  if (normalizeAlbumKey(resolveCollectionAlbum(selectedItem)) !== normalizeAlbumKey(activeAlbumName)) {
    return false;
  }

  const albumKey = normalizeAlbumKey(activeAlbumName);
  const itemKey = getPersistentItemKey(selectedItem);
  if (!albumKey || !itemKey) {
    return false;
  }

  state.albumCovers = {
    ...state.albumCovers,
    [albumKey]: itemKey
  };
  persistAlbumCovers();
  clearSelection({ shouldRender: false });
  render();
  return true;
}

function openRenameAlbumDialog(albumName) {
  state.renameAlbumDialogOpen = true;
  state.renameAlbumTarget = albumName;
  state.renameAlbumDraftName = albumName;
  state.renameAlbumError = '';
  state.renameAlbumBusy = false;
  render();
}

function closeRenameAlbumDialog() {
  state.renameAlbumDialogOpen = false;
  state.renameAlbumTarget = '';
  state.renameAlbumDraftName = '';
  state.renameAlbumError = '';
  state.renameAlbumBusy = false;
  render();
}

function buildContentViewKey(viewModel) {
  return [
    state.primaryFilter,
    viewModel.activeAlbumName || '',
    state.secondaryFilter || ''
  ].join('|');
}

function animateContentViewTransition() {
  if (!(refs.contentInner instanceof HTMLElement)) {
    return;
  }
  refs.contentInner.classList.add('is-view-transitioning');
  requestAnimationFrame(() => {
    if (!(refs.contentInner instanceof HTMLElement)) {
      return;
    }
    refs.contentInner.classList.add('is-view-transition-settled');
  });
  if (contentTransitionTimeoutId) {
    window.clearTimeout(contentTransitionTimeoutId);
  }
  contentTransitionTimeoutId = window.setTimeout(() => {
    if (refs.contentInner instanceof HTMLElement) {
      refs.contentInner.classList.remove('is-view-transitioning', 'is-view-transition-settled');
    }
    contentTransitionTimeoutId = 0;
  }, 320);
}

function focusInlineRenameInput({ select = false } = {}) {
  requestAnimationFrame(() => {
    const input = refs.root ? refs.root.querySelector('[data-focus-key="rename-album-inline"]') : null;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    input.focus();
    if (select) {
      input.select();
    }
  });
}

async function submitRenameAlbum() {
  const oldName = state.renameAlbumTarget;
  const newName = normalizeText(state.renameAlbumDraftName).replace(/\s+/g, ' ');
  if (!newName) {
    state.renameAlbumError = 'Album name cannot be empty';
    render();
    return;
  }
  if (newName.toLowerCase() === oldName.toLowerCase()) {
    closeRenameAlbumDialog();
    return;
  }

  state.renameAlbumBusy = true;
  state.renameAlbumError = '';
  render();

  try {
    const payload = await apiFetch('/api/manage/albums', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: oldName, newName })
    }).then((r) => r.json());

    if (payload?.error) {
      throw new Error(payload.error);
    }

    applyPersistedAlbumState(payload);
    if (state.activeAlbumName && state.activeAlbumName.toLowerCase() === oldName.toLowerCase()) {
      state.activeAlbumName = newName;
    }
    closeRenameAlbumDialog();
    showToast('Album renamed', 'success');
  } catch (error) {
    state.renameAlbumError = error.message || 'Failed to rename album';
    state.renameAlbumBusy = false;
    render();
  }
}

async function deleteAlbum(albumName) {
  try {
    const payload = await apiFetch(`/api/manage/albums?id=${encodeURIComponent(albumName)}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' }
    }).then((r) => r.json());

    if (payload?.error) {
      throw new Error(payload.error);
    }

    applyPersistedAlbumState(payload);
    state.activeAlbumName = '';
    clearSelection({ shouldRender: false });
    resetLoadedCount();
    render();
    showToast('Album deleted', 'success');
  } catch (error) {
    showToast(error.message || 'Failed to delete album', 'error');
  }
}

function removeSelectionFromAlbum() {
  const activeAlbumName = getActiveAlbumName();
  if (!activeAlbumName) {
    return;
  }
  const selectedItems = getSelectedItems();
  if (!selectedItems.length) {
    return;
  }

  const albumKey = normalizeAlbumKey(activeAlbumName);
  const removedKeys = new Set(selectedItems.map((item) => getPersistentItemKey(item)).filter(Boolean));
  const nextAssignments = Object.fromEntries(
    Object.entries(state.albumAssignments).filter(([fileId, name]) => {
      if (normalizeAlbumKey(name) !== albumKey) return true;
      return !removedKeys.has(normalizeText(fileId));
    })
  );

  state.albumAssignments = nextAssignments;
  persistAlbumAssignments();
  clearSelection({ shouldRender: false });
  render();
  showToast(`Removed ${removedKeys.size} item${removedKeys.size === 1 ? '' : 's'} from album`, 'success');
}

async function deleteSelectedItems(options = {}) {
  const selectedItems = getSelectedItems().filter((item) => canDeleteItem(item));
  if (!selectedItems.length) {
    return;
  }
  const permanent = Boolean(options.permanent);
  const previewDeleteFlow = state.confirmDialogOrigin === 'preview' && selectedItems.length === 1 && Boolean(state.previewId);
  const previewItemsBeforeDelete = previewDeleteFlow ? getFilteredItems() : [];
  const previewIndexBeforeDelete = previewDeleteFlow
    ? previewItemsBeforeDelete.findIndex((item) => item.id === state.previewId)
    : -1;

  const deletedIds = new Set();
  const deletedKeys = new Set();
  const failedItems = [];

  for (const item of selectedItems) {
    try {
      const route = permanent
        ? `${buildDeleteRoute(item.sourceId)}?permanent=true`
        : buildDeleteRoute(item.sourceId);
      const response = await apiFetch(route, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json'
        },
        timeoutMs: 15000
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || payload?.message || `Delete failed with ${response.status}`);
      }
      deletedIds.add(item.id);
      deletedKeys.add(getPersistentItemKey(item));
    } catch (error) {
      console.error('[media-library] delete failed', error);
      failedItems.push(item.label || item.sourceId);
    }
  }

  if (deletedIds.size) {
    state.mediaItems = state.mediaItems.filter((item) => !deletedIds.has(item.id));
    state.selectedIds = new Set([...state.selectedIds].filter((id) => !deletedIds.has(id)));
    if (state.lastSelectedId && !state.selectedIds.has(state.lastSelectedId)) {
      state.lastSelectedId = [...state.selectedIds].pop() || null;
    }
    if (state.previewId && deletedIds.has(state.previewId)) {
      state.previewId = null;
    }
    const nextAssignments = { ...state.albumAssignments };
    deletedKeys.forEach((key) => {
      if (key) {
        delete nextAssignments[key];
      }
    });
    state.albumAssignments = nextAssignments;
    persistAlbumAssignments();
    const remainingItems = state.mediaItems.map((item) => applyAlbumOverride(item));
  syncAlbumAssignments(remainingItems, { pruneMissing: true });
    syncAlbumCovers(remainingItems);
    if (previewDeleteFlow) {
      const previewItemsAfterDelete = getFilteredItems();
      const nextPreviewItem = previewIndexBeforeDelete >= 0
        ? previewItemsAfterDelete[Math.min(previewIndexBeforeDelete, previewItemsAfterDelete.length - 1)] || null
        : null;
      state.previewId = nextPreviewItem?.id || null;
      if (!renderPreviewTransientLayers({ animateDirection: 1 })) {
        render();
      }
    } else {
      render();
    }
    window.setTimeout(() => syncLiveMedia({ forceRender: !previewDeleteFlow }), 600);
    void syncStorageSummary({ forceRender: !previewDeleteFlow });
  }

  if (failedItems.length) {
    showToast(`Failed to delete ${failedItems.length} item${failedItems.length === 1 ? '' : 's'}. Check your connection and try again.`);
  }
}

function requestDeleteSelection(permanent = false, { origin = '' } = {}) {
  const selectedItems = getSelectedItems().filter((item) => canDeleteItem(item));
  if (!selectedItems.length) {
    return;
  }
  const isSingle = selectedItems.length === 1;
  const itemLabel = isSingle
    ? (selectedItems[0].label || selectedItems[0].album || 'this item')
    : `${selectedItems.length} selected items`;
  openConfirmDialog({
    mode: permanent ? 'delete-permanently' : 'delete',
    origin,
    title: permanent ? 'Delete forever?' : 'Move to bin?',
    copy: permanent
      ? `${itemLabel} will be removed permanently and cannot be restored.`
      : `${itemLabel} will leave your main library and stay in Bin for up to 45 days before permanent deletion.`,
    confirmLabel: permanent ? 'Delete forever' : 'Move to bin',
    selectionCount: selectedItems.length
  });
}

function syncPreviewAlbumDrawer(isOpen) {
  if (!refs.root) {
    return false;
  }
  const preview = refs.root.querySelector('.cml-preview');
  const albumPanel = refs.root.querySelector('.cml-preview__album-panel');
  const plusButton = refs.root.querySelector('.cml-preview__icon-action[data-action="open-preview-add-to-album"]');
  const infoPanel = refs.root.querySelector('.cml-preview__info');
  const infoButton = refs.root.querySelector('.cml-preview__icon-action[data-action="toggle-info"]');

  if (!(preview instanceof HTMLElement) || !(albumPanel instanceof HTMLElement)) {
    return false;
  }

  preview.classList.toggle('has-album', isOpen);
  albumPanel.classList.toggle('is-open', isOpen);
  albumPanel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');

  if (plusButton instanceof HTMLElement) {
    plusButton.classList.toggle('is-selected', isOpen);
    plusButton.setAttribute('aria-pressed', isOpen ? 'true' : 'false');
  }

  if (isOpen && infoPanel instanceof HTMLElement) {
    preview.classList.remove('has-info');
    infoPanel.classList.remove('is-open');
    infoPanel.setAttribute('aria-hidden', 'true');
    if (infoButton instanceof HTMLElement) {
      infoButton.classList.remove('is-selected');
      infoButton.setAttribute('aria-pressed', 'false');
    }
  }

  return true;
}

function openPreviewAddToAlbum(itemId) {
  if (!itemId) {
    return;
  }
  if (state.albumDialogOpen && state.albumDialogOrigin === 'preview') {
    closeAlbumDialog();
    return;
  }
  state.selectedIds.clear();
  state.selectedIds.add(itemId);
  state.infoOpen = false;
  state.albumDialogOpen = true;
  state.albumDialogMode = 'assign';
  state.albumDialogOrigin = 'preview';
  state.albumDraftName = '';
  state.albumDialogError = '';
  state.albumDrawerSearch = '';
  state.albumDrawerScope = 'all';
  state.albumDrawerCreateMode = false;

  if (!syncPreviewAlbumDrawer(true)) {
    renderPreviewTransientLayers();
  }
}

function downloadSelectedItems() {
  startDownloads(getSelectedItems(), { source: 'selection' });
}

function downloadPreviewItem(itemId) {
  const targetId = normalizeText(itemId || state.previewId);
  if (!targetId) {
    showToast('No preview item is available to download.');
    return;
  }

  const item = getAllItems().find((entry) => entry.id === targetId);
  if (!item) {
    showToast('The requested file is no longer available.');
    return;
  }

  startDownloads([item], { source: 'preview' });
}

function requestDeletePreview(itemId) {
  if (!itemId) {
    return;
  }
  state.selectedIds.clear();
  state.selectedIds.add(itemId);
  requestDeleteSelection(false, { origin: 'preview' });
}

function getVisibleSecondaryFilters(items) {
  return [...navigationModel.secondary];
}

function getFilteredItems(items = getAllItems()) {
  const parsedSearch = parseMediaSearchQuery(state.searchQuery);
  const query = parsedSearch.textQuery.toLowerCase();
  const activeAlbumName = getActiveAlbumName();
  const albumSelectionTarget = getAlbumSelectionTarget();
  const searchFilters = parsedSearch.filters;

  return items.filter((item) => {
    const albumName = resolveCollectionAlbum(item);

    if (activeAlbumName && albumName.toLowerCase() !== activeAlbumName.toLowerCase()) {
      return false;
    }

    if (albumSelectionTarget && albumName.toLowerCase() === albumSelectionTarget.toLowerCase()) {
      return false;
    }

    if (state.primaryFilter === 'Collections' && !activeAlbumName) {
      return false;
    }

    switch (state.secondaryFilter) {
      case 'Videos':
        if (item.type !== 'video') {
          return false;
        }
        break;
      case 'Documents':
        if (!item.isDocumentLike) {
          return false;
        }
        break;
      case 'Favourites':
        if (!state.favoriteIds.has(item.id)) {
          return false;
        }
        break;
      default:
        break;
    }

    return matchesSearchQuery(item, query) && matchesMediaSearchFilters(item, searchFilters);
  });
}

function summarizeLocations(items) {
  const counts = new Map();
  items.forEach((item) => {
    const location = normalizeText(item.location);
    if (!location) {
      return;
    }
    counts.set(location, (counts.get(location) || 0) + 1);
  });

  const ordered = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  if (!ordered.length) {
    return '';
  }
  if (ordered.length === 1) {
    return ordered[0][0];
  }
  return `${ordered[0][0]} & ${ordered.length - 1} more`;
}

function summarizeBinSection(items) {
  if (!items.length) {
    return '';
  }
  const sortedDays = items
    .map((item) => Number(item.daysLeft) || 0)
    .sort((left, right) => left - right);
  const minDays = sortedDays[0];
  const maxDays = sortedDays[sortedDays.length - 1];
  if (minDays === maxDays) {
    return `${minDays} day${minDays === 1 ? '' : 's'} left before permanent deletion`;
  }
  return `${minDays}-${maxDays} days left before permanent deletion`;
}

function toggleSectionSelection(sectionId, {
  selectionSet,
  itemIds
}) {
  const ids = itemIds.filter(Boolean);
  if (!ids.length) {
    return false;
  }
  const shouldSelectAll = ids.some((id) => !selectionSet.has(id));
  ids.forEach((id) => {
    if (shouldSelectAll) {
      selectionSet.add(id);
    } else {
      selectionSet.delete(id);
    }
  });
  return true;
}

function buildSections(items, {
  anchorPrefix = 'timeline',
  getLabel = (item) => item.timelineLabel || createTimelineLabel(item.takenAt),
  getYear = (item) => item.year,
  getMetaLine = summarizeLocations,
  getScrubberLabel = (item) => formatScrubberLabel(item.takenAt)
} = {}) {
  const groups = [];
  items.forEach((item) => {
    const label = getLabel(item);
    const year = String(getYear(item) || '');
    const key = `${year}-${label}`;
    const existing = groups[groups.length - 1];

    if (!existing || existing.key !== key) {
      groups.push({
        key,
        label,
        year,
        anchorId: `${anchorPrefix}-${year}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        scrubberLabel: getScrubberLabel(item) || year,
        items: [item]
      });
    } else {
      existing.items.push(item);
    }
  });

  return groups.map((group) => ({
    ...group,
    metaLine: getMetaLine(group.items)
  }));
}

function buildTimelineLayoutSections(sections, { sectionGap = TIMELINE_SECTION_GAP } = {}) {
  return sections.map((section) => {
    const rows = buildJustifiedRows(section.items, {
      containerWidth: state.layoutWidth,
      denseGrid: false
    });
    let offset = 0;
    const rowOffsets = rows.map((row, index) => {
      const rowTop = offset;
      offset += Number(row.height || row.items?.[0]?.height || 0);
      if (index < rows.length - 1) {
        offset += TIMELINE_ROW_GAP;
      }
      return rowTop;
    });

    return {
      ...section,
      rows,
      rowOffsets,
      totalRowsHeight: offset,
      estimatedHeight: TIMELINE_SECTION_CHROME_ESTIMATE + offset + sectionGap
    };
  });
}

function getVisibleRowRange(section, scrollTop, viewportHeight) {
  const overscanStart = Math.max(0, scrollTop - TIMELINE_VIRTUAL_OVERSCAN);
  const overscanEnd = scrollTop + Math.max(viewportHeight, window.innerHeight || 900) + TIMELINE_VIRTUAL_OVERSCAN;
  const sectionBodyStart = section.estimatedTop + TIMELINE_SECTION_CHROME_ESTIMATE;
  const bodyStart = overscanStart - sectionBodyStart;
  const bodyEnd = overscanEnd - sectionBodyStart;
  const rows = section.rows || [];

  if (!rows.length || bodyEnd <= 0 || bodyStart >= section.totalRowsHeight) {
    return {
      startIndex: -1,
      endIndex: -1,
      topSpacerHeight: bodyStart >= section.totalRowsHeight ? section.totalRowsHeight : 0,
      bottomSpacerHeight: bodyEnd <= 0 ? section.totalRowsHeight : 0,
      visibleRows: []
    };
  }

  let startIndex = 0;
  while (startIndex < rows.length) {
    const rowTop = section.rowOffsets[startIndex];
    const rowBottom = rowTop + Number(rows[startIndex].height || rows[startIndex].items?.[0]?.height || 0);
    if (rowBottom >= bodyStart) {
      break;
    }
    startIndex += 1;
  }

  let endIndex = rows.length - 1;
  while (endIndex >= startIndex) {
    const rowTop = section.rowOffsets[endIndex];
    if (rowTop <= bodyEnd) {
      break;
    }
    endIndex -= 1;
  }

  if (startIndex >= rows.length || endIndex < startIndex) {
    return {
      startIndex: -1,
      endIndex: -1,
      topSpacerHeight: bodyStart >= section.totalRowsHeight ? section.totalRowsHeight : 0,
      bottomSpacerHeight: bodyEnd <= 0 ? section.totalRowsHeight : 0,
      visibleRows: []
    };
  }

  const topSpacerHeight = section.rowOffsets[startIndex];
  const visibleHeight = section.rowOffsets[endIndex]
    + Number(rows[endIndex].height || rows[endIndex].items?.[0]?.height || 0)
    - topSpacerHeight;
  const bottomSpacerHeight = Math.max(0, section.totalRowsHeight - topSpacerHeight - visibleHeight);

  return {
    startIndex,
    endIndex,
    topSpacerHeight,
    bottomSpacerHeight,
    visibleRows: rows.slice(startIndex, endIndex + 1)
  };
}

function applyTimelineVirtualWindow(sections, { scrollTop = 0, viewportHeight = 0 } = {}) {
  let estimatedTop = 0;
  const signatureParts = [];
  const virtualSections = sections.map((section) => {
    const sectionWithOffset = {
      ...section,
      estimatedTop
    };
    const range = getVisibleRowRange(sectionWithOffset, scrollTop, viewportHeight);
    estimatedTop += section.estimatedHeight;
    signatureParts.push(`${section.anchorId}:${range.startIndex}-${range.endIndex}`);
    return {
      ...sectionWithOffset,
      ...range
    };
  });

  return {
    sections: virtualSections,
    signature: signatureParts.join('|')
  };
}

function buildCollectionSummaries(items) {
  const groups = new Map();
  const parsedSearch = parseMediaSearchQuery(state.searchQuery);
  const query = parsedSearch.textQuery.toLowerCase();
  const searchFilters = parsedSearch.filters;
  const ensureGroup = (name) => {
    const normalizedName = normalizeText(name);
    if (!normalizedName) {
      return null;
    }
    const key = normalizedName.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: normalizedName,
        items: []
      });
    }
    return groups.get(key);
  };

  state.albumNames.forEach((albumName) => ensureGroup(albumName));
  items.forEach((item) => {
    const group = ensureGroup(resolveCollectionAlbum(item));
    if (group) {
      group.items.push(item);
    }
  });

  return [...groups.values()]
    .filter((group) => {
      if (!query) {
        return group.items.length > 0 || state.albumNames.some((albumName) => albumName.toLowerCase() === group.key);
      }
      if (group.name.toLowerCase().includes(query)) {
        return true;
      }
      return group.items.some((item) => matchesSearchQuery(item, query) && matchesMediaSearchFilters(item, searchFilters));
    })
    .map((group) => {
      const { item: coverItem, isCustom } = findAlbumCoverItem(group.name, group.items);
      const lastModifiedAt = Math.max(0, ...group.items.map((item) => getAlbumSortTimestamp(item)));
      return {
        ...group,
        coverItem,
        hasCustomCover: isCustom,
        itemCount: group.items.length,
        createdAt: coverItem?.takenAt || coverItem?.createdAt || coverItem?.updatedAt || '',
        lastModifiedAt,
        metaLine: ''
      };
    })
    .sort((left, right) => {
      const rightTime = Number.isFinite(right.lastModifiedAt) ? right.lastModifiedAt : -Infinity;
      const leftTime = Number.isFinite(left.lastModifiedAt) ? left.lastModifiedAt : -Infinity;
      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }
      return left.name.localeCompare(right.name);
    });
}

function getViewModel() {
  const visibleSecondaryFilters = getVisibleSecondaryFilters(getAllItems());
  if (state.secondaryFilter && !visibleSecondaryFilters.includes(state.secondaryFilter)) {
    state.secondaryFilter = '';
  }

  const activeAlbumName = getActiveAlbumName();
  const albumSelectionTarget = getAlbumSelectionTarget();
  const filteredItems = getFilteredItems();
  const selectedItems = getSelectedItems();
  const activeAlbumItems = activeAlbumName
    ? getAllItems().filter((item) => normalizeAlbumKey(resolveCollectionAlbum(item)) === normalizeAlbumKey(activeAlbumName))
    : [];
  const activeAlbumCover = activeAlbumName
    ? findAlbumCoverItem(activeAlbumName, activeAlbumItems)
    : { item: null, isCustom: false };
  const allCollections = state.primaryFilter === 'Collections' && !activeAlbumName
    ? buildCollectionSummaries(getAllItems())
    : [];
  const collectionCards = allCollections.slice(0, state.loadedCount);
  const isCollectionRoot = state.primaryFilter === 'Collections' && !activeAlbumName;
  const isAlbumPickerMode = Boolean(albumSelectionTarget);
  const timelineItems = state.primaryFilter === 'Bin'
    ? state.binItems
    : filteredItems;
  const baseSections = isCollectionRoot
    ? []
    : buildSections(timelineItems, state.primaryFilter === 'Bin'
      ? {
          anchorPrefix: 'bin',
          getLabel: (item) => item.timelineLabel || createTimelineLabel(item.deletedAt || item.takenAt),
          getYear: (item) => item.year || new Date(item.deletedAt || item.takenAt).getFullYear(),
          getMetaLine: summarizeBinSection,
          getScrubberLabel: (item) => formatScrubberLabel(item.deletedAt || item.takenAt)
        }
      : undefined);
  const laidOutSections = isCollectionRoot
    ? []
    : buildTimelineLayoutSections(baseSections, {
        sectionGap: state.primaryFilter === 'Bin' ? BIN_TIMELINE_SECTION_GAP : TIMELINE_SECTION_GAP
      });
  const shouldVirtualizeTimeline = !isCollectionRoot && timelineItems.length > TIMELINE_VIRTUALIZATION_ITEM_THRESHOLD;
  const virtualWindow = !shouldVirtualizeTimeline
    ? {
        sections: laidOutSections.map((section) => ({
          ...section,
          startIndex: section.rows.length ? 0 : -1,
          endIndex: section.rows.length ? section.rows.length - 1 : -1,
          topSpacerHeight: 0,
          bottomSpacerHeight: 0,
          visibleRows: section.rows
        })),
        signature: ''
      }
    : isCollectionRoot
      ? { sections: [], signature: '' }
      : applyTimelineVirtualWindow(laidOutSections, {
          scrollTop: state.virtualScrollTop,
          viewportHeight: state.virtualViewportHeight
        });
  const sections = virtualWindow.sections;
  const years = isCollectionRoot
    ? []
    : [...new Set(timelineItems.map((item) => String(item.year)))]
      .sort((left, right) => Number(right) - Number(left));
  const scrubberSections = sections.map((section, index) => ({
    anchorId: section.anchorId,
    year: section.year,
    scrubberLabel: section.scrubberLabel || section.year,
    isYearBoundary: index === 0 || sections[index - 1].year !== section.year
  }));
  const previewItems = state.primaryFilter === 'Bin' ? [] : filteredItems;
  const previewIndex = previewItems.findIndex((item) => item.id === state.previewId);
  const previewItem = previewIndex >= 0 ? previewItems[previewIndex] : null;
  const canSetAlbumCover = Boolean(
    activeAlbumName
    && selectedItems.length === 1
    && normalizeAlbumKey(resolveCollectionAlbum(selectedItems[0])) === normalizeAlbumKey(activeAlbumName)
  );

  if (years.length && !years.some((year) => String(year) === String(state.activeYear))) {
    state.activeYear = years[0];
  }
  if (scrubberSections.length && !scrubberSections.some((section) => section.anchorId === state.activeSectionAnchor)) {
    state.activeSectionAnchor = scrubberSections[0].anchorId;
  }

  return {
    navigationModel: {
      primary: navigationModel.primary,
      secondary: visibleSecondaryFilters
    },
    activeAlbumName,
    activeAlbumCoverId: activeAlbumCover.item?.id || '',
    activeAlbumCoverLabel: activeAlbumCover.item?.label || activeAlbumCover.item?.displayTakenAt || '',
    hasCustomAlbumCover: activeAlbumCover.isCustom,
    albumSelectionTarget,
    isAlbumPickerMode,
    isCollectionRoot,
    collectionCards,
    totalCollectionCount: allCollections.length,
    filteredItems,
    sections,
    timelineLayoutSections: laidOutSections,
    timelineVirtualSignature: virtualWindow.signature,
    timelineVirtualEnabled: shouldVirtualizeTimeline,
    years,
    scrubberSections,
    previewItems,
    previewIndex,
    previewItem,
    availableAlbums: getAvailableAlbumNames(),
    previewAlbumEntries: buildPreviewAlbumEntries(getAllItems()),
    canSetAlbumCover,
    canDownloadSelection: state.primaryFilter !== 'Bin' && getDownloadableItems(selectedItems).length > 0,
    canDeleteSelection: state.primaryFilter !== 'Bin' && selectedItems.length > 0 && selectedItems.every((item) => canDeleteItem(item)),
    binItems: state.binItems,
    isBinLoading: state.isBinLoading,
    binSelectedIds: state.binSelectedIds
  };
}

function syncLayoutWidth() {
  if (!refs.contentInner) {
    return;
  }
  const nextWidth = Math.max(280, Math.round(refs.contentInner.clientWidth - 4));
  if (Math.abs(nextWidth - state.layoutWidth) <= 2) {
    return;
  }
  state.layoutWidth = nextWidth;
  window.requestAnimationFrame(() => {
    if (refs.root) {
      render();
    }
  });
}

function render() {
  if (!refs.root) {
    return;
  }
  sectionRangeCache.clear();

  if (state.needsLogin) {
    refs.root.innerHTML = LoginOverlay({ error: state.loginError, isLoading: state.isLoggingIn });
    requestAnimationFrame(() => {
      const firstInput = refs.root ? refs.root.querySelector('.cml-login__input') : null;
      if (firstInput) {
        firstInput.focus();
      }
    });
    return;
  }

  const previousScrollTop = refs.scrollRegion ? refs.scrollRegion.scrollTop : state.virtualScrollTop;
  const searchWasFocused = document.activeElement instanceof HTMLInputElement
    && (
      document.activeElement.classList.contains('cml-topbar__search-input')
      || document.activeElement.classList.contains('cml-sidebar__search-input')
    );
  const viewModel = getViewModel();
  const contentViewKey = buildContentViewKey(viewModel);
  const shouldAnimateContentView = Boolean(lastContentViewKey) && lastContentViewKey !== contentViewKey;
  lastContentViewKey = contentViewKey;
  const storageInsights = buildStorageInsights();
  const parsedSearch = parseMediaSearchQuery(state.searchQuery);
  const activeSearchFilterCount = countActiveMediaSearchFilters(parsedSearch.filters);
  const activeSearchFilterParts = summarizeMediaSearch(parsedSearch.filters);

  refs.root.innerHTML = `
    <div class="cml-app-shell">
      ${Sidebar({
        navigationModel: viewModel.navigationModel,
        state,
        storageSummary: state.storageSummary,
        searchQuery: state.searchDraft
      })}
      <div class="cml-main-shell">
        ${TopSearchBar({
          state,
          canDeleteSelection: viewModel.canDeleteSelection,
          canDownloadSelection: viewModel.canDownloadSelection,
          canSetAlbumCover: viewModel.canSetAlbumCover
        })}
        <div class="cml-main-content-shell">
          <main class="cml-main-content" tabindex="-1">
            <div class="cml-main-content__inner">
              ${state.primaryFilter === 'Bin'
                ? BinGrid({
                  items: viewModel.binItems,
                  sections: viewModel.sections,
                  binSelectedIds: viewModel.binSelectedIds,
                  isBinLoading: viewModel.isBinLoading,
                  layoutWidth: state.layoutWidth,
                  activeSectionAnchor: state.activeSectionAnchor
                })
                : `${state.primaryFilter === 'Collections'
                  ? CollectionSummary({
                    activeAlbumName: viewModel.activeAlbumName,
                    collectionCount: viewModel.totalCollectionCount,
                    itemCount: viewModel.filteredItems.length,
                    coverLabel: viewModel.activeAlbumCoverLabel,
                    hasCustomCover: viewModel.hasCustomAlbumCover,
                    renameAlbumDialogOpen: state.renameAlbumDialogOpen,
                    renameAlbumDraftName: state.renameAlbumDraftName,
                    renameAlbumError: state.renameAlbumError,
                    renameAlbumBusy: state.renameAlbumBusy
                  })
                  : ''}
                ${SearchSummary({
                  query: parsedSearch.textQuery,
                  resultCount: viewModel.isCollectionRoot ? viewModel.totalCollectionCount : viewModel.filteredItems.length,
                  filterParts: activeSearchFilterParts,
                  hasActiveFilters: activeSearchFilterCount > 0
                })}
                ${viewModel.isCollectionRoot
                  ? (viewModel.collectionCards.length
                     ? CollectionGrid({ collections: viewModel.collectionCards })
                     : EmptyState({ query: parsedSearch.textQuery, isLoading: state.isLibraryLoading, mode: 'collections' }))
                  : (viewModel.sections.length
                     ? viewModel.sections.map((section) => MediaTimelineSection({
                      section,
                      state,
                      layoutWidth: state.layoutWidth,
                      coverItemId: viewModel.activeAlbumCoverId
                     })).join('')
                     : EmptyState({
                      query: parsedSearch.textQuery,
                      isLoading: state.isLibraryLoading,
                      mode: viewModel.activeAlbumName ? 'album-detail' : (viewModel.isAlbumPickerMode ? 'album-picker' : 'media'),
                      actionLabel: viewModel.activeAlbumName ? 'Add from library' : (viewModel.isAlbumPickerMode ? 'Back to album' : ''),
                      actionAction: viewModel.activeAlbumName ? 'open-add-to-current-album' : (viewModel.isAlbumPickerMode ? 'cancel-add-to-current-album' : '')
                    }))}`}
            </div>
          </main>
          ${!viewModel.isCollectionRoot ? YearScroller({
            scrubberSections: viewModel.scrubberSections,
            activeSectionAnchor: state.activeSectionAnchor,
            activeScrubberLabel: state.activeScrubberLabel
          }) : ''}
        </div>
      </div>
      ${PreviewModal(getPreviewOverlayModel())}
      ${AdminPanel({ state, storageSummary: state.storageSummary })}
      ${StoragePanel({ state, insights: storageInsights })}
      ${AlbumDialog({ state, albums: viewModel.availableAlbums })}
      ${ConfirmDialog({ state })}
      ${state.toastMessage ? `
        <div class="cml-toast cml-toast--${state.toastType}" role="alert" aria-live="polite">
          <span class="cml-toast__message">${state.toastMessage.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
          <button type="button" class="cml-toast__dismiss" data-action="dismiss-toast" aria-label="Dismiss">✕</button>
        </div>
      ` : ''}
    </div>
  `;

  if (state.renameAlbumDialogOpen) {
    focusInlineRenameInput({ select: true });
  }

  refs.root.classList.toggle('has-selection', state.selectedIds.size > 0);

  refs.scrollRegion = refs.root.querySelector('.cml-main-content');
  refs.sectionAnchors = [...refs.root.querySelectorAll('.cml-timeline-section')];
  refs.contentInner = refs.root.querySelector('.cml-main-content__inner');
  refs.sectionItemIds = new Map(viewModel.sections.map((section) => [
    section.anchorId,
    section.items.map((item) => item.id)
  ]));
  refs.timelineLayoutSections = viewModel.timelineLayoutSections || [];
  refs.timelineVirtualSignature = viewModel.timelineVirtualSignature || '';
  refs.timelineVirtualEnabled = Boolean(viewModel.timelineVirtualEnabled);

  if (shouldAnimateContentView) {
    animateContentViewTransition();
  }

  if (refs.scrollRegion) {
    scrollRestoring = true;
    refs.scrollRegion.scrollTop = previousScrollTop;
    state.virtualScrollTop = previousScrollTop;
    state.virtualViewportHeight = refs.scrollRegion.clientHeight;
    refs.scrollRegion.onscroll = handleScroll;
    requestAnimationFrame(() => { scrollRestoring = false; });
  }

  if (searchWasFocused) {
    focusSearchInput();
  }

  syncLayoutWidth();
  updateActiveYear();
  updateScrubberThumb();
  setupPreviewTouchHandlers();
  setupYearScrollerDrag();
  setupImageLoadAnimations();
}

function syncTopbarSelectionState() {
  const currentTopbar = refs.root?.querySelector('.cml-topbar');
  if (!(currentTopbar instanceof HTMLElement)) {
    return;
  }
  const selectedItems = getSelectedItems();
  const activeAlbumName = getActiveAlbumName();
  const canSetAlbumCover = Boolean(
    activeAlbumName
    && selectedItems.length === 1
    && normalizeAlbumKey(resolveCollectionAlbum(selectedItems[0])) === normalizeAlbumKey(activeAlbumName)
  );
  const markup = TopSearchBar({
    state,
    canDeleteSelection: state.primaryFilter !== 'Bin' && selectedItems.length > 0 && selectedItems.every((item) => canDeleteItem(item)),
    canDownloadSelection: state.primaryFilter !== 'Bin' && getDownloadableItems(selectedItems).length > 0,
    canSetAlbumCover
  }).trim();
  if (!markup) {
    return;
  }
  const template = document.createElement('template');
  template.innerHTML = markup;
  const nextTopbar = template.content.firstElementChild;
  if (nextTopbar instanceof HTMLElement) {
    currentTopbar.replaceWith(nextTopbar);
  }
}

function syncSelectionTileState(tile, selected) {
  if (!(tile instanceof HTMLElement)) {
    return;
  }
  tile.classList.toggle('is-selected', selected);
  const selectButton = tile.querySelector('.cml-media-tile__select');
  if (selectButton instanceof HTMLElement) {
    selectButton.innerHTML = selected ? TILE_SELECTION_CHECK_MARKUP : TILE_SELECTION_RING_MARKUP;
    selectButton.setAttribute('aria-pressed', selected ? 'true' : 'false');
  }
}

function syncTimelineSelectionControls() {
  if (!(refs.root instanceof HTMLElement)) {
    return;
  }
  refs.root.querySelectorAll('.cml-timeline-section__select[data-section]').forEach((button) => {
    const sectionId = button.getAttribute('data-section') || '';
    const itemIds = refs.sectionItemIds.get(sectionId) || [];
    const allSelected = itemIds.length > 0 && itemIds.every((id) => state.selectedIds.has(id));
    button.classList.toggle('is-active', allSelected);
    button.setAttribute('aria-pressed', allSelected ? 'true' : 'false');
  });
}

function syncSelectionUi(changedItemIds = []) {
  if (!(refs.root instanceof HTMLElement) || state.primaryFilter === 'Bin' || state.needsLogin) {
    return false;
  }
  const changedSet = new Set(changedItemIds.filter(Boolean));
  refs.root.querySelectorAll('.cml-media-tile[data-tile-id]').forEach((tile) => {
    const itemId = tile.getAttribute('data-tile-id') || '';
    if (changedSet.size && !changedSet.has(itemId)) {
      return;
    }
    syncSelectionTileState(tile, state.selectedIds.has(itemId));
  });
  refs.root.classList.toggle('has-selection', state.selectedIds.size > 0);
  syncTopbarSelectionState();
  syncTimelineSelectionControls();
  return true;
}

function syncPreviewFavoriteButton(itemId) {
  if (!(refs.root instanceof HTMLElement) || !state.previewId || normalizeText(itemId) !== normalizeText(state.previewId)) {
    return false;
  }
  const favoriteButton = refs.root.querySelector('.cml-preview [data-action="toggle-favorite"]');
  if (!(favoriteButton instanceof HTMLElement)) {
    return false;
  }
  const favorited = state.favoriteIds.has(itemId);
  favoriteButton.classList.toggle('is-favorited', favorited);
  favoriteButton.setAttribute('aria-label', favorited ? 'Remove from favourites' : 'Add to favourites');
  favoriteButton.setAttribute('aria-pressed', favorited ? 'true' : 'false');
  return true;
}

function getPreviewOverlayModel({
  previewItems = null,
  previewItem = null,
  previewIndex = -1,
  albumEntries = null
} = {}) {
  const resolvedPreviewItems = Array.isArray(previewItems) ? previewItems : getPreviewItems();
  const resolvedPreviewIndex = Number.isInteger(previewIndex)
    ? previewIndex
    : resolvedPreviewItems.findIndex((item) => item.id === state.previewId);
  const fallbackPreviewItem = resolvedPreviewIndex >= 0
    ? resolvedPreviewItems[resolvedPreviewIndex]
    : resolvePreviewItem(getAllItems(), {
        id: state.previewId,
        sourceHint: state.previewTransitionSrc
      });
  const resolvedPreviewItem = previewItem || fallbackPreviewItem;
  const finalPreviewIndex = resolvedPreviewIndex >= 0 && resolvedPreviewItem
    ? resolvedPreviewIndex
    : resolvedPreviewItems.findIndex((item) => item.id === resolvedPreviewItem?.id);
  return {
    item: resolvedPreviewItem,
    selected: resolvedPreviewItem ? state.selectedIds.has(resolvedPreviewItem.id) : false,
    favorited: resolvedPreviewItem ? state.favoriteIds.has(resolvedPreviewItem.id) : false,
    currentIndex: Math.max(finalPreviewIndex, 0),
    totalCount: resolvedPreviewItems.length,
    infoOpen: state.infoOpen,
    immersive: state.previewImmersive,
    albumDrawerOpen: state.albumDialogOpen && state.albumDialogOrigin === 'preview',
    albumEntries: Array.isArray(albumEntries) ? albumEntries : buildPreviewAlbumEntries(),
    albumDraftName: state.albumDraftName,
    albumDialogError: state.albumDialogError,
    albumDrawerSearch: state.albumDrawerSearch,
    albumDrawerCreateMode: state.albumDrawerCreateMode
  };
}

function animatePreviewSwap(direction = 0) {
  if (!refs.root) {
    return;
  }
  const offset = direction > 0 ? 18 : -18;
  const targets = [
    refs.root.querySelector('.cml-preview__stage'),
    refs.root.querySelector('.cml-preview__caption'),
    refs.root.querySelector('.cml-preview__footer-meta'),
    refs.root.querySelector('.cml-preview__footer-actions'),
    refs.root.querySelector('.cml-preview__info.is-open .cml-preview__info-inner'),
    refs.root.querySelector('.cml-preview__album-panel.is-open .cml-preview__album-sheet')
  ].filter((node) => node instanceof HTMLElement);

  targets.forEach((node) => {
    node.animate(
      [
        { opacity: 0.72, transform: `translateX(${offset}px)` },
        { opacity: 1, transform: 'translateX(0)' }
      ],
      {
        duration: 170,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        fill: 'both'
      }
    );
  });
}

function getPreviewItems(items = getAllItems()) {
  return state.primaryFilter === 'Bin' ? [] : getFilteredItems(items);
}

function getPreviewMediaSignature(node) {
  if (!(node instanceof HTMLElement)) {
    return '';
  }
  const mediaNode = node.querySelector('.cml-preview__media');
  if (!(mediaNode instanceof HTMLElement)) {
    return '';
  }
  const source = mediaNode.getAttribute('src')
    || mediaNode.getAttribute('data-src')
    || mediaNode.getAttribute('poster')
    || mediaNode.currentSrc
    || '';
  const tagName = normalizeText(mediaNode.tagName).toLowerCase();
  const poster = mediaNode.getAttribute('poster') || '';
  return `${tagName}|${source}|${poster}`;
}

function syncPreviewSection(currentParent, nextParent, selector, { preserveFigure = false } = {}) {
  if (!(currentParent instanceof HTMLElement) || !(nextParent instanceof HTMLElement)) {
    return;
  }
  const currentNode = currentParent.querySelector(selector);
  const nextNode = nextParent.querySelector(selector);
  if (currentNode instanceof HTMLElement && nextNode instanceof HTMLElement) {
    const currentFigure = preserveFigure ? currentNode.querySelector('.cml-preview__figure') : null;
    const nextFigure = preserveFigure ? nextNode.querySelector('.cml-preview__figure') : null;
    const shouldReuseFigure = Boolean(
      currentFigure
      && nextFigure
      && getPreviewMediaSignature(currentFigure) !== ''
      && getPreviewMediaSignature(currentFigure) === getPreviewMediaSignature(nextFigure)
    );
    currentNode.className = nextNode.className;
    currentNode.innerHTML = nextNode.innerHTML;
    if (shouldReuseFigure) {
      const replacementFigure = currentNode.querySelector('.cml-preview__figure');
      const nextStage = nextNode.querySelector('.cml-preview__stage');
      if (replacementFigure instanceof HTMLElement) {
        replacementFigure.replaceWith(currentFigure);
        currentFigure.className = nextFigure.className;
        const currentStage = currentFigure.querySelector('.cml-preview__stage');
        if (currentStage instanceof HTMLElement && nextStage instanceof HTMLElement) {
          currentStage.className = nextStage.className;
        }
      }
    }
  } else if (currentNode instanceof HTMLElement && !nextNode) {
    currentNode.remove();
  } else if (!(currentNode instanceof HTMLElement) && nextNode instanceof HTMLElement) {
    currentParent.appendChild(nextNode.cloneNode(true));
  }
}

function renderPreviewOverlay({ animateDirection = 0, nextPreviewElement = null } = {}) {
  if (!refs.root) {
    return false;
  }
  const currentPreview = refs.root.querySelector('.cml-preview');
  if (!(currentPreview instanceof HTMLElement)) {
    return false;
  }

  const nextPreview = nextPreviewElement instanceof HTMLElement
    ? nextPreviewElement
    : (() => {
        const previewModel = getPreviewOverlayModel();
        if (!previewModel.item) {
          return null;
        }
        const template = document.createElement('template');
        template.innerHTML = PreviewModal(previewModel).trim();
        return template.content.firstElementChild;
      })();
  if (!(nextPreview instanceof HTMLElement)) {
    currentPreview.remove();
    return true;
  }

  const focusAction = currentPreview.contains(document.activeElement)
    && document.activeElement instanceof HTMLElement
    ? document.activeElement.getAttribute('data-action')
    : '';
  const currentPanel = currentPreview.querySelector('.cml-preview__panel');
  const nextPanel = nextPreview.querySelector('.cml-preview__panel');
  const shouldPreservePreviewFigure = animateDirection === 0
    && normalizeText(currentPreview.dataset.previewId) !== ''
    && normalizeText(currentPreview.dataset.previewId) === normalizeText(nextPreview.dataset.previewId);

  currentPreview.className = nextPreview.className;
  currentPreview.setAttribute('role', nextPreview.getAttribute('role') || 'dialog');
  currentPreview.setAttribute('aria-modal', nextPreview.getAttribute('aria-modal') || 'true');
  currentPreview.dataset.previewId = nextPreview.dataset.previewId || '';

  if (currentPanel instanceof HTMLElement && nextPanel instanceof HTMLElement) {
    currentPanel.className = nextPanel.className;
    PREVIEW_PANEL_SECTION_SELECTORS.forEach((selector) => {
      syncPreviewSection(currentPanel, nextPanel, selector, {
        preserveFigure: shouldPreservePreviewFigure && selector === '.cml-preview__main'
      });
    });
  } else {
    currentPreview.replaceWith(nextPreview);
  }

  setupPreviewTouchHandlers();
  if (focusAction) {
    const nextFocusTarget = refs.root.querySelector(`.cml-preview [data-action="${focusAction}"]`);
    if (nextFocusTarget instanceof HTMLElement) {
      nextFocusTarget.focus({ preventScroll: true });
    }
  }
  if (animateDirection) {
    window.requestAnimationFrame(() => animatePreviewSwap(animateDirection));
  }
  return true;
}

function getFloatingLayerContainer() {
  return refs.root?.querySelector('.cml-app-shell') || refs.root;
}

function replaceFloatingLayer(currentNode, nextNode) {
  const container = getFloatingLayerContainer();
  if (!(container instanceof HTMLElement)) {
    return;
  }
  if (currentNode instanceof HTMLElement && nextNode instanceof HTMLElement) {
    currentNode.replaceWith(nextNode);
  } else if (currentNode instanceof HTMLElement && !(nextNode instanceof HTMLElement)) {
    currentNode.remove();
  } else if (!(currentNode instanceof HTMLElement) && nextNode instanceof HTMLElement) {
    container.appendChild(nextNode);
  }
}

function getToastMarkup() {
  if (!state.toastMessage) {
    return '';
  }
  return `
    <div class="cml-toast cml-toast--${state.toastType}" role="alert" aria-live="polite">
      <span class="cml-toast__message">${state.toastMessage.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
      <button type="button" class="cml-toast__dismiss" data-action="dismiss-toast" aria-label="Dismiss">鉁?/button>
    </div>
  `;
}

function renderPreviewTransientLayers({ animateDirection = 0 } = {}) {
  if (!refs.root) {
    return false;
  }
  const allItems = getAllItems();
  const previewItems = getPreviewItems(allItems);
  const previewIndex = previewItems.findIndex((item) => item.id === state.previewId);
  const previewItem = previewIndex >= 0 ? previewItems[previewIndex] : null;
  const albumEntries = buildPreviewAlbumEntries(allItems);
  const previewModel = getPreviewOverlayModel({
    previewItems,
    previewItem,
    previewIndex,
    albumEntries
  });
  const template = document.createElement('template');
  template.innerHTML = `
    ${PreviewModal(previewModel)}
    ${AlbumDialog({ state, albums: getAvailableAlbumNames(allItems) })}
    ${ConfirmDialog({ state })}
    ${getToastMarkup()}
  `.trim();

  const nextPreview = template.content.querySelector('.cml-preview');
  const currentPreview = refs.root.querySelector('.cml-preview');
  if (currentPreview instanceof HTMLElement && nextPreview instanceof HTMLElement) {
    renderPreviewOverlay({ animateDirection, nextPreviewElement: nextPreview });
  } else {
    replaceFloatingLayer(currentPreview, nextPreview);
    if (nextPreview instanceof HTMLElement) {
      setupPreviewTouchHandlers();
    }
  }

  const currentAlbumDialog = refs.root.querySelector('.cml-album-dialog')?.closest('.cml-dialog') || null;
  const nextAlbumDialog = template.content.querySelector('.cml-album-dialog')?.closest('.cml-dialog') || null;
  replaceFloatingLayer(currentAlbumDialog, nextAlbumDialog);

  const currentConfirmDialog = refs.root.querySelector('.cml-confirm-dialog')?.closest('.cml-dialog') || null;
  const nextConfirmDialog = template.content.querySelector('.cml-confirm-dialog')?.closest('.cml-dialog') || null;
  replaceFloatingLayer(currentConfirmDialog, nextConfirmDialog);

  const currentToast = refs.root.querySelector('.cml-toast');
  const nextToast = template.content.querySelector('.cml-toast');
  replaceFloatingLayer(currentToast, nextToast);

  if (state.albumDialogOpen) {
    window.setTimeout(() => {
      focusAlbumInput({ focusKey: state.albumDrawerCreateMode ? 'create' : 'search' });
    }, 30);
  }
  return true;
}

async function performSyncLiveMedia({ forceRender = false } = {}) {
  state.liveSyncAttempts += 1;

  const domItems = extractLiveMediaItems();
  let items = domItems;
  let surfaceReady = hasUnderlyingSurface();

  try {
    const indexedItems = await fetchIndexedMediaItems(domItems);
    if (indexedItems.length) {
      items = indexedItems;
      surfaceReady = true;
    }
  } catch (error) {
    console.warn('[media-library] falling back to DOM extraction', error);
  }

  const visibleSecondaryFilters = getVisibleSecondaryFilters(items);
  if (state.secondaryFilter && !visibleSecondaryFilters.includes(state.secondaryFilter)) {
    state.secondaryFilter = '';
  }

  const signature = items.map((item) => `${item.id}:${item.takenAt}:${item.thumbnailUrl}:${item.width}x${item.height}`).join('|');
  const validIds = new Set(items.map((item) => item.id));
  let changed = false;

  if (signature !== state.liveMediaSignature) {
    state.liveMediaSignature = signature;
    state.mediaItems = items;
    changed = true;
    void syncStorageSummary();
  }

  if (syncAlbumCovers(items.map((item) => applyAlbumOverride(item)))) {
    changed = true;
  }

  const nextSelectedIds = new Set([...state.selectedIds].filter((id) => validIds.has(id)));
  if (nextSelectedIds.size !== state.selectedIds.size) {
    state.selectedIds = nextSelectedIds;
    if (state.lastSelectedId && !nextSelectedIds.has(state.lastSelectedId)) {
      state.lastSelectedId = [...nextSelectedIds].pop() || null;
    }
    changed = true;
  }

  if (state.previewId) {
    const nextPreviewItem = resolvePreviewItem(items, {
      id: state.previewId,
      sourceHint: state.previewTransitionSrc
    });
    if (!nextPreviewItem) {
      state.previewId = null;
      changed = true;
    } else if (nextPreviewItem.id !== state.previewId) {
      state.previewId = nextPreviewItem.id;
      changed = true;
    }
  }

  const shouldKeepLoading = items.length === 0 && (!surfaceReady || state.liveSyncAttempts < 4);
  if (state.isLibraryLoading !== shouldKeepLoading) {
    state.isLibraryLoading = shouldKeepLoading;
    changed = true;
  }

  if ((changed || forceRender) && refs.root) {
    if (!(state.previewId && renderPreviewTransientLayers())) {
      render();
    }
  }
}

function syncLiveMedia(options = {}) {
  if (liveSyncPromise) {
    pendingSyncForceRender = pendingSyncForceRender || options.forceRender;
    return liveSyncPromise;
  }

  liveSyncPromise = performSyncLiveMedia(options)
    .catch((error) => {
      console.error('[media-library] sync failed', error);
    })
    .finally(() => {
      liveSyncPromise = null;
      if (pendingSyncForceRender) {
        const rerender = pendingSyncForceRender;
        pendingSyncForceRender = false;
        syncLiveMedia({ forceRender: rerender });
      }
    });

  return liveSyncPromise;
}

function scheduleLiveSync() {
  if (liveSyncRaf) {
    return;
  }
  liveSyncRaf = window.requestAnimationFrame(() => {
    liveSyncRaf = 0;
    syncLiveMedia();
  });
}

function startLiveObserver() {
  stopLiveObserver();
  const target = document.getElementById('app') || document.body;
  liveObserver = new MutationObserver(() => {
    scheduleLiveSync();
  });
  liveObserver.observe(target, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'title', 'aria-label', 'class']
  });

  [0, 180, 700, 1800].forEach((delay) => {
    window.setTimeout(() => {
      syncLiveMedia({ forceRender: true });
      consumePendingUploadRequest();
    }, delay);
  });
}

function stopLiveObserver() {
  if (liveObserver) {
    liveObserver.disconnect();
    liveObserver = null;
  }
  if (liveSyncRaf) {
    window.cancelAnimationFrame(liveSyncRaf);
    liveSyncRaf = 0;
  }
}

function mount() {
  ensureRoot();
  document.body.classList.add('codex-media-library-active');
  state.liveSyncAttempts = 0;
  void loadPersistedAlbumState({ forceRender: true });
  syncLiveMedia({ forceRender: true });
  void syncStorageSummary({ forceRender: true });
  if (!state.adminUsername) {
    void fetchAdminIdentity();
  }
  render();
  startLiveObserver();
  consumePendingUploadRequest();

  if (!mounted && refs.root) {
    refs.root.addEventListener('click', handleClick, true);
    refs.root.addEventListener('input', handleInput);
    refs.root.addEventListener('change', handleChange);
    refs.root.addEventListener('focusin', handleFocusIn);
    refs.root.addEventListener('submit', (e) => {
      if (e.target instanceof HTMLFormElement && e.target.dataset.form === 'login') {
        e.preventDefault();
        void submitLogin();
      }
    }, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleWindowResize);
    mounted = true;
  }
}

function unmount() {
  document.body.classList.remove('codex-media-library-active');
  stopLiveObserver();
  if (timelineRenderRaf) {
    window.cancelAnimationFrame(timelineRenderRaf);
    timelineRenderRaf = 0;
  }
  if (refs.root) {
    refs.root.remove();
    refs.root = null;
  }
  refs.scrollRegion = null;
  refs.sectionAnchors = [];
  refs.contentInner = null;
  refs.sectionItemIds = new Map();
  refs.timelineLayoutSections = [];
  refs.timelineVirtualSignature = '';
  refs.timelineVirtualEnabled = false;
}

function syncMount() {
  if (normalizePreferredLibraryRoute()) {
    queueMicrotask(syncMount);
    return;
  }
  if (shouldMount()) {
    mount();
  } else {
    unmount();
  }
}

function openPreview(itemId) {
  const sourceTile = itemId
    ? refs.root?.querySelector(`.cml-media-tile[data-tile-id="${itemId}"]`)
    : null;
  const sourceHint = getMediaSourceFromTile(sourceTile);
  const resolvedPreviewItem = resolvePreviewItem(getAllItems(), {
    id: itemId,
    sourceHint
  });
  state.previewId = resolvedPreviewItem?.id || itemId;
  state.previewTransitionRect = snapshotRect(sourceTile);
  state.previewTransitionSrc = sourceHint || resolvedPreviewItem?.thumbnailUrl || resolvedPreviewItem?.sourceUrl || '';
  state.infoOpen = false;
  state.previewImmersive = false;
  touchZoom.currentScale = 1;
  touchZoom.tx = 0;
  touchZoom.ty = 0;
  touchZoom.lastTap = 0;
  if (!renderPreviewTransientLayers()) {
    render();
  }
  window.requestAnimationFrame(() => animatePreviewOpenFromTile());
}

function openPreviewFromEvent(event, itemId) {
  const normalizedId = normalizeText(itemId);
  if (!normalizedId) {
    return false;
  }
  if (event && event.target) {
    const selectBtn = event.target.closest('[data-action="toggle-select"]');
    if (selectBtn) {
      return false;
    }
  }
  if (event && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
  if (event && typeof event.stopPropagation === 'function') {
    event.stopPropagation();
  }
  if (event && typeof event.stopImmediatePropagation === 'function') {
    event.stopImmediatePropagation();
  }
  state.avatarMenuOpen = false;
  openPreview(normalizedId);
  return false;
}

function closePreview() {
  state.previewId = null;
  state.previewTransitionRect = null;
  state.previewTransitionSrc = '';
  state.infoOpen = false;
  if (state.albumDialogOrigin === 'preview') {
    state.albumDialogOpen = false;
    state.albumDialogOrigin = '';
    state.albumDialogError = '';
    state.albumDraftName = '';
    state.albumDrawerSearch = '';
    state.albumDrawerScope = 'all';
    state.albumDrawerCreateMode = false;
  }
  state.previewImmersive = false;
  touchZoom.currentScale = 1;
  touchZoom.tx = 0;
  touchZoom.ty = 0;
  if (!renderPreviewTransientLayers()) {
    render();
  }
}

function movePreview(direction) {
  const items = getFilteredItems();
  if (!items.length || !state.previewId) {
    return false;
  }
  const currentIndex = items.findIndex((item) => item.id === state.previewId);
  if (currentIndex < 0) {
    return false;
  }
  const nextIndex = Math.max(0, Math.min(items.length - 1, currentIndex + direction));
  if (nextIndex === currentIndex) {
    return false;
  }
  const nextItem = items[nextIndex];
  state.previewId = nextItem.id;
  const sourceTile = refs.root?.querySelector(`.cml-media-tile[data-tile-id="${nextItem.id}"]`) || null;
  state.previewTransitionRect = snapshotRect(sourceTile);
  state.previewTransitionSrc = getMediaSourceFromTile(sourceTile);
  touchZoom.currentScale = 1;
  touchZoom.tx = 0;
  touchZoom.ty = 0;
  touchZoom.lastTap = 0;
  if (!renderPreviewOverlay({ animateDirection: direction })) {
    render();
  }
  return true;
}

function handleTileSelect(itemId, event) {
  if (event && event.shiftKey && state.lastSelectedId) {
    const items = getFilteredItems();
    const fromIdx = items.findIndex(item => item.id === state.lastSelectedId);
    const toIdx = items.findIndex(item => item.id === itemId);
    if (fromIdx >= 0 && toIdx >= 0) {
      const lo = Math.min(fromIdx, toIdx);
      const hi = Math.max(fromIdx, toIdx);
      const changedIds = [];
      items.slice(lo, hi + 1).forEach((item) => {
        if (!state.selectedIds.has(item.id)) {
          changedIds.push(item.id);
        }
        state.selectedIds.add(item.id);
      });
      if (!syncSelectionUi(changedIds)) {
        render();
      }
      return;
    }
  }
  state.lastSelectedId = itemId;
  toggleSelect(itemId);
}

function toggleSelect(itemId) {
  if (state.selectedIds.has(itemId)) {
    state.selectedIds.delete(itemId);
  } else {
    state.selectedIds.add(itemId);
  }
  if (!syncSelectionUi([itemId])) {
    render();
  }
}

function toggleFavorite(itemId) {
  if (state.favoriteIds.has(itemId)) {
    state.favoriteIds.delete(itemId);
  } else {
    state.favoriteIds.add(itemId);
  }
  persistFavorites();
  const preferPreviewRender = state.previewId && normalizeText(itemId) === normalizeText(state.previewId) && state.secondaryFilter !== 'Favourites';
  if (preferPreviewRender && syncPreviewFavoriteButton(itemId)) {
    return;
  }
  if (!(preferPreviewRender && renderPreviewTransientLayers())) {
    render();
  }
}

function scrollToYear(year) {
  if (!refs.scrollRegion) {
    return;
  }
  const section = refs.sectionAnchors.find((item) =>
    item.id === String(year) || item.getAttribute('data-year') === String(year)
  );
  if (section) {
    refs.scrollRegion.scrollTo({ top: Math.max(0, section.offsetTop - 56), behavior: 'smooth' });
  }
}

function patchTimelineContent() {
  if (!refs.root || !refs.timelineVirtualEnabled) return;
  const layoutSections = refs.timelineLayoutSections || [];
  const nextVirtualWindow = applyTimelineVirtualWindow(layoutSections, {
    scrollTop: state.virtualScrollTop,
    viewportHeight: state.virtualViewportHeight
  });
  if (nextVirtualWindow.signature === refs.timelineVirtualSignature) return;
  refs.timelineVirtualSignature = nextVirtualWindow.signature;

  const activeAlbumName = getActiveAlbumName();
  const activeAlbumItems = activeAlbumName
    ? getAllItems().filter((item) => normalizeAlbumKey(resolveCollectionAlbum(item)) === normalizeAlbumKey(activeAlbumName))
    : [];
  const coverItemId = activeAlbumName
    ? (findAlbumCoverItem(activeAlbumName, activeAlbumItems).item?.id || '')
    : '';

  nextVirtualWindow.sections.forEach((section) => {
    const prev = sectionRangeCache.get(section.anchorId);
    const nextStart = section.startIndex;
    const nextEnd = section.endIndex;
    if (prev && prev.startIndex === nextStart && prev.endIndex === nextEnd) return;
    sectionRangeCache.set(section.anchorId, { startIndex: nextStart, endIndex: nextEnd });

    const el = refs.root.querySelector(`#${CSS.escape(section.anchorId)}`);
    if (!el) return;
    const grid = el.querySelector('.cml-media-grid');
    if (!grid) return;

    // Update spacer heights in-place
    const spacers = grid.querySelectorAll('.cml-media-grid__spacer');
    const topSpacer = spacers[0];
    const bottomSpacer = spacers.length > 1 ? spacers[spacers.length - 1] : null;
    const topH = Math.max(0, Math.round(section.topSpacerHeight || 0));
    const bottomH = Math.max(0, Math.round(section.bottomSpacerHeight || 0));

    if (topSpacer) {
      topSpacer.style.height = topH > 0 ? `${topH}px` : '0px';
    } else if (topH > 0) {
      grid.insertAdjacentHTML('afterbegin', `<div class="cml-media-grid__spacer" style="height:${topH}px" aria-hidden="true"></div>`);
    }
    if (bottomSpacer) {
      bottomSpacer.style.height = bottomH > 0 ? `${bottomH}px` : '0px';
    } else if (bottomH > 0) {
      grid.insertAdjacentHTML('beforeend', `<div class="cml-media-grid__spacer" style="height:${bottomH}px" aria-hidden="true"></div>`);
    }

    // Incremental row update: keep overlapping rows, add/remove at edges
    const allRows = section.rows || [];
    const visibleRows = nextStart >= 0 && nextEnd >= nextStart
      ? allRows.slice(nextStart, nextEnd + 1)
      : [];
    const prevStart = prev ? prev.startIndex : -1;
    const prevEnd = prev ? prev.endIndex : -1;
    const currentRowEls = grid.querySelectorAll('.cml-media-row');

    if (prevStart < 0 || prevEnd < 0 || !currentRowEls.length) {
      // No previous rows or empty — full replace of row content only
      const rowHtml = renderMediaRows(visibleRows, state, coverItemId);
      // Remove existing rows
      currentRowEls.forEach((r) => r.remove());
      // Insert new rows after top spacer
      const insertTarget = grid.querySelector('.cml-media-grid__spacer');
      if (insertTarget) {
        insertTarget.insertAdjacentHTML('afterend', rowHtml);
      } else {
        grid.insertAdjacentHTML('afterbegin', rowHtml);
      }
    } else if (nextStart >= 0 && nextEnd >= nextStart) {
      // Remove rows scrolled out at top (prevStart < nextStart)
      const removeTop = Math.max(0, nextStart - prevStart);
      for (let i = 0; i < removeTop && currentRowEls[i]; i++) {
        currentRowEls[i].remove();
      }
      // Remove rows scrolled out at bottom (nextEnd < prevEnd)
      const removeBottom = Math.max(0, prevEnd - nextEnd);
      for (let i = 0; i < removeBottom; i++) {
        const idx = currentRowEls.length - 1 - i;
        if (currentRowEls[idx]) currentRowEls[idx].remove();
      }
      // Add new rows at top (nextStart < prevStart)
      const addTop = Math.max(0, prevStart - nextStart);
      if (addTop > 0) {
        const newTopRows = allRows.slice(nextStart, nextStart + addTop);
        const html = renderMediaRows(newTopRows, state, coverItemId);
        const firstRow = grid.querySelector('.cml-media-row');
        if (firstRow) {
          firstRow.insertAdjacentHTML('beforebegin', html);
        } else {
          const topSp = grid.querySelector('.cml-media-grid__spacer');
          if (topSp) topSp.insertAdjacentHTML('afterend', html);
          else grid.insertAdjacentHTML('afterbegin', html);
        }
      }
      // Add new rows at bottom (nextEnd > prevEnd)
      const addBottom = Math.max(0, nextEnd - prevEnd);
      if (addBottom > 0) {
        const newBottomRows = allRows.slice(prevEnd + 1, nextEnd + 1);
        const html = renderMediaRows(newBottomRows, state, coverItemId);
        const bottomSp = grid.querySelectorAll('.cml-media-grid__spacer');
        const lastSpacer = bottomSp.length > 1 ? bottomSp[bottomSp.length - 1] : null;
        if (lastSpacer) {
          lastSpacer.insertAdjacentHTML('beforebegin', html);
        } else {
          grid.insertAdjacentHTML('beforeend', html);
        }
      }
    } else {
      // Next range empty — remove all rows
      currentRowEls.forEach((r) => r.remove());
    }
  });
}

function scheduleTimelineRender() {
  if (timelineRenderRaf || !refs.root) {
    return;
  }
  timelineRenderRaf = window.requestAnimationFrame(() => {
    timelineRenderRaf = 0;
    if (refs.root) {
      patchTimelineContent();
    }
  });
}

function updateActiveYear() {
  if (!refs.scrollRegion || !refs.sectionAnchors.length) {
    return;
  }
  const scrollTop = refs.scrollRegion.scrollTop;
  let activeSection = refs.sectionAnchors[0];
  refs.sectionAnchors.forEach((section) => {
    if (section.offsetTop - 40 <= scrollTop) {
      activeSection = section;
    }
  });
  const active = activeSection ? activeSection.getAttribute('data-year') : '';
  const nextActiveAnchor = activeSection ? activeSection.id : '';
  const nextScrubberLabel = activeSection ? normalizeText(activeSection.getAttribute('data-scrubber-label')) : '';
  if (nextScrubberLabel) {
    state.activeScrubberLabel = nextScrubberLabel;
  }
  if (nextActiveAnchor) {
    state.activeSectionAnchor = nextActiveAnchor;
  }
  if (active && active !== state.activeYear) {
    state.activeYear = active;
    updateScrubberThumb();
  }
}

function getScrollableResultCount() {
  if (state.primaryFilter === 'Bin') {
    return state.binItems.length;
  }
  if (state.primaryFilter === 'Collections' && !getActiveAlbumName()) {
    return buildCollectionSummaries(getAllItems()).length;
  }
  return getFilteredItems().length;
}

function handleWindowResize() {
  if (!document.body.classList.contains('codex-media-library-active')) {
    return;
  }
  if (refs.scrollRegion) {
    state.virtualViewportHeight = refs.scrollRegion.clientHeight;
    state.virtualScrollTop = refs.scrollRegion.scrollTop;
  }
  syncLayoutWidth();
  render();
}

function handleScroll() {
  if (!refs.scrollRegion || scrollRestoring) {
    return;
  }
  revealScrubber();
  state.virtualScrollTop = refs.scrollRegion.scrollTop;
  state.virtualViewportHeight = refs.scrollRegion.clientHeight;
  const isCollectionRoot = state.primaryFilter === 'Collections' && !getActiveAlbumName();
  if (isCollectionRoot) {
    const resultCount = getScrollableResultCount();
    const nearBottom = refs.scrollRegion.scrollTop + refs.scrollRegion.clientHeight >= refs.scrollRegion.scrollHeight - 720;
    if (nearBottom && state.loadedCount < resultCount) {
      state.loadedCount = Math.min(resultCount, state.loadedCount + 18);
      render();
      return;
    }
  } else if (refs.timelineVirtualEnabled) {
    const nextVirtualWindow = applyTimelineVirtualWindow(refs.timelineLayoutSections || [], {
      scrollTop: state.virtualScrollTop,
      viewportHeight: state.virtualViewportHeight
    });
    if (nextVirtualWindow.signature !== refs.timelineVirtualSignature) {
      scheduleTimelineRender();
    }
  }
  updateActiveYear();
  updateScrubberThumb();
}

function updateScrubberThumb() {
  if (!refs.root || !refs.scrollRegion) {
    return;
  }
  const scroller = refs.root.querySelector('.cml-scrubber');
  const badge = refs.root.querySelector('.cml-scrubber__badge');
  if (!scroller || !badge) {
    return;
  }
  if (refs.root) {
    refs.root.querySelectorAll('.cml-scrubber__tick').forEach((tick) => {
      tick.classList.toggle('is-active', tick.dataset.anchor === String(state.activeSectionAnchor));
    });
    refs.root.querySelectorAll('.cml-timeline-section').forEach((section) => {
      const isActive = section.id === String(state.activeSectionAnchor || '');
      section.classList.toggle('is-active', isActive);
      const header = section.querySelector('.cml-timeline-section__header');
      if (header instanceof HTMLElement) {
        header.classList.toggle('is-active', isActive);
        header.setAttribute('aria-current', isActive ? 'true' : 'false');
      }
    });
  }
  badge.textContent = state.activeScrubberLabel || String(state.activeYear || '');
  const activeTick = [...refs.root.querySelectorAll('.cml-scrubber__tick')]
    .find((tick) => tick.dataset.anchor === String(state.activeSectionAnchor || ''));
  const topPct = activeTick instanceof HTMLElement
    ? Number(activeTick.dataset.pct || '0')
    : 0;
  badge.style.top = `${topPct.toFixed(1)}%`;
  scroller.classList.toggle('is-visible', state.scrubberVisible);
  scroller.classList.toggle('is-scrubbing', state.isYearScrubbing);
  scroller.classList.toggle('has-active-badge', state.scrubberVisible || state.isYearScrubbing);
}

function handleAction(actionTarget) {
  switch (actionTarget.dataset.action) {
    case 'open-preview':
      if (actionTarget.dataset.id) {
        openPreview(actionTarget.dataset.id);
      }
      return true;
    case 'open-upload':
      requestNativeUpload();
      return true;
    case 'toggle-select':
      if (actionTarget.dataset.id) {
        toggleSelect(actionTarget.dataset.id);
      }
      return true;
    case 'toggle-favorite':
      if (actionTarget.dataset.id) {
        toggleFavorite(actionTarget.dataset.id);
      }
      return true;
    case 'clear-selection':
      clearSelection();
      return true;
    case 'open-add-to-album':
      openAlbumDialog('assign');
      return true;
    case 'download-selected':
      downloadSelectedItems();
      return true;
    case 'open-preview-add-to-album':
      openPreviewAddToAlbum(actionTarget.dataset.id || state.previewId);
      return true;
    case 'download-preview':
      downloadPreviewItem(actionTarget.dataset.id || state.previewId);
      return true;
    case 'open-add-to-current-album':
      openAlbumSelection();
      return true;
    case 'cancel-add-to-current-album':
      closeAlbumSelection();
      return true;
    case 'confirm-add-to-current-album':
      confirmAlbumSelection();
      return true;
    case 'open-create-album':
      openAlbumDialog('create');
      return true;
    case 'open-collection':
      if (actionTarget.dataset.albumName) {
        openCollection(actionTarget.dataset.albumName);
      }
      return true;
    case 'close-collection':
      closeCollection();
      return true;
    case 'close-album-dialog':
      closeAlbumDialog();
      return true;
    case 'set-album-drawer-scope':
      setAlbumDrawerScope(actionTarget.dataset.scope);
      return true;
    case 'toggle-album-create':
      setPreviewAlbumCreateMode(true);
      return true;
    case 'cancel-album-create':
      setPreviewAlbumCreateMode(false);
      return true;
    case 'submit-album-dialog':
      submitAlbumDialog();
      return true;
    case 'assign-album':
      if (actionTarget.dataset.albumName) {
        assignSelectionToAlbum(actionTarget.dataset.albumName);
      }
      return true;
    case 'set-album-cover':
      setSelectedItemAsAlbumCover();
      return true;
    case 'rename-album':
      if (actionTarget.dataset.albumName) {
        openRenameAlbumDialog(actionTarget.dataset.albumName);
      }
      return true;
    case 'close-rename-album-dialog':
      closeRenameAlbumDialog();
      return true;
    case 'submit-rename-album':
      void submitRenameAlbum();
      return true;
    case 'delete-album':
      if (actionTarget.dataset.albumName) {
        state.confirmDialogOpen = true;
        state.confirmDialogMode = 'delete-album';
        state.confirmDialogOrigin = 'collection';
        state.confirmDialogTitle = 'Delete album';
        state.confirmDialogCopy = `Are you sure you want to delete "${actionTarget.dataset.albumName}"? The photos will not be deleted from your library.`;
        state.confirmDialogConfirmLabel = 'Delete';
        state.confirmDialogSelectionCount = 0;
        state._deleteAlbumTarget = actionTarget.dataset.albumName;
        render();
      }
      return true;
    case 'remove-from-album':
      removeSelectionFromAlbum();
      return true;
    case 'select-section': {
      const sectionId = normalizeText(actionTarget.dataset.section);
      const itemIds = sectionId
        ? (refs.sectionItemIds.get(sectionId) || [])
        : [];
      if (toggleSectionSelection(sectionId, { selectionSet: state.selectedIds, itemIds })) {
        render();
      }
      return true;
    }
    case 'select-bin-section': {
      const sectionId = normalizeText(actionTarget.dataset.section);
      const itemIds = sectionId
        ? (refs.sectionItemIds.get(sectionId) || [])
        : [];
      if (toggleSectionSelection(sectionId, { selectionSet: state.binSelectedIds, itemIds })) {
        render();
      }
      return true;
    }
    case 'toggle-bin-select': {
      const binId = normalizeText(actionTarget.dataset.binId);
      if (binId) {
        if (state.binSelectedIds.has(binId)) {
          state.binSelectedIds.delete(binId);
        } else {
          state.binSelectedIds.add(binId);
        }
        render();
      }
      return true;
    }
    case 'restore-bin-selection':
      void restoreBinSelection();
      return true;
    case 'delete-bin-permanently':
      requestDeleteBinSelectionPermanently();
      return true;
    case 'request-empty-bin':
      requestEmptyBin();
      return true;
    case 'delete-selected':
      requestDeleteSelection(false);
      return true;
    case 'request-delete-preview':
      requestDeletePreview(actionTarget.dataset.id || state.previewId);
      return true;
    case 'confirm-delete-selected':
      if (!state.confirmDialogBusy) {
        const preferPreviewRender = state.confirmDialogOrigin === 'preview';
        if (state.confirmDialogMode === 'delete-album') {
          const albumTarget = state._deleteAlbumTarget;
          resetConfirmDialog();
          render();
          void deleteAlbum(albumTarget);
        } else if (state.confirmDialogMode === 'empty-bin') {
          void emptyBin();
        } else if (state.confirmDialogMode === 'delete-bin-permanently') {
          state.confirmDialogBusy = true;
          render();
          void deleteBinSelectionPermanently()
            .finally(() => {
              resetConfirmDialog();
              render();
            });
        } else {
          state.confirmDialogBusy = true;
          if (!(preferPreviewRender && renderPreviewTransientLayers())) {
            render();
          }
          void deleteSelectedItems({ permanent: state.confirmDialogMode === 'delete-permanently' })
            .finally(() => {
              const stillPreferPreviewRender = state.confirmDialogOrigin === 'preview';
              resetConfirmDialog();
              if (!(stillPreferPreviewRender && renderPreviewTransientLayers())) {
                render();
              }
            });
        }
      }
      return true;
    case 'dismiss-toast':
      dismissToast();
      return true;
    case 'close-confirm-dialog':
      closeConfirmDialog();
      return true;
    case 'toggle-info':
      if (state.albumDialogOpen && state.albumDialogOrigin === 'preview') {
        state.albumDialogOpen = false;
        state.albumDialogOrigin = '';
        state.albumDialogError = '';
        state.albumDraftName = '';
        state.albumDrawerSearch = '';
        state.albumDrawerScope = 'all';
        state.albumDrawerCreateMode = false;
        clearSelection({ shouldRender: false });
        syncPreviewAlbumDrawer(false);
        setPreviewInfoOpen(!state.infoOpen);
      } else {
        setPreviewInfoOpen(!state.infoOpen);
      }
      return true;
    case 'clear-search-filters':
      resetSearchQuery();
      clearSelection({ shouldRender: false });
      resetLoadedCount();
      render();
      return true;
    case 'toggle-avatar':
      state.avatarMenuOpen = !state.avatarMenuOpen;
      render();
      return true;
    case 'open-admin-dashboard':
      openAdminPanel('account');
      return true;
    case 'open-storage-panel':
      toggleStoragePanel();
      return true;
    case 'close-storage-panel':
      toggleStoragePanel(false);
      return true;
    case 'close-admin-panel':
      closeAdminPanel();
      return true;
    case 'switch-admin-tab':
      state.adminPanelTab = normalizeText(actionTarget.dataset.tab) || 'account';
      state.adminPanelError = '';
      render();
      return true;
    case 'trigger-admin-avatar-upload':
      void triggerAdminAvatarUpload();
      return true;
    case 'remove-admin-avatar':
      state.adminProfileDraft.avatarData = '';
      state.adminPanelError = '';
      render();
      return true;
    case 'save-admin-account':
      void saveAdminAccount();
      return true;
    case 'save-admin-site':
      void saveAdminSiteSettings();
      return true;
    case 'save-admin-cloud':
      void saveAdminCloudSettings();
      return true;
    case 'refresh-admin-migration-status':
      void refreshAdminMigrationStatus({ notify: true });
      return true;
    case 'scan-admin-orphan-files':
      void runAdminOrphanScan();
      return true;
    case 'refresh-admin-telegram':
      void refreshAdminTelegram();
      return true;
    case 'tg-setup-webhook':
      if (actionTarget.dataset.channel) {
        void adminTelegramAction('setup', actionTarget.dataset.channel);
      }
      return true;
    case 'tg-delete-webhook':
      if (actionTarget.dataset.channel) {
        void adminTelegramAction('delete', actionTarget.dataset.channel);
      }
      return true;
    case 'tg-run-sync':
      if (actionTarget.dataset.channel) {
        void adminTelegramAction('run', actionTarget.dataset.channel);
      }
      return true;
    case 'open-native-dashboard':
      window.sessionStorage.setItem('cmlSkipMount', '1');
      window.location.assign('/dashboard');
      return true;
    case 'submit-login':
      void submitLogin();
      return true;
    case 'logout':
      void performLogout();
      return true;
    case 'close-preview':
      closePreview();
      return true;
    case 'preview-next':
      movePreview(1);
      return true;
    case 'preview-previous':
      movePreview(-1);
      return true;
    default:
      return false;
  }
}

function handleClick(event) {
  const actionTarget = event.target instanceof Element ? event.target.closest('[data-action], [data-primary], [data-secondary], [data-year], [data-anchor]') : null;
  const tileTarget = event.target instanceof Element ? event.target.closest('.cml-media-tile') : null;
  const clickedControl = event.target instanceof HTMLElement
    ? event.target.closest('button, a, input, textarea, select, label')
    : null;

  // Ignore clicks on disabled controls
  if (clickedControl instanceof HTMLElement && clickedControl.hasAttribute('disabled')) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  // Select button clicks should only toggle selection, never open preview
  const isSelectClick = event.target instanceof Element && event.target.closest('[data-action="toggle-select"]');

  // In selection mode, clicking anywhere on a tile toggles selection instead of opening preview
  const inSelectionMode = state.selectedIds.size > 0;

  if (!isSelectClick && actionTarget instanceof HTMLElement && actionTarget.dataset.action === 'open-preview' && actionTarget.dataset.id) {
    event.preventDefault();
    event.stopPropagation();
    if (inSelectionMode) {
      handleTileSelect(actionTarget.dataset.id, event);
    } else {
      state.avatarMenuOpen = false;
      openPreview(actionTarget.dataset.id);
    }
    return;
  }

  if (!isSelectClick && tileTarget instanceof HTMLElement && !(clickedControl instanceof HTMLElement)) {
    const itemId = tileTarget.getAttribute('data-tile-id');
    if (itemId) {
      event.preventDefault();
      event.stopPropagation();
      if (inSelectionMode) {
        handleTileSelect(itemId, event);
      } else {
        state.avatarMenuOpen = false;
        openPreview(itemId);
      }
      return;
    }
  }

  // Close avatar menu when clicking outside it
  if (state.avatarMenuOpen && event.target instanceof Element && !event.target.closest('.cml-avatar-wrap')) {
    state.avatarMenuOpen = false;
    render();
    return;
  }

  if (actionTarget instanceof HTMLElement) {
    if (actionTarget.dataset.action === 'submit-login') {
      event.preventDefault();
    }

    if (actionTarget.dataset.primary) {
      state.primaryFilter = actionTarget.dataset.primary;
      state.storagePanelOpen = false;
      state.secondaryFilter = '';
      state.activeAlbumName = '';
      state.albumSelectionTarget = '';
      resetSearchQuery();
      state.previewId = null;
      state.selectedIds.clear();
      state.binSelectedIds.clear();
      resetLoadedCount();
      render();
      if (state.primaryFilter === 'Bin') {
        void fetchBinItems();
      }
      return;
    }

    if (actionTarget.dataset.secondary) {
      state.primaryFilter = 'Photos';
      state.secondaryFilter = actionTarget.dataset.secondary === state.secondaryFilter ? '' : actionTarget.dataset.secondary;
      state.storagePanelOpen = false;
      state.activeAlbumName = '';
      state.albumSelectionTarget = '';
      state.previewId = null;
      state.selectedIds.clear();
      state.binSelectedIds.clear();
      resetLoadedCount();
      render();
      return;
    }

    if (actionTarget.dataset.anchor) {
      state.activeSectionAnchor = actionTarget.dataset.anchor;
      state.activeYear = actionTarget.dataset.year || state.activeYear;
      state.activeScrubberLabel = normalizeText(actionTarget.dataset.label || state.activeScrubberLabel);
      scrollToYear(actionTarget.dataset.anchor);
      updateScrubberThumb();
      return;
    }

    if (actionTarget.dataset.year) {
      state.activeYear = actionTarget.dataset.year;
      scrollToYear(actionTarget.dataset.year);
      updateScrubberThumb();
      return;
    }

    if (actionTarget.dataset.action === 'toggle-select' && actionTarget.dataset.id) {
      if (event.shiftKey && state.lastSelectedId) {
        const items = getFilteredItems();
        const fromIdx = items.findIndex(item => item.id === state.lastSelectedId);
        const toIdx = items.findIndex(item => item.id === actionTarget.dataset.id);
        if (fromIdx >= 0 && toIdx >= 0) {
          const lo = Math.min(fromIdx, toIdx);
          const hi = Math.max(fromIdx, toIdx);
          items.slice(lo, hi + 1).forEach(item => state.selectedIds.add(item.id));
          render();
          return;
        }
      }
      state.lastSelectedId = actionTarget.dataset.id;
    }

    if (handleAction(actionTarget)) {
      return;
    }
  }
}

function handleInput(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) {
    return;
  }
  if (input.dataset.login === 'username') {
    state.loginUsername = input.value;
    return;
  }
  if (input.dataset.login === 'password') {
    state.loginPassword = input.value;
    return;
  }
  if (input.classList.contains('cml-topbar__search-input') || input.classList.contains('cml-sidebar__search-input')) {
    state.searchDraft = input.value;
    return;
  }
  if (input.dataset.focusKey === 'album-search') {
    const selectionStart = input.selectionStart;
    const selectionEnd = input.selectionEnd;
    state.albumDrawerSearch = input.value;
    renderAlbumDialogState({
      preferPreviewRender: state.albumDialogOrigin === 'preview',
      focusKey: 'search',
      selectionStart,
      selectionEnd
    });
    return;
  }
  if (input.classList.contains('cml-album-dialog__input')) {
    const selectionStart = input.selectionStart;
    const selectionEnd = input.selectionEnd;
    state.albumDraftName = input.value;
    if (state.albumDialogError) {
      state.albumDialogError = '';
      renderAlbumDialogState({
        preferPreviewRender: state.albumDialogOrigin === 'preview',
        focusKey: 'create',
        selectionStart,
        selectionEnd
      });
    }
    return;
  }
  if (input.hasAttribute('data-rename-album-input')) {
    state.renameAlbumDraftName = input.value;
    if (state.renameAlbumError) {
      state.renameAlbumError = '';
    }
    return;
  }
  if (input.dataset.adminField && input.dataset.adminSection) {
    const value = input instanceof HTMLInputElement && input.type === 'checkbox'
      ? input.checked
      : input.value;
    updateAdminDraftField(input.dataset.adminSection, input.dataset.adminField, value);
  }
}

function handleChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  if (target.hasAttribute('data-admin-avatar-input')) {
    void handleAdminAvatarSelection(target.files && target.files[0] ? target.files[0] : null);
    target.value = '';
  }
}

function handleFocusIn(event) {
  const tile = event.target instanceof Element ? event.target.closest('.cml-media-tile') : null;
  if (tile instanceof HTMLElement) {
    state.focusedTileId = tile.getAttribute('data-tile-id');
  }
}

function moveFocus(delta) {
  const tiles = [...(refs.root ? refs.root.querySelectorAll('.cml-media-tile') : [])];
  if (!tiles.length) {
    return;
  }
  const currentIndex = tiles.findIndex((tile) => tile.getAttribute('data-tile-id') === state.focusedTileId);
  const nextIndex = currentIndex < 0 ? 0 : Math.max(0, Math.min(tiles.length - 1, currentIndex + delta));
  const nextTile = tiles[nextIndex];
  if (nextTile instanceof HTMLElement) {
    state.focusedTileId = nextTile.getAttribute('data-tile-id');
    nextTile.focus();
  }
}

function handleKeyDown(event) {
  if (!document.body.classList.contains('codex-media-library-active')) {
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    focusSearchInput();
    return;
  }

  if (state.storagePanelOpen) {
    if (event.key === 'Escape') {
      toggleStoragePanel(false);
    }
    return;
  }

  if (state.adminPanelOpen) {
    if (event.key === 'Escape') {
      closeAdminPanel();
    }
    return;
  }

  if (state.confirmDialogOpen) {
    if (event.key === 'Escape') {
      closeConfirmDialog();
    }
    return;
  }

  if (state.renameAlbumDialogOpen) {
    if (event.key === 'Escape') {
      closeRenameAlbumDialog();
      return;
    }
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.hasAttribute('data-rename-album-input')) {
      event.preventDefault();
      submitRenameAlbum();
    }
    return;
  }

  if (state.albumDialogOpen) {
    if (event.key === 'Escape') {
      closeAlbumDialog();
      return;
    }
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.classList.contains('cml-album-dialog__input')) {
      event.preventDefault();
      submitAlbumDialog();
    }
    return;
  }

  if (event.target instanceof HTMLInputElement && event.target.classList.contains('cml-sidebar__search-input')) {
    if (event.key === 'Enter') {
      event.preventDefault();
      applySearchQuery(event.target.value);
      event.target.blur();
    } else if (event.key === 'Escape' && event.target.value) {
      event.preventDefault();
      event.target.value = state.searchQuery;
      state.searchDraft = state.searchQuery;
      event.target.select();
    }
    return;
  }

  if (state.previewId) {
    if (event.key === 'Escape') {
      if (state.infoOpen) {
        setPreviewInfoOpen(false, { allowRenderFallback: false });
      } else {
        closePreview();
      }
    } else if (event.key === 'ArrowRight') {
      movePreview(1);
    } else if (event.key === 'ArrowLeft') {
      movePreview(-1);
    } else if (event.key === 'f' || event.key === 'F') {
      toggleFavorite(state.previewId);
    } else if (event.key === 'i' || event.key === 'I') {
      setPreviewInfoOpen(!state.infoOpen, { allowRenderFallback: false });
    }
    return;
  }

  if (event.key === 'Delete' && state.selectedIds.size > 0 && state.primaryFilter !== 'Bin') {
    event.preventDefault();
    requestDeleteSelection(false);
    return;
  }

  if (!state.focusedTileId) {
    return;
  }

  const columns = refs.scrollRegion ? Math.max(2, Math.floor(refs.scrollRegion.clientWidth / 220)) : 4;
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    moveFocus(1);
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    moveFocus(-1);
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveFocus(columns);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveFocus(-columns);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    openPreview(state.focusedTileId);
  } else if (event.key === ' ') {
    event.preventDefault();
    toggleSelect(state.focusedTileId);
  }
}

function patchHistory() {
  if (historyPatched) {
    return;
  }
  historyPatched = true;
  const { pushState, replaceState } = window.history;
  window.history.pushState = function patchedPushState(...args) {
    const result = pushState.apply(this, args);
    queueMicrotask(syncMount);
    return result;
  };
  window.history.replaceState = function patchedReplaceState(...args) {
    const result = replaceState.apply(this, args);
    queueMicrotask(syncMount);
    return result;
  };
  window.addEventListener('popstate', syncMount);
}

function boot() {
  window.__cmlOpenPreview = openPreviewFromEvent;
  patchHistory();
  syncMount();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
