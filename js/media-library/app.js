import { createTimelineLabel, navigationModel, storageSummary } from './data.js';
import {
  AlbumDialog,
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
const ALBUMS_STORAGE_KEY = 'codex-media-library-albums';
const ALBUM_ASSIGNMENTS_STORAGE_KEY = 'codex-media-library-album-assignments';
const API_PAGE_SIZE = 400;
const API_MAX_ITEMS = 1600;

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

const state = {
  primaryFilter: 'Photos',
  secondaryFilter: '',
  searchQuery: '',
  selectedIds: new Set(),
  favoriteIds: loadStringSet(FAVORITES_STORAGE_KEY),
  albumNames: loadStringArray(ALBUMS_STORAGE_KEY),
  albumAssignments: loadStringRecord(ALBUM_ASSIGNMENTS_STORAGE_KEY),
  albumDialogOpen: false,
  albumDialogMode: 'create',
  albumDraftName: '',
  albumDialogError: '',
  previewId: null,
  loadedCount: 24,
  activeYear: null,
  focusedTileId: null,
  mediaItems: [],
  liveMediaSignature: '',
  isLibraryLoading: true,
  liveSyncAttempts: 0,
  layoutWidth: 0
};

const refs = {
  root: null,
  scrollRegion: null,
  sectionAnchors: [],
  contentInner: null
};

let mounted = false;
let historyPatched = false;
let liveObserver = null;
let liveSyncRaf = 0;
let liveSyncPromise = null;
let pendingSyncForceRender = false;

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

function getPersistentItemKey(item) {
  return normalizeText(item?.sourceId || item?.id || '');
}

function getAssignedAlbumName(item) {
  const key = getPersistentItemKey(item);
  return key ? normalizeText(state.albumAssignments[key] || '') : '';
}

function resolveItemAlbum(item) {
  return getAssignedAlbumName(item) || normalizeText(item?.album || '') || 'Library';
}

function applyAlbumOverride(item) {
  const album = resolveItemAlbum(item);
  return album !== item.album ? { ...item, album } : item;
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
  state.mediaItems.forEach((item) => pushAlbum(resolveItemAlbum(item)));
  Object.values(state.albumAssignments).forEach(pushAlbum);
  return names;
}

function persistAlbumNames() {
  saveStringArray(ALBUMS_STORAGE_KEY, state.albumNames);
}

function persistAlbumAssignments() {
  saveStringRecord(ALBUM_ASSIGNMENTS_STORAGE_KEY, state.albumAssignments);
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
      const parts = createDatePartsFromDate(date, now);
      parts.timelineLabel = `${MONTH_NAMES[month]} ${year}`;
      parts.displayTakenAt = `${MONTH_NAMES[month]} ${year}`;
      return parts;
    }

    const weekdayLabel = WEEKDAY_NAMES.find((weekday) => new RegExp(`\\b${weekday}\\b`, 'i').test(candidate));
    if (weekdayLabel) {
      const date = resolveRelativeWeekday(weekdayLabel, now);
      if (date) {
        const parts = createDatePartsFromDate(date, now);
        parts.timelineLabel = weekdayLabel;
        parts.displayTakenAt = weekdayLabel;
        return parts;
      }
    }

    const yearMatch = candidate.match(yearPattern);
    if (yearMatch) {
      const year = Number(yearMatch[1]);
      const date = new Date(year, 0, 1, 12, 0, 0, 0);
      const parts = createDatePartsFromDate(date, now);
      parts.timelineLabel = String(year);
      parts.displayTakenAt = String(year);
      return parts;
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
    tags,
    location: inferLocationFromMetadata(metadata, domMatch),
    favorite: false,
    personLabels: safeArray(metadata.PersonLabels).map(normalizeText).filter(Boolean),
    label,
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
  const response = await fetch(`/api/manage/list?${params.toString()}`, {
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json'
    }
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
  state.loadedCount = 24;
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
  state.secondaryFilter = 'Albums';
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
  state.secondaryFilter = 'Albums';
  resetLoadedCount();
  render();
  return true;
}

function assignSelectionToAlbum(albumName) {
  return commitSelectionToAlbum(albumName);
}

async function deleteSelectedItems() {
  const selectedItems = getSelectedItems().filter((item) => canDeleteItem(item));
  if (!selectedItems.length) {
    return;
  }
  const confirmationLabel = selectedItems.length === 1
    ? (selectedItems[0].label || selectedItems[0].album || 'this item')
    : `${selectedItems.length} selected items`;
  if (!window.confirm(`Delete ${confirmationLabel}? This cannot be undone.`)) {
    return;
  }

  const deletedIds = new Set();
  const deletedKeys = new Set();
  const failedItems = [];

  for (const item of selectedItems) {
    try {
      const response = await fetch(buildDeleteRoute(item.sourceId), {
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
    render();
    window.setTimeout(() => syncLiveMedia({ forceRender: true }), 600);
  }

  if (failedItems.length) {
    window.alert(`Failed to delete ${failedItems.length} item${failedItems.length === 1 ? '' : 's'}.`);
  }
}

function getVisibleSecondaryFilters(items) {
  if (!items.length && !state.favoriteIds.size && !state.albumNames.length) {
    return [];
  }

  const filters = [];
  if (items.length || state.secondaryFilter === 'Albums' || state.albumNames.length) {
    filters.push('Albums');
  }
  if (items.some((item) => item.isDocumentLike) || state.secondaryFilter === 'Documents') {
    filters.push('Documents');
  }
  if (state.favoriteIds.size || state.secondaryFilter === 'Favourites') {
    filters.push('Favourites');
  }
  return filters;
}

function isCollectionItem(item) {
  return state.favoriteIds.has(item.id)
    || item.isDocumentLike
    || /travel|festival|night|sunset|memory|archive/.test(item.tags.join(' '));
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

    if (state.primaryFilter === 'Collections' && !isCollectionItem(item)) {
      return false;
    }

    switch (state.secondaryFilter) {
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

function buildSections(items) {
  const renderedItems = items.slice(0, state.loadedCount);
  const groupByAlbum = state.secondaryFilter === 'Albums';

  if (groupByAlbum) {
    const groups = new Map();
    const ensureGroup = (label, year = new Date().getFullYear()) => {
      const normalizedLabel = normalizeText(label) || 'Library';
      const key = `album-${normalizedLabel.toLowerCase()}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: normalizedLabel,
          year,
          anchorId: `timeline-album-${normalizedLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          items: []
        });
      }
      return groups.get(key);
    };

    state.albumNames.forEach((albumName) => ensureGroup(albumName));
    renderedItems.forEach((item) => {
      const group = ensureGroup(item.album, item.year);
      group.year = group.items[0]?.year || item.year;
      group.items.push(item);
    });

    return [...groups.values()].map((group) => ({
      ...group,
      metaLine: group.items[0] ? group.items[0].displayTakenAt : 'Empty album'
    }));
  }

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

  return groups.map((group) => ({
    ...group,
    metaLine: summarizeLocations(group.items)
  }));
}

function getViewModel() {
  const visibleSecondaryFilters = getVisibleSecondaryFilters(getAllItems());
  if (state.secondaryFilter && !visibleSecondaryFilters.includes(state.secondaryFilter)) {
    state.secondaryFilter = '';
  }

  const filteredItems = getFilteredItems();
  const sections = buildSections(filteredItems);
  const years = state.secondaryFilter === 'Albums'
    ? []
    : [...new Set(filteredItems.map((item) => item.year))];
  const previewItems = filteredItems;
  const previewIndex = previewItems.findIndex((item) => item.id === state.previewId);
  const previewItem = previewIndex >= 0 ? previewItems[previewIndex] : null;
  const selectedItems = getSelectedItems();

  if (years.length && !years.some((year) => String(year) === String(state.activeYear))) {
    state.activeYear = years[0];
  }

  return {
    navigationModel: {
      primary: navigationModel.primary,
      secondary: visibleSecondaryFilters
    },
    filteredItems,
    sections,
    years,
    previewItems,
    previewIndex,
    previewItem,
    availableAlbums: getAvailableAlbumNames(),
    canDeleteSelection: selectedItems.length > 0 && selectedItems.every((item) => canDeleteItem(item))
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

  const previousScrollTop = refs.scrollRegion ? refs.scrollRegion.scrollTop : 0;
  const searchWasFocused = document.activeElement instanceof HTMLInputElement
    && document.activeElement.classList.contains('cml-topbar__search-input');
  const viewModel = getViewModel();

  refs.root.innerHTML = `
    <div class="cml-app-shell">
      ${Sidebar({ navigationModel: viewModel.navigationModel, state, storageSummary })}
      <div class="cml-main-shell">
        ${TopSearchBar({ state, canDeleteSelection: viewModel.canDeleteSelection })}
        <div class="cml-main-content-shell">
          <main class="cml-main-content" tabindex="-1">
            <div class="cml-main-content__inner">
              ${SearchSummary({ query: state.searchQuery.trim(), resultCount: viewModel.filteredItems.length })}
              ${viewModel.sections.length
                ? viewModel.sections.map((section) => MediaTimelineSection({ section, state, layoutWidth: state.layoutWidth })).join('')
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
      ${AlbumDialog({ state, albums: viewModel.availableAlbums })}
    </div>
  `;

  refs.scrollRegion = refs.root.querySelector('.cml-main-content');
  refs.sectionAnchors = [...refs.root.querySelectorAll('.cml-timeline-section')];
  refs.contentInner = refs.root.querySelector('.cml-main-content__inner');

  if (refs.scrollRegion) {
    refs.scrollRegion.scrollTop = previousScrollTop;
    refs.scrollRegion.onscroll = handleScroll;
  }

  if (searchWasFocused) {
    focusSearchInput();
  }

  syncLayoutWidth();
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
  refs.contentInner = null;
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
  if (!document.body.classList.contains('codex-media-library-active')) {
    return;
  }
  syncLayoutWidth();
  render();
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
    case 'open-create-album':
      openAlbumDialog('create');
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
    case 'delete-selected':
      void deleteSelectedItems();
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
      resetLoadedCount();
      render();
      return;
    }

    if (actionTarget.dataset.secondary) {
      state.secondaryFilter = actionTarget.dataset.secondary === state.secondaryFilter ? '' : actionTarget.dataset.secondary;
      state.selectedIds.clear();
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
  if (!(input instanceof HTMLInputElement)) {
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
      closePreview();
    } else if (event.key === 'ArrowRight') {
      movePreview(1);
    } else if (event.key === 'ArrowLeft') {
      movePreview(-1);
    }
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
