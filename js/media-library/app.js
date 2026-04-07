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
  MediaTimelineSection,
  PreviewModal,
  SearchSummary,
  Sidebar,
  StoragePanel,
  TopSearchBar,
  YearScroller,
  buildJustifiedRows
} from './components.js';

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
const API_PAGE_SIZE = 400;
const API_MAX_ITEMS = 1600;
const COLLECTION_PAGE_SIZE = 24;
const TIMELINE_ROW_GAP = 2;
const TIMELINE_SECTION_CHROME_ESTIMATE = 92;
const TIMELINE_SECTION_GAP = 28;
const BIN_TIMELINE_SECTION_GAP = 24;
const TIMELINE_VIRTUAL_OVERSCAN = 960;

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

function saveStringSet(key, set) {
  window.localStorage.setItem(key, JSON.stringify([...set]));
}

function loadStringArray(key) {
  const values = loadJson(key, []);
  return Array.isArray(values)
    ? values.map((value) => normalizeText(value)).filter(Boolean)
    : [];
}

function saveStringArray(key, values) {
  window.localStorage.setItem(key, JSON.stringify(values));
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

function saveStringRecord(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
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

function saveAlbumCoverRecord(value) {
  window.localStorage.setItem(ALBUM_COVERS_STORAGE_KEY, JSON.stringify(value));
}

const state = {
  primaryFilter: 'Photos',
  secondaryFilter: '',
  activeAlbumName: '',
  albumSelectionTarget: '',
  searchQuery: '',
  selectedIds: new Set(),
  favoriteIds: loadStringSet(FAVORITES_STORAGE_KEY),
  albumNames: loadStringArray(ALBUMS_STORAGE_KEY),
  albumAssignments: loadStringRecord(ALBUM_ASSIGNMENTS_STORAGE_KEY),
  albumCovers: loadAlbumCoverRecord(),
  albumDialogOpen: false,
  albumDialogMode: 'create',
  albumDraftName: '',
  albumDialogError: '',
  confirmDialogOpen: false,
  confirmDialogMode: '',
  confirmDialogTitle: '',
  confirmDialogCopy: '',
  confirmDialogConfirmLabel: '',
  confirmDialogSelectionCount: 0,
  confirmDialogBusy: false,
  previewId: null,
  previewTransitionRect: null,
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
  adminProfileDraft: createEmptyAdminProfileDraft(),
  adminPageDraft: createEmptyAdminPageDraft(),
  adminCloudDraft: createEmptyAdminCloudDraft(),
  adminPageConfigSource: [],
  adminOthersConfigSource: null,
  storagePanelOpen: false
};

const refs = {
  root: null,
  scrollRegion: null,
  sectionAnchors: [],
  contentInner: null,
  sectionItemIds: new Map(),
  timelineLayoutSections: [],
  timelineVirtualSignature: ''
};

let mounted = false;
let historyPatched = false;
let liveObserver = null;
let liveSyncRaf = 0;
let liveSyncPromise = null;
let pendingSyncForceRender = false;
let timelineRenderRaf = 0;

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

function setupImageLoadAnimations() {
  if (!refs.root) {
    return;
  }
  refs.root.querySelectorAll('.cml-media-tile__image').forEach((img) => {
    const tile = img.closest('.cml-media-tile');
    if (!tile) {
      return;
    }
    if (img.complete && img.naturalWidth > 0) {
      // Skip fade-in for already-cached images (avoids flash on every render)
      img.style.transition = 'none';
      tile.classList.add('is-img-loaded');
      return;
    }
    img.addEventListener('load', () => tile.classList.add('is-img-loaded'), { once: true });
    img.addEventListener('error', () => tile.classList.add('is-img-loaded'), { once: true });
  });

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
  const animation = panel.animate(
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

  animation.finished
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

  backdrop?.animate?.(
    [{ opacity: 1 }, { opacity: 0 }],
    { duration: 120, easing: 'ease-in', fill: 'both' }
  );
  const animation = panel.animate(
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

  animation.finished
    .catch(() => {})
    .finally(() => {
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
  const toggleButton = refs.root.querySelector('.cml-preview__chip[data-action="toggle-info"]');
  const toggleLabels = refs.root.querySelectorAll('[data-info-toggle-label]');
  const infoBackButton = refs.root.querySelector('.cml-preview__info-back');

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
  if (infoBackButton instanceof HTMLElement) {
    infoBackButton.setAttribute('aria-label', nextOpen ? 'Back to photo' : 'Open details');
  }
  toggleLabels.forEach((node) => {
    node.textContent = nextOpen ? 'Hide details' : 'Show details';
  });
}

let yearScrollerDragActive = false;
let scrubberHideTimeoutId = 0;
let previewTransitionInFlight = false;

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
  return pathname === '/';
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
  const numeric = Math.max(0, Number(totalQuotaGb) || 0);
  if (!numeric) {
    return 'No quota limit configured';
  }
  if (numeric >= 1024) {
    return `${(numeric / 1024).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')} TB total quota`;
  }
  return `${numeric.toFixed(numeric >= 100 ? 0 : numeric >= 10 ? 1 : 2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')} GB total quota`;
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

function getAvailableAlbumNames() {
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
  state.mediaItems.forEach((item) => pushAlbum(resolveCollectionAlbum(item)));
  Object.values(state.albumAssignments).forEach(pushAlbum);
  return names;
}

function persistAlbumNames() {
  saveStringArray(ALBUMS_STORAGE_KEY, state.albumNames);
}

function persistAlbumAssignments() {
  saveStringRecord(ALBUM_ASSIGNMENTS_STORAGE_KEY, state.albumAssignments);
}

function persistAlbumCovers() {
  saveAlbumCoverRecord(state.albumCovers);
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

function createLookupKey(value) {
  return stripExtension(decodeValue(normalizeText(value))).toLowerCase();
}

function getLookupKeys(fileId, fileName, label) {
  const pathName = String(fileId || '').split('/').filter(Boolean).pop() || '';
  const values = [fileId, pathName, fileName, label]
    .map(createLookupKey)
    .filter(Boolean);
  return [...new Set(values)];
}

function encodePathForRoute(fileId) {
  return String(fileId || '')
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function buildFileRoute(fileId) {
  const encodedPath = encodePathForRoute(fileId);
  return encodedPath ? `/file/${encodedPath}` : '/file/';
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

    seen.add(src);
    items.push({
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
      isDocumentLike: DOCUMENT_HINT_PATTERN.test(`${src} ${fileLabel}`),
      sortOrder: Date.parse(dateParts.takenAt),
      domIndex
    });
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
    getLookupKeys(item.sourceId, item.label, item.label).forEach((key) => {
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
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers || {})
    }
  });
  if (response.status === 401) {
    state.needsLogin = true;
    render();
    throw new Error('Unauthorized');
  }
  return response;
}

async function fetchJson(url) {
  const response = await apiFetch(url);
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
  render();

  try {
    const [account, pageConfig, otherSettings] = await Promise.all([
      fetchJson('/api/manage/account'),
      fetchJson('/api/manage/sysConfig/page'),
      fetchJson('/api/manage/sysConfig/others')
    ]);

    applyAdminIdentity(account);
    hydrateAdminProfileDraft(account);
    state.adminPageConfigSource = safeArray(pageConfig?.config);
    state.adminPageDraft = createAdminPageDraft(state.adminPageConfigSource);
    state.adminOthersConfigSource = otherSettings || {};
    state.adminCloudDraft = createAdminCloudDraft(otherSettings || {});
  } catch (error) {
    state.adminPanelError = error.message || 'Failed to load admin settings';
  } finally {
    state.adminPanelLoading = false;
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
      fetchJson('/api/manage/quota'),
      fetchJson('/api/manage/sysConfig/upload')
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

function inferLocationFromMetadata(metadata, domMatch) {
  const direct = [metadata.Location, metadata.Place, metadata.City, metadata.Country]
    .map((value) => normalizeText(value))
    .find(Boolean);
  return direct || domMatch?.location || '';
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

function buildIndexedMediaItem(record, domLookup, index) {
  const metadata = record && typeof record === 'object' ? (record.metadata || {}) : {};
  const fileId = normalizeText(record?.name || record?.id || '');
  if (!fileId) {
    return null;
  }

  const mimeType = normalizeText(metadata.FileType || '').toLowerCase();
  if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) {
    return null;
  }

  const fileName = normalizeText(metadata.FileName || extractFileNameFromPath(fileId) || 'Library item');
  const lookupKeys = getLookupKeys(fileId, fileName, fileName);
  const domMatch = lookupKeys.map((key) => domLookup.get(key)).find(Boolean) || null;
  const type = mimeType.startsWith('video/') ? 'video' : 'photo';
  const width = toPositiveNumber(metadata.Width, toPositiveNumber(domMatch?.width, type === 'video' ? 1280 : 1200));
  const height = toPositiveNumber(metadata.Height, toPositiveNumber(domMatch?.height, type === 'video' ? 720 : 900));
  const timestamp = parseTimestamp(metadata.TimeStamp, index);
  const date = new Date(timestamp);
  const dateParts = createDatePartsFromDate(date);
  const sourceUrl = buildFileRoute(fileId);
  const posterUrl = domMatch && domMatch.thumbnailUrl !== sourceUrl ? domMatch.thumbnailUrl : '';
  const tags = inferTagsFromMetadata(metadata, fileName, type);
  const label = fileName || inferAlbumFromFileId(fileId, metadata);

  return {
    id: `managed-${hashString(fileId)}`,
    sourceId: fileId,
    sourceUrl,
    thumbnailUrl: domMatch?.thumbnailUrl || sourceUrl,
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
    isDocumentLike: isDocumentLikeSource(fileId, fileName, tags),
    sortOrder: timestamp,
    domIndex: index
  };
}

async function fetchListPage(start) {
  const params = new URLSearchParams({
    start: String(start),
    count: String(API_PAGE_SIZE),
    recursive: 'true',
    fileType: 'image,video'
  });
  const response = await apiFetch(`/api/manage/list?${params.toString()}`);

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
  const mimeType = normalizeText(metadata.FileType || '').toLowerCase();
  if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) {
    return null;
  }
  const type = mimeType.startsWith('video/') ? 'video' : 'photo';
  const fileName = normalizeText(metadata.FileName || extractFileNameFromPath(fileId) || 'Deleted item');
  const deletedAt = Number(record.deletedAt) || Date.now();
  const deletedDate = new Date(deletedAt);
  const deletedYear = deletedDate.getFullYear();
  return {
    id: fileId,
    label: fileName,
    thumbnailUrl: buildFileRoute(fileId),
    sourceUrl: buildFileRoute(fileId),
    posterUrl: '',
    type,
    width: toPositiveNumber(metadata.Width, type === 'video' ? 1280 : 1200),
    height: toPositiveNumber(metadata.Height, type === 'video' ? 720 : 900),
    sizeMb: Math.max(0, Number(metadata.FileSize) || Number(metadata.FileSizeMB) || 0),
    daysLeft: Math.max(0, Number(record.daysLeft) || 0),
    deletedAt,
    takenAt: deletedDate.toISOString(),
    year: String(deletedYear),
    timelineLabel: createTimelineLabel(deletedDate),
    isDocumentLike: DOCUMENT_HINT_PATTERN.test(`${fileId} ${fileName}`)
  };
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
      body: JSON.stringify({ action: 'restore', fileIds })
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
      body: JSON.stringify({ action: 'delete', fileIds })
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
    const response = await apiFetch('/api/manage/bin/empty', { method: 'POST' });
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
  const searchInput = refs.root ? refs.root.querySelector('.cml-topbar__search-input') : null;
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
  saveStringSet(FAVORITES_STORAGE_KEY, state.favoriteIds);
}

function focusAlbumInput() {
  const input = refs.root ? refs.root.querySelector('.cml-album-dialog__input') : null;
  if (input instanceof HTMLInputElement) {
    input.focus();
    input.select();
  }
}

function clearSelection({ shouldRender = true } = {}) {
  if (!state.selectedIds.size) {
    return;
  }
  state.selectedIds.clear();
  state.lastSelectedId = null;
  if (shouldRender) {
    render();
  }
}

function openAlbumDialog(mode = 'create') {
  state.albumDialogOpen = true;
  state.albumDialogMode = mode;
  state.albumDraftName = '';
  state.albumDialogError = '';
  render();
  window.setTimeout(focusAlbumInput, 30);
}

function closeAlbumDialog() {
  if (!state.albumDialogOpen) {
    return;
  }
  state.albumDialogOpen = false;
  state.albumDialogError = '';
  state.albumDraftName = '';
  render();
}

function openConfirmDialog(options = {}) {
  state.confirmDialogOpen = true;
  state.confirmDialogMode = normalizeText(options.mode || '');
  state.confirmDialogTitle = normalizeText(options.title || 'Confirm action');
  state.confirmDialogCopy = normalizeText(options.copy || '');
  state.confirmDialogConfirmLabel = normalizeText(options.confirmLabel || 'Confirm');
  state.confirmDialogSelectionCount = Number(options.selectionCount) || 0;
  state.confirmDialogBusy = false;
  render();
}

function resetConfirmDialog() {
  state.confirmDialogOpen = false;
  state.confirmDialogMode = '';
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
  resetConfirmDialog();
  render();
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
  state.searchQuery = '';
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
  state.searchQuery = '';
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
  state.searchQuery = '';
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
  state.searchQuery = '';
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
  const canonicalAlbumName = ensureAlbumName(albumName);
  if (!canonicalAlbumName) {
    state.albumDialogError = 'Album name is required.';
    render();
    window.setTimeout(focusAlbumInput, 30);
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
  state.albumDialogError = '';
  state.albumDraftName = '';
  state.albumSelectionTarget = '';
  state.primaryFilter = 'Collections';
  state.activeAlbumName = canonicalAlbumName;
  state.secondaryFilter = '';
  clearSelection({ shouldRender: false });
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
    render();
    window.setTimeout(focusAlbumInput, 30);
    return false;
  }
  state.albumDialogOpen = false;
  state.albumDialogError = '';
  state.albumDraftName = '';
  state.albumSelectionTarget = '';
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

async function deleteSelectedItems(options = {}) {
  const selectedItems = getSelectedItems().filter((item) => canDeleteItem(item));
  if (!selectedItems.length) {
    return;
  }
  const permanent = Boolean(options.permanent);

  const deletedIds = new Set();
  const deletedKeys = new Set();
  const failedItems = [];

  for (const item of selectedItems) {
    try {
      const route = permanent
        ? `${buildDeleteRoute(item.sourceId)}?permanent=true`
        : buildDeleteRoute(item.sourceId);
      const response = await fetch(route, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json'
        }
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
    if (state.previewId && deletedIds.has(state.previewId)) {
      state.previewId = null;
    }
    const nextAssignments = { ...state.albumAssignments };
    deletedKeys.forEach((key) => {
      delete nextAssignments[key];
    });
    state.albumAssignments = nextAssignments;
    persistAlbumAssignments();
    syncAlbumCovers();
    render();
    window.setTimeout(() => syncLiveMedia({ forceRender: true }), 600);
    void syncStorageSummary({ forceRender: true });
  }

  if (failedItems.length) {
    showToast(`Failed to delete ${failedItems.length} item${failedItems.length === 1 ? '' : 's'}. Check your connection and try again.`);
  }
}

function requestDeleteSelection(permanent = false) {
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
    title: permanent ? 'Delete forever?' : 'Move to bin?',
    copy: permanent
      ? `${itemLabel} will be removed permanently and cannot be restored.`
      : `${itemLabel} will leave your main library and stay in Bin for up to 45 days before permanent deletion.`,
    confirmLabel: permanent ? 'Delete forever' : 'Move to bin',
    selectionCount: selectedItems.length
  });
}

function getVisibleSecondaryFilters(items) {
  if (state.primaryFilter !== 'Photos') {
    return [];
  }

  if (!items.length && !state.secondaryFilter) {
    return [];
  }

  const filters = [];
  if (items.some((item) => item.type === 'video') || state.secondaryFilter === 'Videos') {
    filters.push('Videos');
  }
  if (items.some((item) => item.isDocumentLike) || state.secondaryFilter === 'Documents') {
    filters.push('Documents');
  }
  if (items.some((item) => state.favoriteIds.has(item.id)) || state.secondaryFilter === 'Favourites') {
    filters.push('Favourites');
  }
  return filters;
}

function getFilteredItems() {
  const items = getAllItems();
  const now = new Date();
  const query = state.searchQuery.trim().toLowerCase();
  const activeAlbumName = getActiveAlbumName();
  const albumSelectionTarget = getAlbumSelectionTarget();

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

    return matchesSearchQuery(item, query);
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
  const query = state.searchQuery.trim().toLowerCase();
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
      return group.items.some((item) => matchesSearchQuery(item, query));
    })
    .map((group) => {
      const { item: coverItem, isCustom } = findAlbumCoverItem(group.name, group.items);
      const locationSummary = summarizeLocations(group.items);
      const metaParts = [];
      if (coverItem?.displayTakenAt) {
        metaParts.push(coverItem.displayTakenAt);
      }
      if (locationSummary) {
        metaParts.push(locationSummary);
      }
      return {
        ...group,
        coverItem,
        hasCustomCover: isCustom,
        itemCount: group.items.length,
        metaLine: metaParts.join(' · ') || 'Empty album'
      };
    })
    .sort((left, right) => {
      const rightTime = right.coverItem ? Date.parse(right.coverItem.takenAt) : -Infinity;
      const leftTime = left.coverItem ? Date.parse(left.coverItem.takenAt) : -Infinity;
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
  const virtualWindow = isCollectionRoot
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
      secondary: state.primaryFilter === 'Bin' ? [] : visibleSecondaryFilters
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
    years,
    scrubberSections,
    previewItems,
    previewIndex,
    previewItem,
    availableAlbums: getAvailableAlbumNames(),
    canSetAlbumCover,
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
    && document.activeElement.classList.contains('cml-topbar__search-input');
  const viewModel = getViewModel();
  const storageInsights = buildStorageInsights();

  refs.root.innerHTML = `
    <div class="cml-app-shell">
      ${Sidebar({ navigationModel: viewModel.navigationModel, state, storageSummary: state.storageSummary })}
      <div class="cml-main-shell">
        ${TopSearchBar({
          state,
          canDeleteSelection: viewModel.canDeleteSelection,
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
                  layoutWidth: state.layoutWidth
                })
                : `${state.primaryFilter === 'Collections'
                  ? CollectionSummary({
                    activeAlbumName: viewModel.activeAlbumName,
                    collectionCount: viewModel.totalCollectionCount,
                    itemCount: viewModel.filteredItems.length,
                    coverLabel: viewModel.activeAlbumCoverLabel,
                    hasCustomCover: viewModel.hasCustomAlbumCover
                  })
                  : ''}
                ${SearchSummary({
                  query: state.searchQuery.trim(),
                  resultCount: viewModel.isCollectionRoot ? viewModel.totalCollectionCount : viewModel.filteredItems.length
                })}
                ${viewModel.isCollectionRoot
                  ? (viewModel.collectionCards.length
                    ? CollectionGrid({ collections: viewModel.collectionCards })
                    : EmptyState({ query: state.searchQuery.trim(), isLoading: state.isLibraryLoading, mode: 'collections' }))
                  : (viewModel.sections.length
                    ? viewModel.sections.map((section) => MediaTimelineSection({
                      section,
                      state,
                      layoutWidth: state.layoutWidth,
                      coverItemId: viewModel.activeAlbumCoverId
                    })).join('')
                    : EmptyState({
                      query: state.searchQuery.trim(),
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
      ${PreviewModal({
        item: viewModel.previewItem,
        selected: viewModel.previewItem ? state.selectedIds.has(viewModel.previewItem.id) : false,
        favorited: viewModel.previewItem ? state.favoriteIds.has(viewModel.previewItem.id) : false,
        currentIndex: Math.max(viewModel.previewIndex, 0),
        totalCount: viewModel.previewItems.length,
        infoOpen: state.infoOpen
      })}
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

  refs.scrollRegion = refs.root.querySelector('.cml-main-content');
  refs.sectionAnchors = [...refs.root.querySelectorAll('.cml-timeline-section')];
  refs.contentInner = refs.root.querySelector('.cml-main-content__inner');
  refs.sectionItemIds = new Map(viewModel.sections.map((section) => [
    section.anchorId,
    section.items.map((item) => item.id)
  ]));
  refs.timelineLayoutSections = viewModel.timelineLayoutSections || [];
  refs.timelineVirtualSignature = viewModel.timelineVirtualSignature || '';

  if (refs.scrollRegion) {
    refs.scrollRegion.scrollTop = previousScrollTop;
    state.virtualScrollTop = previousScrollTop;
    state.virtualViewportHeight = refs.scrollRegion.clientHeight;
    refs.scrollRegion.onscroll = handleScroll;
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
    changed = true;
  }

  if (state.previewId && !validIds.has(state.previewId)) {
    state.previewId = null;
    changed = true;
  }

  const shouldKeepLoading = items.length === 0 && (!surfaceReady || state.liveSyncAttempts < 4);
  if (state.isLibraryLoading !== shouldKeepLoading) {
    state.isLibraryLoading = shouldKeepLoading;
    changed = true;
  }

  if ((changed || forceRender) && refs.root) {
    render();
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
  syncLiveMedia({ forceRender: true });
  void syncStorageSummary({ forceRender: true });
  if (!state.adminUsername) {
    void fetchAdminIdentity();
  }
  render();
  startLiveObserver();
  consumePendingUploadRequest();

  if (!mounted && refs.root) {
    refs.root.addEventListener('click', handleClick);
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
}

function syncMount() {
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
  state.previewId = itemId;
  state.previewTransitionRect = snapshotRect(sourceTile);
  state.infoOpen = false;
  touchZoom.currentScale = 1;
  touchZoom.tx = 0;
  touchZoom.ty = 0;
  touchZoom.lastTap = 0;
  render();
  window.requestAnimationFrame(() => animatePreviewOpenFromTile());
}

function closePreview() {
  animatePreviewCloseToTile(() => {
    state.previewId = null;
    state.previewTransitionRect = null;
    state.infoOpen = false;
    touchZoom.currentScale = 1;
    touchZoom.tx = 0;
    touchZoom.ty = 0;
    render();
  });
}

function movePreview(direction) {
  const items = getFilteredItems();
  if (!items.length || !state.previewId) {
    return;
  }
  const currentIndex = items.findIndex((item) => item.id === state.previewId);
  if (currentIndex < 0) {
    return;
  }
  const nextIndex = Math.max(0, Math.min(items.length - 1, currentIndex + direction));
  state.previewId = items[nextIndex].id;
  render();
}

function toggleSelect(itemId) {
  if (state.selectedIds.has(itemId)) {
    state.selectedIds.delete(itemId);
  } else {
    state.selectedIds.add(itemId);
  }
  render();
}

function toggleFavorite(itemId) {
  if (state.favoriteIds.has(itemId)) {
    state.favoriteIds.delete(itemId);
  } else {
    state.favoriteIds.add(itemId);
  }
  persistFavorites();
  render();
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

function scheduleTimelineRender() {
  if (timelineRenderRaf || !refs.root) {
    return;
  }
  timelineRenderRaf = window.requestAnimationFrame(() => {
    timelineRenderRaf = 0;
    if (refs.root) {
      render();
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
  if (!refs.scrollRegion) {
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
  } else {
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
    case 'confirm-delete-selected':
      if (!state.confirmDialogBusy) {
        if (state.confirmDialogMode === 'empty-bin') {
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
          render();
          void deleteSelectedItems({ permanent: state.confirmDialogMode === 'delete-permanently' })
            .finally(() => {
              resetConfirmDialog();
              render();
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
      setPreviewInfoOpen(!state.infoOpen);
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
      state.searchQuery = '';
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
      state.secondaryFilter = actionTarget.dataset.secondary === state.secondaryFilter ? '' : actionTarget.dataset.secondary;
      state.storagePanelOpen = false;
      state.activeAlbumName = '';
      state.albumSelectionTarget = '';
      state.previewId = null;
      state.selectedIds.clear();
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

  if (tileTarget instanceof HTMLElement && !(event.target instanceof HTMLElement && event.target.closest('button'))) {
    const itemId = tileTarget.getAttribute('data-tile-id');
    if (itemId) {
      openPreview(itemId);
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
  if (input.classList.contains('cml-topbar__search-input')) {
    state.searchQuery = input.value;
    clearSelection({ shouldRender: false });
    resetLoadedCount();
    render();
    return;
  }
  if (input.classList.contains('cml-album-dialog__input')) {
    state.albumDraftName = input.value;
    if (state.albumDialogError) {
      state.albumDialogError = '';
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
  patchHistory();
  syncMount();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
