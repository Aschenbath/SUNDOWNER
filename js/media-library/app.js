import { createTimelineLabel, navigationModel, storageSummary } from './data.js';
import {
  EmptyState,
  MediaTimelineSection,
  PreviewModal,
  SearchSummary,
  Sidebar,
  TopSearchBar,
  YearScroller
} from './components.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_INDEX = Object.fromEntries(MONTH_NAMES.map((month, index) => [month.toLowerCase(), index]));
const WEEKDAY_INDEX = Object.fromEntries(WEEKDAY_NAMES.map((weekday, index) => [weekday.toLowerCase(), index]));

const FAVORITES_STORAGE_KEY = 'codex-media-library-favorites';
const SETTINGS_STORAGE_KEY = 'codex-media-library-settings';
const DEFAULT_SETTINGS = {
  denseGrid: false,
  hideSidebar: false
};

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

function loadSettings() {
  const saved = loadJson(SETTINGS_STORAGE_KEY, {});
  return {
    ...DEFAULT_SETTINGS,
    ...(saved && typeof saved === 'object' ? saved : {})
  };
}

function saveSettings(settings) {
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

const state = {
  primaryFilter: 'Photos',
  secondaryFilter: '',
  searchQuery: '',
  selectedIds: new Set(),
  favoriteIds: loadStringSet(FAVORITES_STORAGE_KEY),
  previewId: null,
  loadedCount: 24,
  isCreateMenuOpen: false,
  activeYear: null,
  focusedTileId: null,
  mediaItems: [],
  liveMediaSignature: '',
  isLibraryLoading: true,
  liveSyncAttempts: 0,
  activePanel: '',
  settings: loadSettings()
};

const refs = {
  root: null,
  scrollRegion: null,
  sectionAnchors: []
};

let mounted = false;
let historyPatched = false;
let liveObserver = null;
let liveSyncRaf = 0;

function shouldMount(pathname = window.location.pathname, search = window.location.search) {
  const params = new URLSearchParams(search);
  if (params.get('cmlNative') === '1') {
    return false;
  }
  if (pathname.startsWith('/login') || pathname.startsWith('/browse')) {
    return false;
  }
  return pathname === '/' || pathname.startsWith('/dashboard');
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

function getDateDisplay(date) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} ${hh}:${mm}`;
}

function createDateParts(date, timelineLabel, displayTakenAt) {
  return {
    takenAt: date.toISOString(),
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    monthLabel: MONTH_NAMES[date.getMonth()],
    timelineLabel,
    displayTakenAt
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
      return createDateParts(date, createTimelineLabel(date, now), getDateDisplay(date));
    }

    if (/\btoday\b/i.test(candidate)) {
      const date = new Date(now);
      date.setHours(12, 0, 0, 0);
      return createDateParts(date, 'Today', 'Today');
    }

    if (/\byesterday\b/i.test(candidate)) {
      const date = new Date(now);
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - 1);
      return createDateParts(date, 'Yesterday', 'Yesterday');
    }

    const monthYearMatch = candidate.match(monthYearPattern);
    if (monthYearMatch) {
      const month = MONTH_INDEX[monthYearMatch[1].toLowerCase()];
      const year = Number(monthYearMatch[2]);
      const date = new Date(year, month, 1, 12, 0, 0, 0);
      return createDateParts(date, `${MONTH_NAMES[month]} ${year}`, `${MONTH_NAMES[month]} ${year}`);
    }

    const weekdayLabel = WEEKDAY_NAMES.find((weekday) => new RegExp(`\\b${weekday}\\b`, 'i').test(candidate));
    if (weekdayLabel) {
      const date = resolveRelativeWeekday(weekdayLabel, now);
      if (date) {
        return createDateParts(date, weekdayLabel, weekdayLabel);
      }
    }

    const yearMatch = candidate.match(yearPattern);
    if (yearMatch) {
      const year = Number(yearMatch[1]);
      const date = new Date(year, 0, 1, 12, 0, 0, 0);
      return createDateParts(date, String(year), String(year));
    }
  }

  const fallbackDate = new Date(now.getTime() - domIndex * 60000);
  return createDateParts(fallbackDate, 'Recent', 'Recent');
}

function extractFileNameFromUrl(url) {
  const raw = String(url || '').split('#')[0].split('?')[0];
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

function inferFileLabel(candidates, src) {
  const filePattern = /([A-Za-z0-9][A-Za-z0-9 _-]{0,120}\.(?:jpg|jpeg|png|webp|gif|bmp|avif|heic|heif|mp4|mov|m4v|webm|avi))/i;
  for (const candidate of candidates) {
    const match = candidate.match(filePattern);
    if (match) {
      return match[1];
    }
  }
  const fromUrl = extractFileNameFromUrl(src);
  if (FILE_EXTENSION_PATTERN.test(fromUrl)) {
    return fromUrl;
  }
  return 'Library item';
}

function inferMediaType(candidates, src, node) {
  const candidateBlob = candidates.join(' ');
  if (VIDEO_EXTENSION_PATTERN.test(candidateBlob) || VIDEO_EXTENSION_PATTERN.test(src)) {
    return 'video';
  }
  if (node instanceof Element && node.closest('[class*="video"], [data-type="video"]')) {
    return 'video';
  }
  return 'photo';
}

function inferLocation(candidates) {
  const locationPattern = /\b([A-Z][A-Za-z]+(?:,\s*[A-Z][A-Za-z]+)+)\b/;
  for (const candidate of candidates) {
    const match = normalizeText(candidate).match(locationPattern);
    if (match) {
      return match[1];
    }
  }
  return '';
}

function inferTags(fileLabel, type) {
  const base = fileLabel.replace(FILE_EXTENSION_PATTERN, '');
  const baseTags = base
    .split(/[_\-\s]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part && !/^\d+$/.test(part) && part.length > 1)
    .slice(0, 6);
  if (type === 'video' && !baseTags.includes('video')) {
    baseTags.push('video');
  }
  return baseTags;
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
    const album = fileLabel.replace(FILE_EXTENSION_PATTERN, '') || 'Library item';

    seen.add(src);
    items.push({
      id: `live-${hashString(src)}`,
      type,
      thumbnailUrl: src,
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
      tags: inferTags(fileLabel, type),
      location: inferLocation(candidates),
      favorite: false,
      personLabels: [],
      label: fileLabel,
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

function getAllItems() {
  return state.mediaItems;
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

function openPhotoLibrary(pathname) {
  window.location.assign(getPhotoLibraryUrl(pathname));
}

function openNativeView(pathname) {
  window.location.assign(getNativeUrl(pathname));
}

function openTelegramAdmin() {
  window.location.assign('/telegram-sync-admin.html');
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
  state.loadedCount = 24;
}

function persistFavorites() {
  saveStringSet(FAVORITES_STORAGE_KEY, state.favoriteIds);
}

function persistSettings() {
  saveSettings(state.settings);
}

function togglePanel(panelName) {
  state.isCreateMenuOpen = false;
  state.activePanel = state.activePanel === panelName ? '' : panelName;
  render();
}

function reloadMediaLibrary() {
  state.liveSyncAttempts = 0;
  state.isLibraryLoading = true;
  syncLiveMedia({ forceRender: true });
}

function toggleSetting(settingName) {
  if (!(settingName in state.settings)) {
    return;
  }
  state.settings = {
    ...state.settings,
    [settingName]: !state.settings[settingName]
  };
  persistSettings();
  render();
}
function syncLiveMedia({ forceRender = false } = {}) {
  state.liveSyncAttempts += 1;
  const items = extractLiveMediaItems();
  const surfaceReady = hasUnderlyingSurface();
  const signature = items.map((item) => `${item.id}:${item.takenAt}:${item.thumbnailUrl}`).join('|');
  const validIds = new Set(items.map((item) => item.id));
  let changed = false;

  if (signature !== state.liveMediaSignature) {
    state.liveMediaSignature = signature;
    state.mediaItems = items;
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

function getFilteredItems() {
  const items = getAllItems();
  const now = new Date();
  const query = state.searchQuery.trim().toLowerCase();

  return items.filter((item) => {
    if (state.primaryFilter === 'Updates') {
      const diffDays = Math.floor((now.getTime() - new Date(item.takenAt).getTime()) / 86400000);
      if (diffDays > 45) {
        return false;
      }
    }

    if (state.primaryFilter === 'Collections') {
      const isCollectionItem = state.favoriteIds.has(item.id) || item.personLabels.length > 0 || /travel|festival|night/i.test(item.tags.join(' '));
      if (!isCollectionItem) {
        return false;
      }
    }

    switch (state.secondaryFilter) {
      case 'Documents':
        if (!(item.album === 'Documents' || item.tags.includes('scan') || item.tags.includes('archive') || item.tags.includes('invoice'))) {
          return false;
        }
        break;
      case 'Screenshots and recordings':
        if (!(item.album === 'Screenshots and recordings' || item.type === 'video')) {
          return false;
        }
        break;
      case 'Favourites':
        if (!state.favoriteIds.has(item.id)) {
          return false;
        }
        break;
      case 'People and pets':
        if (!item.personLabels.length) {
          return false;
        }
        break;
      case 'Places':
        if (!item.location) {
          return false;
        }
        break;
      case 'Albums':
      default:
        break;
    }

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
  });
}

function buildSections(items) {
  const renderedItems = items.slice(0, state.loadedCount);
  const groups = [];

  renderedItems.forEach((item) => {
    const label = item.timelineLabel || createTimelineLabel(item.takenAt);
    const key = `${item.year}-${label}`;
    const existing = groups[groups.length - 1];
    if (!existing || existing.key !== key) {
      groups.push({
        key,
        label,
        year: item.year,
        anchorId: `timeline-${item.year}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        items: [item]
      });
    } else {
      existing.items.push(item);
    }
  });

  return groups;
}

function getViewModel() {
  const filteredItems = getFilteredItems();
  const sections = buildSections(filteredItems);
  const years = [...new Set(filteredItems.map((item) => item.year))];
  const previewItems = filteredItems;
  const previewIndex = previewItems.findIndex((item) => item.id === state.previewId);
  const previewItem = previewIndex >= 0 ? previewItems[previewIndex] : null;

  if (years.length && !years.some((year) => String(year) === String(state.activeYear))) {
    state.activeYear = years[0];
  }

  return {
    filteredItems,
    sections,
    years,
    previewItems,
    previewIndex,
    previewItem
  };
}

function renderActionButton(label, action, description = '', tone = '') {
  return `
    <button type="button" class="cml-utility__action ${tone}" data-action="${action}">
      <span>${label}</span>
      ${description ? `<small>${description}</small>` : ''}
    </button>
  `;
}

function renderToggleButton(label, settingName, enabled, description = '') {
  return `
    <button type="button" class="cml-utility__toggle ${enabled ? 'is-on' : ''}" data-action="toggle-setting" data-setting="${settingName}">
      <span>${label}</span>
      <strong>${enabled ? 'On' : 'Off'}</strong>
      ${description ? `<small>${description}</small>` : ''}
    </button>
  `;
}
function renderUtilityPanel() {
  if (!state.activePanel) {
    return '';
  }

  const itemCount = getAllItems().length;
  const favoriteCount = state.favoriteIds.size;
  let title = '';
  let eyebrow = 'Library tools';
  let body = '';

  if (state.activePanel === 'help') {
    title = 'Help and shortcuts';
    body = `
      <section class="cml-utility__section">
        <h4>Keyboard</h4>
        <div class="cml-shortcuts">
          <div class="cml-shortcut"><span>Focus search</span><kbd>Ctrl/Cmd + K</kbd></div>
          <div class="cml-shortcut"><span>Open help</span><kbd>?</kbd></div>
          <div class="cml-shortcut"><span>Preview current tile</span><kbd>Enter</kbd></div>
          <div class="cml-shortcut"><span>Select current tile</span><kbd>Space</kbd></div>
          <div class="cml-shortcut"><span>Move around grid</span><kbd>Arrows</kbd></div>
          <div class="cml-shortcut"><span>Close panel or preview</span><kbd>Esc</kbd></div>
        </div>
      </section>
      <section class="cml-utility__section">
        <h4>Quick actions</h4>
        <div class="cml-utility__actions-grid">
          ${renderActionButton('Upload media', 'open-upload', 'Use the underlying uploader and keep the real upload chain.')}
          ${renderActionButton('Reload media scan', 'reload-library', 'Re-scan the hidden app DOM for new photos and videos.')}
          ${renderActionButton('Open original manager', 'open-native-dashboard', 'Jump back to the native dashboard view.')}
        </div>
      </section>
    `;
  } else if (state.activePanel === 'settings') {
    title = 'Library settings';
    body = `
      <section class="cml-utility__section">
        <h4>Interface</h4>
        <div class="cml-utility__actions-grid">
          ${renderToggleButton('Dense grid', 'denseGrid', state.settings.denseGrid, 'Fit more media into the timeline without changing the sort order.')}
          ${renderToggleButton('Hide sidebar', 'hideSidebar', state.settings.hideSidebar, 'Collapse the fixed navigation rail and expand the canvas.')}
        </div>
      </section>
      <section class="cml-utility__section">
        <h4>Maintenance</h4>
        <div class="cml-utility__actions-grid">
          ${renderActionButton('Reload media scan', 'reload-library', 'Refresh the real-photo index from the live page DOM.')}
          ${renderActionButton('Open native home', 'open-native-home', 'Use the upstream upload workspace without the overlay.')}
          ${renderActionButton('Open native dashboard', 'open-native-dashboard', 'Use the original file-manager surface directly.')}
        </div>
      </section>
    `;
  } else if (state.activePanel === 'apps') {
    title = 'Launchers';
    body = `
      <section class="cml-utility__section">
        <h4>Surfaces</h4>
        <div class="cml-utility__actions-grid">
          ${renderActionButton('Photo library home', 'open-photo-home', 'Open the overlay home route.')}
          ${renderActionButton('Photo library dashboard', 'open-photo-dashboard', 'Open the overlay dashboard route.')}
          ${renderActionButton('Original file manager', 'open-native-dashboard', 'Bypass the overlay and use the upstream manager.')}
          ${renderActionButton('Telegram sync admin', 'open-telegram-admin', 'Open the existing Telegram import admin page.')}
        </div>
      </section>
    `;
  } else if (state.activePanel === 'account') {
    eyebrow = 'Session';
    title = 'Current library session';
    body = `
      <section class="cml-utility__section">
        <h4>Overview</h4>
        <div class="cml-utility__stats">
          <div class="cml-utility__stat"><strong>${itemCount}</strong><span>Indexed items</span></div>
          <div class="cml-utility__stat"><strong>${favoriteCount}</strong><span>Favourites saved locally</span></div>
          <div class="cml-utility__stat"><strong>${window.location.pathname}</strong><span>Current route</span></div>
        </div>
      </section>
      <section class="cml-utility__section">
        <h4>Actions</h4>
        <div class="cml-utility__actions-grid">
          ${renderActionButton('Reload photo library', 'reload-library', 'Refresh the current live-media extraction.')}
          ${renderActionButton('Open login page', 'open-login', 'Jump to the existing login route.')}
          ${renderActionButton('Open original home', 'open-native-home', 'Leave the overlay and use the native home view.')}
        </div>
      </section>
    `;
  }

  return `
    <div class="cml-utility" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="cml-utility__backdrop" data-action="close-panel"></div>
      <div class="cml-utility__panel">
        <header class="cml-utility__header">
          <div>
            <p class="cml-utility__eyebrow">${eyebrow}</p>
            <h3 class="cml-utility__title">${title}</h3>
          </div>
          <button type="button" class="cml-utility__close" data-action="close-panel" aria-label="Close panel">×</button>
        </header>
        <div class="cml-utility__body">
          ${body}
        </div>
      </div>
    </div>
  `;
}

function render() {
  if (!refs.root) {
    return;
  }

  refs.root.dataset.density = state.settings.denseGrid ? 'dense' : 'comfortable';
  refs.root.dataset.sidebar = state.settings.hideSidebar ? 'hidden' : 'visible';

  const previousScrollTop = refs.scrollRegion ? refs.scrollRegion.scrollTop : 0;
  const searchWasFocused = document.activeElement instanceof HTMLInputElement
    && document.activeElement.classList.contains('cml-topbar__search-input');
  const viewModel = getViewModel();

  refs.root.innerHTML = `
    <div class="cml-app-shell">
      ${Sidebar({ navigationModel, state, storageSummary })}
      <div class="cml-main-shell">
        ${TopSearchBar({ state })}
        <div class="cml-main-content-shell">
          <main class="cml-main-content" tabindex="-1">
            <div class="cml-main-content__inner">
              ${SearchSummary({ query: state.searchQuery.trim(), resultCount: viewModel.filteredItems.length })}
              ${viewModel.sections.length
                ? viewModel.sections.map((section) => MediaTimelineSection({ section, state })).join('')
                : EmptyState({ query: state.searchQuery.trim(), isLoading: state.isLibraryLoading })}
            </div>
          </main>
          ${YearScroller({ years: viewModel.years, activeYear: state.activeYear })}
        </div>
      </div>
      ${PreviewModal({
        item: viewModel.previewItem,
        selected: viewModel.previewItem ? state.selectedIds.has(viewModel.previewItem.id) : false,
        favorited: viewModel.previewItem ? state.favoriteIds.has(viewModel.previewItem.id) : false,
        currentIndex: Math.max(viewModel.previewIndex, 0),
        totalCount: viewModel.previewItems.length
      })}
    </div>
  `;

  refs.scrollRegion = refs.root.querySelector('.cml-main-content');
  refs.sectionAnchors = [...refs.root.querySelectorAll('.cml-timeline-section')];

  if (refs.scrollRegion) {
    refs.scrollRegion.scrollTop = previousScrollTop;
    refs.scrollRegion.onscroll = handleScroll;
  }

  if (searchWasFocused) {
    focusSearchInput();
  }
}

function mount() {
  ensureRoot();
  document.body.classList.add('codex-media-library-active');
  state.liveSyncAttempts = 0;
  syncLiveMedia();
  render();
  startLiveObserver();
  consumePendingUploadRequest();

  if (!mounted && refs.root) {
    refs.root.addEventListener('click', handleClick);
    refs.root.addEventListener('input', handleInput);
    refs.root.addEventListener('focusin', handleFocusIn);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleWindowResize);
    mounted = true;
  }
}

function unmount() {
  document.body.classList.remove('codex-media-library-active');
  stopLiveObserver();
  if (refs.root) {
    refs.root.remove();
    refs.root = null;
  }
  refs.scrollRegion = null;
  refs.sectionAnchors = [];
}

function syncMount() {
  if (shouldMount()) {
    mount();
  } else {
    unmount();
  }
}

function openPreview(itemId) {
  state.previewId = itemId;
  render();
}

function closePreview() {
  state.previewId = null;
  render();
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
  const section = refs.sectionAnchors.find((item) => item.getAttribute('data-year') === String(year));
  if (section) {
    refs.scrollRegion.scrollTo({ top: section.offsetTop - 12, behavior: 'smooth' });
  }
}

function updateActiveYear() {
  if (!refs.scrollRegion || !refs.sectionAnchors.length) {
    return;
  }
  const scrollTop = refs.scrollRegion.scrollTop;
  let active = refs.sectionAnchors[0].getAttribute('data-year');
  refs.sectionAnchors.forEach((section) => {
    if (section.offsetTop - 40 <= scrollTop) {
      active = section.getAttribute('data-year');
    }
  });
  if (active && active !== state.activeYear) {
    state.activeYear = active;
    render();
  }
}

function handleWindowResize() {
  if (document.body.classList.contains('codex-media-library-active')) {
    render();
  }
}

function handleScroll() {
  if (!refs.scrollRegion) {
    return;
  }
  const filteredItems = getFilteredItems();
  const nearBottom = refs.scrollRegion.scrollTop + refs.scrollRegion.clientHeight >= refs.scrollRegion.scrollHeight - 720;
  if (nearBottom && state.loadedCount < filteredItems.length) {
    state.loadedCount = Math.min(filteredItems.length, state.loadedCount + 18);
    render();
    return;
  }
  updateActiveYear();
}
function handleAction(actionTarget) {
  switch (actionTarget.dataset.action) {
    case 'toggle-create-menu':
      state.isCreateMenuOpen = !state.isCreateMenuOpen;
      render();
      return true;
    case 'open-upload':
      state.isCreateMenuOpen = false;
      state.activePanel = '';
      requestNativeUpload();
      return true;
    case 'open-photo-home':
      openPhotoLibrary('/');
      return true;
    case 'open-photo-dashboard':
      openPhotoLibrary('/dashboard');
      return true;
    case 'open-native-home':
      openNativeView('/');
      return true;
    case 'open-native-dashboard':
      openNativeView('/dashboard');
      return true;
    case 'open-telegram-admin':
      openTelegramAdmin();
      return true;
    case 'open-login':
      window.location.assign('/login');
      return true;
    case 'help':
    case 'settings':
    case 'apps':
    case 'account':
      togglePanel(actionTarget.dataset.action);
      return true;
    case 'upgrade':
      togglePanel('settings');
      return true;
    case 'close-panel':
      state.activePanel = '';
      render();
      return true;
    case 'reload-library':
      reloadMediaLibrary();
      return true;
    case 'toggle-setting':
      if (actionTarget.dataset.setting) {
        toggleSetting(actionTarget.dataset.setting);
      }
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
    case 'open-preview':
      if (actionTarget.dataset.id) {
        openPreview(actionTarget.dataset.id);
      }
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
  const actionTarget = event.target instanceof Element ? event.target.closest('[data-action], [data-primary], [data-secondary], [data-year]') : null;
  const tileTarget = event.target instanceof Element ? event.target.closest('.cml-media-tile') : null;

  if (actionTarget instanceof HTMLElement) {
    if (actionTarget.dataset.primary) {
      state.primaryFilter = actionTarget.dataset.primary;
      state.secondaryFilter = '';
      state.searchQuery = '';
      state.selectedIds.clear();
      state.isCreateMenuOpen = false;
      state.activePanel = '';
      resetLoadedCount();
      render();
      return;
    }

    if (actionTarget.dataset.secondary) {
      state.secondaryFilter = actionTarget.dataset.secondary === state.secondaryFilter ? '' : actionTarget.dataset.secondary;
      state.selectedIds.clear();
      state.isCreateMenuOpen = false;
      state.activePanel = '';
      resetLoadedCount();
      render();
      return;
    }

    if (actionTarget.dataset.year) {
      state.activeYear = actionTarget.dataset.year;
      scrollToYear(actionTarget.dataset.year);
      render();
      return;
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
  if (!(input instanceof HTMLInputElement) || !input.classList.contains('cml-topbar__search-input')) {
    return;
  }
  state.searchQuery = input.value;
  state.selectedIds.clear();
  state.isCreateMenuOpen = false;
  resetLoadedCount();
  render();
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

  if (event.key === '?') {
    event.preventDefault();
    togglePanel('help');
    return;
  }

  if (state.previewId) {
    if (event.key === 'Escape') {
      closePreview();
    } else if (event.key === 'ArrowRight') {
      movePreview(1);
    } else if (event.key === 'ArrowLeft') {
      movePreview(-1);
    }
    return;
  }

  if (state.activePanel && event.key === 'Escape') {
    state.activePanel = '';
    render();
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