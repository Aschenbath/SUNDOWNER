import {
  createEmptyAdminCloudDraft,
  createEmptyAdminPageDraft,
  createEmptyAdminProfileDraft,
  createAdminCloudDraft,
  createAdminPageDraft,
  applyAdminCloudDraftToSettings,
  applyAdminPageDraftToConfig,
  parseAdminRecoveryMatches,
  resetAdminPasswordDraft,
  hydrateAdminProfileDraft,
  updateAdminDraftField,
} from './admin-runtime.js?v=2';
import { createTimelineLabel, navigationModel, storageSummary as defaultStorageSummary } from './data.js?v=3';
import {
  AdminPanel,
  AlbumDialog,
  AudioPlayerPanel,
  BinGrid,
  CollectionGrid,
  CollectionSummary,
  ConfirmDialog,
  DocumentsListView,
  EmptyState,
  LoginOverlay,
  MediaGrid,
  MediaTimelineSection,
  MindChatView,
  MindLoadingView,
  MobileAudioMiniPlayer,
  MobileBottomNav,
  MusicListView,
  MusicSummary,
  PrivateAlbumGate,
  PrivateAlbumSummary,
  renderMediaRows,
  PreviewModal,
  SearchResultsView,
  Sidebar,
  SidebarAudioPlayer,
  StorageCard,
  StoragePanel,
  TopSearchBar,
  VideoAlbumGrid,
  VideoAlbumSummary,
  VideoCategoryBar,
  YearScroller,
  buildJustifiedRows
} from './components.js?v=92';
import {
  countActiveMediaSearchFilters,
  matchesMediaSearchFilters,
  parseMediaSearchQuery,
  summarizeMediaSearch,
} from './search-filters.js?v=4';
import { loadJson, saveJson } from './storage.js';
import {
  buildPickerPreserveFlags,
  canUseDistinctAlbumPicker,
  getAlbumSelectionTarget,
  getVideoAlbumSelectionTarget,
  hasAnyPickerTarget,
  resetAddToTargetModes,
} from './picker-state.js';
import { PREVIEW_PANEL_SECTION_SELECTORS } from './preview-overlay.js';
import { findPreviewMatch } from './preview-resolution.js';
import { getLookupKeys as buildMediaLookupKeys } from './media-lookup.js';
import { shouldDisplayMediaItem, supportsBrowserImagePreview } from './media-support.js';
import { resolveMediaCaptureTimestamp } from './time-resolution.js';
import {
  FILM_FILTERS
} from './films-data.js?v=5';
import { FilmDetailPage, FilmSearchResults, FilmsPage } from './films-components.js?v=53';
import {
  THEME_CHANGE_EVENT,
  applyThemeToDocument,
  applyThemeToElement,
  dispatchThemeChange,
  loadThemePreference,
  persistThemePreference,
} from '../theme-system.js?v=2';

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
const PLAYLISTS_STORAGE_KEY = 'codex-media-library-playlists';
const PLAYLIST_ASSIGNMENTS_STORAGE_KEY = 'codex-media-library-playlist-assignments';
const FILM_ACCIDENTAL_ENTRY_CLEANUP_KEY = 'codex-media-library-film-accidental-entry-cleanup-v1';
const LEGACY_ALBUM_STORAGE_KEYS = [
  FAVORITES_STORAGE_KEY,
  ALBUMS_STORAGE_KEY,
  ALBUM_ASSIGNMENTS_STORAGE_KEY,
  ALBUM_COVERS_STORAGE_KEY
];
const API_PAGE_SIZE = 200;
const API_MAX_ITEMS = 1600;
const API_REQUEST_TIMEOUT_MS = 12000;
const STORAGE_REQUEST_TIMEOUT_MS = 5000;
const SEARCH_INPUT_DEBOUNCE_MS = 160;
const FILM_SEARCH_DEBOUNCE_MS = 180;
const FILM_SEARCH_MIN_LOADING_MS = 80;
const FILM_SEARCH_CLEAR_TRANSITION_MS = 180;
const FILM_BACKDROP_ROTATION_MS = 7200;
const FILM_METADATA_FIELDS = [
  'titleOverride',
  'originalTitleOverride',
  'directorOverride',
  'releaseDateOverride',
  'runtimeOverride',
  'genresOverride',
  'overviewOverride',
  'posterPathOverride',
  'backdropPathOverride',
  'posterUrlOverride',
  'backdropUrlOverride'
];
const FILM_BACKDROP_FRAME_FIELDS = [
  'backdropZoomOverride',
  'backdropPositionXOverride',
  'backdropPositionYOverride'
];
const FILM_ACTION_NAMES = new Set([
  'save-film-status',
  'toggle-film-tmdb-add',
  'open-tmdb-film-detail',
  'open-film-detail',
  'clear-film-rating',
  'save-film-watched-date',
  'close-film-detail',
  'set-film-view-mode',
  'add-manual-film',
  'load-more-film-search-results',
  'clear-film-library-search',
  'film-toggle-favourite',
  'film-edit-notes',
  'film-notes-format',
  'film-notes-preview-toggle',
  'film-toggle-more-actions',
  'film-edit-metadata',
  'film-change-poster',
  'film-change-backdrop',
  'film-pick-image',
  'film-apply-image-url',
  'film-clear-image-override',
  'film-reset-backdrop-frame',
  'film-close-image-picker',
  'film-refresh-tmdb',
  'film-open-tmdb',
  'film-mark-rewatch',
  'film-remove-entry',
  'film-undo-remove-entry',
  'film-delete-watch-event',
  'film-undo-watch-event-delete'
]);
const FILM_ACTIONS_WITHOUT_IMAGE_URL_AUTOSAVE = new Set([
  'film-pick-image',
  'film-apply-image-url',
  'film-clear-image-override',
  'film-reset-backdrop-frame'
]);
const MEDIA_LIBRARY_UPLOAD_ACCEPT = 'image/*,video/*,audio/*,application/pdf,application/zip,application/x-zip-compressed,application/msword,application/vnd.openxmlformats-officedocument.*,text/*';
const COLLECTION_PAGE_SIZE = 24;
const TIMELINE_ROW_GAP = 2;
const TIMELINE_SECTION_CHROME_ESTIMATE = 92;
const TIMELINE_SECTION_GAP = 28;
const BIN_TIMELINE_SECTION_GAP = 24;
const TIMELINE_VIRTUAL_OVERSCAN = 960;
const TIMELINE_VIRTUALIZATION_ITEM_THRESHOLD = 120;
const TILE_SELECTION_CHECK_MARKUP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.4 12.8 3.7 3.7 7.5-8.3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
const TILE_SELECTION_RING_MARKUP = '<span class="cml-media-tile__select-ring"></span>';
const VIDEO_CATEGORY_MAX_LENGTH = 48;
const DEFAULT_VIDEO_CATEGORY_SUGGESTIONS = ['Travel', 'Scenery', 'Daily life', 'Pets', 'Food', 'Performance', 'Tutorial', 'Screen recording'];
const UNGROUPED_VIDEO_ALBUM_KEY = '__ungrouped__';
const UNGROUPED_VIDEO_ROUTE_SEGMENT = '_ungrouped';
const PRIVATE_ROUTE_SEGMENT = 'private';
const PRIVATE_ALBUM_PASSWORD = '210217';
const PRIVATE_ALBUM_SESSION_KEY = 'codex-media-library-private-album';
const PREVIEW_INFO_FLAT_SECTION_STYLE = 'margin:0;padding:18px 20px;border:0;border-bottom:1px solid rgba(255,255,255,0.12);border-radius:0;background:transparent;';
const PREVIEW_INFO_EDITABLE_STYLE = `${PREVIEW_INFO_FLAT_SECTION_STYLE}cursor:pointer;`;
const PREVIEW_INFO_HEADING_STYLE = 'margin:0 0 12px;color:#c2cad6;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;';
const PREVIEW_INFO_VALUE_STYLE = 'margin:0;color:#f3f6fb;font-size:16px;font-weight:600;line-height:1.35;';
const PREVIEW_INFO_META_STYLE = 'margin:8px 0 0;color:#c2cad6;font-size:13px;line-height:1.45;';
const PREVIEW_INFO_TAG_STYLE = 'display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,0.16);background:rgba(255,255,255,0.1);color:#eef3fa;font-size:11px;font-weight:600;';

function readSessionFlag(key) {
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeSessionFlag(key, enabled) {
  try {
    if (enabled) {
      window.sessionStorage.setItem(key, '1');
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore sessionStorage failures and keep the UI functional.
  }
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

const FILE_EXTENSION_PATTERN = /\.(?:jpg|jpeg|png|webp|gif|bmp|avif|heic|heif|mp4|mov|m4v|webm|avi|mp3|m4a|aac|wav|ogg|flac)$/i;
const VIDEO_EXTENSION_PATTERN = /\.(?:mp4|mov|m4v|webm|avi)$/i;
const AUDIO_EXTENSION_PATTERN = /\.(?:mp3|m4a|aac|wav|ogg|flac)$/i;
const DOCUMENT_HINT_PATTERN = /\b(document|documents|scan|receipt|invoice|contract|paper|archive|notes?)\b/i;
const AUDIO_MODE_SEQUENCE = 'queue';
const AUDIO_MODE_REPEAT_ONE = 'repeat-one';
const AUDIO_MODE_SHUFFLE = 'shuffle';
const MIND_SETTINGS_STORAGE_KEY = 'codex-media-library-mind-settings';
const MIND_STATE_FRESH_MS = 30000;

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
      .map(([entryKey, entryValue]) => {
        const normalizedKey = normalizeText(entryKey);
        if (Array.isArray(entryValue)) {
          const normalized = entryValue.map((v) => normalizeText(v)).filter(Boolean);
          return [normalizedKey, normalized.length ? normalized : null];
        }
        const normalized = normalizeText(entryValue);
        return [normalizedKey, normalized || null];
      })
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
const initialMindSettings = loadPersistedMindSettingsSeed();
const initialThemePreference = loadThemePreference();

const state = {
  primaryFilter: 'Photos',
  secondaryFilter: '',
  videoCategoryFilter: '',
  privateViewOpen: false,
  privateRouteUnlocked: false,
  privatePasswordDraft: '',
  privatePasswordError: '',
  activeAlbumName: '',
  albumSelectionTarget: '',
  videoAlbumSelectionTarget: '',
  privateSelectionMode: false,
  searchQuery: '',
  searchDraft: '',
  selectedIds: new Set(),
  favoriteIds: new Set(),
  loadedMediaIds: new Set(),
  fullLoadedMediaIds: new Set(),
  albumNames: [],
  albumAssignments: {},
  albumCovers: {},
  playlistNames: loadStringArray(PLAYLISTS_STORAGE_KEY),
  playlistAssignments: loadStringRecord(PLAYLIST_ASSIGNMENTS_STORAGE_KEY),
  activePlaylistName: '',
  albumDialogOpen: false,
  albumDialogMode: 'create',
  albumDialogOrigin: '',
  albumDialogTarget: 'photo',
  albumDraftName: '',
  albumDialogError: '',
  albumDrawerSearch: '',
  albumDrawerScope: 'all',
  albumPickerDistinctOnly: false,
  albumDrawerCreateMode: false,
  mobileAlbumSearchOpen: false,
  mobileMindReturnPrimary: 'Photos',
  mobileMindReturnSecondary: '',
  mobileMindReturnPrivate: false,
  confirmDialogOpen: false,
  confirmDialogMode: '',
  confirmDialogOrigin: '',
  confirmDialogTitle: '',
  confirmDialogCopy: '',
  confirmDialogConfirmLabel: '',
  confirmDialogSelectionCount: 0,
  confirmDialogBusy: false,
  previewId: null,
  previewSourceHint: '',
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
  toastAction: null,
  toastTimeoutId: 0,
  infoOpen: false,
  previewImmersive: false,
  previewRotation: 0,
  uploadQueue: [],
  uploadActive: false,
  uploadTotal: 0,
  uploadDone: 0,
  mindMessages: [],
  mindDraft: '',
  mindComposerComposing: false,
  mindLoading: false,
  mindHydrated: false,
  mindLastLoadedAt: 0,
  mindSettingsBusy: false,
  mindDeletingIds: new Set(),
  mindSettings: initialMindSettings,
  mindSettingsDraft: createMindSettingsDraft(initialMindSettings),
  mindSettingsOpen: false,
  uiTheme: initialThemePreference.themeColor,
  uiThemeColor: initialThemePreference.themeColor,
  uiThemeMode: initialThemePreference.themeMode,
  uiResolvedThemeMode: initialThemePreference.resolvedThemeMode,
  uiThemeMenuOpen: false,
  audioCurrentId: '',
  audioQueueIds: [],
  audioMode: AUDIO_MODE_SEQUENCE,
  audioCurrentTime: 0,
  audioDuration: 0,
  audioVolume: 0.92,
  audioPlaying: false,
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
  adminRecoveryTargetChatId: '',
  adminRecoveryMatchesText: '',
  adminRecoverCaptureTimesLoading: false,
  adminRecoverCaptureTimesError: '',
  adminRecoverCaptureTimesResult: null,
  adminRecoverTgFileIdsLoading: false,
  adminRecoverTgFileIdsError: '',
  adminRecoverTgFileIdsResult: null,
  adminRecoverTgThumbnailsLoading: false,
  adminRecoverTgThumbnailsError: '',
  adminRecoverTgThumbnailsResult: null,
  adminTelegramChannels: [],
  adminTelegramLoading: false,
  adminTelegramError: '',
  adminTelegramBusy: false,
  renameAlbumDialogOpen: false,
  renameAlbumTarget: '',
  renameAlbumDraftName: '',
  renameAlbumError: '',
  renameAlbumBusy: false,
  renameItemDialogOpen: false,
  renameItemTargetId: '',
  renameItemField: 'FileName',
  renameItemDraftValue: '',
  renameItemError: '',
  renameItemBusy: false,
  playlistDialogOpen: false,
  playlistDialogMode: 'create',
  playlistDialogTargetItemId: '',
  playlistDraftName: '',
  playlistDialogError: '',
  playlistDialogBusy: false,
  adminProfileDraft: createEmptyAdminProfileDraft(),
  adminPageDraft: createEmptyAdminPageDraft(),
  adminCloudDraft: createEmptyAdminCloudDraft(),
  adminPageConfigSource: [],
  adminOthersConfigSource: null,
  storagePanelOpen: false,
  librarySyncMeta: {
    source: 'indexed',
    totalCount: 0,
    loadedCount: 0,
    isTruncated: false
  },
  dimensionCache: new Map(),
  docsCurrentDir: '',
  docsNewFolderOpen: false,
  docsFolders: new Set(),
  docsMoveDialogOpen: false,
  docsMoveDialogDir: '',
  docsMoveCreateOpen: false,
  docsMoveCreateName: '',
  docsContextMenu: null,
  films: [],
  activeFilmId: '',
  filmDetailOpen: false,
  filmTransientDetailRecord: null,
  filmSearchQuery: '',
  filmSearchResults: [],
  filmSearchLoading: false,
  filmSearchSettling: false,
  filmSearchClearing: false,
  filmSearchResultKey: 0,
  filmSearchPage: 0,
  filmSearchTotalPages: 0,
  filmSearchTotalResults: 0,
  filmSearchComposing: false,
  filmSearchLoadingMore: false,
  filmSearchAppendStartIndex: 0,
  filmTmdbAddOpen: false,
  filmLibraryQuery: '',
  filmLibrarySearchComposing: false,
  filmActiveFilter: FILM_FILTERS[0],
  filmViewMode: 'ticket',
  filmSavingTmdbIds: new Set(),
  filmError: '',
  filmNotesEditing: false,
  filmNotesDraft: '',
  filmNotesPreview: false,
  filmMetadataEditing: false,
  filmMetadataDraft: null,
  filmMetadataFocusField: '',
  filmMoreActionsOpen: false,
  filmImagePickerMode: '',
  filmImagePickerDraft: '',
  filmBackdropFrameDraft: null,
  filmRemovedUndoRecord: null,
  filmDeletedWatchEventUndo: null,
  filmBackdropIndexByFilmId: {},
  filmManualDraft: null,
  filmSaveStatus: null
};

let dimensionPatchTimer = 0;
let dimensionPatchRenderRaf = 0;

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

function getThemeState() {
  return {
    themeColor: state.uiThemeColor || state.uiTheme || initialThemePreference.themeColor,
    themeMode: state.uiThemeMode || initialThemePreference.themeMode,
    resolvedThemeMode: state.uiResolvedThemeMode || initialThemePreference.resolvedThemeMode
  };
}

function syncThemeState(nextTheme) {
  state.uiTheme = nextTheme.themeColor;
  state.uiThemeColor = nextTheme.themeColor;
  state.uiThemeMode = nextTheme.themeMode;
  state.uiResolvedThemeMode = nextTheme.resolvedThemeMode;
}

function commitThemeState(nextTheme, { dispatch = true } = {}) {
  const persisted = persistThemePreference(nextTheme);
  syncThemeState(persisted);
  applyThemeToDocument(persisted);
  if (dispatch) {
    dispatchThemeChange(persisted);
  }
  return persisted;
}

function applyThemeToLiveShell(nextTheme) {
  if (!refs.root) {
    return;
  }
  const shell = refs.root.querySelector('.cml-app-shell');
  if (shell instanceof HTMLElement) {
    applyThemeToElement(shell, nextTheme);
  }
}

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
let persistedPlaylistStatePromise = null;
let pendingPersistedPlaylistSnapshot = null;
let mindStatePromise = null;
let mindMirrorPromise = null;
let mindMutationQueue = Promise.resolve();
let mindVisitStickyMessages = [];
let stableAppViewportHeight = 0;
let stableAppViewportWidth = 0;
let lockedDocumentScrollY = 0;
let audioEngine = null;
let audioUiRaf = 0;
let filmSearchDebounceTimer = 0;
let filmSearchRequestId = 0;
let filmSearchAbortController = null;
let filmWarmupStarted = false;
let filmBackdropRotationTimer = 0;
let filmRemoveUndoTimer = 0;
let filmSaveStatusTimer = 0;
const filmSearchCache = new Map();
const filmDetailLoadingTmdbIds = new Set();
const filmManualCreateRequests = new Map();
const AUDIO_PLAY_ICON_HTML = '<span class="cml-icon "><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6.6 17.2 12 8 17.4Z" fill="currentColor"></path></svg></span>';
const AUDIO_PAUSE_ICON_HTML = '<span class="cml-icon "><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6.2h2.8v11.6H8Zm5.2 0H16v11.6h-2.8Z" fill="currentColor"></path></svg></span>';
const ADMIN_ORPHAN_SCAN_LIMIT = 20;
const MIND_BACKGROUND_PRESETS = ['ios-sky', 'sunset-glow', 'seafoam', 'midnight', 'paper'];
const MIND_BACKGROUND_POSITIONS = [
  'left top',
  'center top',
  'right top',
  'left center',
  'center center',
  'right center',
  'left bottom',
  'center bottom',
  'right bottom'
];
const MIND_SEND_BUTTON_COLORS = ['default', 'blue', 'green', 'yellow', 'pink', 'orange', 'purple', 'black'];
const MIND_SEND_BUTTON_THEMES = {
  default: {
    background: 'linear-gradient(180deg, #6b7280 0%, #4b5563 100%)',
    shadow: 'rgba(75, 85, 99, 0.3)',
    text: '#ffffff'
  },
  blue: {
    background: 'linear-gradient(180deg, #2896ff 0%, #0d7fff 100%)',
    shadow: 'rgba(13, 127, 255, 0.32)',
    text: '#ffffff'
  },
  green: {
    background: 'linear-gradient(180deg, #39da63 0%, #27c451 100%)',
    shadow: 'rgba(39, 196, 81, 0.34)',
    text: '#ffffff'
  },
  yellow: {
    background: 'linear-gradient(180deg, #f8cf32 0%, #e9b400 100%)',
    shadow: 'rgba(233, 180, 0, 0.3)',
    text: '#1c1a12'
  },
  pink: {
    background: 'linear-gradient(180deg, #f062a8 0%, #e14893 100%)',
    shadow: 'rgba(225, 72, 147, 0.3)',
    text: '#ffffff'
  },
  orange: {
    background: 'linear-gradient(180deg, #ff8a33 0%, #f06000 100%)',
    shadow: 'rgba(240, 96, 0, 0.3)',
    text: '#ffffff'
  },
  purple: {
    background: 'linear-gradient(180deg, #9a63ff 0%, #7f43e6 100%)',
    shadow: 'rgba(127, 67, 230, 0.32)',
    text: '#ffffff'
  },
  black: {
    background: 'linear-gradient(180deg, #2d3138 0%, #16181d 100%)',
    shadow: 'rgba(10, 12, 16, 0.42)',
    text: '#ffffff'
  }
};

function normalizeAudioMode(value) {
  return [AUDIO_MODE_SEQUENCE, AUDIO_MODE_REPEAT_ONE, AUDIO_MODE_SHUFFLE].includes(value)
    ? value
    : AUDIO_MODE_SEQUENCE;
}

function getAudioItemById(itemId, items = getAccessibleItems()) {
  const normalizedId = normalizeText(itemId);
  if (!normalizedId) {
    return null;
  }
  return items.find((item) => item.type === 'audio' && normalizeText(item.id) === normalizedId) || null;
}

function getMusicContextItems(items = getAccessibleItems()) {
  const activePlaylistName = getActivePlaylistName();
  const visibleAudioItems = getFilteredItems(items)
    .filter((item) => item.type === 'audio');
  if (!activePlaylistName) {
    return visibleAudioItems;
  }
  return items
    .filter((item) => item.type === 'audio')
    .filter((item) => itemBelongsToPlaylist(item, activePlaylistName));
}


function getAudioQueueItems(items = getAccessibleItems()) {
  if (state.primaryFilter === 'Music' && getActivePlaylistName()) {
    return getMusicContextItems(items);
  }
  const queueIds = Array.isArray(state.audioQueueIds) ? state.audioQueueIds : [];
  const mappedQueue = queueIds
    .map((itemId) => getAudioItemById(itemId, items))
    .filter(Boolean);
  if (mappedQueue.length) {
    return mappedQueue;
  }
  return state.primaryFilter === 'Music' ? getMusicContextItems(items) : [];
}

function syncAudioProgressUi() {
  if (!refs.root) {
    return;
  }
  const duration = Math.max(0, Number(state.audioDuration) || 0);
  const currentTime = Math.max(0, Math.min(Number(state.audioCurrentTime) || 0, duration || Number.MAX_SAFE_INTEGER));
  const progressMax = Math.max(1, Math.round(duration || 1));
  const progressValue = Math.min(Math.max(0, Math.round(currentTime)), progressMax);
  const progressFill = progressMax > 0 ? Math.max(0, Math.min(100, (progressValue / progressMax) * 100)) : 0;
  const volumeValue = Math.min(1, Math.max(0, Number(state.audioVolume) || 0));
  const volumeFill = Math.max(0, Math.min(100, volumeValue * 100));
  refs.root.querySelectorAll('[data-audio-current-time]').forEach((node) => {
    node.textContent = formatDuration(currentTime);
  });
  refs.root.querySelectorAll('[data-audio-duration]').forEach((node) => {
    node.textContent = formatDuration(duration);
  });
  refs.root.querySelectorAll('[data-audio-progress]').forEach((input) => {
    if (input instanceof HTMLInputElement) {
      input.max = String(progressMax);
      input.value = String(progressValue);
      input.style.setProperty('--cml-range-fill', `${progressFill}%`);
    }
  });
  refs.root.querySelectorAll('[data-audio-volume]').forEach((input) => {
    if (input instanceof HTMLInputElement) {
      input.value = String(volumeValue);
      input.style.setProperty('--cml-range-fill', `${volumeFill}%`);
    }
  });
  refs.root.querySelectorAll('[data-audio-toggle]').forEach((button) => {
    if (button instanceof HTMLElement) {
      button.innerHTML = state.audioPlaying ? AUDIO_PAUSE_ICON_HTML : AUDIO_PLAY_ICON_HTML;
      button.setAttribute('aria-label', state.audioPlaying ? 'Pause' : 'Play');
    }
  });
}

function scheduleAudioUiSync() {
  if (audioUiRaf) {
    cancelAnimationFrame(audioUiRaf);
  }
  audioUiRaf = requestAnimationFrame(() => {
    audioUiRaf = 0;
    syncAudioProgressUi();
  });
}

function getAudioRenderModel() {
  const viewModel = getViewModel();
  return {
    viewModel,
    showDesktopAudioPanel: viewModel.isMusicView && !isMobileLayout() && Boolean(viewModel.currentAudioItem),
    showDesktopSidebarAudioDock: !viewModel.isMusicView && !viewModel.isMindView && !isMobileLayout() && Boolean(viewModel.currentAudioItem),
    showMobileAudioPlayer: !viewModel.isMindView && isMobileLayout() && Boolean(viewModel.currentAudioItem)
  };
}

function patchMusicAudioRows(viewModel) {
  if (!refs.root || !viewModel?.isMusicView) {
    return false;
  }
  const rows = [...refs.root.querySelectorAll('.cml-music-row[data-audio-row]')];
  const currentId = normalizeText(state.audioCurrentId);
  rows.forEach((row, index) => {
    if (!(row instanceof HTMLElement)) {
      return;
    }
    const rowId = normalizeText(row.dataset.audioRow || '');
    const isCurrent = Boolean(currentId) && rowId === currentId;
    row.classList.toggle('is-current', isCurrent);
    const trigger = row.querySelector('.cml-music-row__index');
    if (!(trigger instanceof HTMLElement)) {
      return;
    }
    if (isCurrent) {
      trigger.dataset.action = 'audio-toggle-play';
      delete trigger.dataset.id;
      trigger.innerHTML = state.audioPlaying ? AUDIO_PAUSE_ICON_HTML : AUDIO_PLAY_ICON_HTML;
      trigger.setAttribute('aria-label', state.audioPlaying ? 'Pause track' : 'Play track');
      return;
    }
    const sourceId = row.dataset.audioRow || '';
    trigger.dataset.action = 'play-audio-item';
    if (sourceId) {
      trigger.dataset.id = sourceId;
    }
    trigger.textContent = String(index + 1);
    trigger.setAttribute('aria-label', 'Play track');
  });
  return true;
}

function buildSidebarMarkupForAudio(viewModel, { showDesktopSidebarAudioDock = false } = {}) {
  const desktopAudioDockKey = showDesktopSidebarAudioDock
    ? `${normalizeText(viewModel.currentAudioItem?.id)}|${state.audioPlaying ? 'playing' : 'paused'}|${normalizeAudioMode(state.audioMode)}`
    : '';
  return Sidebar({
    navigationModel: viewModel.navigationModel,
    state,
    storageSummary: state.storageSummary,
    desktopAudioDockKey,
    desktopAudioDock: showDesktopSidebarAudioDock
      ? SidebarAudioPlayer({
          currentItem: viewModel.currentAudioItem,
          currentTime: state.audioCurrentTime,
          duration: state.audioDuration,
          isPlaying: state.audioPlaying,
          mode: state.audioMode,
          volume: state.audioVolume
        })
      : '',
    searchQuery: state.searchDraft
  });
}

function patchAudioUi({ allowFullRender = true } = {}) {
  if (!refs.root) {
    return false;
  }
  const audioModel = getAudioRenderModel();
  const { viewModel, showDesktopAudioPanel, showDesktopSidebarAudioDock, showMobileAudioPlayer } = audioModel;
  const hasDesktopPanel = refs.root.querySelector('.cml-audio-panel') instanceof HTMLElement;
  const hasSidebarDock = refs.root.querySelector('.cml-sidebar-audio-player') instanceof HTMLElement;
  const hasMobilePlayer = refs.root.querySelector('.cml-mobile-audio-player') instanceof HTMLElement;
  const structureChanged = hasDesktopPanel !== showDesktopAudioPanel
    || hasSidebarDock !== showDesktopSidebarAudioDock
    || hasMobilePlayer !== showMobileAudioPlayer;

  if (structureChanged) {
    if (allowFullRender) {
      render();
      return true;
    }
    return false;
  }

  if (showDesktopAudioPanel) {
    const currentPanel = refs.root.querySelector('.cml-audio-panel');
    if (currentPanel instanceof HTMLElement) {
      const template = document.createElement('template');
      template.innerHTML = AudioPlayerPanel({
        currentItem: viewModel.currentAudioItem,
        queueItems: viewModel.audioQueueItems,
        currentTime: state.audioCurrentTime,
        duration: state.audioDuration,
        isPlaying: state.audioPlaying,
        mode: state.audioMode,
        volume: state.audioVolume
      }).trim();
      const nextPanel = template.content.firstElementChild;
      if (nextPanel instanceof HTMLElement) {
        currentPanel.replaceWith(nextPanel);
      }
    }
  }

  if (showDesktopSidebarAudioDock) {
    const template = document.createElement('template');
    template.innerHTML = buildSidebarMarkupForAudio(viewModel, { showDesktopSidebarAudioDock }).trim();
    const nextSidebar = template.content.querySelector('.cml-sidebar');
    if (nextSidebar instanceof HTMLElement) {
      patchSidebarFooter(nextSidebar);
    }
  }

  if (showMobileAudioPlayer) {
    const currentMiniPlayer = refs.root.querySelector('.cml-mobile-audio-player');
    if (currentMiniPlayer instanceof HTMLElement) {
      const template = document.createElement('template');
      template.innerHTML = MobileAudioMiniPlayer({
        currentItem: viewModel.currentAudioItem,
        isPlaying: state.audioPlaying
      }).trim();
      const nextMiniPlayer = template.content.firstElementChild;
      if (nextMiniPlayer instanceof HTMLElement) {
        currentMiniPlayer.replaceWith(nextMiniPlayer);
      }
    }
  }

  if (viewModel.isMusicView) {
    const currentSummary = refs.root.querySelector('.cml-music-summary');
    if (currentSummary instanceof HTMLElement) {
      const template = document.createElement('template');
      template.innerHTML = MusicSummary({
        totalCount: viewModel.musicItems.length,
        isMobile: isMobileLayout(),
        currentItem: viewModel.currentAudioItem,
        queueItems: viewModel.audioQueueItems,
        isPlaying: state.audioPlaying,
        mode: state.audioMode,
        playlists: viewModel.musicPlaylists,
        activePlaylistName: viewModel.activePlaylistName
      }).trim();
      const nextSummary = template.content.firstElementChild;
      if (nextSummary instanceof HTMLElement) {
        currentSummary.replaceWith(nextSummary);
      }
    }
    const currentMusicLibrary = refs.root.querySelector('.cml-music-library');
    if (currentMusicLibrary instanceof HTMLElement && viewModel.musicItems.length) {
      const template = document.createElement('template');
      template.innerHTML = MusicListView({
        items: viewModel.musicItems,
        state,
        audioState: {
          currentId: state.audioCurrentId,
          isPlaying: state.audioPlaying
        },
        currentItem: viewModel.currentAudioItem,
        currentTime: state.audioCurrentTime,
        duration: state.audioDuration,
        queueItems: viewModel.audioQueueItems,
        playlists: viewModel.musicPlaylists,
        activePlaylistName: viewModel.activePlaylistName
      }).trim();
      const nextMusicLibrary = template.content.firstElementChild;
      if (nextMusicLibrary instanceof HTMLElement) {
        currentMusicLibrary.replaceWith(nextMusicLibrary);
      }
    } else {
      patchMusicAudioRows(viewModel);
    }
  }

  scheduleAudioUiSync();
  return true;
}

function ensureAudioEngine() {
  if (audioEngine instanceof HTMLAudioElement) {
    return audioEngine;
  }
  audioEngine = new Audio();
  audioEngine.preload = 'auto';
  audioEngine.volume = Math.min(1, Math.max(0, Number(state.audioVolume) || 0));
  audioEngine.addEventListener('loadedmetadata', () => {
    state.audioDuration = Number.isFinite(audioEngine.duration) ? audioEngine.duration : 0;
    scheduleAudioUiSync();
  });
  audioEngine.addEventListener('durationchange', () => {
    state.audioDuration = Number.isFinite(audioEngine.duration) ? audioEngine.duration : state.audioDuration;
    scheduleAudioUiSync();
  });
  audioEngine.addEventListener('timeupdate', () => {
    state.audioCurrentTime = Number.isFinite(audioEngine.currentTime) ? audioEngine.currentTime : 0;
    scheduleAudioUiSync();
  });
  audioEngine.addEventListener('play', () => {
    state.audioPlaying = true;
    if (refs.root) {
      patchAudioUi();
    }
  });
  audioEngine.addEventListener('pause', () => {
    state.audioPlaying = false;
    if (refs.root) {
      patchAudioUi();
    }
  });
  audioEngine.addEventListener('ended', () => {
    handleAudioEnded();
  });
  audioEngine.addEventListener('error', () => {
    state.audioPlaying = false;
    scheduleAudioUiSync();
  });
  return audioEngine;
}

function formatDuration(value) {
  const numeric = Math.max(0, Number(value) || 0);
  const totalSeconds = Math.round(numeric);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

async function playAudioItemById(itemId, { queueItems = null, autoplay = true } = {}) {
  const accessibleItems = getAccessibleItems();
  const item = getAudioItemById(itemId, accessibleItems);
  if (!item?.sourceUrl) {
    return;
  }
  const engine = ensureAudioEngine();
  const nextQueue = Array.isArray(queueItems) && queueItems.length
    ? queueItems.filter((entry) => entry?.type === 'audio')
    : (state.primaryFilter === 'Music' ? getMusicContextItems(accessibleItems) : [item]);
  state.audioQueueIds = [...new Set(nextQueue.map((entry) => normalizeText(entry.id)).filter(Boolean))];
  state.audioCurrentId = item.id;
  state.audioCurrentTime = 0;
  state.audioDuration = Number(item.audioDuration) || 0;
  if (engine.src !== item.sourceUrl) {
    engine.src = item.sourceUrl;
  } else {
    engine.currentTime = 0;
  }
  if (refs.root) {
    patchAudioUi();
  }
  if (autoplay) {
    try {
      await engine.play();
    } catch {
      state.audioPlaying = false;
      if (refs.root) {
        patchAudioUi();
      }
    }
  } else {
    engine.pause();
    if (refs.root) {
      patchAudioUi();
    }
  }
}

function loadPersistedMindSettingsSeed() {
  const stored = loadJson(MIND_SETTINGS_STORAGE_KEY, {});
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    return {};
  }
  return stored;
}

function persistMindSettings(settings = {}) {
  try {
    window.localStorage.setItem(MIND_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeMindSettings(settings)));
  } catch {
    // Ignore persistence failures and keep the UI responsive.
  }
}

function toggleAudioPlayback() {
  const engine = ensureAudioEngine();
  if (!state.audioCurrentId) {
    const queueItems = getAudioQueueItems(getAccessibleItems());
    if (queueItems.length) {
      void playAudioItemById(queueItems[0].id, { queueItems });
    }
    return;
  }
  if (engine.paused) {
    void engine.play().catch(() => {});
  } else {
    engine.pause();
  }
}

function getAdjacentAudioItem(direction = 1) {
  const queueItems = getAudioQueueItems(getAccessibleItems());
  if (!queueItems.length) {
    return null;
  }
  if (state.audioMode === AUDIO_MODE_SHUFFLE && queueItems.length > 1) {
    const currentId = normalizeText(state.audioCurrentId);
    const candidates = queueItems.filter((item) => normalizeText(item.id) !== currentId);
    return candidates[Math.floor(Math.random() * candidates.length)] || queueItems[0];
  }
  const currentIndex = Math.max(0, queueItems.findIndex((item) => normalizeText(item.id) === normalizeText(state.audioCurrentId)));
  const nextIndex = currentIndex + direction;
  if (nextIndex < 0) {
    return queueItems[queueItems.length - 1];
  }
  if (nextIndex >= queueItems.length) {
    return queueItems[0];
  }
  return queueItems[nextIndex];
}

function playAdjacentAudio(direction = 1) {
  const nextItem = getAdjacentAudioItem(direction);
  if (!nextItem) {
    return;
  }
  void playAudioItemById(nextItem.id, { queueItems: getAudioQueueItems(getAccessibleItems()) });
}

function handleAudioEnded() {
  if (state.audioMode === AUDIO_MODE_REPEAT_ONE && state.audioCurrentId) {
    void playAudioItemById(state.audioCurrentId, { queueItems: getAudioQueueItems(getAccessibleItems()) });
    return;
  }
  const queueItems = getAudioQueueItems(getAccessibleItems());
  if (!queueItems.length) {
    state.audioPlaying = false;
    scheduleAudioUiSync();
    return;
  }
  const currentIndex = queueItems.findIndex((item) => normalizeText(item.id) === normalizeText(state.audioCurrentId));
  if (state.audioMode === AUDIO_MODE_SHUFFLE) {
    playAdjacentAudio(1);
    return;
  }
  if (currentIndex >= queueItems.length - 1) {
    state.audioPlaying = false;
    state.audioCurrentTime = Number.isFinite(audioEngine?.duration) ? audioEngine.duration : state.audioDuration;
    scheduleAudioUiSync();
    if (audioEngine) {
      audioEngine.pause();
    }
    return;
  }
  playAdjacentAudio(1);
}

function removeAudioQueueItem(itemId) {
  const normalizedId = normalizeText(itemId);
  if (!normalizedId) {
    return;
  }
  const currentQueueItems = getAudioQueueItems(getAccessibleItems());
  const currentQueueIds = currentQueueItems
    .map((item) => normalizeText(item.id))
    .filter(Boolean);
  const currentIndex = currentQueueIds.findIndex((id) => id === normalizedId);
  const nextQueueIds = currentQueueIds.filter((id) => id !== normalizedId);
  if (nextQueueIds.length === currentQueueIds.length) {
    return;
  }
  const removedCurrent = normalizeText(state.audioCurrentId) === normalizedId;
  state.audioQueueIds = nextQueueIds;
  if (!nextQueueIds.length) {
    state.audioCurrentId = '';
    state.audioPlaying = false;
    state.audioCurrentTime = 0;
    state.audioDuration = 0;
    if (audioEngine) {
      audioEngine.pause();
      audioEngine.removeAttribute('src');
      audioEngine.load();
    }
    patchAudioUi();
    return;
  }
  if (removedCurrent) {
    const fallbackIndex = currentIndex < 0 ? 0 : Math.min(currentIndex, nextQueueIds.length - 1);
    const nextItemId = nextQueueIds[fallbackIndex] || nextQueueIds[0];
    void playAudioItemById(nextItemId, { queueItems: getAudioQueueItems(getAccessibleItems()), autoplay: true });
    return;
  }
  patchAudioUi();
}

function setAudioMode(mode) {
  const normalizedMode = normalizeAudioMode(mode);
  state.audioMode = state.audioMode === normalizedMode ? AUDIO_MODE_SEQUENCE : normalizedMode;
  patchAudioUi();
}

function setAudioVolume(value) {
  const numeric = Math.min(1, Math.max(0, Number(value) || 0));
  state.audioVolume = numeric;
  if (audioEngine) {
    audioEngine.volume = numeric;
  }
  scheduleAudioUiSync();
}

function seekAudio(value) {
  const engine = ensureAudioEngine();
  const nextTime = Math.max(0, Number(value) || 0);
  engine.currentTime = nextTime;
  state.audioCurrentTime = nextTime;
  scheduleAudioUiSync();
}

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

  // Mouse wheel zoom — anchor to cursor position
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : (1 / 1.15);
    const next = Math.max(1, Math.min(6, touchZoom.currentScale * factor));
    if (next === touchZoom.currentScale) return;
    const rect = stage.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;
    const d = next / touchZoom.currentScale;
    touchZoom.tx = cx - d * (cx - touchZoom.tx);
    touchZoom.ty = cy - d * (cy - touchZoom.ty);
    touchZoom.currentScale = next;
    _tzApply(mediaEl);
    if (touchZoom.currentScale < 1.05) _tzReset(mediaEl);
  }, { passive: false });

  // Double-click to toggle 2.5× zoom
  stage.addEventListener('dblclick', (e) => {
    if (e.target.closest('.cml-preview__nav')) return;
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
  });

  // Mouse drag pan when zoomed
  let isMousePan = false;
  stage.addEventListener('mousedown', (e) => {
    if (touchZoom.currentScale > 1.05 && e.button === 0) {
      isMousePan = true;
      touchZoom.startMidX = e.clientX;
      touchZoom.startMidY = e.clientY;
      touchZoom.startTx = touchZoom.tx;
      touchZoom.startTy = touchZoom.ty;
      e.preventDefault();
    }
  });
  stage.addEventListener('mousemove', (e) => {
    if (!isMousePan) return;
    touchZoom.tx = touchZoom.startTx + (e.clientX - touchZoom.startMidX);
    touchZoom.ty = touchZoom.startTy + (e.clientY - touchZoom.startMidY);
    _tzApply(mediaEl);
  });
  stage.addEventListener('mouseup', () => { isMousePan = false; });
  stage.addEventListener('mouseleave', () => { isMousePan = false; });
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
      const current = state.mediaItems[mediaIdx];
      if (current.width !== width || current.height !== height) {
        state.mediaItems[mediaIdx] = { ...current, width, height };
        changed = true;
      }
    }
    const binIdx = state.binItems.findIndex((m) => m.id === id);
    if (binIdx !== -1) {
      const current = state.binItems[binIdx];
      if (current.width !== width || current.height !== height) {
        state.binItems[binIdx] = { ...current, width, height };
        changed = true;
      }
    }
  });
  state.dimensionCache.clear();
  if (changed && refs.root && !dimensionPatchRenderRaf) {
    dimensionPatchRenderRaf = window.requestAnimationFrame(() => {
      dimensionPatchRenderRaf = 0;
      if (refs.root) {
        render();
      }
    });
  }
}

function swapTileToFullImage(img, tile, fullSrc) {
  if (!(img instanceof HTMLImageElement) || !fullSrc) {
    return;
  }
  const applyLoadedFullImage = (source) => {
    if (!refs.root || !tile?.isConnected || !img.isConnected) {
      return;
    }
    img.classList.remove('is-blur-placeholder');
    img.src = fullSrc;
    tile.classList.add('is-full-loaded');
    const tileId = normalizeText(tile.dataset?.tileId || tile.dataset?.id || '');
    if (tileId) {
      state.loadedMediaIds.add(tileId);
      state.fullLoadedMediaIds.add(tileId);
    }
    if (source?.naturalWidth && source?.naturalHeight) {
      captureDimension(source, tile);
    } else {
      captureDimension(img, tile);
    }
  };
  const full = new Image();
  full.decoding = 'async';
  full.addEventListener('load', () => applyLoadedFullImage(full), { once: true });
  full.addEventListener('error', () => {
    // Keep the blur thumbnail visible when the full image fails, but still try
    // to reconcile the tile with whatever dimensions are currently available.
    captureDimension(img, tile);
  }, { once: true });
  full.src = fullSrc;
  if (full.complete && full.naturalWidth > 0) {
    applyLoadedFullImage(full);
  }
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
    const tileId = normalizeText(tile.dataset?.tileId || tile.dataset?.id || '');
    const rememberLoaded = ({ fullLoaded = false } = {}) => {
      if (!tileId) {
        return;
      }
      state.loadedMediaIds.add(tileId);
      if (fullLoaded) {
        state.fullLoadedMediaIds.add(tileId);
      }
    };
    const fullSrc = img.dataset.fullSrc || '';
    if (img.complete && img.naturalWidth > 0) {
      // Skip fade-in for already-cached images (avoids flash on every render)
      img.style.transition = 'none';
      tile.classList.add('is-img-loaded');
      rememberLoaded({ fullLoaded: !fullSrc || img.src === fullSrc });
      if (fullSrc && img.src !== fullSrc) {
        // Do not read dimensions from the blur thumbnail; wait for the real
        // image so portrait photos do not get patched as landscape tiles.
        swapTileToFullImage(img, tile, fullSrc);
        return;
      } else if (fullSrc) {
        tile.classList.add('is-full-loaded');
      }
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
    if (fullSrc) {
      // Blur-up: load tiny thumbnail first, then swap to full
      img.addEventListener('load', function onBlurLoad() {
        tile.classList.add('is-img-loaded');
        rememberLoaded();
        swapTileToFullImage(img, tile, fullSrc);
      }, { once: true });
      img.addEventListener('error', () => {
        tile.classList.add('is-img-loaded');
        rememberLoaded();
      }, { once: true });
    } else {
      img.addEventListener('load', () => {
        tile.classList.add('is-img-loaded');
        rememberLoaded({ fullLoaded: true });
        captureDimension(img, tile);
      }, { once: true });
      img.addEventListener('error', () => {
        tile.classList.add('is-img-loaded');
        rememberLoaded();
      }, { once: true });
    }
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
    const tileId = normalizeText(tile.dataset?.tileId || tile.dataset?.id || '');
    const markLoaded = () => {
      tile.classList.add('is-img-loaded');
      if (tileId) {
        state.loadedMediaIds.add(tileId);
      }
    };
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
  sourceHint = state.previewSourceHint
} = {}) {
  return findPreviewMatch(items, { id, sourceHint });
}

function animatePreviewOpenFromTile() {
  if (!refs.root || previewTransitionInFlight) {
    return;
  }
  const preview = refs.root.querySelector('.cml-preview');
  if (!(preview instanceof HTMLElement)) {
    return;
  }

  previewTransitionInFlight = true;
  preview.classList.add('is-entering');
  void preview.offsetWidth;
  window.requestAnimationFrame(() => {
    preview.classList.remove('is-entering');
    window.setTimeout(() => {
      previewTransitionInFlight = false;
    }, 220);
  });
}

function animatePreviewCloseToTile(onComplete) {
  if (!refs.root) {
    onComplete();
    return;
  }
  const preview = refs.root.querySelector('.cml-preview');
  if (!(preview instanceof HTMLElement)) {
    onComplete();
    return;
  }
  if (previewTransitionInFlight) {
    if (preview.classList.contains('is-entering')) {
      preview.classList.remove('is-entering');
      previewTransitionInFlight = false;
    } else {
      return;
    }
  }

  previewTransitionInFlight = true;
  let finished = false;
  const finalize = () => {
    if (finished) {
      return;
    }
    finished = true;
    preview.removeEventListener('transitionend', handleTransitionEnd);
    window.clearTimeout(fallbackTimer);
    preview.classList.remove('is-closing');
    previewTransitionInFlight = false;
    onComplete();
  };
  const handleTransitionEnd = (event) => {
    if (
      event.target instanceof HTMLElement
      && (
        event.target.classList.contains('cml-preview__panel')
        || event.target.classList.contains('cml-preview__backdrop')
      )
    ) {
      finalize();
    }
  };
  const fallbackTimer = window.setTimeout(finalize, 220);
  preview.addEventListener('transitionend', handleTransitionEnd);
  window.requestAnimationFrame(() => {
    preview.classList.add('is-closing');
  });
}

function setPreviewInfoOpen(isOpen, { allowRenderFallback = true } = {}) {
  const nextOpen = Boolean(isOpen);
  state.infoOpen = nextOpen;
  if (nextOpen && state.albumDialogOpen && state.albumDialogOrigin === 'preview') {
    state.albumDialogOpen = false;
    state.albumDialogOrigin = '';
    state.albumDialogError = '';
    state.albumDraftName = '';
    state.albumDrawerSearch = '';
    state.albumDrawerScope = 'all';
    state.albumDrawerCreateMode = false;
  }
  if (!refs.root) {
    if (allowRenderFallback) {
      render();
    }
    return;
  }
  const preview = refs.root.querySelector('.cml-preview');
  const infoPanel = refs.root.querySelector('.cml-preview__info');
  const toggleButton = refs.root.querySelector('.cml-preview__icon-action[data-action="toggle-info"]');
  const albumPanel = refs.root.querySelector('.cml-preview__album-panel');
  const albumButton = refs.root.querySelector('.cml-preview__icon-action[data-action="open-preview-add-to-album"]');

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

  if (nextOpen && albumPanel instanceof HTMLElement) {
    preview.classList.remove('has-album');
    albumPanel.classList.remove('is-open');
    albumPanel.setAttribute('aria-hidden', 'true');
    if (albumButton instanceof HTMLElement) {
      albumButton.classList.remove('is-selected');
      albumButton.setAttribute('aria-pressed', 'false');
    }
  }
}

let yearScrollerDragActive = false;
let scrubberHideTimeoutId = 0;
let scrubberClickSuppressUntil = 0;
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
    scrubberClickSuppressUntil = Date.now() + 600;
    scrollToYear(hit.dataset.anchor);
    updateScrubberThumb();
  }
  revealScrubber({ keepAlive: yearScrollerDragActive });
}

let storageSyncPromise = null;
let pendingSearchApplyTimer = 0;

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

function normalizeMultilineText(value, maxLength = 12000) {
  const normalized = String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  return maxLength > 0 ? normalized.slice(0, maxLength) : normalized;
}

function getFilmUserRatingMood(value) {
  const rating = Number(value);
  if (!Number.isFinite(rating)) {
    return 'Not rated';
  }
  if (rating < 2) {
    return '\u4e0d\u63a8\u8350';
  }
  if (rating < 3) {
    return '\u4e00\u822c';
  }
  if (rating < 4) {
    return '\u8fd8\u884c';
  }
  if (rating < 4.5) {
    return '\u63a8\u8350';
  }
  return '\u79c1\u5fc3\u6700\u7231';
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
      items: allItems.filter((item) => item?.type !== 'document' && Math.max(0, Number(item?.sizeMb) || 0) >= 25)
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
  const albumItems = safeArray(items).filter((item) => itemBelongsToAlbum(item, albumName));
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

function getAssignedAlbumNames(item) {
  const key = getPersistentItemKey(item);
  if (!key) { return []; }
  const value = state.albumAssignments[key];
  if (Array.isArray(value)) { return value.map(normalizeText).filter(Boolean); }
  const single = normalizeText(value || '');
  return single ? [single] : [];
}

function getAssignedAlbumName(item) {
  return getAssignedAlbumNames(item)[0] || '';
}

function normalizePlaylistKey(value) {
  return normalizeText(value).toLowerCase();
}

function getAssignedPlaylistNames(item) {
  const key = getPersistentItemKey(item);
  if (!key) {
    return [];
  }
  const value = state.playlistAssignments[key];
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean);
  }
  const single = normalizeText(value || '');
  return single ? [single] : [];
}

function itemBelongsToPlaylist(item, playlistName) {
  const playlistKey = normalizePlaylistKey(playlistName);
  return getAssignedPlaylistNames(item).some((name) => normalizePlaylistKey(name) === playlistKey);
}

function getStoredCollectionAlbum(item) {
  return normalizeText(item?.collectionAlbum || item?.tgAlbumPath || item?.metadataAlbum || '');
}

function resolveCollectionAlbums(item) {
  const assigned = getAssignedAlbumNames(item);
  if (assigned.length) { return assigned; }
  const stored = getStoredCollectionAlbum(item);
  return stored ? [stored] : [];
}

function resolveCollectionAlbum(item) {
  return resolveCollectionAlbums(item)[0] || '';
}

function itemBelongsToAlbum(item, albumName) {
  const albumKey = normalizeAlbumKey(albumName);
  return resolveCollectionAlbums(item).some((name) => normalizeAlbumKey(name) === albumKey);
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

function getAvailableAlbumNames(items = getAccessibleItems(state.mediaItems)) {
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
  safeArray(items).forEach((item) => resolveCollectionAlbums(item).forEach(pushAlbum));
  Object.values(state.albumAssignments).forEach((value) => {
    if (Array.isArray(value)) { value.forEach(pushAlbum); } else { pushAlbum(value); }
  });
  return names;
}

function buildMusicPlaylistSummaries(items = getAccessibleItems()) {
  const groups = new Map();
  const ensureGroup = (name) => {
    const normalizedName = normalizeText(name);
    if (!normalizedName) {
      return null;
    }
    const key = normalizePlaylistKey(normalizedName);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: normalizedName,
        items: []
      });
    }
    return groups.get(key);
  };

  state.playlistNames.forEach((playlistName) => ensureGroup(playlistName));
  items
    .filter((item) => item?.type === 'audio')
    .forEach((item) => {
      getAssignedPlaylistNames(item).forEach((playlistName) => {
        const group = ensureGroup(playlistName);
        if (group) {
          group.items.push(item);
        }
      });
    });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      itemCount: group.items.length,
      lastModifiedAt: Math.max(0, ...group.items.map((item) => getAlbumSortTimestamp(item)))
    }))
    .sort((left, right) => {
      if (right.lastModifiedAt !== left.lastModifiedAt) {
        return right.lastModifiedAt - left.lastModifiedAt;
      }
      return left.name.localeCompare(right.name);
    });
}

function getAvailableVideoAlbumNames(items = getAccessibleItems()) {
  return buildVideoAlbumSummaries(items)
    .filter((entry) => !entry.isUngrouped)
    .map((entry) => entry.name);
}

function getAlbumSortTimestamp(item) {
  const value = item?.takenAt || item?.createdAt || item?.updatedAt || '';
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildPreviewAlbumEntries(items = getAccessibleItems()) {
  const selectedItems = getSelectedItems(items);
  const selectedAlbumKeys = new Set(
    selectedItems.flatMap((item) => resolveCollectionAlbums(item).map((albumName) => normalizeAlbumKey(albumName)))
  );
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
    const albums = resolveCollectionAlbums(item);
    if (!albums.length) { return; }
    albums.forEach((albumName) => {
      const group = ensureGroup(albumName);
      if (!group) { return; }
      group.items.push(item);
      group.lastModifiedAt = Math.max(group.lastModifiedAt, getAlbumSortTimestamp(item));
    });
  });

  return [...groups.values()]
    .map((group) => {
      const { item: coverItem } = findAlbumCoverItem(group.name, group.items);
      return {
        name: group.name,
        itemCount: group.items.length,
        coverUrl: normalizeText(coverItem?.thumbnailUrl || coverItem?.posterUrl || coverItem?.sourceUrl || ''),
        lastModifiedAt: group.lastModifiedAt,
        scope: group.scope,
        selected: selectedAlbumKeys.has(normalizeAlbumKey(group.name))
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
      isPrivateAlbum: false,
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

function getActivePlaylistName() {
  return state.primaryFilter === 'Music' ? normalizeText(state.activePlaylistName) : '';
}

function isAlbumTargetedPhotoPickerActive() {
  return Boolean(getAlbumSelectionTarget(state))
    && state.primaryFilter === 'Collections'
    && normalizeText(state.activeAlbumName) === getAlbumSelectionTarget(state);
}

function getViewportLayoutWidth() {
  const docWidth = typeof document !== 'undefined' ? Number(document.documentElement?.clientWidth || 0) : 0;
  const winWidth = typeof window !== 'undefined' ? Number(window.innerWidth || 0) : 0;
  return Math.max(docWidth, winWidth, Number(state.layoutWidth || 0), 0);
}

function isMobileLayout() {
  return getViewportLayoutWidth() <= 960;
}

function normalizeRoutePrimaryFilter(value) {
  const normalized = normalizeText(value);
  return ['Photos', 'Collections', 'Music', 'Mind', 'Bin'].includes(normalized)
    ? normalized
    : 'Photos';
}

function normalizeRouteSecondaryFilter(value) {
  const normalized = normalizeText(value);
  return ['', 'Videos', 'Documents', 'Favourites', 'TODO'].includes(normalized)
    ? normalized
    : '';
}

function isMobileMindComposerFocused() {
  if (!isMobileLayout() || state.primaryFilter !== 'Mind') {
    return false;
  }
  const activeElement = document.activeElement;
  return activeElement instanceof HTMLElement
    && activeElement.dataset.mindInput === 'message';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeCssIdentifier(value) {
  const normalized = String(value || '');
  if (window.CSS && typeof window.CSS.escape === 'function') {
    return window.CSS.escape(normalized);
  }
  return normalized.replace(/["\\]/g, '\\$&');
}

function escapeDraftForEditor(value) {
  return escapeHtml(String(value || '')).replace(/\n/g, '<br>');
}

function readMindDraftFromEditor(element) {
  if (!(element instanceof HTMLElement)) {
    return '';
  }
  const raw = element.innerText ?? element.textContent ?? '';
  return raw.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ');
}

function placeCaretAtEnd(element) {
  if (!(element instanceof HTMLElement)) {
    return;
  }
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function focusMindComposer() {
  const input = refs.root?.querySelector('.cml-mind__input');
  if (!(input instanceof HTMLElement)) {
    return;
  }
  input.focus();
  if (input.isContentEditable) {
    placeCaretAtEnd(input);
  }
}

function shouldRestoreComposerFocus() {
  return !(isMobileLayout() && state.primaryFilter === 'Mind');
}

function shouldBlurComposerAfterSend() {
  return isMobileMindRouteActive();
}

function syncMindDraftEditorValue() {
  const input = refs.root?.querySelector('.cml-mind__input');
  if (!(input instanceof HTMLElement) || !input.isContentEditable) {
    return;
  }
  const nextHtml = escapeDraftForEditor(state.mindDraft);
  if ((input.innerHTML || '') !== nextHtml) {
    input.innerHTML = nextHtml;
  }
}

function isMobileMindRouteActive() {
  return state.primaryFilter === 'Mind' && isMobileLayout();
}

function handleCompositionStart(event) {
  if (event.target instanceof HTMLInputElement && event.target.hasAttribute('data-films-search-input')) {
    state.filmSearchComposing = true;
    clearPendingFilmSearch();
    return;
  }
  if (event.target instanceof HTMLInputElement && event.target.hasAttribute('data-film-library-search-input')) {
    state.filmLibrarySearchComposing = true;
    return;
  }
  if (!(event.target instanceof HTMLElement) || event.target.dataset.mindInput !== 'message') {
    return;
  }
  state.mindComposerComposing = true;
}

function handleCompositionEnd(event) {
  if (event.target instanceof HTMLInputElement && event.target.hasAttribute('data-films-search-input')) {
    state.filmSearchComposing = false;
    clearPendingFilmSearch();
    void searchFilms({ query: event.target.value });
    return;
  }
  if (event.target instanceof HTMLInputElement && event.target.hasAttribute('data-film-library-search-input')) {
    state.filmLibrarySearchComposing = false;
    state.filmLibraryQuery = event.target.value;
    render();
    return;
  }
  if (!(event.target instanceof HTMLElement) || event.target.dataset.mindInput !== 'message') {
    return;
  }
  state.mindComposerComposing = false;
  state.mindDraft = event.target.isContentEditable
    ? readMindDraftFromEditor(event.target)
    : event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
      ? event.target.value
      : state.mindDraft;
}

function syncMobileMindInputIsolation() {
  if (!(refs.root instanceof HTMLElement)) {
    return;
  }
  const mobileMindShell = refs.root.querySelector('.cml-mind--mobile-fixed');
  const shouldIsolate = isMobileMindRouteActive() && mobileMindShell instanceof HTMLElement;
  const restoreInputState = (element) => {
    if (!(element instanceof HTMLElement) || !('dataset' in element)) {
      return;
    }
    if (element.dataset.cmlMobileMindDisabled !== '1') {
      return;
    }
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      element.disabled = element.dataset.cmlMobileMindPrevDisabled === '1';
    }
    if (element.dataset.cmlMobileMindPrevTabindex === 'unset') {
      element.removeAttribute('tabindex');
    } else if (element.dataset.cmlMobileMindPrevTabindex) {
      element.setAttribute('tabindex', element.dataset.cmlMobileMindPrevTabindex);
    }
    if (element.dataset.cmlMobileMindPrevContenteditable) {
      element.setAttribute('contenteditable', element.dataset.cmlMobileMindPrevContenteditable);
    } else if (element.hasAttribute('contenteditable')) {
      element.removeAttribute('contenteditable');
    }
    delete element.dataset.cmlMobileMindDisabled;
    delete element.dataset.cmlMobileMindPrevDisabled;
    delete element.dataset.cmlMobileMindPrevTabindex;
    delete element.dataset.cmlMobileMindPrevContenteditable;
  };
  const stashInputState = (element) => {
    if (!(element instanceof HTMLElement) || !('dataset' in element)) {
      return;
    }
    if (element.dataset.cmlMobileMindDisabled === '1') {
      return;
    }
    element.dataset.cmlMobileMindDisabled = '1';
    element.dataset.cmlMobileMindPrevTabindex = element.getAttribute('tabindex') ?? 'unset';
    element.dataset.cmlMobileMindPrevContenteditable = element.getAttribute('contenteditable') ?? '';
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      element.dataset.cmlMobileMindPrevDisabled = element.disabled ? '1' : '0';
      element.disabled = true;
    }
    if (element.hasAttribute('contenteditable')) {
      element.setAttribute('contenteditable', 'false');
    }
    element.setAttribute('tabindex', '-1');
  };
  const toggleContainerInert = (selector, inert) => {
    refs.root.querySelectorAll(selector).forEach((element) => {
      if (!(element instanceof HTMLElement)) {
        return;
      }
      element.toggleAttribute('inert', inert);
      if (inert) {
        element.setAttribute('aria-hidden', 'true');
      } else {
        element.removeAttribute('aria-hidden');
      }
    });
  };

  refs.root.querySelectorAll('input, textarea, select, [contenteditable], [tabindex]').forEach((element) => {
    if (!(element instanceof HTMLElement)) {
      return;
    }
    const insideMobileMind = element.closest('.cml-mind--mobile-fixed');
    if (shouldIsolate && !insideMobileMind) {
      stashInputState(element);
    } else {
      restoreInputState(element);
    }
  });

  toggleContainerInert('.cml-sidebar, .cml-topbar, .cml-mobile-nav', shouldIsolate);

  const activeElement = document.activeElement;
  if (shouldIsolate && activeElement instanceof HTMLElement && !activeElement.closest('.cml-mind--mobile-fixed')) {
    activeElement.blur();
  }
}

function syncViewportHeightVar({ force = false } = {}) {
  if (!(refs.root instanceof HTMLElement)) {
    return;
  }
  const viewport = window.visualViewport;
  const nextHeight = Math.round(
    viewport?.height
      || window.innerHeight
      || document.documentElement.clientHeight
      || 0
  );
  const nextWidth = Math.round(
    viewport?.width
      || window.innerWidth
      || document.documentElement.clientWidth
      || 0
  );
  if (nextHeight <= 0) {
    return;
  }
  const keyboardInset = (() => {
    if (!isMobileMindRouteActive()) {
      return 0;
    }
    const baselineHeight = Math.max(
      stableAppViewportHeight || 0,
      Math.round(window.innerHeight || 0),
      Math.round(document.documentElement.clientHeight || 0)
    );
    if (baselineHeight <= 0) {
      return 0;
    }
    const viewportBottom = Math.round((viewport?.height || nextHeight) + (viewport?.offsetTop || 0));
    return Math.max(0, baselineHeight - viewportBottom);
  })();
  refs.root.style.setProperty('--cml-keyboard-inset', `${keyboardInset}px`);
  const keyboardLikeResize = !force
    && isMobileMindComposerFocused()
    && stableAppViewportHeight > 0
    && nextHeight < stableAppViewportHeight - 120
    && Math.abs(nextWidth - stableAppViewportWidth) < 40;
  if (keyboardLikeResize) {
    return;
  }
  refs.root.style.setProperty('--cml-app-height', `${nextHeight}px`);
  stableAppViewportHeight = nextHeight;
  stableAppViewportWidth = nextWidth;
}

function lockDocumentScroll() {
  lockedDocumentScrollY = window.scrollY || window.pageYOffset || 0;
  document.documentElement.classList.add('codex-media-library-active');
  document.body.classList.add('codex-media-library-active');
  document.documentElement.style.overflow = 'hidden';
  document.documentElement.style.overscrollBehavior = 'none';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${lockedDocumentScrollY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
}

function unlockDocumentScroll() {
  document.documentElement.classList.remove('codex-media-library-active');
  document.body.classList.remove('codex-media-library-active');
  document.documentElement.style.overflow = '';
  document.documentElement.style.overscrollBehavior = '';
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  window.scrollTo(0, lockedDocumentScrollY || 0);
}

function stabilizeMobileMindViewport() {
  if (!isMobileMindRouteActive()) {
    return;
  }
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function rememberMobileMindReturnRoute() {
  state.mobileMindReturnPrimary = state.privateViewOpen ? 'Photos' : state.primaryFilter;
  state.mobileMindReturnSecondary = state.privateViewOpen ? '' : state.secondaryFilter;
  state.mobileMindReturnPrivate = Boolean(state.privateViewOpen);
}

function ensureDocsFolders() {
  if (!(state.docsFolders instanceof Set)) {
    state.docsFolders = new Set();
  }
  return state.docsFolders;
}

function leaveMobileMindView() {
  const targetPrimary = state.mobileMindReturnPrivate
    ? 'Photos'
    : normalizeRoutePrimaryFilter(state.mobileMindReturnPrimary || 'Photos');
  const targetSecondary = state.mobileMindReturnPrivate
    ? ''
    : normalizeRouteSecondaryFilter(state.mobileMindReturnSecondary || '');
  handleMindViewTransition(targetPrimary, targetSecondary);
  state.primaryFilter = targetPrimary;
  state.secondaryFilter = targetSecondary;
  state.videoCategoryFilter = '';
  state.activeAlbumName = '';
  state.storagePanelOpen = false;
  state.previewId = null;
  state.selectedIds.clear();
  state.binSelectedIds.clear();
  resetAddToTargetModes(state);
  resetSearchQuery();
  clearPrivateViewState();
  if (state.mobileMindReturnPrivate) {
    state.privateViewOpen = true;
    state.privateRouteUnlocked = false;
    state.privatePasswordDraft = '';
    state.privatePasswordError = '';
  }
  resetLoadedCount();
  pushNavigationHash();
  patchSidebarActive();
  scheduleRender();
  if (state.secondaryFilter === 'Documents') {
    ensureDocsFolders();
  }
  if (state.primaryFilter === 'Bin') {
    void fetchBinItems();
  }
}

function resetSearchQuery() {
  if (pendingSearchApplyTimer) {
    window.clearTimeout(pendingSearchApplyTimer);
    pendingSearchApplyTimer = 0;
  }
  state.searchQuery = '';
  state.searchDraft = '';
  state.mobileAlbumSearchOpen = false;
}

function restoreSearchInputFocus(selectionStart = null, selectionEnd = null) {
  const searchInput = refs.root?.querySelector('.cml-sidebar__search-input, .cml-topbar__search-input');
  if (!(searchInput instanceof HTMLInputElement)) {
    return;
  }
  searchInput.focus({ preventScroll: true });
  if (Number.isInteger(selectionStart) && Number.isInteger(selectionEnd)) {
    searchInput.setSelectionRange(selectionStart, selectionEnd);
  }
}

function applySearchQuery(nextQuery, { preserveFocus = false, selectionStart = null, selectionEnd = null } = {}) {
  if (pendingSearchApplyTimer) {
    window.clearTimeout(pendingSearchApplyTimer);
    pendingSearchApplyTimer = 0;
  }
  state.searchQuery = normalizeText(nextQuery);
  state.searchDraft = nextQuery;
  // When searching inside Documents view, reset directory so results
  // from all folders are visible instead of only the current subfolder.
  if (state.secondaryFilter === 'Documents' && state.searchQuery) {
    state.docsCurrentDir = '';
  }
  clearSelection({ shouldRender: false });
  resetLoadedCount();
  render();
  if (preserveFocus) {
    window.requestAnimationFrame(() => {
      restoreSearchInputFocus(selectionStart, selectionEnd);
    });
  }
}

function scheduleSearchQueryApply(nextQuery, { selectionStart = null, selectionEnd = null } = {}) {
  if (pendingSearchApplyTimer) {
    window.clearTimeout(pendingSearchApplyTimer);
  }
  pendingSearchApplyTimer = window.setTimeout(() => {
    pendingSearchApplyTimer = 0;
    applySearchQuery(nextQuery, {
      preserveFocus: true,
      selectionStart,
      selectionEnd
    });
  }, SEARCH_INPUT_DEBOUNCE_MS);
}

function matchesSearchQuery(item, query) {
  if (!query) {
    return true;
  }

  const fileName = normalizeText(item.label);
  const fileExt = fileName.includes('.') ? fileName.split('.').pop() : '';
  const directory = normalizeText(item.directory || '');
  const directoryParts = directory ? directory.split('/').filter(Boolean) : [];
  const albumNames = resolveCollectionAlbums(item);
  const haystack = [
    item.type,
    item.videoCategory,
    item.album,
    ...albumNames,
    item.label,
    fileExt,
    item.sourceId,
    item.audioTitle,
    item.audioArtist,
    item.audioAlbum,
    item.location,
    item.exif?.camera?.make,
    item.exif?.camera?.model,
    item.exif?.camera?.lens,
    item.year,
    item.monthLabel,
    item.day,
    item.timelineLabel,
    item.description,
    directory,
    ...directoryParts,
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

async function fetchMovieJson(url, options = {}) {
  const response = await apiFetch(url, options);
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

function normalizeMindText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

function normalizeMindSettings(settings = {}) {
  const defaults = createDefaultMindSettings();
  const preset = normalizeText(settings.backgroundPreset);
  const allowedPresets = new Set(['ios-sky', 'sunset-glow', 'seafoam', 'midnight', 'paper']);
  const backgroundPosition = normalizeText(settings.backgroundPosition).toLowerCase();
  const allowedBackgroundPositions = new Set(MIND_BACKGROUND_POSITIONS);
  const sendButtonColor = normalizeText(settings.sendButtonColor).toLowerCase();
  const allowedSendButtonColors = new Set(['default', 'blue', 'green', 'yellow', 'pink', 'orange', 'purple', 'black']);
  const normalizeImage = (value) => {
    const nextValue = normalizeText(value);
    return /^data:image\//i.test(nextValue) ? nextValue : '';
  };
  return {
    contactName: normalizeText(settings.contactName) || defaults.contactName,
    contactAvatarData: normalizeImage(settings.contactAvatarData),
    backgroundPreset: allowedPresets.has(preset) ? preset : defaults.backgroundPreset,
    backgroundImageData: normalizeImage(settings.backgroundImageData),
    backgroundPhotoId: normalizeText(settings.backgroundPhotoId),
    backgroundPosition: allowedBackgroundPositions.has(backgroundPosition) ? backgroundPosition : defaults.backgroundPosition,
    sendButtonColor: allowedSendButtonColors.has(sendButtonColor) ? sendButtonColor : defaults.sendButtonColor
  };
}

function normalizeMindMessage(rawMessage = {}, { forceRight = false } = {}) {
  const text = normalizeMindText(rawMessage.text);
  if (!text) {
    return null;
  }
  const source = String(rawMessage.source || '').toLowerCase() === 'telegram' ? 'telegram' : 'web';
  const phase = source === 'web' && String(rawMessage.phase || '').toLowerCase() === 'fresh'
    ? 'fresh'
    : 'mirrored';
  const timestamp = Number(rawMessage.createdAt);
  return {
    id: normalizeText(rawMessage.id) || `mind-${hashString(`${text}-${timestamp || Date.now()}`)}`,
    text,
    source,
    phase,
    side: forceRight || (source === 'web' && phase === 'fresh') ? 'right' : 'left',
    createdAt: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now(),
    updatedAt: Number(rawMessage.updatedAt) || 0,
    channelName: normalizeText(rawMessage.channelName),
    sourceRef: normalizeText(rawMessage.sourceRef)
  };
}

function isMindMessageStickyForVisit(rawMessage = {}, stickyMessages = mindVisitStickyMessages) {
  if (!stickyMessages.length) {
    return false;
  }
  const source = String(rawMessage.source || '').toLowerCase() === 'telegram' ? 'telegram' : 'web';
  if (source !== 'web') {
    return false;
  }
  const id = normalizeText(rawMessage.id);
  const text = normalizeMindText(rawMessage.text);
  const createdAt = Number(rawMessage.createdAt);
  return stickyMessages.some((message) => {
    if (id && message.id && message.id === id) {
      return true;
    }
    if (!text || message.text !== text) {
      return false;
    }
    if (!Number.isFinite(createdAt) || !Number.isFinite(message.createdAt)) {
      return true;
    }
    return Math.abs(createdAt - message.createdAt) <= 15000;
  });
}

function syncMindVisitStickyMessages(messages = state.mindMessages) {
  mindVisitStickyMessages = safeArray(messages)
    .filter((message) => message?.source === 'web' && message?.side === 'right')
    .map((message) => ({
      id: normalizeText(message.id),
      text: normalizeMindText(message.text),
      createdAt: Number(message.createdAt) || 0
    }));
}

function clearMindVisitStickyMessages() {
  mindVisitStickyMessages = [];
}

function sortMindMessages(messages = []) {
  return messages.slice().sort((left, right) => {
    if (left.createdAt !== right.createdAt) {
      return left.createdAt - right.createdAt;
    }
    return left.id.localeCompare(right.id);
  });
}

function createDefaultMindSettings() {
  return {
    contactName: 'Mind',
    contactAvatarData: '',
    backgroundPreset: 'ios-sky',
    backgroundImageData: '',
    backgroundPhotoId: '',
    backgroundPosition: 'center center',
    sendButtonColor: 'green'
  };
}

function createMindSettingsDraft(settings = {}) {
  return {
    ...createDefaultMindSettings(),
    ...settings
  };
}

function applyMindState(payload) {
  const stickyMessages = mindVisitStickyMessages.slice();
  state.mindSettings = normalizeMindSettings(payload?.settings || {});
  state.mindSettingsDraft = createMindSettingsDraft(state.mindSettings);
  persistMindSettings(state.mindSettings);
  state.mindMessages = sortMindMessages(safeArray(payload?.messages)
    .map((message) => normalizeMindMessage(message, {
      forceRight: isMindMessageStickyForVisit(message, stickyMessages)
    }))
    .filter(Boolean));
  state.mindHydrated = true;
  syncMindVisitStickyMessages(state.mindMessages);
}

function enqueueMindMutation(task) {
  const queuedTask = mindMutationQueue
    .catch(() => undefined)
    .then(task);
  mindMutationQueue = queuedTask.then(
    () => undefined,
    () => undefined
  );
  return queuedTask;
}

function hasFreshMindMessages() {
  return state.mindMessages.some((message) => message.source === 'web' && message.phase === 'fresh');
}

async function loadMindState({ forceRender = false, mirrorAfterLoad = false } = {}) {
  if (mindStatePromise) {
    return mindStatePromise;
  }
  state.mindLoading = true;
  mindStatePromise = fetchJson('/api/manage/mind')
    .then((payload) => {
      applyMindState(payload);
      state.mindLastLoadedAt = Date.now();
      return payload;
    })
    .then((payload) => {
      if (!mirrorAfterLoad) {
        return payload;
      }
      return Promise.resolve(mirrorMindMessagesIfNeeded())
        .then((mirroredPayload) => mirroredPayload || payload);
    })
    .catch((error) => {
      console.error('[media-library] failed to load Mind state', error);
      showToast(error.message || 'Failed to load Mind');
      throw error;
    })
    .finally(() => {
      state.mindLoading = false;
      mindStatePromise = null;
      if (forceRender && refs.root && state.primaryFilter === 'Mind') {
        render();
        scrollMindToBottom({ force: false });
      }
    });
  return mindStatePromise;
}

function shouldRefreshMindOnEnter() {
  if (mindStatePromise || state.mindLoading) {
    return false;
  }
  if (!state.mindLastLoadedAt) {
    return true;
  }
  return (Date.now() - state.mindLastLoadedAt) > MIND_STATE_FRESH_MS;
}

function scrollMindToBottom({ force = false } = {}) {
  if (!refs.scrollRegion || state.primaryFilter !== 'Mind') {
    return;
  }
  const target = refs.scrollRegion.scrollHeight;
  refs.scrollRegion.scrollTo({
    top: target,
    behavior: force ? 'auto' : 'smooth'
  });
}

async function sendMindMessage() {
  const text = normalizeMindText(state.mindDraft);
  if (!text) {
    return;
  }
  const activeComposer = document.activeElement instanceof HTMLElement
    && document.activeElement.dataset.mindInput === 'message'
      ? document.activeElement
      : null;
  const optimisticMessage = normalizeMindMessage({
    id: `mind-local-${Date.now()}`,
    text,
    source: 'web',
    phase: 'fresh',
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  state.mindDraft = '';
  if (shouldBlurComposerAfterSend() && activeComposer instanceof HTMLElement) {
    activeComposer.blur();
  }
  if (optimisticMessage) {
    state.mindMessages = [...state.mindMessages, optimisticMessage];
    syncMindVisitStickyMessages(state.mindMessages);
  }
  if (refs.root) {
    render();
    scrollMindToBottom({ force: true });
    if (shouldRestoreComposerFocus()) {
      focusMindComposer();
    }
  }
  void enqueueMindMutation(() => postJson('/api/manage/mind', { text }))
    .then((payload) => {
      applyMindState(payload);
    })
    .catch((error) => {
      state.mindMessages = state.mindMessages.filter((message) => message.id !== optimisticMessage?.id);
      syncMindVisitStickyMessages(state.mindMessages);
      if (!normalizeMindText(state.mindDraft)) {
        state.mindDraft = text;
      }
      showToast(error.message || 'Failed to send Mind message');
    })
    .finally(() => {
      if (refs.root) {
        render();
        scrollMindToBottom({ force: false });
        if (shouldRestoreComposerFocus()) {
          focusMindComposer();
        }
      }
    });
}

function setMindSettingsOpen(nextOpen) {
  const nextValue = Boolean(nextOpen);
  if (state.mindSettingsOpen === nextValue) {
    return;
  }
  state.mindSettingsOpen = nextValue;
  if (nextValue) {
    state.mindSettingsDraft = createMindSettingsDraft(state.mindSettings);
  }
  if (refs.root) {
    render();
    if (nextValue) {
      window.setTimeout(() => {
        const input = refs.root?.querySelector('[data-mind-settings-field="contactName"]');
        if (input instanceof HTMLInputElement) {
          input.focus();
          input.select();
        }
      }, 30);
    }
  }
}

async function saveMindSettings() {
  if (state.mindSettingsBusy) {
    return;
  }
  const previousSettings = normalizeMindSettings(state.mindSettings);
  const attemptedDraft = createMindSettingsDraft(state.mindSettingsDraft);
  const optimisticSettings = normalizeMindSettings(state.mindSettingsDraft);
  state.mindSettings = optimisticSettings;
  state.mindSettingsDraft = createMindSettingsDraft(optimisticSettings);
  persistMindSettings(state.mindSettings);
  state.mindSettingsOpen = false;
  state.mindSettingsBusy = true;
  if (refs.root) {
    render();
  }
  try {
    const payload = await enqueueMindMutation(() => postJson('/api/manage/mind', {
      action: 'update-settings',
      settings: state.mindSettingsDraft
    }));
    applyMindState(payload);
  } catch (error) {
    state.mindSettings = previousSettings;
    state.mindSettingsDraft = attemptedDraft;
    persistMindSettings(state.mindSettings);
    state.mindSettingsOpen = true;
    showToast(error.message || 'Failed to save Mind settings');
  } finally {
    state.mindSettingsBusy = false;
    if (refs.root) {
      render();
      scrollMindToBottom({ force: false });
    }
  }
}

async function deleteMindMessageById(messageId) {
  const normalizedId = normalizeText(messageId);
  if (!normalizedId || state.mindDeletingIds.has(normalizedId)) {
    return;
  }
  const deletedMessage = state.mindMessages.find((message) => message.id === normalizedId) || null;
  state.mindMessages = state.mindMessages.filter((message) => message.id !== normalizedId);
  syncMindVisitStickyMessages(state.mindMessages);
  state.mindDeletingIds.add(normalizedId);
  if (refs.root) {
    render();
    scrollMindToBottom({ force: false });
  }
  try {
    const payload = await enqueueMindMutation(() => postJson('/api/manage/mind', {
      action: 'delete-message',
      id: normalizedId
    }));
    applyMindState(payload);
    showToast('Message deleted', 'success');
  } catch (error) {
    if (deletedMessage && !state.mindMessages.some((message) => message.id === normalizedId)) {
      state.mindMessages = sortMindMessages([...state.mindMessages, deletedMessage]);
      syncMindVisitStickyMessages(state.mindMessages);
    }
    showToast(error.message || 'Failed to delete message');
  } finally {
    state.mindDeletingIds.delete(normalizedId);
    if (refs.root) {
      render();
      scrollMindToBottom({ force: false });
    }
  }
}

async function handleMindAssetSelection(field, file) {
  if (!file) {
    return;
  }
  if (!file.type.startsWith('image/')) {
    showToast('Please choose an image file');
    return;
  }
  if (file.size > 1.5 * 1024 * 1024) {
    showToast('Please choose an image smaller than 1.5 MB');
    return;
  }
  try {
    const dataUrl = await readFileAsDataUrl(file);
    state.mindSettingsDraft = {
      ...state.mindSettingsDraft,
      [field]: dataUrl,
      ...(field === 'backgroundImageData' ? { backgroundPhotoId: '' } : {})
    };
    render();
  } catch (error) {
    showToast(error.message || 'Failed to read image');
  }
}

function getMindWallpaperPhotoChoices(limit = 12) {
  return getAccessibleItems(getAllItems())
    .filter((item) => item?.type === 'photo')
    .sort((left, right) => {
      const leftTime = Number(left?.takenAt) || Number(left?.timestamp) || 0;
      const rightTime = Number(right?.takenAt) || Number(right?.timestamp) || 0;
      if (leftTime !== rightTime) {
        return rightTime - leftTime;
      }
      return String(right?.id || '').localeCompare(String(left?.id || ''));
    })
    .slice(0, Math.max(1, limit));
}

function resolveMindWallpaperItem(settings = state.mindSettings) {
  const photoId = normalizeText(settings?.backgroundPhotoId);
  if (!photoId) {
    return null;
  }
  return getAccessibleItems(getAllItems()).find((item) => item?.id === photoId && item?.type === 'photo') || null;
}

function resolveMindWallpaperUrl(settings = state.mindSettings) {
  const wallpaperItem = resolveMindWallpaperItem(settings);
  if (wallpaperItem) {
    return normalizeText(wallpaperItem.sourceUrl || wallpaperItem.thumbnailUrl || '');
  }
  return normalizeText(settings?.backgroundImageData);
}

function applyMindSendButtonTheme(button, tone) {
  if (!(button instanceof HTMLElement)) {
    return;
  }
  const resolvedTone = MIND_SEND_BUTTON_COLORS.includes(tone) ? tone : createDefaultMindSettings().sendButtonColor;
  const theme = MIND_SEND_BUTTON_THEMES[resolvedTone] || MIND_SEND_BUTTON_THEMES.green;
  button.style.setProperty('--cml-mind-send-bg', theme.background);
  button.style.setProperty('--cml-mind-send-shadow', theme.shadow);
  button.style.setProperty('--cml-mind-send-text', theme.text);
}

function patchMindDraftPreview() {
  if (!refs.root || !state.mindSettingsOpen) {
    return false;
  }
  const section = refs.root.querySelector('.cml-mind');
  if (!(section instanceof HTMLElement)) {
    return false;
  }
  const draftSettings = normalizeMindSettings(state.mindSettingsDraft);
  MIND_BACKGROUND_PRESETS.forEach((preset) => {
    section.classList.toggle(`cml-mind--${preset}`, draftSettings.backgroundPreset === preset);
  });
  MIND_SEND_BUTTON_COLORS.forEach((tone) => {
    section.classList.toggle(`cml-mind--send-${tone}`, draftSettings.sendButtonColor === tone);
  });
  applyMindSendButtonTheme(section.querySelector('.cml-mind__send'), draftSettings.sendButtonColor);
  const wallpaperUrl = resolveMindWallpaperUrl(draftSettings);
  if (wallpaperUrl) {
    const escapedUrl = String(wallpaperUrl).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    section.style.setProperty('--cml-mind-wallpaper-image', `url("${escapedUrl}")`);
  } else {
    section.style.removeProperty('--cml-mind-wallpaper-image');
  }
  section.style.setProperty('--cml-mind-wallpaper-position', draftSettings.backgroundPosition || createDefaultMindSettings().backgroundPosition);
  if (!section.getAttribute('style')?.trim()) {
    section.removeAttribute('style');
  }
  refs.root.querySelectorAll('[data-action="set-mind-background-preset"]').forEach((button) => {
    const active = button instanceof HTMLElement && button.dataset.value === draftSettings.backgroundPreset;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  refs.root.querySelectorAll('[data-action="set-mind-background-position"]').forEach((button) => {
    const active = button instanceof HTMLElement && button.dataset.value === draftSettings.backgroundPosition;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  refs.root.querySelectorAll('[data-action="set-mind-send-button-color"]').forEach((button) => {
    const active = button instanceof HTMLElement && button.dataset.value === draftSettings.sendButtonColor;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  refs.root.querySelectorAll('[data-action="set-mind-wallpaper-photo"]').forEach((button) => {
    const active = button instanceof HTMLElement && button.dataset.id === draftSettings.backgroundPhotoId;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  return true;
}

async function mirrorMindMessagesIfNeeded() {
  if (mindMirrorPromise || !hasFreshMindMessages()) {
    return mindMirrorPromise;
  }
  mindMirrorPromise = enqueueMindMutation(() => postJson('/api/manage/mind', { action: 'mirror' }))
    .then((payload) => {
      applyMindState(payload);
      return payload;
    })
    .catch((error) => {
      console.error('[media-library] failed to mirror Mind messages', error);
      throw error;
    })
    .finally(() => {
      mindMirrorPromise = null;
    });
  return mindMirrorPromise;
}

function isMindViewActive() {
  return state.primaryFilter === 'Mind';
}

function handleMindViewTransition(nextPrimary, nextSecondary = state.secondaryFilter) {
  const enteringMind = nextPrimary === 'Mind' && !nextSecondary;
  const leavingMind = state.primaryFilter === 'Mind' && (!enteringMind || nextPrimary !== 'Mind');
  if (leavingMind) {
    clearMindVisitStickyMessages();
  }
  if (enteringMind) {
    const shouldForceMindRender = state.mindMessages.length === 0;
    if (shouldRefreshMindOnEnter()) {
      void loadMindState({ forceRender: shouldForceMindRender, mirrorAfterLoad: true });
    } else if (hasFreshMindMessages()) {
      void mirrorMindMessagesIfNeeded();
    }
    window.setTimeout(() => scrollMindToBottom({ force: true }), 40);
  }
}

function handleDocumentVisibilityChange() {
  // Mind fresh messages should not auto-mirror on tab visibility changes.
}

function handleWindowPageHide() {
  // Mind fresh messages should not auto-mirror on page hide.
}

async function loadAdminPanelData() {
  if (state.adminPanelLoading) {
    return;
  }

  state.adminPanelLoading = true;
  state.adminPanelError = '';
  state.adminMigrationError = '';
  patchAdminOverlays();

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
    state.adminProfileDraft = hydrateAdminProfileDraft(account, normalizeText);
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
    patchAdminOverlays();
  }
}

async function refreshAdminMigrationStatus({ notify = false } = {}) {
  if (state.adminMigrationLoading) {
    return;
  }

  state.adminMigrationLoading = true;
  state.adminMigrationError = '';
  patchAdminOverlays();

  try {
    state.adminMigrationStatus = await fetchJson('/api/manage/migrate/status');
    if (notify) {
      showToast('Migration status refreshed', 'success');
    }
  } catch (error) {
    state.adminMigrationError = error.message || 'Failed to load migration status';
  } finally {
    state.adminMigrationLoading = false;
    patchAdminOverlays();
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
  patchAdminOverlays();

  try {
    state.adminOrphanScanResult = await fetchJson(`/api/manage/migrate/scan-orphan-files?limit=${finalLimit}`);
    const total = Number(state.adminOrphanScanResult?.total) || 0;
    showToast(total > 0 ? `Found ${total} orphan Telegram records` : 'No orphan Telegram records found', 'success');
  } catch (error) {
    state.adminOrphanScanError = error.message || 'Failed to scan orphan Telegram files';
  } finally {
    state.adminOrphanScanLoading = false;
    patchAdminOverlays();
  }
}

async function refreshAdminTelegram() {
  if (state.adminTelegramLoading) {
    return;
  }
  state.adminTelegramLoading = true;
  state.adminTelegramError = '';
  patchAdminOverlays();

  try {
    const data = await fetchJson('/api/manage/telegram-sync/status');
    const items = Array.isArray(data.data) ? data.data : (data.data ? [data.data] : []);
    state.adminTelegramChannels = items;
  } catch (error) {
    state.adminTelegramError = error.message || 'Failed to load Telegram status';
  } finally {
    state.adminTelegramLoading = false;
    patchAdminOverlays();
  }
}

async function adminTelegramAction(action, channelName) {
  if (state.adminTelegramBusy) {
    return;
  }
  state.adminTelegramBusy = true;
  state.adminTelegramError = '';
  patchAdminOverlays();

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
    patchAdminOverlays();
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
  writeSessionFlag(PRIVATE_ALBUM_SESSION_KEY, false);
  state.privateRouteUnlocked = false;
  clearPrivateViewState();
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
      const topbarPatched = patchTopbarStorageTrigger();
      if (state.adminPanelOpen || state.storagePanelOpen) {
        patchAdminOverlays();
      } else if (!topbarPatched) {
        render();
      }
    }
    return;
  }

  if (forceRender && refs.root) {
    const topbarPatched = patchTopbarStorageTrigger();
    if (state.adminPanelOpen || state.storagePanelOpen) {
      patchAdminOverlays();
    } else if (!topbarPatched) {
      render();
    }
  }
}

async function runAdminRecoveryTask(kind, { dryRun = false } = {}) {
  const configs = {
    captureTimes: {
      loadingKey: 'adminRecoverCaptureTimesLoading',
      errorKey: 'adminRecoverCaptureTimesError',
      resultKey: 'adminRecoverCaptureTimesResult',
      endpoint: '/api/manage/migrate/recover-capture-times',
      buildBody: () => ({ limit: 20, dryRun }),
      successLabel: dryRun ? 'Capture-time dry run finished' : 'Capture-time recovery finished',
    },
    tgFileIds: {
      loadingKey: 'adminRecoverTgFileIdsLoading',
      errorKey: 'adminRecoverTgFileIdsError',
      resultKey: 'adminRecoverTgFileIdsResult',
      endpoint: '/api/manage/migrate/recover-tg-file-ids',
      buildBody: () => ({
        limit: 20,
        dryRun,
        targetChatId: normalizeText(state.adminRecoveryTargetChatId),
        ...(() => {
          const matches = parseAdminRecoveryMatches(state.adminRecoveryMatchesText, normalizeText);
          return matches.length ? { matches } : {};
        })(),
      }),
      validate: () => {
        if (!normalizeText(state.adminRecoveryTargetChatId)) {
          return 'Target chat ID is required for Telegram file ID recovery';
        }
        try {
          parseAdminRecoveryMatches(state.adminRecoveryMatchesText);
          return true;
        } catch (error) {
          return error.message || 'Recovery match lines are invalid';
        }
      },
      successLabel: dryRun ? 'Telegram file ID dry run finished' : 'Telegram file ID recovery finished',
    },
    tgThumbnails: {
      loadingKey: 'adminRecoverTgThumbnailsLoading',
      errorKey: 'adminRecoverTgThumbnailsError',
      resultKey: 'adminRecoverTgThumbnailsResult',
      endpoint: '/api/manage/migrate/recover-tg-thumbnails',
      buildBody: () => ({
        limit: 20,
        dryRun,
        targetChatId: normalizeText(state.adminRecoveryTargetChatId),
      }),
      validate: () => normalizeText(state.adminRecoveryTargetChatId) ? true : 'Target chat ID is required for Telegram thumbnail recovery',
      successLabel: dryRun ? 'Telegram thumbnail dry run finished' : 'Telegram thumbnail recovery finished',
    },
  };

  const config = configs[kind];
  if (!config || state[config.loadingKey]) {
    return;
  }

  if (typeof config.validate === 'function') {
    const validationResult = config.validate();
    if (validationResult !== true && validationResult) {
      state[config.errorKey] = validationResult;
      patchAdminOverlays();
      showToast(validationResult);
      return;
    }
  }

  state[config.loadingKey] = true;
  state[config.errorKey] = '';
  patchAdminOverlays();

  try {
    state[config.resultKey] = await postJson(config.endpoint, config.buildBody());
    const summary = state[config.resultKey] || {};
    showToast(`${config.successLabel}: ${summary.recovered || 0} recovered, ${summary.failed?.length || 0} failed`, 'success');
  } catch (error) {
    state[config.errorKey] = error.message || `Failed to run ${kind} recovery`;
    showToast(state[config.errorKey], 'error');
  } finally {
    state[config.loadingKey] = false;
    patchAdminOverlays();
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

function normalizeLegacyTelegramDirectory(rawDirectory, metadata = {}) {
  const directory = normalizeText(rawDirectory || '').replace(/^\/+|\/+$/g, '');
  if (!directory) {
    return '';
  }
  const channelName = normalizeText(metadata.ChannelName || '');
  if (!channelName) {
    return directory;
  }
  const segments = directory.split('/').filter(Boolean);
  if (segments.length < 2) {
    return directory;
  }
  const root = String(segments[0] || '').toLowerCase();
  const channelSegment = String(segments[1] || '').toLowerCase();
  const safeChannel = channelName.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').toLowerCase();
  if ((root === 'tg-import' || root === 'telegram-import') && channelSegment === safeChannel) {
    return segments.slice(2).join('/');
  }
  return directory;
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

function normalizeVideoCategory(value) {
  return normalizeText(value).slice(0, VIDEO_CATEGORY_MAX_LENGTH);
}

function isUngroupedVideoAlbum(value) {
  return normalizeText(value).toLowerCase() === UNGROUPED_VIDEO_ALBUM_KEY;
}

function normalizeVideoAlbumRouteValue(value) {
  const normalized = normalizeText(value);
  if (normalized.toLowerCase() === UNGROUPED_VIDEO_ROUTE_SEGMENT || isUngroupedVideoAlbum(normalized)) {
    return UNGROUPED_VIDEO_ALBUM_KEY;
  }
  return normalizeVideoCategory(normalized);
}

function getVideoAlbumDisplayName(value) {
  return isUngroupedVideoAlbum(value) ? 'Ungrouped' : normalizeVideoCategory(value);
}

function inferPrivateAlbum(metadata, type) {
  if (!['photo', 'video'].includes(type) || !metadata || typeof metadata !== 'object') {
    return false;
  }
  const rawValue = metadata.PrivateAlbum;
  if (rawValue === true) {
    return true;
  }
  const normalized = normalizeText(rawValue).toLowerCase();
  return ['1', 'true', 'yes', 'private'].includes(normalized);
}

function isPrivateMedia(item) {
  return ['photo', 'video'].includes(item?.type) && Boolean(item?.isPrivateAlbum);
}

function isPrivateRouteActive() {
  return state.primaryFilter === 'Photos'
    && !state.secondaryFilter
    && !state.activeAlbumName
    && state.privateViewOpen;
}

function hasPrivateRouteAccess() {
  return !isPrivateRouteActive() || state.privateRouteUnlocked;
}

function getAccessibleItems(items = getAllItems()) {
  return safeArray(items).filter((item) => {
    if (isPrivateRouteActive()) {
      return hasPrivateRouteAccess() && isPrivateMedia(item);
    }
    return !item?.isPrivateAlbum;
  });
}

function inferVideoCategory(metadata, type) {
  if (type !== 'video' || !metadata || typeof metadata !== 'object') {
    return '';
  }
  return normalizeVideoCategory(metadata.VideoCategory || metadata.Category || '');
}

function itemMatchesVideoAlbum(item, albumValue) {
  if (item?.type !== 'video') {
    return false;
  }
  if (isUngroupedVideoAlbum(albumValue)) {
    return !normalizeVideoCategory(item.videoCategory);
  }
  return normalizeVideoCategory(item.videoCategory).toLowerCase() === normalizeVideoCategory(albumValue).toLowerCase();
}

function buildVideoCategoryOptions(items = [], activeCategory = '') {
  const counts = new Map();
  items.forEach((item) => {
    if (item?.type !== 'video') {
      return;
    }
    const label = normalizeVideoCategory(item.videoCategory);
    if (!label) {
      return;
    }
    counts.set(label, (counts.get(label) || 0) + 1);
  });

  const normalizedActive = isUngroupedVideoAlbum(activeCategory) ? '' : normalizeVideoCategory(activeCategory);
  if (normalizedActive && !counts.has(normalizedActive)) {
    counts.set(normalizedActive, 0);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.label.localeCompare(right.label);
    });
}

function buildVideoAlbumSummaries(items = []) {
  const groups = new Map();
  const ungroupedItems = [];
  items.forEach((item) => {
    if (item?.type !== 'video') {
      return;
    }
    const name = normalizeVideoCategory(item.videoCategory);
    if (!name) {
      ungroupedItems.push(item);
      return;
    }
    const key = name.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name,
        items: []
      });
    }
    groups.get(key).items.push(item);
  });

  return [...groups.values()]
    .map((group) => {
      const sortedItems = [...group.items].sort((left, right) => getAlbumSortTimestamp(right) - getAlbumSortTimestamp(left));
      const coverItem = sortedItems[0] || null;
      const lastModifiedAt = Math.max(0, ...sortedItems.map((item) => getAlbumSortTimestamp(item)));
      return {
        ...group,
        routeValue: group.name,
        isUngrouped: false,
        items: sortedItems,
        coverItem,
        itemCount: sortedItems.length,
        createdAt: coverItem?.takenAt || coverItem?.createdAt || coverItem?.updatedAt || '',
        lastModifiedAt
      };
    })
    .concat(ungroupedItems.length ? [(() => {
      const sortedItems = [...ungroupedItems].sort((left, right) => getAlbumSortTimestamp(right) - getAlbumSortTimestamp(left));
      const coverItem = sortedItems[0] || null;
      const lastModifiedAt = Math.max(0, ...sortedItems.map((item) => getAlbumSortTimestamp(item)));
      return {
        key: UNGROUPED_VIDEO_ALBUM_KEY,
        name: 'Ungrouped',
        routeValue: UNGROUPED_VIDEO_ALBUM_KEY,
        isUngrouped: true,
        items: sortedItems,
        coverItem,
        itemCount: sortedItems.length,
        createdAt: coverItem?.takenAt || coverItem?.createdAt || coverItem?.updatedAt || '',
        lastModifiedAt
      };
    })()] : [])
    .sort((left, right) => {
      if (left.isUngrouped !== right.isUngrouped) {
        return left.isUngrouped ? 1 : -1;
      }
      const rightTime = Number.isFinite(right.lastModifiedAt) ? right.lastModifiedAt : -Infinity;
      const leftTime = Number.isFinite(left.lastModifiedAt) ? left.lastModifiedAt : -Infinity;
      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }
      return left.name.localeCompare(right.name);
    });
}

function buildPreviewVideoAlbumEntries(items = getAccessibleItems()) {
  const selectedItems = getSelectedItems(items);
  const selectedVideoAlbumKeys = new Set(
    selectedItems
      .filter((item) => item?.type === 'video')
      .map((item) => normalizeVideoCategory(item.videoCategory))
      .filter(Boolean)
      .map((name) => normalizeAlbumKey(name))
  );
  return buildVideoAlbumSummaries(items)
    .filter((entry) => !entry.isUngrouped)
    .map((entry) => ({
      name: entry.name,
      itemCount: entry.itemCount,
      coverUrl: normalizeText(entry.coverItem?.thumbnailUrl || entry.coverItem?.posterUrl || entry.coverItem?.sourceUrl || ''),
      lastModifiedAt: entry.lastModifiedAt,
      scope: 'mine',
      selected: selectedVideoAlbumKeys.has(normalizeAlbumKey(entry.name))
    }));
}


function isVideoAlbumRootView(parsedSearch = parseMediaSearchQuery(state.searchQuery)) {
  return state.secondaryFilter === 'Videos'
    && !state.videoCategoryFilter
    && !normalizeText(parsedSearch?.rawQuery);
}

function getVideoCategorySuggestions(items = getAccessibleItems(), currentCategory = '') {
  const dynamic = buildVideoCategoryOptions(items, currentCategory).map((entry) => entry.label);
  return [...new Set([
    isUngroupedVideoAlbum(currentCategory) ? '' : normalizeVideoCategory(currentCategory),
    ...dynamic,
    ...DEFAULT_VIDEO_CATEGORY_SUGGESTIONS
  ].filter(Boolean))].slice(0, 16);
}

function isDocumentLikeSource(fileId, fileLabel, tags) {
  return DOCUMENT_HINT_PATTERN.test(`${fileId} ${fileLabel} ${tags.join(' ')}`);
}

function parseAudioDurationSeconds(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric > 1000 ? numeric / 1000 : numeric;
  }
  const text = normalizeText(value);
  if (!text) {
    return 0;
  }
  const timeMatch = text.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (timeMatch) {
    const hours = timeMatch[3] ? Number(timeMatch[1]) : 0;
    const minutes = timeMatch[3] ? Number(timeMatch[2]) : Number(timeMatch[1]);
    const seconds = timeMatch[3] ? Number(timeMatch[3]) : Number(timeMatch[2]);
    return hours * 3600 + minutes * 60 + seconds;
  }
  return 0;
}

function stripFileExtension(fileName = '') {
  return normalizeText(String(fileName || '').replace(/\.[^.]+$/, ''));
}

function inferAudioMetadata(metadata = {}, fileName = '') {
  const audioTitle = normalizeText(
    metadata.Title
    || metadata.TrackTitle
    || metadata.SongTitle
    || metadata.OriginalTitle
    || stripFileExtension(fileName)
    || fileName
  );
  const audioArtist = normalizeText(metadata.Artist || metadata.Performer || metadata.Author || '');
  const audioAlbum = normalizeText(metadata.Album || metadata.Collection || '');
  const audioDuration = parseAudioDurationSeconds(
    metadata.Duration
    || metadata.DurationSeconds
    || metadata.AudioDuration
    || metadata.Length
    || metadata.TimeLength
  );
  return {
    audioTitle,
    audioArtist,
    audioAlbum,
    audioDuration
  };
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
  if (/\.mp3\b/.test(reference)) return 'audio/mpeg';
  if (/\.m4a\b/.test(reference)) return 'audio/mp4';
  if (/\.aac\b/.test(reference)) return 'audio/aac';
  if (/\.wav\b/.test(reference)) return 'audio/wav';
  if (/\.ogg\b/.test(reference)) return 'audio/ogg';
  if (/\.flac\b/.test(reference)) return 'audio/flac';
  if (/\.pdf\b/.test(reference)) return 'application/pdf';
  if (/\.zip\b/.test(reference)) return 'application/zip';
  if (/\.rar\b/.test(reference)) return 'application/x-rar-compressed';
  if (/\.7z\b/.test(reference)) return 'application/x-7z-compressed';
  if (/\.docx?\b/.test(reference)) return 'application/msword';
  if (/\.xlsx?\b/.test(reference)) return 'application/vnd.ms-excel';
  if (/\.pptx?\b/.test(reference)) return 'application/vnd.ms-powerpoint';
  if (/\.txt\b/.test(reference)) return 'text/plain';
  if (/\.csv\b/.test(reference)) return 'text/csv';
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
  if (!mimeType) {
    return null;
  }

  const lookupKeys = buildMediaLookupKeys(fileId, fileName, fileName);
  const domMatch = lookupKeys.map((key) => domLookup.get(key)).find(Boolean) || null;
  const type = mimeType.startsWith('video/')
    ? 'video'
    : mimeType.startsWith('image/')
      ? 'photo'
      : mimeType.startsWith('audio/')
        ? 'audio'
        : 'document';
  const defaultW = type === 'video'
    ? 1280
    : (type === 'document' ? 240 : (type === 'audio' ? 320 : 1200));
  const defaultH = type === 'video'
    ? 720
    : (type === 'document' ? 240 : (type === 'audio' ? 320 : 900));
  const width = toPositiveNumber(metadata.Width, toPositiveNumber(domMatch?.width, defaultW));
  const height = toPositiveNumber(metadata.Height, toPositiveNumber(domMatch?.height, defaultH));
  const captureTime = resolveMediaCaptureTimestamp(metadata, fileName || fileId);
  const timestamp = Number.isFinite(captureTime) ? captureTime : parseTimestamp(metadata.TimeStamp, index);
  const date = new Date(timestamp);
  const dateParts = createDatePartsFromDate(date);
  const sourceUrl = buildFileRoute(fileId);
  const explicitTags = safeArray(metadata.Tags)
    .map((tag) => normalizeText(tag).toLowerCase())
    .filter(Boolean);
  const tags = inferTagsFromMetadata(metadata, fileName, type);
  const videoCategory = inferVideoCategory(metadata, type);
  const isPrivateAlbum = inferPrivateAlbum(metadata, type);
  const label = fileName || inferAlbumFromFileId(fileId, metadata);
  const audioMeta = type === 'audio' ? inferAudioMetadata(metadata, fileName) : null;
  const browserPreviewSupported = type === 'document' ? false : (type !== 'photo' || supportsBrowserImagePreview(mimeType));
  const videoThumbUrl = (type === 'video' && metadata.TgThumbnailFileId)
    ? buildFileRoute(fileId, { preview: '1' })
    : '';
  const thumbnailUrl = type === 'photo'
    ? resolvePhotoPreviewUrl(fileId, mimeType, domMatch?.thumbnailUrl || '')
    : (type === 'document' || type === 'audio' ? '' : (domMatch?.thumbnailUrl || videoThumbUrl || sourceUrl));
  const posterUrl = type === 'video'
    ? (thumbnailUrl !== sourceUrl ? thumbnailUrl : '')
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
    explicitTags,
    tags,
    videoCategory,
    isPrivateAlbum,
    location: inferLocationFromMetadata(metadata, domMatch),
    favorite: false,
    personLabels: safeArray(metadata.PersonLabels).map(normalizeText).filter(Boolean),
    label,
    sizeMb: Math.max(0, Number(metadata.FileSize) || Number(metadata.FileSizeMB) || 0),
    exif: metadata.Exif || null,
    browserPreviewSupported,
    description: normalizePreviewDescription(metadata.Description || ''),
    audioTitle: audioMeta?.audioTitle || '',
    audioArtist: audioMeta?.audioArtist || '',
    audioAlbum: audioMeta?.audioAlbum || '',
    audioDuration: audioMeta?.audioDuration || 0,
    blurThumbUrl: (type === 'photo' && metadata.TgThumbnailFileId)
      ? buildFileRoute(fileId, { preview: '1' })
      : '',
    isDocumentLike: type === 'document' || (!mimeType.startsWith('audio/') && isDocumentLikeSource(fileId, fileName, tags)),
    directory: normalizeLegacyTelegramDirectory(metadata.Directory || '', metadata),
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
    fileType: 'image,video,audio,other'
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
  let totalCount = 0;

  while (start < API_MAX_ITEMS) {
    const payload = await fetchListPage(start);
    const pageFiles = safeArray(payload?.files);
    if (!pageFiles.length) {
      break;
    }

    files.push(...pageFiles);
    const returnedCount = toPositiveNumber(payload?.returnedCount, pageFiles.length);
    totalCount = Math.max(totalCount, toPositiveNumber(payload?.totalCount, files.length));
    const shouldStop = returnedCount < API_PAGE_SIZE || files.length >= totalCount || files.length >= API_MAX_ITEMS;
    if (shouldStop) {
      break;
    }

    start += returnedCount;
  }

  const items = files
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

  const effectiveTotalCount = Math.max(totalCount, items.length);
  return {
    items,
    totalCount: effectiveTotalCount,
    loadedCount: items.length,
    isTruncated: effectiveTotalCount > items.length
  };
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
  const allItemKeys = new Set();

  safeArray(items).forEach((item) => {
    const itemKey = getPersistentItemKey(item);
    if (!itemKey) { return; }
    allItemKeys.add(itemKey);
    resolveCollectionAlbums(item).forEach((albumName) => {
      const albumKey = normalizeAlbumKey(albumName);
      if (!albumKey) { return; }
      if (!validKeysByAlbum.has(albumKey)) {
      validKeysByAlbum.set(albumKey, new Set());
    }
    validKeysByAlbum.get(albumKey).add(itemKey);
    });
  });

  // Only prune covers where the album has items loaded but the cover item is not among them.
  // Keep covers for albums with no items loaded (they might just not be loaded yet).
  const nextAlbumCovers = Object.fromEntries(
    Object.entries(state.albumCovers).filter(([albumKey, itemKey]) => {
      const albumItemKeys = validKeysByAlbum.get(albumKey);
      if (!albumItemKeys || albumItemKeys.size === 0) {
        // Album has no items loaded — don't prune the cover, items may not be loaded yet
        return true;
      }
      return albumItemKeys.has(normalizeText(itemKey));
    })
  );

  if (isSameRecord(nextAlbumCovers, state.albumCovers)) {
    return false;
  }

  state.albumCovers = nextAlbumCovers;
  persistAlbumCovers();
  return true;
}

function getSelectedItems(items = getAccessibleItems()) {
  const lookup = new Map(items.map((item) => [item.id, item]));
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
  if (!mimeType) {
    return null;
  }
  const type = mimeType.startsWith('video/')
    ? 'video'
    : (mimeType.startsWith('image/')
      ? 'photo'
      : (mimeType.startsWith('audio/') ? 'audio' : 'document'));
  const sourceUrl = buildFileRoute(fileId);
  const browserPreviewSupported = type === 'document' ? false : (type !== 'photo' || supportsBrowserImagePreview(mimeType));
  const thumbnailUrl = type === 'photo'
    ? resolvePhotoPreviewUrl(fileId, mimeType)
    : ((type === 'document' || type === 'audio') ? '' : sourceUrl);
  const deletedAt = Number(record.deletedAt) || Date.now();
  const deletedDate = new Date(deletedAt);
  const deletedDateParts = createDatePartsFromDate(deletedDate);
  const deletedYear = deletedDate.getFullYear();
  const nextItem = {
    id: fileId,
    sourceId: fileId,
    label: fileName,
    thumbnailUrl,
    sourceUrl,
    posterUrl: thumbnailUrl !== sourceUrl ? thumbnailUrl : '',
    type,
    width: toPositiveNumber(metadata.Width, type === 'video' ? 1280 : (type === 'document' ? 240 : 1200)),
    height: toPositiveNumber(metadata.Height, type === 'video' ? 720 : (type === 'document' ? 240 : 900)),
    sizeMb: Math.max(0, Number(metadata.FileSize) || Number(metadata.FileSizeMB) || 0),
    videoCategory: inferVideoCategory(metadata, type),
    isPrivateAlbum: inferPrivateAlbum(metadata, type),
    mimeType,
    browserPreviewSupported,
    daysLeft: Math.max(0, Number(record.daysLeft) || 0),
    deletedAt,
    takenAt: deletedDateParts.takenAt,
    displayTakenAt: deletedDateParts.displayTakenAt,
    year: String(deletedYear),
    timelineLabel: createTimelineLabel(deletedDate),
    description: normalizeText(metadata.Description || metadata.Caption || ''),
    explicitTags: normalizeExplicitTags(metadata.Tags),
    tags: inferTagsFromMetadata(metadata, fileName, type),
    location: inferLocationFromMetadata(metadata, null),
    exif: metadata.Exif || null,
    isDocumentLike: type === 'document' || DOCUMENT_HINT_PATTERN.test(`${fileId} ${fileName}`)
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

function snapshotBinMutationState() {
  const previewItemsBeforeMutation = [...getPreviewItems()];
  return {
    binItems: state.binItems.map((item) => ({ ...item })),
    binSelectedIds: new Set(state.binSelectedIds),
    previewId: state.previewId,
    previewItemsBeforeMutation,
    previewIndexBeforeMutation: previewItemsBeforeMutation.findIndex((item) => item.id === state.previewId)
  };
}

function applyBinItemsLocally({
  removedIds = new Set(),
  snapshot = null
} = {}) {
  const normalizedRemovedIds = removedIds instanceof Set ? removedIds : new Set(removedIds);
  const baseBinItems = Array.isArray(snapshot?.binItems) ? snapshot.binItems : state.binItems;
  const baseBinSelectedIds = snapshot?.binSelectedIds instanceof Set ? snapshot.binSelectedIds : state.binSelectedIds;
  const basePreviewId = snapshot?.previewId ?? state.previewId;
  const previewItemsBeforeMutation = Array.isArray(snapshot?.previewItemsBeforeMutation) ? snapshot.previewItemsBeforeMutation : [];
  const previewIndexBeforeMutation = Number.isInteger(snapshot?.previewIndexBeforeMutation) ? snapshot.previewIndexBeforeMutation : -1;

  state.binItems = baseBinItems.filter((item) => !normalizedRemovedIds.has(item.id));
  state.binSelectedIds = new Set([...baseBinSelectedIds].filter((id) => !normalizedRemovedIds.has(id)));

  if (basePreviewId && normalizedRemovedIds.has(basePreviewId)) {
    const previewItemsAfterMutation = previewItemsBeforeMutation.filter((item) => !normalizedRemovedIds.has(item.id));
    const nextPreviewItem = previewIndexBeforeMutation >= 0
      ? previewItemsAfterMutation[Math.min(previewIndexBeforeMutation, previewItemsAfterMutation.length - 1)] || null
      : null;
    state.previewId = nextPreviewItem?.id || null;
    return;
  }

  state.previewId = basePreviewId;
}

function renderBinMutationState() {
  if (state.previewId && state.primaryFilter === 'Bin') {
    if (!renderPreviewTransientLayers({ animateDirection: 1 })) {
      render();
    }
    return;
  }
  render();
}

async function restoreBinSelection() {
  const fileIds = [...state.binSelectedIds];
  if (!fileIds.length) {
    return;
  }
  const snapshot = snapshotBinMutationState();
  const requestedIds = new Set(fileIds.map((id) => normalizeText(id)).filter(Boolean));
  applyBinItemsLocally({
    removedIds: requestedIds,
    snapshot
  });
  renderBinMutationState();
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
    if (restoredIds.size !== requestedIds.size) {
      applyBinItemsLocally({
        removedIds: restoredIds,
        snapshot
      });
      renderBinMutationState();
    }
    if (restoredIds.size) {
      showToast(`Restored ${restoredIds.size} item${restoredIds.size === 1 ? '' : 's'} from Bin.`, 'success');
    }
    if (failedIds.length) {
      showToast(`Failed to restore ${failedIds.length} item${failedIds.length === 1 ? '' : 's'}. Try again.`, 'error');
    }
  } catch (error) {
    console.error('[media-library] restoreBinSelection failed', error);
    applyBinItemsLocally({
      removedIds: new Set(),
      snapshot
    });
    renderBinMutationState();
    showToast('Failed to restore the selected Bin items.');
  }
  void syncStorageSummary({ forceRender: false });
}

async function deleteBinSelectionPermanently() {
  const fileIds = [...state.binSelectedIds];
  if (!fileIds.length) {
    return;
  }
  const snapshot = snapshotBinMutationState();
  const requestedIds = new Set(fileIds.map((id) => normalizeText(id)).filter(Boolean));
  applyBinItemsLocally({
    removedIds: requestedIds,
    snapshot
  });
  renderBinMutationState();
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
    if (deletedIds.size !== requestedIds.size) {
      applyBinItemsLocally({
        removedIds: deletedIds,
        snapshot
      });
      renderBinMutationState();
    }
    if (deletedIds.size) {
      showToast(`Deleted ${deletedIds.size} item${deletedIds.size === 1 ? '' : 's'} forever.`, 'success');
    }
    if (failedIds.length) {
      showToast(`Failed to delete ${failedIds.length} Bin item${failedIds.length === 1 ? '' : 's'} forever.`, 'error');
    }
  } catch (error) {
    console.error('[media-library] deleteBinSelectionPermanently failed', error);
    applyBinItemsLocally({
      removedIds: new Set(),
      snapshot
    });
    renderBinMutationState();
    showToast('Failed to permanently delete the selected Bin items.');
  }
  void syncStorageSummary({ forceRender: false });
}

async function emptyBin() {
  if (!state.binItems.length) {
    return;
  }
  const snapshot = snapshotBinMutationState();
  const requestedIds = new Set(state.binItems.map((item) => normalizeText(item.id)).filter(Boolean));
  applyBinItemsLocally({
    removedIds: requestedIds,
    snapshot
  });
  renderBinMutationState();
  try {
    const response = await apiFetch('/api/manage/bin/empty', { method: 'POST', timeoutMs: 15000 });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || `Empty bin failed with ${response.status}`);
    }
    const deletedIds = new Set(safeArray(payload?.deletedIds).map(normalizeText).filter(Boolean));
    const failedIds = safeArray(payload?.failedIds).map(normalizeText).filter(Boolean);
    if (deletedIds.size !== requestedIds.size) {
      applyBinItemsLocally({
        removedIds: deletedIds,
        snapshot
      });
      renderBinMutationState();
    }
    if (failedIds.length) {
      showToast(`Deleted ${deletedIds.size} item${deletedIds.size === 1 ? '' : 's'}, but ${failedIds.length} failed.`, 'error');
    } else {
      showToast('Bin emptied.', 'success');
    }
  } catch (error) {
    console.error('[media-library] emptyBin failed', error);
    applyBinItemsLocally({
      removedIds: new Set(),
      snapshot
    });
    renderBinMutationState();
    showToast('Failed to empty Bin.');
  }
  void syncStorageSummary({ forceRender: false });
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
  const binItem = fileIds.length === 1
    ? state.binItems.find((item) => item.id === fileIds[0])
    : null;
  const itemLabel = binItem?.label || `${fileIds.length} Bin item${fileIds.length === 1 ? '' : 's'}`;
  openConfirmDialog({
    mode: 'delete-bin-permanently',
    origin: state.previewId && fileIds.length === 1 && state.previewId === fileIds[0] ? 'preview' : '',
    title: 'Delete forever?',
    copy: `${itemLabel} will be permanently deleted and cannot be restored.`,
    confirmLabel: 'Delete forever',
    selectionCount: fileIds.length
  });
}

function requestDeleteBinPreviewPermanently(itemId) {
  const normalizedId = normalizeText(itemId);
  if (!normalizedId) {
    return;
  }
  state.binSelectedIds = new Set([normalizedId]);
  requestDeleteBinSelectionPermanently();
}

function restoreBinPreview(itemId) {
  const normalizedId = normalizeText(itemId);
  if (!normalizedId) {
    return;
  }
  state.binSelectedIds = new Set([normalizedId]);
  void restoreBinSelection();
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

function getUploadPickerAccept() {
  return state.secondaryFilter === 'Documents' ? '' : MEDIA_LIBRARY_UPLOAD_ACCEPT;
}

function requestNativeUpload() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  const accept = getUploadPickerAccept();
  if (accept) {
    fileInput.accept = accept;
  }
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);
  fileInput.addEventListener('change', () => {
    const files = [...fileInput.files];
    document.body.removeChild(fileInput);
    if (files.length) {
      startUploadQueue(files);
    }
  }, { once: true });
  fileInput.click();
}

function startUploadQueue(files) {
  state.uploadQueue = files.map((file) => ({ file, progress: 0, status: 'pending' }));
  state.uploadActive = true;
  state.uploadTotal = files.length;
  state.uploadDone = 0;
  renderUploadOverlay();
  processUploadQueue();
}

async function processUploadQueue() {
  for (let i = 0; i < state.uploadQueue.length; i++) {
    const entry = state.uploadQueue[i];
    if (entry.status !== 'pending') continue;
    entry.status = 'uploading';
    try {
      await uploadSingleFile(entry, i);
      entry.status = 'done';
      state.uploadDone += 1;
    } catch (err) {
      entry.status = 'error';
      state.uploadDone += 1;
      console.warn('[upload] failed:', entry.file.name, err);
    }
    renderUploadOverlay();
  }
  const failCount = state.uploadQueue.filter((e) => e.status === 'error').length;
  if (failCount > 0) {
    showToast(`${state.uploadDone - failCount} uploaded, ${failCount} failed`, 'error');
  } else {
    showToast(`${state.uploadDone} file${state.uploadDone === 1 ? '' : 's'} uploaded`, 'success');
  }
  window.setTimeout(() => {
    state.uploadActive = false;
    state.uploadQueue = [];
    removeUploadOverlay();
  }, 1200);
  void performSyncLiveMedia({ forceRender: true });
}

function uploadSingleFile(entry, index) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', entry.file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload');
    xhr.withCredentials = true;
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        entry.progress = Math.round((e.loaded / e.total) * 100);
        renderUploadOverlay();
      }
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        entry.progress = 100;
        resolve();
      } else {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.addEventListener('abort', () => reject(new Error('Aborted')));
    xhr.send(formData);
    entry._xhr = xhr;
  });
}

function renderUploadOverlay() {
  let overlay = refs.root?.querySelector('.cml-upload-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'cml-upload-overlay';
    refs.root?.appendChild(overlay);
  }
  const totalProgress = state.uploadQueue.length
    ? Math.round(state.uploadQueue.reduce((s, e) => s + e.progress, 0) / state.uploadQueue.length)
    : 0;
  const currentIdx = state.uploadQueue.findIndex((e) => e.status === 'uploading');
  const currentName = currentIdx >= 0 ? state.uploadQueue[currentIdx].file.name : '';
  const label = state.uploadDone >= state.uploadTotal
    ? 'Upload complete'
    : `Uploading ${state.uploadDone + 1} of ${state.uploadTotal}`;
  overlay.innerHTML = `
    <div class="cml-upload-overlay__content">
      <div class="cml-upload-overlay__info">
        <span class="cml-upload-overlay__label">${label}</span>
        <span class="cml-upload-overlay__pct">${totalProgress}%</span>
      </div>
      <div class="cml-upload-overlay__bar">
        <div class="cml-upload-overlay__fill" style="width:${totalProgress}%"></div>
      </div>
      ${currentName ? `<span class="cml-upload-overlay__filename">${currentName.length > 30 ? currentName.slice(0, 27) + '...' : currentName}</span>` : ''}
    </div>
  `;
  if (!overlay.classList.contains('is-visible')) {
    requestAnimationFrame(() => overlay.classList.add('is-visible'));
  }
}

function removeUploadOverlay() {
  const overlay = refs.root?.querySelector('.cml-upload-overlay');
  if (overlay) {
    overlay.classList.remove('is-visible');
    window.setTimeout(() => overlay.remove(), 400);
  }
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
      .map(([entryKey, entryValue]) => {
        const normalizedKey = normalizeText(entryKey);
        if (Array.isArray(entryValue)) {
          const normalized = entryValue.map((v) => normalizeText(v)).filter(Boolean);
          return [normalizedKey, normalized.length ? normalized : null];
        }
        const normalized = normalizeText(entryValue);
        return [normalizedKey, normalized || null];
      })
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

function hasPersistedPlaylistData(snapshot) {
  return Boolean(
    safeArray(snapshot?.playlistNames).length
    || Object.keys(snapshot?.playlistAssignments || {}).length
  );
}

function applyPersistedPlaylistState(payload) {
  state.playlistNames = loadStringArrayFromApi(payload?.playlistNames);
  state.playlistAssignments = loadStringRecordFromApi(payload?.playlistAssignments);
}

function snapshotPersistedPlaylistState() {
  return {
    playlistNames: [...state.playlistNames],
    playlistAssignments: { ...state.playlistAssignments }
  };
}

async function flushPersistedPlaylistState() {
  while (pendingPersistedPlaylistSnapshot) {
    const nextSnapshot = pendingPersistedPlaylistSnapshot;
    pendingPersistedPlaylistSnapshot = null;
    try {
      const payload = await postJson('/api/manage/playlists', { state: nextSnapshot });
      if (!pendingPersistedPlaylistSnapshot) {
        applyPersistedPlaylistState(payload);
        saveJson(PLAYLISTS_STORAGE_KEY, state.playlistNames);
        saveJson(PLAYLIST_ASSIGNMENTS_STORAGE_KEY, state.playlistAssignments);
      }
    } catch (error) {
      console.error('[media-library] failed to persist playlist state', error);
      showToast(error.message || 'Failed to save playlist changes');
    }
  }
}

function clearSearchInputAndFocus() {
  resetSearchQuery();
  clearSelection({ shouldRender: false });
  resetLoadedCount();
  render();
  window.requestAnimationFrame(() => {
    const searchInput = refs.root?.querySelector('.cml-topbar__search-input, .cml-sidebar__search-input');
    if (searchInput instanceof HTMLInputElement) {
      searchInput.focus({ preventScroll: true });
    }
  });
}

function queuePersistedPlaylistState() {
  pendingPersistedPlaylistSnapshot = snapshotPersistedPlaylistState();
  if (persistedPlaylistStatePromise) {
    return persistedPlaylistStatePromise;
  }
  persistedPlaylistStatePromise = flushPersistedPlaylistState()
    .finally(() => {
      persistedPlaylistStatePromise = null;
      if (pendingPersistedPlaylistSnapshot) {
        queuePersistedPlaylistState();
      }
    });
  return persistedPlaylistStatePromise;
}

async function loadPersistedPlaylistState({ forceRender = false } = {}) {
  try {
    const payload = await fetchJson('/api/manage/playlists');
    if (hasPersistedPlaylistData(payload)) {
      applyPersistedPlaylistState(payload);
      saveJson(PLAYLISTS_STORAGE_KEY, state.playlistNames);
      saveJson(PLAYLIST_ASSIGNMENTS_STORAGE_KEY, state.playlistAssignments);
    }
  } catch (error) {
    console.error('[media-library] failed to load playlist state', error);
  } finally {
    if (forceRender && refs.root) {
      render();
    }
  }
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

function inferAlbumDialogTarget(selectedItems = getSelectedItems()) {
  if (selectedItems.length && selectedItems.every((item) => item?.type === 'video')) {
    return 'video';
  }
  if (state.secondaryFilter === 'Videos') {
    return 'video';
  }
  return 'photo';
}

function getDialogAlbumNames(items = getAccessibleItems()) {
  return state.albumDialogTarget === 'video'
    ? getAvailableVideoAlbumNames(items)
    : getAvailableAlbumNames(items);
}

function getDialogAlbumEntries(items = getAccessibleItems()) {
  return state.albumDialogTarget === 'video'
    ? buildPreviewVideoAlbumEntries(items)
    : buildPreviewAlbumEntries(items);
}

function openAlbumDialog(mode = 'create', { origin = '', preferPreviewRender = false } = {}) {
  state.albumDialogOpen = true;
  state.albumDialogMode = mode;
  state.albumDialogOrigin = normalizeText(origin || '');
  state.albumDialogTarget = inferAlbumDialogTarget();
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
  state.albumDialogTarget = 'photo';
  state.albumDialogError = '';
  state.albumDraftName = '';
  state.albumDrawerSearch = '';
  state.albumDrawerScope = 'all';
  state.albumDrawerCreateMode = false;
  if (previewAlbumFlow) {
    clearSelection({ shouldRender: false });
  }
  renderAlbumDialogState({ preferPreviewRender: previewAlbumFlow });
}

function setAlbumDrawerScope(scope) {
  if (!state.albumDialogOpen) {
    return;
  }
  const normalizedScope = normalizeText(scope || 'all').toLowerCase();
  const nextScope = ['all', 'mine', 'shared'].includes(normalizedScope) ? normalizedScope : 'all';
  if (state.albumDrawerScope === nextScope) {
    return;
  }
  state.albumDrawerScope = nextScope;
  renderAlbumDialogState({ preferPreviewRender: state.albumDialogOrigin === 'preview', focusKey: 'search' });
}

function setPreviewAlbumCreateMode(forceOpen) {
  if (!state.albumDialogOpen) {
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
  if (!patchAlbumDialogCreateMode()) {
    renderAlbumDialogState({
      preferPreviewRender: state.albumDialogOrigin === 'preview',
      focusKey: nextValue ? 'create' : 'search',
      select: nextValue
    });
    return;
  }
  if (nextValue) {
    window.setTimeout(() => {
      focusAlbumInput({ focusKey: 'create', select: true });
    }, 30);
  }
}

function toggleAlbumPickerDistinctOnly() {
  if (!canUseDistinctAlbumPicker(state)) {
    state.albumPickerDistinctOnly = false;
    return;
  }
  state.albumPickerDistinctOnly = !state.albumPickerDistinctOnly;
  clearSelection({ shouldRender: false });
  resetLoadedCount();
  render();
  if (refs.scrollRegion) {
    refs.scrollRegion.scrollTo({ top: 0, behavior: 'auto' });
  }
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

function patchAvatarMenu() {
  if (!refs.root) { render(); return; }
  const wrap = refs.root.querySelector('.cml-avatar-wrap');
  if (!(wrap instanceof HTMLElement)) { render(); return; }
  const btn = wrap.querySelector('.cml-avatar-btn');
  if (btn instanceof HTMLElement) {
    btn.classList.toggle('is-open', state.avatarMenuOpen);
    btn.setAttribute('aria-expanded', String(state.avatarMenuOpen));
  }
  const existingMenu = wrap.querySelector('.cml-avatar-menu');
  if (!state.avatarMenuOpen) {
    if (existingMenu) { existingMenu.remove(); }
    return;
  }
  if (!existingMenu) {
    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const name = esc(state.adminDisplayName || state.adminUsername || 'Admin');
    const user = esc(state.adminUsername || 'admin');
    const tpl = document.createElement('template');
    tpl.innerHTML = `<div class="cml-avatar-menu" role="menu">
      <div class="cml-avatar-menu__header"><div><p class="cml-avatar-menu__name">${name}</p><p class="cml-avatar-menu__meta">@${user}</p><p class="cml-avatar-menu__role">Administrator</p></div></div>
      <div class="cml-avatar-menu__divider"></div>
      <button type="button" class="cml-avatar-menu__item" data-action="open-admin-dashboard" role="menuitem">Admin dashboard</button>
      <div class="cml-avatar-menu__divider"></div>
      <button type="button" class="cml-avatar-menu__item cml-avatar-menu__item--danger" data-action="logout" role="menuitem">Sign out</button>
    </div>`.trim();
    wrap.appendChild(tpl.content.firstElementChild);
  }
}

function patchThemeSwitcher() {
  if (!refs.root) {
    return false;
  }
  const currentTopbar = refs.root.querySelector('.cml-topbar');
  if (!(currentTopbar instanceof HTMLElement)) {
    return false;
  }
  const selectedItems = getSelectedItems();
  const markup = TopSearchBar({
    state,
    storageSummary: state.storageSummary,
    canDeleteSelection: state.primaryFilter !== 'Bin' && selectedItems.length > 0 && selectedItems.every((item) => canDeleteItem(item)),
    canDownloadSelection: state.primaryFilter !== 'Bin' && getDownloadableItems(selectedItems).length > 0,
    canSetAlbumCover: false
  }).trim();
  if (!markup) {
    return false;
  }
  const template = document.createElement('template');
  template.innerHTML = markup;
  const nextTopbar = template.content.firstElementChild;
  if (!(nextTopbar instanceof HTMLElement)) {
    return false;
  }
  const currentSwitcher = currentTopbar.querySelector('.cml-theme-switcher');
  const nextSwitcher = nextTopbar.querySelector('.cml-theme-switcher');
  if (currentSwitcher instanceof HTMLElement && nextSwitcher instanceof HTMLElement) {
    currentSwitcher.replaceWith(nextSwitcher);
    return true;
  }
  if (currentSwitcher instanceof HTMLElement && !(nextSwitcher instanceof HTMLElement)) {
    currentSwitcher.remove();
    return true;
  }
  if (!(currentSwitcher instanceof HTMLElement) && nextSwitcher instanceof HTMLElement) {
    currentTopbar.querySelector('.cml-topbar__actions')?.prepend(nextSwitcher);
    return true;
  }
  return false;
}

function dismissThemeMenu({ allowRenderFallback = true } = {}) {
  if (!state.uiThemeMenuOpen) {
    return false;
  }
  state.uiThemeMenuOpen = false;
  if (!patchThemeSwitcher() && allowRenderFallback) {
    render();
  }
  return true;
}

function patchToastDom() {
  if (!refs.root) { return false; }
  const existing = refs.root.querySelector('.cml-toast');
  if (state.toastMessage) {
    if (existing) {
      existing.className = `cml-toast cml-toast--${state.toastType}`;
      const msg = existing.querySelector('.cml-toast__message');
      if (msg) { msg.textContent = state.toastMessage; }
      const existingAction = existing.querySelector('.cml-toast__action');
      if (existingAction) {
        existingAction.remove();
      }
      if (state.toastAction?.label && state.toastAction?.action) {
        const actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.className = 'cml-toast__action';
        actionBtn.setAttribute('data-action', state.toastAction.action);
        actionBtn.textContent = state.toastAction.label;
        const dismissBtn = existing.querySelector('.cml-toast__dismiss');
        existing.insertBefore(actionBtn, dismissBtn || null);
      }
      return true;
    }
    const toast = document.createElement('div');
    toast.className = `cml-toast cml-toast--${state.toastType}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    const msg = document.createElement('span');
    msg.className = 'cml-toast__message';
    msg.textContent = state.toastMessage;
    const actionBtn = document.createElement('button');
    if (state.toastAction?.label && state.toastAction?.action) {
      actionBtn.type = 'button';
      actionBtn.className = 'cml-toast__action';
      actionBtn.setAttribute('data-action', state.toastAction.action);
      actionBtn.textContent = state.toastAction.label;
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cml-toast__dismiss';
    btn.setAttribute('data-action', 'dismiss-toast');
    btn.setAttribute('aria-label', 'Dismiss');
    btn.textContent = '\u2715';
    toast.append(msg);
    if (state.toastAction?.label && state.toastAction?.action) {
      toast.append(actionBtn);
    }
    toast.append(btn);
    refs.root.appendChild(toast);
    return true;
  }
  if (existing) { existing.remove(); }
  return true;
}

function showToast(message, type = 'error', options = {}) {
  const normalizedType = String(type || 'error');
  if (state.toastTimeoutId) {
    window.clearTimeout(state.toastTimeoutId);
  }
  state.toastMessage = String(message || '');
  state.toastType = normalizedType;
  state.toastAction = options?.action || null;
  if (!patchToastDom()) { render(); }
  state.toastTimeoutId = window.setTimeout(() => {
    state.toastMessage = '';
    state.toastAction = null;
    state.toastTimeoutId = 0;
    patchToastDom();
  }, 4500);
}

function getSearchContextLabel() {
  if (state.privateViewOpen) {
    return 'Private';
  }
  if (state.activeAlbumName) {
    return state.activeAlbumName;
  }
  if (state.primaryFilter === 'Collections') {
    return 'Albums';
  }
  if (state.primaryFilter === 'Films') {
    return 'Films';
  }
  if (state.secondaryFilter) {
    return state.secondaryFilter;
  }
  return state.primaryFilter || 'Library';
}

function scrollToMusicLibrary() {
  if (!(refs.root instanceof HTMLElement)) {
    return false;
  }
  const musicLibrary = refs.root.querySelector('#cml-music-library');
  if (!(musicLibrary instanceof HTMLElement)) {
    return false;
  }
  musicLibrary.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'smooth' });
  return true;
}

function scrollToSearchGroup(groupKey) {
  const normalizedGroupKey = normalizeText(groupKey).toLowerCase();
  if (!normalizedGroupKey || !refs.root) {
    return false;
  }
  const target = refs.root.querySelector(`[data-search-group="${normalizedGroupKey}"]`);
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}

function dismissToast() {
  if (state.toastTimeoutId) {
    window.clearTimeout(state.toastTimeoutId);
    state.toastTimeoutId = 0;
  }
  state.toastMessage = '';
  state.toastAction = null;
  patchToastDom();
}

function patchAdminOverlays() {
  if (!refs.root) { render(); return; }
  const container = getFloatingLayerContainer();
  if (!(container instanceof HTMLElement)) { render(); return; }

  const adminHtml = AdminPanel({ state, storageSummary: state.storageSummary });
  const storageHtml = StoragePanel({ state, insights: buildStorageInsights() });
  const tpl = document.createElement('template');
  tpl.innerHTML = (adminHtml + storageHtml).trim();

  const currentAdmin = container.querySelector('.cml-admin-panel');
  const nextAdmin = tpl.content.querySelector('.cml-admin-panel');
  replaceFloatingLayer(currentAdmin, nextAdmin);

  const currentStorage = container.querySelector('.cml-storage-panel');
  const nextStorage = tpl.content.querySelector('.cml-storage-panel');
  replaceFloatingLayer(currentStorage, nextStorage);
}

function openAdminPanel(tab = 'account') {
  state.avatarMenuOpen = false;
  state.storagePanelOpen = false;
  state.adminPanelOpen = true;
  state.adminPanelTab = normalizeText(tab) || 'account';
  state.adminPanelError = '';
  patchAvatarMenu();
  patchAdminOverlays();
  void loadAdminPanelData();
}

function closeAdminPanel() {
  if (!state.adminPanelOpen || state.adminPanelBusy) {
    return;
  }
  state.adminPanelOpen = false;
  state.adminPanelError = '';
  state.adminProfileDraft = resetAdminPasswordDraft(state.adminProfileDraft);
  patchAdminOverlays();
}

function toggleStoragePanel(forceOpen = null) {
  const nextOpen = typeof forceOpen === 'boolean' ? forceOpen : !state.storagePanelOpen;
  if (nextOpen) {
    state.avatarMenuOpen = false;
    state.adminPanelOpen = false;
  }
  state.storagePanelOpen = nextOpen;
  patchAvatarMenu();
  patchAdminOverlays();
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
    patchAdminOverlays();
    return;
  }
  if (file.size > 512 * 1024) {
    state.adminPanelError = 'Avatar image must be 512 KB or smaller';
    patchAdminOverlays();
    return;
  }

  try {
    state.adminProfileDraft.avatarData = await readFileAsDataUrl(file);
    state.adminPanelError = '';
  } catch (error) {
    state.adminPanelError = error.message || 'Failed to read avatar image';
  }
  patchAdminOverlays();
}


async function saveAdminAccount() {
  if (state.adminPanelBusy) {
    return;
  }

  const username = normalizeText(state.adminProfileDraft.username);
  const displayName = normalizeText(state.adminProfileDraft.displayName);
  if (!username) {
    state.adminPanelError = 'Username is required';
    patchAdminOverlays();
    return;
  }
  if (!displayName) {
    state.adminPanelError = 'Display name is required';
    patchAdminOverlays();
    return;
  }
  if (state.adminProfileDraft.newPassword && state.adminProfileDraft.newPassword !== state.adminProfileDraft.confirmPassword) {
    state.adminPanelError = 'New password and confirmation do not match';
    patchAdminOverlays();
    return;
  }

  state.adminPanelBusy = true;
  state.adminPanelError = '';
  patchAdminOverlays();

  try {
    const profile = await postJson('/api/manage/account', {
      username,
      displayName,
      avatarData: state.adminProfileDraft.avatarData,
      currentPassword: state.adminProfileDraft.currentPassword,
      newPassword: state.adminProfileDraft.newPassword
    });
    applyAdminIdentity(profile);
    state.adminProfileDraft = hydrateAdminProfileDraft(profile, normalizeText);
    showToast('Admin account updated', 'success');
  } catch (error) {
    state.adminPanelError = error.message || 'Failed to update account';
  } finally {
    state.adminPanelBusy = false;
    patchAdminOverlays();
  }
}

async function saveAdminSiteSettings() {
  if (state.adminPanelBusy) {
    return;
  }
  state.adminPanelBusy = true;
  state.adminPanelError = '';
  patchAdminOverlays();

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
    patchAdminOverlays();
  }
}

async function saveAdminCloudSettings() {
  if (state.adminPanelBusy) {
    return;
  }
  state.adminPanelBusy = true;
  state.adminPanelError = '';
  patchAdminOverlays();

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
    patchAdminOverlays();
  }
}

function openCollection(albumName) {
  const normalizedName = normalizeText(albumName);
  if (!normalizedName) {
    return;
  }
  state.primaryFilter = 'Collections';
  state.activeAlbumName = normalizedName;
  resetAddToTargetModes(state);
  state.secondaryFilter = '';
  resetSearchQuery();
  state.previewId = null;
  clearSelection({ shouldRender: false });
  resetLoadedCount();
  pushNavigationHash();
  render();
  if (refs.scrollRegion) {
    refs.scrollRegion.scrollTo({ top: 0, behavior: 'auto' });
  }
}

function openMusicPlaylist(playlistName) {
  const normalizedName = normalizeText(playlistName);
  if (!normalizedName) {
    return;
  }
  state.primaryFilter = 'Music';
  state.activePlaylistName = normalizedName;
  resetAddToTargetModes(state);
  resetSearchQuery();
  state.previewId = null;
  clearSelection({ shouldRender: false });
  pushNavigationHash();
  render();
}

function openVideoAlbum(categoryName) {
  const normalizedCategory = normalizeVideoAlbumRouteValue(categoryName);
  if (!normalizedCategory) {
    return;
  }
  if (
    state.primaryFilter === 'Photos'
    && state.secondaryFilter === 'Videos'
    && normalizeVideoAlbumRouteValue(state.videoCategoryFilter) === normalizedCategory
    && !state.activeAlbumName
    && !state.albumSelectionTarget
    && !state.videoAlbumSelectionTarget
    && !state.privateSelectionMode
  ) {
    return;
  }
  state.primaryFilter = 'Photos';
  state.secondaryFilter = 'Videos';
  state.videoCategoryFilter = normalizedCategory;
  state.activeAlbumName = '';
  resetAddToTargetModes(state);
  resetSearchQuery();
  state.previewId = null;
  clearSelection({ shouldRender: false });
  resetLoadedCount();
  pushNavigationHash();
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
  resetAddToTargetModes(state);
  resetSearchQuery();
  state.previewId = null;
  clearSelection({ shouldRender: false });
  resetLoadedCount();
  pushNavigationHash();
  render();
  if (refs.scrollRegion) {
    refs.scrollRegion.scrollTo({ top: 0, behavior: 'auto' });
  }
}

function closeMusicPlaylist() {
  if (!state.activePlaylistName) {
    return;
  }
  state.activePlaylistName = '';
  state.playlistDialogOpen = false;
  state.playlistDialogMode = 'create';
  state.playlistDialogTargetItemId = '';
  state.playlistDraftName = '';
  state.playlistDialogError = '';
  state.playlistDialogBusy = false;
  resetSearchQuery();
  state.previewId = null;
  clearSelection({ shouldRender: false });
  pushNavigationHash();
  render();
}

function closeVideoAlbum() {
  if (state.secondaryFilter !== 'Videos' || !state.videoCategoryFilter) {
    return;
  }
  state.videoCategoryFilter = '';
  resetSearchQuery();
  state.previewId = null;
  clearSelection({ shouldRender: false });
  resetLoadedCount();
  pushNavigationHash();
  render();
  if (refs.scrollRegion) {
    refs.scrollRegion.scrollTo({ top: 0, behavior: 'auto' });
  }
}

function clearPrivateViewState() {
  state.privateViewOpen = false;
  state.privateRouteUnlocked = false;
  state.privatePasswordDraft = '';
  state.privatePasswordError = '';
  state.focusedTileId = null;
}

function resetPrivateRouteUnlockError() {
  state.privatePasswordError = '';
}

function unlockPrivateRoute(passwordInput = state.privatePasswordDraft) {
  const password = normalizeText(passwordInput);
  state.privatePasswordDraft = passwordInput;
  if (!password) {
    state.privatePasswordError = 'Enter the password first.';
    render();
    return false;
  }
  if (password !== PRIVATE_ALBUM_PASSWORD) {
    state.privatePasswordError = 'Wrong password.';
    render();
    return false;
  }
  state.privateRouteUnlocked = true;
  state.privatePasswordDraft = '';
  state.privatePasswordError = '';
  state.focusedTileId = null;
  render();
  if (refs.scrollRegion) {
    refs.scrollRegion.scrollTo({ top: 0, behavior: 'auto' });
  }
  return true;
}

function openAlbumSelection(albumName = getActiveAlbumName()) {
  const normalizedName = normalizeText(albumName);
  if (!normalizedName) {
    return;
  }
  state.albumSelectionTarget = normalizedName;
  state.videoAlbumSelectionTarget = '';
  state.privateSelectionMode = false;
  state.primaryFilter = 'Photos';
  state.activeAlbumName = '';
  state.secondaryFilter = '';
  state.videoCategoryFilter = '';
  clearPrivateViewState();
  resetSearchQuery();
  state.previewId = null;
  clearSelection({ shouldRender: false });
  resetLoadedCount();
  pushNavigationHash();
  render();
  if (refs.scrollRegion) {
    refs.scrollRegion.scrollTo({ top: 0, behavior: 'auto' });
  }
}

function openVideoAlbumSelection(albumName = state.videoCategoryFilter) {
  const normalizedName = normalizeVideoCategory(albumName);
  if (!normalizedName) {
    return;
  }
  state.videoAlbumSelectionTarget = normalizedName;
  state.albumSelectionTarget = '';
  state.privateSelectionMode = false;
  state.primaryFilter = 'Photos';
  state.activeAlbumName = '';
  state.secondaryFilter = 'Videos';
  state.videoCategoryFilter = '';
  clearPrivateViewState();
  resetSearchQuery();
  state.previewId = null;
  clearSelection({ shouldRender: false });
  resetLoadedCount();
  pushNavigationHash();
  render();
  if (refs.scrollRegion) {
    refs.scrollRegion.scrollTo({ top: 0, behavior: 'auto' });
  }
}

function openPrivateSelection() {
  state.privateSelectionMode = true;
  state.albumSelectionTarget = '';
  state.videoAlbumSelectionTarget = '';
  state.primaryFilter = 'Photos';
  state.activeAlbumName = '';
  state.secondaryFilter = '';
  state.videoCategoryFilter = '';
  clearPrivateViewState();
  resetSearchQuery();
  state.previewId = null;
  clearSelection({ shouldRender: false });
  resetLoadedCount();
  pushNavigationHash();
  render();
  if (refs.scrollRegion) {
    refs.scrollRegion.scrollTo({ top: 0, behavior: 'auto' });
  }
}

function closeAlbumSelection() {
  const targetAlbum = getAlbumSelectionTarget(state);
  const targetVideoAlbum = getVideoAlbumSelectionTarget(state);
  const wasPrivateSelection = state.privateSelectionMode;
  if (!targetAlbum && !targetVideoAlbum && !wasPrivateSelection) {
    return;
  }
  resetAddToTargetModes(state);
  if (targetVideoAlbum) {
    state.primaryFilter = 'Photos';
    state.activeAlbumName = '';
    state.secondaryFilter = 'Videos';
    state.videoCategoryFilter = targetVideoAlbum;
    clearPrivateViewState();
  } else if (wasPrivateSelection) {
    state.primaryFilter = 'Photos';
    state.activeAlbumName = '';
    state.secondaryFilter = '';
    state.videoCategoryFilter = '';
    state.privateViewOpen = true;
    state.privateRouteUnlocked = false;
    state.privatePasswordDraft = '';
    state.privatePasswordError = '';
    state.focusedTileId = null;
  } else {
    state.primaryFilter = 'Collections';
    state.activeAlbumName = targetAlbum;
    state.secondaryFilter = '';
    state.videoCategoryFilter = '';
    clearPrivateViewState();
  }
  resetSearchQuery();
  state.previewId = null;
  clearSelection({ shouldRender: false });
  resetLoadedCount();
  pushNavigationHash();
  render();
  if (refs.scrollRegion) {
    refs.scrollRegion.scrollTo({ top: 0, behavior: 'auto' });
  }
}

function commitSelectionToCurrentTarget() {
  const targetAlbum = getAlbumSelectionTarget(state);
  const targetVideoAlbum = getVideoAlbumSelectionTarget(state);
  if (state.privateSelectionMode) {
    return setSelectionPrivateAlbum(true);
  }
  if (targetVideoAlbum) {
    return setSelectionVideoAlbum(targetVideoAlbum);
  }
  if (!targetAlbum || !state.selectedIds.size) {
    return false;
  }
  return commitSelectionToAlbum(targetAlbum);
}

function commitSelectionToAlbum(albumName) {
  if (state.albumDialogTarget === 'video') {
    return setSelectionVideoAlbum(albumName);
  }
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
      const existing = Array.isArray(nextAssignments[key]) ? [...nextAssignments[key]] : (nextAssignments[key] ? [nextAssignments[key]] : []);
      if (!existing.some((name) => normalizeAlbumKey(name) === normalizeAlbumKey(canonicalAlbumName))) {
        existing.push(canonicalAlbumName);
      }
      nextAssignments[key] = existing;
    }
  });
  state.albumAssignments = nextAssignments;
  persistAlbumAssignments();
  state.albumDialogOpen = false;
  state.albumDialogOrigin = '';
  state.albumDialogTarget = 'photo';
  state.albumDialogError = '';
  state.albumDraftName = '';
  resetAddToTargetModes(state);
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
  if (state.albumDialogTarget === 'video') {
    if (state.selectedIds.size) {
      return setSelectionVideoAlbum(draftName, { createOnly: true });
    }
    const canonicalVideoAlbumName = normalizeVideoCategory(draftName);
    if (!canonicalVideoAlbumName) {
      state.albumDialogError = 'Video album name is required.';
      renderAlbumDialogState({ focusKey: 'create', select: true });
      return false;
    }
    state.albumDialogOpen = false;
    state.albumDialogTarget = 'photo';
    state.albumDialogError = '';
    state.albumDraftName = '';
    openVideoAlbumSelection(canonicalVideoAlbumName);
    return true;
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
  state.albumDialogTarget = 'photo';
  state.albumDraftName = '';
  resetAddToTargetModes(state);
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
    showToast('Select one album item to set as cover.', 'error');
    return false;
  }

  const [selectedItem] = selectedItems;
  if (!itemBelongsToAlbum(selectedItem, activeAlbumName)) {
    showToast('Choose an item already inside this album.', 'error');
    return false;
  }

  const albumKey = normalizeAlbumKey(activeAlbumName);
  const itemKey = getPersistentItemKey(selectedItem);
  if (!albumKey || !itemKey) {
    showToast('This item cannot be used as an album cover yet.', 'error');
    return false;
  }

  state.albumCovers = {
    ...state.albumCovers,
    [albumKey]: itemKey
  };
  persistAlbumCovers();
  clearSelection({ shouldRender: false });
  render();
  showToast('Album cover updated.', 'success');
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
    viewModel.activePlaylistName || '',
    state.secondaryFilter || '',
    state.videoCategoryFilter || '',
    state.privateViewOpen ? 'private-view' : '',
    viewModel.isVideoAlbumRoot ? 'video-album-root' : '',
    viewModel.isGlobalSearchView ? 'global-search' : '',
    normalizeText(state.searchQuery || '')
  ].join('|');
}

function hasActiveSearchUiState() {
  return Boolean(normalizeText(state.searchQuery || '') || normalizeText(state.searchDraft || ''));
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
  const nextAssignments = {};
  for (const [fileId, value] of Object.entries(state.albumAssignments)) {
    if (!removedKeys.has(normalizeText(fileId))) {
      nextAssignments[fileId] = value;
    } else {
      const names = Array.isArray(value) ? value : [value];
      const filtered = names.filter((name) => normalizeAlbumKey(name) !== albumKey);
      if (filtered.length) {
        nextAssignments[fileId] = filtered;
      }
    }
  }

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
  const deleteOrigin = normalizeText(options.origin || state.confirmDialogOrigin || '');
  const previewDeleteFlow = deleteOrigin === 'preview' && selectedItems.length === 1 && Boolean(state.previewId);
  const previewItemsBeforeDelete = previewDeleteFlow ? getFilteredItems() : [];
  const previewIndexBeforeDelete = previewDeleteFlow
    ? previewItemsBeforeDelete.findIndex((item) => item.id === state.previewId)
    : -1;
  const snapshot = {
    mediaItems: state.mediaItems.slice(),
    selectedIds: new Set(state.selectedIds),
    lastSelectedId: state.lastSelectedId,
    previewId: state.previewId,
    albumAssignments: { ...state.albumAssignments }
  };

  const deletedIds = new Set();
  const deletedKeys = new Set();
  const failedItems = [];
  const requestedIds = new Set(selectedItems.map((item) => item.id));
  const requestedKeys = new Set(selectedItems.map((item) => getPersistentItemKey(item)).filter(Boolean));

  applyDeletedItemsLocally({
    deletedIds: requestedIds,
    deletedKeys: requestedKeys,
    snapshot,
    previewDeleteFlow,
    previewItemsBeforeDelete,
    previewIndexBeforeDelete
  });
  if (previewDeleteFlow) {
    if (!renderPreviewTransientLayers({ animateDirection: 1 })) {
      render();
    }
  } else {
    render();
  }

  const deleteResults = await Promise.all(selectedItems.map(async (item) => {
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
      return {
        item,
        success: true
      };
    } catch (error) {
      console.error('[media-library] delete failed', error);
      return {
        item,
        success: false
      };
    }
  }));

  deleteResults.forEach((result) => {
    if (result.success) {
      deletedIds.add(result.item.id);
      deletedKeys.add(getPersistentItemKey(result.item));
      return;
    }
    failedItems.push(result.item.id);
  });

  if (deletedIds.size !== requestedIds.size) {
    applyDeletedItemsLocally({
      deletedIds,
      deletedKeys,
      snapshot,
      previewDeleteFlow,
      previewItemsBeforeDelete,
      previewIndexBeforeDelete
    });
    if (previewDeleteFlow) {
      if (!renderPreviewTransientLayers({ animateDirection: 1 })) {
        render();
      }
    } else {
      render();
    }
  }

  if (deletedIds.size) {
    void syncStorageSummary({ forceRender: false });
    showToast(
      permanent
        ? `Deleted ${deletedIds.size} item${deletedIds.size === 1 ? '' : 's'} forever.`
        : `Moved ${deletedIds.size} item${deletedIds.size === 1 ? '' : 's'} to Bin.`,
      'success'
    );
  }
  if (failedItems.length) {
    showToast(`Failed to delete ${failedItems.length} item${failedItems.length === 1 ? '' : 's'}. Check your connection and try again.`);
  }
}

function applyDeletedItemsLocally({
  deletedIds = new Set(),
  deletedKeys = new Set(),
  snapshot,
  previewDeleteFlow = false,
  previewItemsBeforeDelete = [],
  previewIndexBeforeDelete = -1
} = {}) {
  const normalizedDeletedIds = deletedIds instanceof Set ? deletedIds : new Set(deletedIds);
  const normalizedDeletedKeys = deletedKeys instanceof Set ? deletedKeys : new Set(deletedKeys);
  const baseMediaItems = Array.isArray(snapshot?.mediaItems) ? snapshot.mediaItems : state.mediaItems;
  const baseSelectedIds = snapshot?.selectedIds instanceof Set ? snapshot.selectedIds : state.selectedIds;
  const baseLastSelectedId = snapshot?.lastSelectedId ?? state.lastSelectedId;
  const basePreviewId = snapshot?.previewId ?? state.previewId;
  const baseAlbumAssignments = snapshot?.albumAssignments && typeof snapshot.albumAssignments === 'object'
    ? snapshot.albumAssignments
    : state.albumAssignments;

  state.mediaItems = baseMediaItems.filter((item) => !normalizedDeletedIds.has(item.id));
  state.selectedIds = new Set([...baseSelectedIds].filter((id) => !normalizedDeletedIds.has(id)));
  if (baseLastSelectedId && !state.selectedIds.has(baseLastSelectedId)) {
    state.lastSelectedId = [...state.selectedIds].pop() || null;
  } else {
    state.lastSelectedId = baseLastSelectedId;
  }

  const nextAssignments = { ...baseAlbumAssignments };
  normalizedDeletedKeys.forEach((key) => {
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
    const previewItemsAfterDelete = previewItemsBeforeDelete.filter((item) => !normalizedDeletedIds.has(item.id));
    const nextPreviewItem = previewIndexBeforeDelete >= 0
      ? previewItemsAfterDelete[Math.min(previewIndexBeforeDelete, previewItemsAfterDelete.length - 1)] || null
      : null;
    state.previewId = nextPreviewItem?.id || null;
    return;
  }

  if (basePreviewId && normalizedDeletedIds.has(basePreviewId)) {
    state.previewId = null;
  } else {
    state.previewId = basePreviewId;
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
  const targetItem = getAllItems().find((entry) => entry.id === itemId);
  state.infoOpen = false;
  state.albumDialogOpen = true;
  state.albumDialogMode = 'assign';
  state.albumDialogOrigin = 'preview';
  state.albumDialogTarget = targetItem?.type === 'video' ? 'video' : 'photo';
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

function encodeMetadataPath(sourceId) {
  return String(sourceId || '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join(',');
}

function normalizePreviewDescription(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim();
}

function renderPreviewDescriptionHtml(value) {
  const normalized = normalizePreviewDescription(value);
  return normalized ? escapeHtml(normalized).replace(/\n/g, '<br>') : '';
}

function formatCaptureTimeMeta(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) {
    return 'Click to change';
  }
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()] || '';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMinutes = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absMinutes / 60)).padStart(2, '0');
  const offsetMins = String(absMinutes % 60).padStart(2, '0');
  return [weekday, `${hh}:${mm}`, `GMT${sign}${offsetHours}:${offsetMins}`].filter(Boolean).join('  ');
}

function formatCaptureTimeInputValue(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hh}:${mm}`;
}

function parseCaptureTimeInputValue(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) {
    return '';
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
    || date.getHours() !== hour
    || date.getMinutes() !== minute
  ) {
    return '';
  }
  return date.toISOString();
}

function buildPreviewCaptureTimeState(item, captureIso) {
  const date = new Date(captureIso);
  if (Number.isNaN(date.getTime())) {
    return item;
  }
  const dateParts = createDatePartsFromDate(date);
  return {
    ...item,
    takenAt: dateParts.takenAt,
    displayTakenAt: dateParts.displayTakenAt,
    timelineLabel: dateParts.timelineLabel,
    year: dateParts.year,
    month: dateParts.month,
    day: dateParts.day,
    monthLabel: dateParts.monthLabel,
  };
}

function patchCaptureTimeDisplay(section, item) {
  section.textContent = '';
  section.setAttribute('data-action', 'edit-capture-time');
  section.style.cssText = PREVIEW_INFO_EDITABLE_STYLE;
  const heading = document.createElement('h5');
  heading.className = 'cml-preview__info-heading';
  heading.textContent = 'Date & time';
  heading.style.cssText = PREVIEW_INFO_HEADING_STYLE;
  const wrapper = document.createElement('div');
  wrapper.className = 'cml-preview__info-time';
  const value = document.createElement('p');
  value.className = 'cml-preview__info-time-value';
  value.textContent = item?.displayTakenAt || 'Set date & time';
  value.style.cssText = PREVIEW_INFO_VALUE_STYLE;
  const meta = document.createElement('p');
  meta.className = 'cml-preview__info-time-meta';
  meta.textContent = formatCaptureTimeMeta(item?.takenAt);
  meta.style.cssText = PREVIEW_INFO_META_STYLE;
  wrapper.append(value, meta);
  section.append(heading, wrapper);
}

function patchVideoCategoryDisplay(section, category) {
  const normalizedCategory = normalizeVideoCategory(category);
  section.textContent = '';
  section.setAttribute('data-action', 'edit-video-category');
  section.style.cssText = PREVIEW_INFO_EDITABLE_STYLE;
  const heading = document.createElement('h5');
  heading.className = 'cml-preview__info-heading';
  heading.textContent = 'Video category';
  heading.style.cssText = PREVIEW_INFO_HEADING_STYLE;
  const wrapper = document.createElement('div');
  wrapper.className = 'cml-preview__info-category';
  const value = document.createElement('p');
  value.className = 'cml-preview__info-category-value';
  value.textContent = normalizedCategory || 'Choose video album';
  value.style.cssText = PREVIEW_INFO_VALUE_STYLE;
  const meta = document.createElement('p');
  meta.className = 'cml-preview__info-category-meta';
  meta.textContent = normalizedCategory ? 'Click to switch video album' : 'Choose or create a video album';
  meta.style.cssText = PREVIEW_INFO_META_STYLE;
  wrapper.append(value, meta);
  section.append(heading, wrapper);
}

function patchPrivateAlbumDisplay(section, item) {
  const isPrivate = isPrivateMedia(item);
  section.textContent = '';
  section.setAttribute('data-action', 'toggle-private-photo');
  section.style.cssText = PREVIEW_INFO_EDITABLE_STYLE;
  const heading = document.createElement('h5');
  heading.className = 'cml-preview__info-heading';
  heading.textContent = 'Hidden album';
  heading.style.cssText = PREVIEW_INFO_HEADING_STYLE;
  const wrapper = document.createElement('div');
  wrapper.className = 'cml-preview__info-category';
  const value = document.createElement('p');
  value.className = 'cml-preview__info-category-value';
  value.textContent = isPrivate ? 'Inside hidden album' : 'Visible in library';
  value.style.cssText = PREVIEW_INFO_VALUE_STYLE;
  const meta = document.createElement('p');
  meta.className = 'cml-preview__info-category-meta';
  meta.textContent = isPrivate
    ? 'Click to remove this photo from the hidden album'
    : 'Click to move this photo into the hidden album';
  meta.style.cssText = PREVIEW_INFO_META_STYLE;
  wrapper.append(value, meta);
  section.append(heading, wrapper);
}

function normalizeExplicitTags(tags = []) {
  return [...new Set(
    safeArray(tags)
      .map((tag) => normalizeText(tag).toLowerCase().replace(/^#+/, ''))
      .filter(Boolean)
  )];
}

function parsePreviewTagsInput(input = '') {
  return normalizeExplicitTags(
    String(input || '')
      .split(/[\n,]+/)
      .flatMap((part) => part.split(/\s+/))
  );
}

function formatPreviewTagsValue(tags = []) {
  return normalizeExplicitTags(tags).join(', ');
}

function patchTagsDisplay(section, tags = []) {
  const normalizedTags = normalizeExplicitTags(tags);
  section.textContent = '';
  section.setAttribute('data-action', 'edit-tags');
  section.style.cssText = PREVIEW_INFO_EDITABLE_STYLE;
  const heading = document.createElement('h5');
  heading.className = 'cml-preview__info-heading';
  heading.textContent = 'Tags';
  heading.style.cssText = PREVIEW_INFO_HEADING_STYLE;
  const wrapper = document.createElement('div');
  wrapper.className = 'cml-preview__info-tags-wrap';
  const tagsNode = document.createElement('div');
  tagsNode.className = 'cml-preview__info-tags';
  if (normalizedTags.length) {
    normalizedTags.forEach((tag) => {
      const pill = document.createElement('span');
      pill.className = 'cml-preview__info-tag';
      pill.textContent = tag;
      pill.style.cssText = PREVIEW_INFO_TAG_STYLE;
      tagsNode.appendChild(pill);
    });
  } else {
    const empty = document.createElement('p');
    empty.className = 'cml-preview__info-category-value';
    empty.textContent = 'Add tags';
    empty.style.cssText = PREVIEW_INFO_VALUE_STYLE;
    tagsNode.appendChild(empty);
  }
  const meta = document.createElement('p');
  meta.className = 'cml-preview__info-category-meta';
  meta.textContent = normalizedTags.length
    ? 'Click to edit tags for search and organization'
    : 'Add tags to organize this item and find it faster later';
  meta.style.cssText = PREVIEW_INFO_META_STYLE;
  wrapper.append(tagsNode, meta);
  section.append(heading, wrapper);
}

function applyPatchedCaptureTime(mediaItem, metadata) {
  if (!mediaItem || !metadata || typeof metadata !== 'object') {
    return;
  }
  const captureTime = resolveMediaCaptureTimestamp(metadata, metadata.FileName || mediaItem.label || mediaItem.sourceId || '');
  const timestamp = Number.isFinite(captureTime) ? captureTime : parseTimestamp(metadata.TimeStamp, 0);
  const dateParts = createDatePartsFromDate(new Date(timestamp));
  mediaItem.takenAt = dateParts.takenAt;
  mediaItem.displayTakenAt = dateParts.displayTakenAt;
  mediaItem.timelineLabel = dateParts.timelineLabel;
  mediaItem.year = dateParts.year;
  mediaItem.month = dateParts.month;
  mediaItem.day = dateParts.day;
  mediaItem.monthLabel = dateParts.monthLabel;
  mediaItem.exif = metadata.Exif || mediaItem.exif || null;
}

function applyPatchedVideoCategory(mediaItem, metadata) {
  if (!mediaItem || !metadata || typeof metadata !== 'object') {
    return;
  }
  mediaItem.videoCategory = normalizeVideoCategory(metadata.VideoCategory || '');
}

function applyPatchedPrivateAlbum(mediaItem, metadata) {
  if (!mediaItem || !metadata || typeof metadata !== 'object') {
    return;
  }
  mediaItem.isPrivateAlbum = inferPrivateAlbum(metadata, mediaItem.type);
}

function applyPatchedTags(mediaItem, metadata = {}) {
  if (!mediaItem || !metadata || typeof metadata !== 'object') {
    return;
  }
  mediaItem.explicitTags = normalizeExplicitTags(metadata.Tags);
  mediaItem.tags = inferTagsFromMetadata(
    metadata,
    mediaItem.label || mediaItem.sourceId || '',
    mediaItem.type,
  );
}

function refreshPreviewAfterMetadataPatch(itemId, options = {}) {
  return normalizeText(state.previewId) === normalizeText(itemId)
    && renderPreviewTransientLayers(options);
}

function sortMediaItemsInPlace(items) {
  return items.sort((left, right) => {
    const leftTime = Date.parse(left?.takenAt || '') || 0;
    const rightTime = Date.parse(right?.takenAt || '') || 0;
    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }
    return String(left?.label || '').localeCompare(String(right?.label || ''));
  });
}

async function savePreviewDescription(itemId, description) {
  const item = getAllItems().find((entry) => entry.id === itemId);
  if (!item || !item.sourceId) {
    showToast('Cannot save description for this item');
    return;
  }

  const encodedPath = encodeMetadataPath(item.sourceId);

  try {
    const response = await apiFetch(`/api/manage/metadata/${encodedPath}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Description: description })
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to save description');
    }

    const mediaItem = state.mediaItems.find((entry) => entry.id === itemId);
    if (mediaItem) {
      mediaItem.description = normalizePreviewDescription(description);
    }
    refreshPreviewAfterMetadataPatch(itemId);

  } catch (error) {
    showToast(error.message || 'Failed to save description');
  }
}

async function savePreviewCaptureTime(itemId, captureTimeInput, previousItem = null) {
  const item = getAllItems().find((entry) => entry.id === itemId);
  if (!item || !item.sourceId) {
    showToast('Cannot save date & time for this item');
    return;
  }

  const nextDateTaken = parseCaptureTimeInputValue(captureTimeInput);
  if (!nextDateTaken) {
    const captureSection = refs.root?.querySelector('.cml-preview__info-section--capture-time');
    if (captureSection && previousItem) {
      patchCaptureTimeDisplay(captureSection, previousItem);
    }
    showToast('Please choose a valid date & time');
    return;
  }

  const encodedPath = encodeMetadataPath(item.sourceId);

  try {
    const response = await apiFetch(`/api/manage/metadata/${encodedPath}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ DateTaken: nextDateTaken })
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to save date & time');
    }

    const mediaItem = state.mediaItems.find((entry) => entry.id === itemId);
    if (mediaItem) {
      applyPatchedCaptureTime(mediaItem, data.metadata || {});
      sortMediaItemsInPlace(state.mediaItems);
    }

    if (!refreshPreviewAfterMetadataPatch(itemId)) {
      render();
    }
  } catch (error) {
    const captureSection = refs.root?.querySelector('.cml-preview__info-section--capture-time');
    if (captureSection && previousItem) {
      patchCaptureTimeDisplay(captureSection, previousItem);
    }
    showToast(error.message || 'Failed to save date & time');
  }
}

async function savePreviewVideoCategory(itemId, categoryInput, previousItem = null) {
  const item = getAllItems().find((entry) => entry.id === itemId);
  if (!item || !item.sourceId) {
    showToast('Cannot save video category for this item');
    return;
  }

  const nextCategory = normalizeVideoCategory(categoryInput);
  const encodedPath = encodeMetadataPath(item.sourceId);

  try {
    const response = await apiFetch(`/api/manage/metadata/${encodedPath}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ VideoCategory: nextCategory })
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to save video category');
    }

    const mediaItem = state.mediaItems.find((entry) => entry.id === itemId);
    if (mediaItem) {
      applyPatchedVideoCategory(mediaItem, data.metadata || {});
    }

    if (!refreshPreviewAfterMetadataPatch(itemId)) {
      render();
    }
  } catch (error) {
    const categorySection = refs.root?.querySelector('.cml-preview__info-section--video-category');
    if (categorySection && previousItem) {
      patchVideoCategoryDisplay(categorySection, previousItem.videoCategory);
    }
    showToast(error.message || 'Failed to save video category');
  }
}

async function savePreviewPrivateAlbum(itemId, nextPrivate, previousItem = null) {
  const item = getAllItems().find((entry) => entry.id === itemId);
  if (!item || !item.sourceId || !['photo', 'video'].includes(item.type)) {
    showToast('Only photos and videos can be moved into Private');
    return;
  }

  const encodedPath = encodeMetadataPath(item.sourceId);

  try {
    const response = await apiFetch(`/api/manage/metadata/${encodedPath}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ PrivateAlbum: Boolean(nextPrivate) })
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to update hidden album');
    }

    const mediaItem = state.mediaItems.find((entry) => entry.id === itemId);
    if (mediaItem) {
      applyPatchedPrivateAlbum(mediaItem, data.metadata || {});
    }
    state.selectedIds.delete(itemId);
    render();
  } catch (error) {
    const privateSection = refs.root?.querySelector('.cml-preview__info-section--private-album');
    if (privateSection && previousItem) {
      patchPrivateAlbumDisplay(privateSection, previousItem);
    }
    showToast(error.message || 'Failed to update hidden album');
  }
}

async function savePreviewTags(itemId, tagInput, previousItem = null) {
  const item = getAllItems().find((entry) => entry.id === itemId);
  if (!item || !item.sourceId) {
    showToast('Cannot save tags for this item');
    return;
  }

  const encodedPath = encodeMetadataPath(item.sourceId);
  const nextTags = parsePreviewTagsInput(tagInput);

  try {
    const response = await apiFetch(`/api/manage/tags/${encodedPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set', tags: nextTags })
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to save tags');
    }

    const patchedMetadata = {
      ...(item.exif ? { Exif: item.exif } : {}),
      ...(typeof data.metadata === 'object' && data.metadata ? data.metadata : {}),
      Tags: normalizeExplicitTags(data.tags),
    };

    const mediaItem = state.mediaItems.find((entry) => entry.id === itemId);
    if (mediaItem) {
      applyPatchedTags(mediaItem, patchedMetadata);
    }

    if (!refreshPreviewAfterMetadataPatch(itemId)) {
      render();
    }
  } catch (error) {
    const tagSection = refs.root?.querySelector('.cml-preview__info-section--tags');
    if (tagSection && previousItem) {
      patchTagsDisplay(tagSection, previousItem.explicitTags || previousItem.tags || []);
    }
    showToast(error.message || 'Failed to save tags');
  }
}

async function setSelectionPrivateAlbum(nextPrivate) {
  const selectedMedia = getSelectedItems().filter((item) => ['photo', 'video'].includes(item?.type) && item?.sourceId);
  if (!selectedMedia.length) {
    showToast('Select one or more photos or videos first');
    return;
  }

  let updated = 0;
  for (const item of selectedMedia) {
    const encodedPath = encodeMetadataPath(item.sourceId);
    try {
      const response = await apiFetch(`/api/manage/metadata/${encodedPath}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ PrivateAlbum: Boolean(nextPrivate) })
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to update hidden album');
      }
      const mediaItem = state.mediaItems.find((entry) => entry.id === item.id);
      if (mediaItem) {
        applyPatchedPrivateAlbum(mediaItem, data.metadata || {});
      }
      updated += 1;
    } catch (error) {
      console.warn('[media-library] failed to update hidden album flag', item.sourceId, error);
    }
  }

  if (!updated) {
    showToast('No selected photos or videos were updated');
    return;
  }

  state.selectedIds.clear();
  if (nextPrivate) {
    resetAddToTargetModes(state);
  }
  if (!nextPrivate && isPrivateRouteActive()) {
    state.previewId = null;
  }
  render();
  showToast(nextPrivate
    ? `Moved ${updated} item${updated === 1 ? '' : 's'} to Private`
    : `Removed ${updated} item${updated === 1 ? '' : 's'} from Private`, 'success');
}

async function setSelectionVideoAlbum(albumName, { createOnly = false } = {}) {
  const canonicalAlbumName = normalizeVideoCategory(albumName);
  if (!canonicalAlbumName) {
    state.albumDialogError = 'Video album name is required.';
    renderAlbumDialogState({
      preferPreviewRender: state.albumDialogOrigin === 'preview',
      focusKey: 'create',
      select: true
    });
    return false;
  }

  const selectedVideos = getSelectedItems().filter((item) => item?.type === 'video' && item?.sourceId);
  if (!selectedVideos.length) {
    showToast('Select one or more videos first');
    return false;
  }

  let updated = 0;
  for (const item of selectedVideos) {
    const encodedPath = encodeMetadataPath(item.sourceId);
    try {
      const response = await apiFetch(`/api/manage/metadata/${encodedPath}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ VideoCategory: canonicalAlbumName })
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to update video album');
      }
      const mediaItem = state.mediaItems.find((entry) => entry.id === item.id);
      if (mediaItem) {
        applyPatchedVideoCategory(mediaItem, data.metadata || {});
      }
      updated += 1;
    } catch (error) {
      console.warn('[media-library] failed to update video album', item.sourceId, error);
    }
  }

  if (!updated) {
    showToast('No selected videos were updated');
    return false;
  }

  state.albumDialogOpen = false;
  state.albumDialogOrigin = '';
  state.albumDialogTarget = 'photo';
  state.albumDialogError = '';
  state.albumDraftName = '';
  resetAddToTargetModes(state);
  state.albumDrawerSearch = '';
  state.albumDrawerScope = 'all';
  state.albumDrawerCreateMode = false;
  clearSelection({ shouldRender: false });
  state.primaryFilter = 'Photos';
  state.secondaryFilter = 'Videos';
  state.videoCategoryFilter = canonicalAlbumName;
  resetLoadedCount();
  pushNavigationHash();
  render();
  showToast(
    createOnly
      ? `Created video album "${canonicalAlbumName}" and added ${updated} video${updated === 1 ? '' : 's'}`
      : `Added ${updated} video${updated === 1 ? '' : 's'} to "${canonicalAlbumName}"`,
    'success'
  );
  return true;
}

function createDocFolder(folderName) {
  const currentDir = state.docsCurrentDir || '';
  const fullPath = currentDir ? currentDir + '/' + folderName : folderName;
  state.docsFolders.add(fullPath);
  state.docsNewFolderOpen = false;
  showToast(`Folder "${folderName}" created`, 'success');
  render();
}

async function moveFilesToFolder(itemIds, targetDir) {
  let moved = 0;
  for (const itemId of itemIds) {
    const item = state.mediaItems.find((entry) => entry.id === itemId);
    if (!item || !item.sourceId) continue;

    const encodedPath = encodeMetadataPath(item.sourceId);

    try {
      const response = await apiFetch(`/api/manage/metadata/${encodedPath}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Directory: targetDir })
      });
      const data = await response.json();
      if (response.ok && data?.success) {
        item.directory = normalizeText(targetDir);
        moved++;
      }
    } catch (error) {
      console.warn('[media-library] failed to move file', itemId, error);
    }
  }

  if (moved) {
    showToast(`Moved ${moved} file${moved === 1 ? '' : 's'}`, 'success');
    render();
  }
  return moved;
}

async function deleteDocFolder(dirPath) {
  if (!dirPath) return;
  // Move all files in this folder (and subfolders) to root
  const allItems = getAllItems();
  const dirPrefix = dirPath + '/';
  const itemsInFolder = allItems.filter((item) => {
    const itemDir = String(item.directory || '').replace(/\/+$/, '');
    return itemDir === dirPath || itemDir.startsWith(dirPrefix);
  });
  if (itemsInFolder.length) {
    const ids = itemsInFolder.map((item) => item.id);
    await moveFilesToFolder(ids, '');
  }
  // Remove the folder and any subfolders from docsFolders
  if (state.docsFolders instanceof Set) {
    const toDelete = [];
    state.docsFolders.forEach((p) => {
      if (p === dirPath || p.startsWith(dirPrefix)) toDelete.push(p);
    });
    toDelete.forEach((p) => state.docsFolders.delete(p));
  }
  // If currently inside the deleted folder, navigate up
  if (state.docsCurrentDir === dirPath || state.docsCurrentDir.startsWith(dirPrefix)) {
    state.docsCurrentDir = '';
  }
  showToast(`Folder "${dirPath.split('/').pop()}" deleted`, 'success');
  render();
}

function downloadSelectedDocs() {
  const selectedItems = getAllItems().filter((item) => state.selectedIds.has(item.id));
  if (!selectedItems.length) {
    showToast('No files selected');
    return;
  }
  startDownloads(selectedItems, { source: 'documents' });
}

function openDocsMoveDialog() {
  const selectedItems = getAllItems().filter((item) => state.selectedIds.has(item.id));
  if (!selectedItems.length) {
    showToast('No files selected');
    return;
  }
  state.docsMoveDialogOpen = true;
  state.docsMoveDialogDir = '';
  state.docsMoveCreateOpen = false;
  state.docsMoveCreateName = '';
  render();
}

async function moveSelectedDocsToFolder(targetDir) {
  const selectedItemIds = [...state.selectedIds];
  if (!selectedItemIds.length) return;
  const normalizedTargetDir = normalizeText(targetDir);
  const currentDir = normalizeText(state.docsCurrentDir);
  state.docsMoveDialogOpen = false;
  state.docsMoveCreateOpen = false;
  state.docsMoveCreateName = '';
  await moveFilesToFolder(selectedItemIds, normalizedTargetDir);
  state.selectedIds.clear();
  state.docsContextMenu = null;
  if (currentDir && normalizedTargetDir !== currentDir) {
    state.docsCurrentDir = normalizedTargetDir;
  }
  await performSyncLiveMedia({ forceRender: true });
}

function patchDescriptionDisplay(section, text) {
  section.textContent = '';
  section.setAttribute('data-action', 'edit-description');
  section.style.cssText = PREVIEW_INFO_EDITABLE_STYLE;
  const p = document.createElement('p');
  p.className = 'cml-preview__info-description' + (text ? ' has-content' : '');
  if (text) {
    p.innerHTML = renderPreviewDescriptionHtml(text);
  } else {
    p.textContent = 'Add a description';
  }
  p.style.cssText = PREVIEW_INFO_VALUE_STYLE.replace('font-weight:600;', 'font-weight:500;line-height:1.45;white-space:pre-wrap;');
  section.appendChild(p);
}

function getVisibleSecondaryFilters(items) {
  return navigationModel.secondary.filter((label) => {
    if (label === 'TODO') {
      return items.some((item) => isTodoPhotoItem(item));
    }
    return true;
  });
}

function isTodoPhotoItem(item) {
  return item?.type === 'photo' && resolveCollectionAlbums(item).length === 0;
}



function getFilteredItems(items = getAllItems(), { ignoreVideoCategoryFilter = false } = {}) {
  const parsedSearch = parseMediaSearchQuery(state.searchQuery);
  const query = parsedSearch.textQuery.toLowerCase();
  const activeAlbumName = getActiveAlbumName();
  const albumSelectionTarget = getAlbumSelectionTarget(state);
  const videoAlbumSelectionTarget = getVideoAlbumSelectionTarget(state);
  const searchFilters = parsedSearch.filters;
  const hasGlobalSearch = Boolean(query || countActiveMediaSearchFilters(searchFilters) > 0);

  return items.filter((item) => {
    if (isPrivateRouteActive()) {
      if (!hasPrivateRouteAccess() || !isPrivateMedia(item)) {
        return false;
      }
    } else if (item?.isPrivateAlbum) {
      return false;
    }

    if (activeAlbumName && !itemBelongsToAlbum(item, activeAlbumName)) {
      return false;
    }

    if (albumSelectionTarget && itemBelongsToAlbum(item, albumSelectionTarget)) {
      return false;
    }

    if (state.albumPickerDistinctOnly && canUseDistinctAlbumPicker(state) && !isTodoPhotoItem(item)) {
      return false;
    }

    if (state.privateSelectionMode && !['photo', 'video'].includes(item.type)) {
      return false;
    }

    if (videoAlbumSelectionTarget && (item.type !== 'video' || itemMatchesVideoAlbum(item, videoAlbumSelectionTarget))) {
      return false;
    }

    if (!hasGlobalSearch && state.primaryFilter === 'Collections' && !activeAlbumName) {
      return false;
    }

    if (!hasGlobalSearch && state.primaryFilter === 'Music' && item.type !== 'audio') {
      return false;
    }

    switch (hasGlobalSearch ? '' : state.secondaryFilter) {
      case 'TODO':
        if (!isTodoPhotoItem(item)) {
          return false;
        }
        break;
      case 'Videos':
        if (item.type !== 'video') {
          return false;
        }
        if (!ignoreVideoCategoryFilter && state.videoCategoryFilter) {
          if (!itemMatchesVideoAlbum(item, state.videoCategoryFilter)) {
            return false;
          }
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
        // In Photos view (no secondary filter), exclude documents and audio
        // unless the user explicitly filtered to that media type.
        if (!hasGlobalSearch && state.primaryFilter === 'Photos' && item.type === 'document'
            && searchFilters.type !== 'document') {
          return false;
        }
        if (!hasGlobalSearch && state.primaryFilter === 'Photos' && item.type === 'audio'
            && searchFilters.type !== 'audio') {
          return false;
        }
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
  const hasSearchFilters = countActiveMediaSearchFilters(searchFilters) > 0;
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
    resolveCollectionAlbums(item).forEach((albumName) => {
      const group = ensureGroup(albumName);
      if (group) {
        group.items.push(item);
      }
    });
  });

  return [...groups.values()]
    .filter((group) => {
      const matchingItems = group.items.filter((item) => (
        matchesSearchQuery(item, query) && matchesMediaSearchFilters(item, searchFilters)
      ));
      if (!query && !hasSearchFilters) {
        return group.items.length > 0 || state.albumNames.some((albumName) => albumName.toLowerCase() === group.key);
      }
      if (query && group.name.toLowerCase().includes(query) && !hasSearchFilters) {
        return true;
      }
      return matchingItems.length > 0;
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
  const accessibleItems = getAccessibleItems();
  const visibleSecondaryFilters = getVisibleSecondaryFilters(accessibleItems);
  if (state.secondaryFilter && !visibleSecondaryFilters.includes(state.secondaryFilter)) {
    state.secondaryFilter = '';
  }

  const parsedSearch = parseMediaSearchQuery(state.searchQuery);
  const globalSearchActive = Boolean(
    parsedSearch.textQuery
    || countActiveMediaSearchFilters(parsedSearch.filters) > 0
  );
  if (state.primaryFilter === 'Music' && state.activePlaylistName) {
    const playlistExists = state.playlistNames.some((name) => normalizePlaylistKey(name) === normalizePlaylistKey(state.activePlaylistName));
    if (!playlistExists) {
      state.activePlaylistName = '';
    }
  }
  const activeAlbumName = getActiveAlbumName();
  const albumSelectionTarget = getAlbumSelectionTarget(state);
  const videoAlbumSelectionTarget = getVideoAlbumSelectionTarget(state);
  const filteredItems = getFilteredItems(accessibleItems);
  const searchPhotoItems = globalSearchActive
    ? filteredItems.filter((item) => item?.type === 'photo')
    : [];
  const searchVideoItems = globalSearchActive
    ? filteredItems.filter((item) => item?.type === 'video')
    : [];
  const searchAudioItems = globalSearchActive
    ? filteredItems.filter((item) => item?.type === 'audio')
    : [];
  const searchFileItems = globalSearchActive
    ? filteredItems.filter((item) => item?.isDocumentLike)
    : [];
  const searchAlbumCards = globalSearchActive
    ? buildCollectionSummaries(accessibleItems)
    : [];
  const searchPhotoSections = globalSearchActive
    ? buildSearchTimelineSections(searchPhotoItems, 'search-photo')
    : [];
  const searchVideoSections = globalSearchActive
    ? buildSearchTimelineSections(searchVideoItems, 'search-video')
    : [];
  const videoCategoryScopeItems = state.secondaryFilter === 'Videos'
    ? getFilteredItems(accessibleItems, { ignoreVideoCategoryFilter: true })
    : [];
  const activeVideoAlbumItemCount = state.secondaryFilter === 'Videos' && state.videoCategoryFilter
    ? accessibleItems.filter((item) => itemMatchesVideoAlbum(item, state.videoCategoryFilter)).length
    : 0;
  const videoAlbumCards = state.secondaryFilter === 'Videos'
    ? buildVideoAlbumSummaries(videoCategoryScopeItems)
    : [];
  const videoAlbumGroupedItemCount = videoAlbumCards.reduce((sum, group) => sum + group.itemCount, 0);
  const isVideoAlbumRoot = isVideoAlbumRootView(parsedSearch);
  const videoCategoryOptions = state.secondaryFilter === 'Videos'
    ? buildVideoCategoryOptions(videoCategoryScopeItems, state.videoCategoryFilter)
    : [];
  const selectedItems = getSelectedItems(accessibleItems);
  const activeAlbumItems = activeAlbumName
    ? accessibleItems.filter((item) => itemBelongsToAlbum(item, activeAlbumName))
    : [];
  const activeAlbumCover = activeAlbumName
    ? findAlbumCoverItem(activeAlbumName, activeAlbumItems)
    : { item: null, isCustom: false };
  const allCollections = (state.primaryFilter === 'Collections' && !activeAlbumName) || globalSearchActive
    ? buildCollectionSummaries(accessibleItems)
    : [];
  const collectionCards = allCollections.slice(0, state.loadedCount);
  const isMindView = state.primaryFilter === 'Mind';
  const isGlobalSearchView = globalSearchActive
    && !isMindView
    && state.primaryFilter !== 'Bin'
    && !activeAlbumName
    && !state.videoCategoryFilter
    && !state.privateViewOpen
    && !albumSelectionTarget
    && !videoAlbumSelectionTarget
    && !state.privateSelectionMode;
  const globalSearchResultCount = isGlobalSearchView
    ? searchPhotoItems.length
      + searchVideoItems.length
      + searchAudioItems.length
      + searchFileItems.length
      + searchAlbumCards.length
    : 0;
  const isFilmsView = state.primaryFilter === 'Films' && !isGlobalSearchView;
  const isMusicView = state.primaryFilter === 'Music' && !isGlobalSearchView;
  const isCollectionRoot = state.primaryFilter === 'Collections' && !activeAlbumName && !isGlobalSearchView;
  const isAlbumPickerMode = hasAnyPickerTarget(state);
  const musicPlaylists = (isMusicView || isGlobalSearchView) ? buildMusicPlaylistSummaries(accessibleItems) : [];
  const musicItems = isMusicView
    ? getMusicContextItems(accessibleItems)
    : [];
  const audioQueueItems = getAudioQueueItems(accessibleItems);
  const currentAudioItem = getAudioItemById(state.audioCurrentId, accessibleItems)
    || getAudioItemById(state.audioCurrentId, getAllItems());
  const timelineItems = isMindView || isMusicView || isFilmsView
    ? []
    : state.primaryFilter === 'Bin'
    ? state.binItems
    : filteredItems;
  const baseSections = isMindView || isMusicView || isCollectionRoot || isFilmsView
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
  const laidOutSections = isMindView || isMusicView || isCollectionRoot || isFilmsView
    ? []
    : buildTimelineLayoutSections(baseSections, {
        sectionGap: state.primaryFilter === 'Bin' ? BIN_TIMELINE_SECTION_GAP : TIMELINE_SECTION_GAP
      });
  const shouldVirtualizeTimeline = !isMindView && !isMusicView && !isCollectionRoot && !isFilmsView && timelineItems.length > TIMELINE_VIRTUALIZATION_ITEM_THRESHOLD;
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
    : (isMindView || isMusicView || isCollectionRoot)
      ? { sections: [], signature: '' }
      : applyTimelineVirtualWindow(laidOutSections, {
          scrollTop: state.virtualScrollTop,
          viewportHeight: state.virtualViewportHeight
        });
  const sections = virtualWindow.sections;
  const years = isMindView || isMusicView || isCollectionRoot || isFilmsView
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
    && itemBelongsToAlbum(selectedItems[0], activeAlbumName)
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
    videoAlbumSelectionTarget,
    isAlbumPickerMode,
    isFilmsView,
    isMindView,
    isGlobalSearchView,
    globalSearchResultCount,
    isMusicView,
    activePlaylistName: getActivePlaylistName(),
    isCollectionRoot,
    musicPlaylists,
    collectionCards,
    totalCollectionCount: allCollections.length,
    filteredItems,
    searchPhotoItems,
    searchVideoItems,
    searchAudioItems,
    searchFileItems,
    searchAlbumCards,
    searchPhotoSections,
    searchVideoSections,
    musicItems,
    currentAudioItem,
    audioQueueItems,
    isVideoAlbumRoot,
    videoAlbumCards,
    videoAlbumCount: videoAlbumCards.length,
    videoAlbumGroupedItemCount,
    videoAlbumUngroupedCount: Math.max(0, videoCategoryScopeItems.length - videoAlbumGroupedItemCount),
    activeVideoAlbumItemCount,
    videoCategoryOptions,
    videoCategoryScopeCount: videoCategoryScopeItems.length,
    sections,
    timelineLayoutSections: laidOutSections,
    timelineVirtualSignature: virtualWindow.signature,
    timelineVirtualEnabled: shouldVirtualizeTimeline,
    years,
    scrubberSections,
    previewItems,
    previewIndex,
    previewItem,
    availableAlbums: getAvailableAlbumNames(accessibleItems),
    previewAlbumEntries: buildPreviewAlbumEntries(accessibleItems),
    filmRecord: getActiveFilmRecord(),
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
  const getLayoutBucket = (width) => {
    if (width <= 640) return 'phone';
    if (width <= 960) return 'mobile';
    if (width <= 1180) return 'compact-desktop';
    if (width <= 1380) return 'desktop';
    return 'wide';
  };
  const nextWidth = Math.max(280, Math.round(refs.contentInner.clientWidth - 4));
  const previousWidth = Math.max(280, Number(state.layoutWidth) || 0);
  const bucketChanged = getLayoutBucket(nextWidth) !== getLayoutBucket(previousWidth);
  const widthDelta = Math.abs(nextWidth - previousWidth);
  if (!bucketChanged && widthDelta <= 80) {
    return;
  }
  state.layoutWidth = nextWidth;
  window.requestAnimationFrame(() => {
    if (refs.root) {
      render();
    }
  });
}

/** Surgical sidebar active-state update — avoids full innerHTML rebuild flicker */
function patchSidebarActive() {
  if (!refs.root) return;
  refs.root.querySelectorAll('.cml-sidebar__nav-item').forEach((btn) => {
    const primary = btn.dataset.primary;
    const active = primary === 'Private'
      ? isPrivateRouteActive()
      : primary === state.primaryFilter && !state.secondaryFilter && !state.privateViewOpen;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-current', active ? 'page' : 'false');
    if (primary === 'Mind') {
      const labelNode = btn.querySelector('.cml-sidebar__nav-label');
      if (labelNode) {
        labelNode.textContent = state.mindSettings?.contactName || 'Mind';
      }
    }
  });
  refs.root.querySelectorAll('.cml-sidebar__subnav-item').forEach((btn) => {
    const secondary = btn.dataset.secondary;
    const active = secondary === state.secondaryFilter;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-current', active ? 'page' : 'false');
  });
  refs.root.querySelectorAll('.cml-mobile-nav__tab').forEach((btn) => {
    const primary = btn.dataset.primary;
    const secondary = btn.dataset.secondary;
    const active = primary
      ? (primary === 'Private'
        ? isPrivateRouteActive()
        : state.primaryFilter === primary && !state.secondaryFilter && !state.privateViewOpen)
      : (state.secondaryFilter === secondary);
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-current', active ? 'page' : 'false');
  });
}

function buildSearchTimelineSections(items = [], anchorPrefix = 'search') {
  if (!items.length) {
    return [];
  }
  return buildTimelineLayoutSections(buildSections(items, { anchorPrefix }), {
    sectionGap: TIMELINE_SECTION_GAP
  }).map((section) => ({
    ...section,
    startIndex: section.rows.length ? 0 : -1,
    endIndex: section.rows.length ? section.rows.length - 1 : -1,
    topSpacerHeight: 0,
    bottomSpacerHeight: 0,
    visibleRows: section.rows
  }));
}

function isPrimaryViewDomInSync(primary) {
  if (!(refs.root instanceof HTMLElement)) {
    return true;
  }
  const contentInner = refs.root.querySelector('.cml-main-content__inner');
  const domPrimary = contentInner instanceof HTMLElement
    ? normalizeText(contentInner.dataset.primaryView)
    : '';
  const domSecondary = contentInner instanceof HTMLElement
    ? normalizeText(contentInner.dataset.secondaryView)
    : '';
  const domPrivate = contentInner instanceof HTMLElement
    ? contentInner.dataset.privateView === '1'
    : false;
  const domAlbum = contentInner instanceof HTMLElement
    ? normalizeText(contentInner.dataset.activeAlbum || '')
    : '';
  const domPlaylist = contentInner instanceof HTMLElement
    ? normalizeText(contentInner.dataset.activePlaylist || '')
    : '';
  const domSearchView = contentInner instanceof HTMLElement
    ? contentInner.dataset.searchView === '1'
    : false;
  if (primary === 'Music') {
    return domPrimary === 'Music'
      && !domSecondary
      && !domPrivate
      && !domAlbum
      && !domSearchView
      && (refs.root.querySelector('.cml-main-content__inner.is-music-view') instanceof HTMLElement)
      && domPlaylist === normalizeText(state.activePlaylistName || '');
  }
  if (primary === 'Mind') {
    return domPrimary === 'Mind'
      && !domSecondary
      && !domPrivate
      && !domAlbum
      && !domSearchView
      && (refs.root.querySelector('.cml-main-content__inner.is-mind-view') instanceof HTMLElement);
  }
  return domPrimary === normalizeText(primary)
    && domSecondary === normalizeText(state.secondaryFilter || '')
    && domPrivate === Boolean(state.privateViewOpen)
    && domAlbum === normalizeText(state.activeAlbumName || '')
    && !domSearchView
    && domPlaylist === normalizeText(state.activePlaylistName || '');
}

function getActiveFilmRecord() {
  if (!state.activeFilmId) {
    return null;
  }
  if (state.filmManualDraft?.id === state.activeFilmId) {
    return state.filmManualDraft;
  }
  if (state.filmTransientDetailRecord?.id === state.activeFilmId) {
    return state.filmTransientDetailRecord;
  }
  return state.films.find((record) => record.id === state.activeFilmId) || null;
}

function findFilmRecordByTarget(target = '') {
  const normalized = normalizeText(target);
  if (!normalized) {
    return null;
  }
  return state.films.find((record) => record.id === normalized || String(record.tmdbId || '') === normalized)
    || (state.filmTransientDetailRecord?.id === normalized ? state.filmTransientDetailRecord : null)
    || null;
}

function getFilmDraftRecordById(id = '') {
  const normalized = normalizeText(id);
  return normalized && state.filmManualDraft?.id === normalized ? state.filmManualDraft : null;
}

function clearTransientFilmDetail() {
  state.filmTransientDetailRecord = null;
}

function normalizeFilmRecord(movie = {}, entry = null, existingRecord = null) {
  const source = normalizeFilmSource(entry?.source || movie.source || existingRecord?.source || (movie.tmdbId || existingRecord?.tmdbId ? 'tmdb' : 'manual'));
  const overrides = normalizeFilmMetadataOverrides({
    ...(existingRecord || {}),
    ...(movie || {}),
    ...(entry || {})
  });
  const cacheTitle = normalizeText(movie.cacheTitle || movie.title || existingRecord?.cacheTitle || '');
  const cacheOriginalTitle = normalizeText(movie.cacheOriginalTitle || movie.originalTitle || existingRecord?.cacheOriginalTitle || '');
  const cacheDirector = normalizeText(movie.cacheDirector || movie.director || existingRecord?.cacheDirector || '');
  const cacheOverview = normalizeText(movie.cacheOverview || movie.overview || existingRecord?.cacheOverview || '');
  const cacheReleaseDate = normalizeText(movie.cacheReleaseDate || movie.releaseDate || existingRecord?.cacheReleaseDate || '');
  const cacheRuntime = movie.cacheRuntime ?? movie.runtime ?? existingRecord?.cacheRuntime ?? null;
  const cacheGenres = Array.isArray(movie.cacheGenres)
    ? movie.cacheGenres
    : (Array.isArray(movie.genres)
      ? movie.genres
      : (Array.isArray(existingRecord?.cacheGenres) ? existingRecord.cacheGenres : []));
  const moviePosterPath = movie.posterPathOverride ? '' : movie.posterPath;
  const moviePosterPaths = movie.posterPathOverride ? [] : movie.posterPaths;
  const existingPosterPath = existingRecord?.posterPathOverride ? '' : existingRecord?.posterPath;
  const existingPosterPaths = existingRecord?.posterPathOverride ? [] : existingRecord?.posterPaths;
  const cachePosterPath = normalizeText(movie.cachePosterPath || moviePosterPath || existingRecord?.cachePosterPath || existingPosterPath || '');
  const cachePosterPaths = normalizeFilmBackdropPaths([
    ...(Array.isArray(movie.cachePosterPaths) ? movie.cachePosterPaths : []),
    ...(Array.isArray(moviePosterPaths) ? moviePosterPaths : []),
    ...(Array.isArray(existingRecord?.cachePosterPaths) ? existingRecord.cachePosterPaths : []),
    ...(Array.isArray(existingPosterPaths) ? existingPosterPaths : []),
    cachePosterPath
  ]);
  const movieBackdropPath = movie.backdropPathOverride ? '' : movie.backdropPath;
  const movieBackdropPaths = movie.backdropPathOverride ? [] : movie.backdropPaths;
  const existingBackdropPath = existingRecord?.backdropPathOverride ? '' : existingRecord?.backdropPath;
  const existingBackdropPaths = existingRecord?.backdropPathOverride ? [] : existingRecord?.backdropPaths;
  const cacheBackdropPath = normalizeText(movie.cacheBackdropPath || movieBackdropPath || existingRecord?.cacheBackdropPath || existingBackdropPath || '');
  const cacheBackdropPaths = normalizeFilmBackdropPaths([
    ...(Array.isArray(movie.cacheBackdropPaths) ? movie.cacheBackdropPaths : []),
    ...(Array.isArray(movieBackdropPaths) ? movieBackdropPaths : []),
    ...(Array.isArray(existingRecord?.cacheBackdropPaths) ? existingRecord.cacheBackdropPaths : []),
    ...(Array.isArray(existingBackdropPaths) ? existingBackdropPaths : []),
    cacheBackdropPath
  ]);
  const releaseDate = overrides.releaseDateOverride || cacheReleaseDate;
  const releaseYear = String(releaseDate || '').slice(0, 4) || String(movie.year || existingRecord?.year || '');
  const watchStatus = entry?.watchStatus
    || normalizeWatchStatusForPayload(movie.status || existingRecord?.status || '')
    || 'wantToWatch';
  const status = watchStatus === 'wantToWatch' ? 'watchlist' : watchStatus;
  const tmdbId = Number(movie.tmdbId ?? entry?.tmdbId ?? existingRecord?.tmdbId);
  const userRating = entry?.userRating === null || entry?.userRating === undefined
    ? (movie.userRating ?? movie.rating ?? existingRecord?.userRating ?? null)
    : Number(entry.userRating);
  const id = Number.isFinite(tmdbId) && tmdbId > 0
    ? `tmdb-${tmdbId}`
    : normalizeText(entry?.id || movie.id || existingRecord?.id || `manual-${Date.now()}`);
  const title = overrides.titleOverride || cacheTitle || cacheOriginalTitle || existingRecord?.title || 'Untitled film';
  const originalTitle = overrides.originalTitleOverride || cacheOriginalTitle || cacheTitle || existingRecord?.originalTitle || '';
  const overview = overrides.overviewOverride || cacheOverview;
  const genres = overrides.genresOverride.length
    ? overrides.genresOverride
    : cacheGenres;
  const runtime = overrides.runtimeOverride ?? cacheRuntime;
  const localNote = normalizeText(entry?.note || existingRecord?.note || '');
  const localJournal = normalizeMultilineText(entry?.journal || entry?.noteMarkdown || existingRecord?.journal || existingRecord?.noteMarkdown || '');
  const backdropFrame = normalizeFilmBackdropFrameOverrides({
    ...existingRecord,
    ...movie,
    ...entry
  });
  return {
    id,
    source,
    tmdbId: Number.isFinite(tmdbId) && tmdbId > 0 ? tmdbId : null,
    title,
    localTitle: title,
    originalTitle,
    releaseDate,
    year: releaseYear,
    status,
    favorite: Boolean(entry?.isFavorite ?? movie.favorite ?? existingRecord?.favorite),
    userRating: Number.isFinite(userRating) ? userRating : null,
    rating: Number.isFinite(userRating) ? userRating : null,
    overview,
    note: localNote,
    journal: localJournal,
    noteMarkdown: localJournal,
    watchedAt: entry?.watchedAt || existingRecord?.watchedAt || '',
    watchEvents: normalizeFilmWatchEvents(entry?.watchEvents || existingRecord?.watchEvents || []),
    addedAt: entry?.createdAt || existingRecord?.addedAt || movie.updatedAt || '',
    updatedAt: entry?.updatedAt || movie.updatedAt || existingRecord?.updatedAt || '',
    director: overrides.directorOverride || cacheDirector,
    genres,
    country: existingRecord?.country || '',
    language: existingRecord?.language || '',
    runtime,
    posterPath: overrides.posterPathOverride || cachePosterPath || (!existingRecord?.posterPathOverride ? existingRecord?.posterPath : '') || '',
    posterPaths: normalizeFilmBackdropPaths([
      overrides.posterPathOverride,
      ...cachePosterPaths,
      ...(!existingRecord?.posterPathOverride && Array.isArray(existingRecord?.posterPaths) ? existingRecord.posterPaths : []),
      !existingRecord?.posterPathOverride ? existingRecord?.posterPath : ''
    ]),
    posterUrl: overrides.posterUrlOverride || movie.posterUrl || (!existingRecord?.posterUrlOverride ? existingRecord?.posterUrl : '') || '',
    backdropPath: overrides.backdropPathOverride || cacheBackdropPath || (!existingRecord?.backdropPathOverride ? existingRecord?.backdropPath : '') || '',
    backdropPaths: normalizeFilmBackdropPaths([
      overrides.backdropPathOverride,
      ...cacheBackdropPaths,
      ...(!existingRecord?.backdropPathOverride && Array.isArray(existingRecord?.backdropPaths) ? existingRecord.backdropPaths : []),
      !existingRecord?.backdropPathOverride ? existingRecord?.backdropPath : ''
    ]),
    backdropUrl: overrides.backdropUrlOverride || movie.backdropUrl || (!existingRecord?.backdropUrlOverride ? existingRecord?.backdropUrl : '') || '',
    voteAverage: movie.voteAverage ?? existingRecord?.voteAverage ?? null,
    voteCount: movie.voteCount ?? existingRecord?.voteCount ?? null,
    cacheTitle,
    cacheOriginalTitle,
    cacheDirector,
    cacheOverview,
    cacheReleaseDate,
    cacheRuntime,
    cacheGenres,
    cachePosterPath,
    cachePosterPaths,
    cacheBackdropPath,
    cacheBackdropPaths,
    titleOverride: overrides.titleOverride,
    originalTitleOverride: overrides.originalTitleOverride,
    directorOverride: overrides.directorOverride,
    releaseDateOverride: overrides.releaseDateOverride,
    runtimeOverride: overrides.runtimeOverride,
    genresOverride: overrides.genresOverride,
    overviewOverride: overrides.overviewOverride,
    posterPathOverride: overrides.posterPathOverride,
    backdropPathOverride: overrides.backdropPathOverride,
    posterUrlOverride: overrides.posterUrlOverride,
    backdropUrlOverride: overrides.backdropUrlOverride,
    backdropZoomOverride: backdropFrame.backdropZoomOverride,
    backdropPositionXOverride: backdropFrame.backdropPositionXOverride,
    backdropPositionYOverride: backdropFrame.backdropPositionYOverride,
    isSaving: Number.isFinite(tmdbId) && tmdbId > 0 && state.filmSavingTmdbIds.has(tmdbId)
  };
}

function normalizeMovieRecord(movie = {}, entry = null) {
  return normalizeFilmRecord(movie, entry);
}

function preferLocalText(...values) {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) {
      return normalized;
    }
  }
  return '';
}

function preferLocalMultilineText(...values) {
  for (const value of values) {
    const normalized = normalizeMultilineText(value);
    if (normalized) {
      return normalized;
    }
  }
  return '';
}

function normalizeFilmGenresOverride(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean).slice(0, 40);
  }
  return String(value ?? '')
    .split(/[,\n/]+/)
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, 40);
}

function normalizeFilmRuntimeOverride(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
}

function normalizeFilmImageOverride(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }
  if (normalized.startsWith('/file/')) {
    return normalized;
  }
  try {
    const url = new URL(normalized);
    return url.protocol === 'http:' || url.protocol === 'https:' ? normalized : '';
  } catch {
    return '';
  }
}

function normalizeFilmImagePathOverride(value) {
  const normalized = normalizeText(value).slice(0, 240);
  if (!normalized || /^https?:\/\//i.test(normalized) || normalized.startsWith('data:') || normalized.startsWith('/file/')) {
    return '';
  }
  return normalized;
}

function normalizeFilmBackdropZoomOverride(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 1.02;
  }
  return Math.max(0.5, Math.min(1.8, Math.round(numeric * 100) / 100));
}

function normalizeFilmBackdropPositionOverride(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 50;
  }
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeFilmBackdropFrameOverrides(source = {}) {
  return {
    backdropZoomOverride: normalizeFilmBackdropZoomOverride(source.backdropZoomOverride),
    backdropPositionXOverride: normalizeFilmBackdropPositionOverride(source.backdropPositionXOverride),
    backdropPositionYOverride: normalizeFilmBackdropPositionOverride(source.backdropPositionYOverride)
  };
}

function backdropFrameEqualsRecord(frame = {}, record = {}) {
  const left = normalizeFilmBackdropFrameOverrides(frame);
  const right = normalizeFilmBackdropFrameOverrides(record);
  return left.backdropZoomOverride === right.backdropZoomOverride
    && left.backdropPositionXOverride === right.backdropPositionXOverride
    && left.backdropPositionYOverride === right.backdropPositionYOverride;
}

function normalizeFilmBackdropPaths(value = []) {
  return (Array.isArray(value) ? value : [])
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, 20);
}

function normalizeFilmMetadataOverrides(source = {}) {
  return {
    titleOverride: normalizeText(source.titleOverride),
    originalTitleOverride: normalizeText(source.originalTitleOverride),
    directorOverride: normalizeText(source.directorOverride),
    releaseDateOverride: normalizeText(source.releaseDateOverride).slice(0, 40),
    runtimeOverride: normalizeFilmRuntimeOverride(source.runtimeOverride),
    genresOverride: normalizeFilmGenresOverride(source.genresOverride),
    overviewOverride: normalizeText(source.overviewOverride),
    posterPathOverride: normalizeFilmImagePathOverride(source.posterPathOverride),
    backdropPathOverride: normalizeFilmImagePathOverride(source.backdropPathOverride),
    posterUrlOverride: normalizeFilmImageOverride(source.posterUrlOverride),
    backdropUrlOverride: normalizeFilmImageOverride(source.backdropUrlOverride)
  };
}

function normalizeFilmSource(source = '', tmdbId = 0) {
  const normalized = normalizeText(source).toLowerCase();
  if (normalized === 'manual' || normalized === 'tmdb') {
    return normalized;
  }
  const numericTmdbId = Number(tmdbId);
  return Number.isFinite(numericTmdbId) && numericTmdbId > 0 ? 'tmdb' : 'manual';
}

function getFilmRecordSaveTarget(record = {}) {
  if (!record) {
    return { filmId: '', tmdbId: 0, source: 'tmdb' };
  }
  const filmId = normalizeText(record.id || '');
  const tmdbId = Number(record.tmdbId);
  return {
    filmId,
    tmdbId: Number.isFinite(tmdbId) && tmdbId > 0 ? tmdbId : 0,
    source: normalizeFilmSource(record.source, tmdbId)
  };
}

function normalizeFilmWatchEvents(value = []) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  return source
    .map((item, index) => {
      const watchedAt = normalizeText(typeof item === 'string' ? item : item?.watchedAt || item?.date).slice(0, 10);
      const createdAt = normalizeText(typeof item === 'object' ? item?.createdAt : '') || (watchedAt ? `${watchedAt}T00:00:00.000Z` : '');
      const fallbackId = watchedAt ? `watch-${`${watchedAt}-${createdAt}-${index}`.replace(/[^0-9a-z]/gi, '').slice(0, 40)}` : '';
      const id = normalizeText(typeof item === 'object' ? item?.id || item?.watchEventId : '') || fallbackId;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(watchedAt) || !id || seen.has(id)) {
        return null;
      }
      seen.add(id);
      return {
        id,
        watchedAt,
        rating: normalizeFilmUserRating(typeof item === 'object' ? item?.rating : null),
        note: normalizeText(typeof item === 'object' ? item?.note : ''),
        createdAt
      };
    })
    .filter(Boolean)
    .sort((left, right) =>
      String(right.watchedAt || '').localeCompare(String(left.watchedAt || ''))
      || String(right.createdAt || '').localeCompare(String(left.createdAt || ''))
    );
}

function appendFilmWatchEvent(events = [], watchedAt = new Date().toISOString().slice(0, 10)) {
  const normalizedDate = normalizeText(watchedAt).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    return normalizeFilmWatchEvents(events);
  }
  const createdAt = new Date().toISOString();
  return normalizeFilmWatchEvents([
    ...normalizeFilmWatchEvents(events),
    { id: `watch-${`${normalizedDate}-${createdAt}-${Date.now()}`.replace(/[^0-9a-z]/gi, '').slice(0, 40)}`, watchedAt: normalizedDate, createdAt }
  ]);
}

function replacePrimaryFilmWatchEvent(events = [], previousWatchedAt = '', nextWatchedAt = '', watchEventId = '') {
  const previousDate = normalizeText(previousWatchedAt).slice(0, 10);
  const nextDate = normalizeText(nextWatchedAt).slice(0, 10);
  const targetId = normalizeText(watchEventId);
  const normalizedEvents = normalizeFilmWatchEvents(events);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) {
    return normalizedEvents;
  }
  if ((targetId && normalizedEvents.some((event) => event.id === targetId)) || (/^\d{4}-\d{2}-\d{2}$/.test(previousDate) && normalizedEvents.some((event) => event.watchedAt === previousDate))) {
    return normalizeFilmWatchEvents(normalizedEvents.map((event) =>
      (targetId ? event.id === targetId : event.watchedAt === previousDate) ? { ...event, watchedAt: nextDate } : event
    ));
  }
  return appendFilmWatchEvent(normalizedEvents, nextDate);
}

function hasFilmMetadataOverrides(source = {}) {
  const overrides = normalizeFilmMetadataOverrides(source);
  return FILM_METADATA_FIELDS.some((field) => {
    const value = overrides[field];
    return Array.isArray(value) ? value.length > 0 : value !== null && value !== '';
  });
}

function createFilmMetadataDraft(record = {}) {
  return {
    titleOverride: normalizeText(record.titleOverride || ''),
    originalTitleOverride: normalizeText(record.originalTitleOverride || ''),
    directorOverride: normalizeText(record.directorOverride || ''),
    releaseDateOverride: normalizeText(record.releaseDateOverride || ''),
    runtimeOverride: record.runtimeOverride === null || record.runtimeOverride === undefined
      ? ''
      : String(record.runtimeOverride),
    genresOverride: Array.isArray(record.genresOverride) ? record.genresOverride.join(', ') : normalizeText(record.genresOverride || ''),
    overviewOverride: normalizeText(record.overviewOverride || ''),
    posterPathOverride: normalizeText(record.posterPathOverride || ''),
    backdropPathOverride: normalizeText(record.backdropPathOverride || ''),
    posterUrlOverride: normalizeText(record.posterUrlOverride || ''),
    backdropUrlOverride: normalizeText(record.backdropUrlOverride || '')
  };
}

function getFilmAutoBackdropPaths(record = {}) {
  if (!record || normalizeText(record.backdropUrlOverride) || normalizeText(record.backdropPathOverride)) {
    return [];
  }
  return normalizeFilmBackdropPaths([
    ...(Array.isArray(record.backdropPaths) ? record.backdropPaths : []),
    record.backdropPath
  ]);
}

function resetFilmBackdropRotation() {
  if (filmBackdropRotationTimer) {
    window.clearTimeout(filmBackdropRotationTimer);
    filmBackdropRotationTimer = 0;
  }
}

function getActiveFilmBackdropIndex(record = getActiveFilmRecord()) {
  if (!record?.id) {
    return 0;
  }
  const paths = getFilmAutoBackdropPaths(record);
  if (paths.length <= 1) {
    return 0;
  }
  const index = Number(state.filmBackdropIndexByFilmId?.[record.id]) || 0;
  return Math.max(0, Math.min(paths.length - 1, index));
}

function buildFilmBackdropImageUrl(path = '') {
  const normalized = normalizeText(path);
  if (!normalized) {
    return '';
  }
  if (/^https?:\/\//i.test(normalized) || normalized.startsWith('data:')) {
    return normalized;
  }
  return `https://image.tmdb.org/t/p/w1280${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
}

function rotateActiveFilmBackdrop() {
  const record = getActiveFilmRecord();
  const paths = getFilmAutoBackdropPaths(record);
  if (
    !record?.id
    || paths.length <= 1
    || state.filmNotesEditing
    || state.filmMetadataEditing
    || state.filmImagePickerMode
    || state.filmSaveStatus?.state === 'saving'
    || document.hidden
    || (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  ) {
    scheduleFilmBackdropRotation();
    return;
  }
  const nextIndex = (getActiveFilmBackdropIndex(record) + 1) % paths.length;
  state.filmBackdropIndexByFilmId = {
    ...(state.filmBackdropIndexByFilmId || {}),
    [record.id]: nextIndex
  };
  patchFilmBackdropImage(record, nextIndex);
  scheduleFilmBackdropRotation();
}

function scheduleFilmBackdropRotation() {
  resetFilmBackdropRotation();
  const record = getActiveFilmRecord();
  if (
    !state.filmDetailOpen
    || !record
    || state.filmNotesEditing
    || state.filmMetadataEditing
    || state.filmImagePickerMode
    || state.filmSaveStatus?.state === 'saving'
    || document.hidden
    || (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    || getFilmAutoBackdropPaths(record).length <= 1
  ) {
    return;
  }
  filmBackdropRotationTimer = window.setTimeout(rotateActiveFilmBackdrop, FILM_BACKDROP_ROTATION_MS);
}

function patchFilmBackdropImage(record = getActiveFilmRecord(), backdropIndex = getActiveFilmBackdropIndex(record)) {
  const paths = getFilmAutoBackdropPaths(record);
  if (!refs.root || !record || paths.length <= 1) {
    return false;
  }
  const image = refs.root.querySelector('.cml-film-detail-page__backdrop-image');
  if (!(image instanceof HTMLImageElement)) {
    return false;
  }
  const nextPath = paths[backdropIndex] || paths[0] || '';
  if (!nextPath) {
    return false;
  }
  const nextUrl = buildFilmBackdropImageUrl(nextPath);
  if (image.getAttribute('src') === nextUrl) {
    return true;
  }
  const preload = new Image();
  preload.decoding = 'async';
  preload.onload = () => {
    if (!image.isConnected) {
      return;
    }
    image.classList.add('is-switching');
    window.setTimeout(() => {
      if (!image.isConnected) {
        return;
      }
      image.setAttribute('src', nextUrl);
      image.dataset.filmBackdropIndex = String(backdropIndex);
      window.requestAnimationFrame(() => {
        if (image.isConnected) {
          image.classList.remove('is-switching');
        }
      });
    }, 120);
  };
  preload.onerror = () => {
    if (image.isConnected) {
      image.classList.remove('is-switching');
    }
  };
  preload.src = nextUrl;
  return true;
}

function upsertFilmRecord(record, { preserveLocal = false } = {}) {
  if (!record?.id) {
    return;
  }
  const normalizedTmdbId = Number(record.tmdbId);
  const existingIndex = state.films.findIndex((item) => {
    const itemTmdbId = Number(item.tmdbId);
    return (Number.isFinite(normalizedTmdbId) && normalizedTmdbId > 0 && itemTmdbId === normalizedTmdbId)
      || item.id === record.id;
  });
  const existing = existingIndex >= 0 ? state.films[existingIndex] : null;
  const merged = normalizeFilmRecord(record, null, existing);
  const preserved = {
    ...merged,
    userRating: preserveLocal ? (existing?.userRating ?? record.userRating ?? null) : (record.userRating ?? existing?.userRating ?? null),
    rating: preserveLocal ? (existing?.userRating ?? record.userRating ?? null) : (record.userRating ?? existing?.userRating ?? null),
    note: preserveLocal
      ? preferLocalText(existing?.note, record.note, merged.note)
      : preferLocalText(record.note, existing?.note, merged.note),
    journal: preserveLocal
      ? preferLocalMultilineText(existing?.journal, existing?.noteMarkdown, record.journal, record.noteMarkdown, merged.journal)
      : preferLocalMultilineText(record.journal, record.noteMarkdown, existing?.journal, existing?.noteMarkdown, merged.journal),
    noteMarkdown: preserveLocal
      ? preferLocalMultilineText(existing?.noteMarkdown, existing?.journal, record.noteMarkdown, record.journal, merged.noteMarkdown)
      : preferLocalMultilineText(record.noteMarkdown, record.journal, existing?.noteMarkdown, existing?.journal, merged.noteMarkdown),
    watchedAt: preserveLocal ? (existing?.watchedAt ?? record.watchedAt ?? '') : (record.watchedAt ?? existing?.watchedAt ?? ''),
    watchEvents: preserveLocal
      ? normalizeFilmWatchEvents(existing?.watchEvents?.length ? existing.watchEvents : record.watchEvents || [])
      : normalizeFilmWatchEvents(record.watchEvents?.length ? record.watchEvents : existing?.watchEvents || []),
    status: preserveLocal ? (existing?.status ?? record.status ?? merged.status) : (record.status ?? existing?.status ?? merged.status),
    favorite: preserveLocal ? (existing?.favorite ?? record.favorite ?? false) : (record.favorite ?? existing?.favorite ?? false),
    ...normalizeFilmMetadataOverrides(preserveLocal ? { ...record, ...existing } : { ...existing, ...record }),
    ...normalizeFilmBackdropFrameOverrides(preserveLocal ? { ...record, ...existing } : { ...existing, ...record }),
    isSaving: Boolean(record.isSaving)
  };
  const nextFilms = state.films.slice();
  if (existingIndex >= 0) {
    nextFilms.splice(existingIndex, 1);
  }
  state.films = [preserved, ...nextFilms];
}

function findMovieSourceByTmdbId(tmdbId) {
  const normalizedId = Number(tmdbId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
    return null;
  }
  return state.films.find((record) => Number(record.tmdbId) === normalizedId)
    || (Number(state.filmTransientDetailRecord?.tmdbId) === normalizedId ? state.filmTransientDetailRecord : null)
    || state.filmSearchResults.find((movie) => Number(movie.tmdbId) === normalizedId)
    || null;
}

function isUnsavedActiveFilmPreview(tmdbId = null) {
  if (!state.filmDetailOpen || !state.filmTransientDetailRecord || state.filmTransientDetailRecord.isSavedEntry !== false) {
    return false;
  }
  const normalizedId = Number(tmdbId ?? state.filmTransientDetailRecord.tmdbId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
    return true;
  }
  return Number(state.filmTransientDetailRecord.tmdbId) === normalizedId;
}

function clearMatchingTransientFilmDetail(tmdbId) {
  const normalizedId = Number(tmdbId);
  if (Number.isFinite(normalizedId) && Number(state.filmTransientDetailRecord?.tmdbId) === normalizedId) {
    clearTransientFilmDetail();
  }
}

function createTransientFilmDetailRecord(source = {}, existing = null, { isLoading = false } = {}) {
  const record = normalizeFilmRecord(source || {}, null, existing);
  if (existing) {
    return {
      ...record,
      ...existing,
      ...record,
      isSavedEntry: true,
      isSaving: Boolean(isLoading)
    };
  }
  return {
    ...record,
    status: '',
    favorite: false,
    userRating: null,
    rating: null,
    note: '',
    journal: '',
    noteMarkdown: '',
    watchedAt: '',
    watchEvents: [],
    addedAt: '',
    isSavedEntry: false,
    isSaving: Boolean(isLoading)
  };
}

function getMoviePayloadImagePath(source = {}, kind = 'poster') {
  const isBackdrop = kind === 'backdrop';
  const cachePath = normalizeText(isBackdrop ? source.cacheBackdropPath : source.cachePosterPath);
  if (cachePath) {
    return cachePath;
  }
  const overridePath = normalizeText(isBackdrop ? source.backdropPathOverride : source.posterPathOverride);
  const directPath = normalizeText(isBackdrop ? source.backdropPath : source.posterPath);
  if (!overridePath && directPath) {
    return directPath;
  }
  const paths = normalizeFilmBackdropPaths(isBackdrop ? source.backdropPaths : source.posterPaths);
  return paths.find((path) => path !== overridePath) || '';
}

function getMoviePayloadImagePaths(source = {}, kind = 'poster') {
  const isBackdrop = kind === 'backdrop';
  const cachePaths = normalizeFilmBackdropPaths(isBackdrop ? source.cacheBackdropPaths : source.cachePosterPaths);
  if (cachePaths.length) {
    return cachePaths;
  }
  const overridePath = normalizeText(isBackdrop ? source.backdropPathOverride : source.posterPathOverride);
  return normalizeFilmBackdropPaths(isBackdrop ? source.backdropPaths : source.posterPaths)
    .filter((path) => path !== overridePath);
}

function toMoviePayload(source = {}, tmdbId = 0) {
  return {
    tmdbId: Number(source.tmdbId || tmdbId),
    title: source.cacheTitle || source.title || source.localTitle || source.originalTitle || 'Untitled film',
    originalTitle: source.cacheOriginalTitle || source.originalTitle || source.title || source.localTitle || '',
    director: source.cacheDirector || source.director || '',
    overview: source.cacheOverview || source.overview || '',
    posterPath: getMoviePayloadImagePath(source, 'poster'),
    posterPaths: getMoviePayloadImagePaths(source, 'poster'),
    backdropPath: getMoviePayloadImagePath(source, 'backdrop'),
    backdropPaths: getMoviePayloadImagePaths(source, 'backdrop'),
    releaseDate: source.cacheReleaseDate || source.releaseDate || (source.year ? `${source.year}-01-01` : ''),
    runtime: source.cacheRuntime ?? source.runtime ?? null,
    genres: Array.isArray(source.cacheGenres) ? source.cacheGenres : (Array.isArray(source.genres) ? source.genres : []),
    voteAverage: source.voteAverage ?? source.tmdbRating ?? null,
    voteCount: source.voteCount ?? null
  };
}

function normalizeWatchStatusForPayload(status = '') {
  return status === 'watchlist' ? 'wantToWatch' : (status || 'wantToWatch');
}

function normalizeFilmUserRating(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Math.min(5, Math.max(0.5, Math.round(numeric * 10) / 10));
}

function createOptimisticFilmRecord(tmdbId, patch = {}, { isSaving = true } = {}) {
  const source = findMovieSourceByTmdbId(tmdbId) || { tmdbId };
  const movie = source.movie ? source.movie : toMoviePayload(source, tmdbId);
  const existing = state.films.find((record) => Number(record.tmdbId) === Number(tmdbId));
  const watchStatus = patch.watchStatus || normalizeWatchStatusForPayload(existing?.status || source.status || 'wantToWatch');
  const entry = {
    tmdbId: Number(tmdbId),
    watchStatus,
    userRating: Object.prototype.hasOwnProperty.call(patch, 'userRating')
      ? patch.userRating
      : existing?.userRating ?? null,
    note: Object.prototype.hasOwnProperty.call(patch, 'note')
      ? patch.note
      : existing?.note && existing.note !== movie.overview ? existing.note : '',
    journal: Object.prototype.hasOwnProperty.call(patch, 'journal')
      ? patch.journal
      : existing?.journal || existing?.noteMarkdown || '',
    noteMarkdown: Object.prototype.hasOwnProperty.call(patch, 'noteMarkdown')
      ? patch.noteMarkdown
      : existing?.noteMarkdown || existing?.journal || '',
    ...normalizeFilmMetadataOverrides({
      ...existing,
      ...patch
    }),
    ...normalizeFilmBackdropFrameOverrides({
      ...existing,
      ...patch
    }),
    tags: [],
    isFavorite: Object.prototype.hasOwnProperty.call(patch, 'isFavorite')
      ? Boolean(patch.isFavorite)
      : Boolean(existing?.favorite),
    watchedAt: patch.watchedAt ?? existing?.watchedAt ?? '',
    watchEvents: Object.prototype.hasOwnProperty.call(patch, 'watchEvents')
      ? normalizeFilmWatchEvents(patch.watchEvents)
      : (Object.prototype.hasOwnProperty.call(patch, 'appendWatchEvent')
        ? appendFilmWatchEvent(existing?.watchEvents || [], patch.appendWatchEvent)
        : (Object.prototype.hasOwnProperty.call(patch, 'watchedAt')
          ? replacePrimaryFilmWatchEvent(existing?.watchEvents || [], existing?.watchedAt || '', patch.watchedAt, patch.watchEventId)
          : normalizeFilmWatchEvents(existing?.watchEvents || []))),
    createdAt: existing?.addedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  return {
    ...normalizeMovieRecord(movie, entry),
    isSaving: Boolean(isSaving)
  };
}

function createOptimisticManualFilmRecord(film = {}, patch = {}) {
  const existing = state.films.find((record) => record.id === film.id) || null;
  const source = {
    source: 'manual',
    id: existing?.id || film.id || `manual-${Date.now()}`
  };
  const movie = {
    source: 'manual',
    id: source.id,
    tmdbId: null,
    title: patch.titleOverride || film.title || existing?.title || 'Untitled film',
    originalTitle: patch.originalTitleOverride || film.originalTitle || existing?.originalTitle || '',
    director: patch.directorOverride || film.director || existing?.director || '',
    overview: patch.overviewOverride || film.overview || existing?.overview || '',
    posterPath: '',
    posterPaths: [],
    backdropPath: '',
    backdropPaths: [],
    releaseDate: patch.releaseDateOverride || film.releaseDate || existing?.releaseDate || '',
    runtime: patch.runtimeOverride ?? film.runtime ?? existing?.runtime ?? null,
    genres: Array.isArray(patch.genresOverride) && patch.genresOverride.length
      ? patch.genresOverride
      : (Array.isArray(film.genres) ? film.genres : (Array.isArray(existing?.genres) ? existing.genres : [])),
    voteAverage: null,
    voteCount: null
  };
  return {
    ...normalizeMovieRecord(movie, {
      ...existing,
      ...film,
      ...patch,
      source: 'manual',
      tmdbId: null,
      id: source.id,
      watchStatus: normalizeWatchStatusForPayload(patch.watchStatus || existing?.status || film.status || 'wantToWatch'),
      userRating: Object.prototype.hasOwnProperty.call(patch, 'userRating') ? patch.userRating : existing?.userRating ?? null,
      note: Object.prototype.hasOwnProperty.call(patch, 'note') ? patch.note : existing?.note || '',
      journal: Object.prototype.hasOwnProperty.call(patch, 'journal') ? patch.journal : existing?.journal || existing?.noteMarkdown || '',
      noteMarkdown: Object.prototype.hasOwnProperty.call(patch, 'noteMarkdown') ? patch.noteMarkdown : existing?.noteMarkdown || existing?.journal || '',
      isFavorite: Object.prototype.hasOwnProperty.call(patch, 'isFavorite') ? patch.isFavorite : Boolean(existing?.favorite),
      watchedAt: Object.prototype.hasOwnProperty.call(patch, 'watchedAt') ? patch.watchedAt : existing?.watchedAt || '',
      watchEvents: Object.prototype.hasOwnProperty.call(patch, 'watchEvents')
        ? patch.watchEvents
        : (Object.prototype.hasOwnProperty.call(patch, 'appendWatchEvent')
          ? appendFilmWatchEvent(existing?.watchEvents || [], patch.appendWatchEvent)
          : (Object.prototype.hasOwnProperty.call(patch, 'watchedAt')
            ? replacePrimaryFilmWatchEvent(existing?.watchEvents || [], existing?.watchedAt || '', patch.watchedAt, patch.watchEventId)
            : normalizeFilmWatchEvents(existing?.watchEvents || [])))
    }),
    source: 'manual',
    tmdbId: null,
    isSaving: false
  };
}

function createManualDraftFilmRecord({ id = `manual-draft-${Date.now()}`, createdAt = new Date().toISOString() } = {}) {
  return {
    ...normalizeMovieRecord({
      source: 'manual',
      id,
      title: '',
      originalTitle: '',
      director: '',
      overview: '',
      releaseDate: '',
      runtime: null,
      genres: [],
      posterUrl: '',
      backdropUrl: ''
    }, {
      source: 'manual',
      id,
      watchStatus: 'wantToWatch',
      titleOverride: '',
      createdAt,
      updatedAt: createdAt
    }),
    id,
    source: 'manual',
    tmdbId: null,
    title: '',
    localTitle: '',
    manualDraft: true,
    isSaving: false
  };
}

function applyMovieEntries(entries = []) {
  const remoteRecords = (Array.isArray(entries) ? entries : [])
    .map((item) => item?.movie ? normalizeMovieRecord(item.movie, item.entry) : null)
    .filter(Boolean);
  state.films = remoteRecords;
  if (state.filmManualDraft?.id && remoteRecords.some((record) => record.id === state.filmManualDraft.id)) {
    state.filmManualDraft = null;
  }
}

async function deleteFilmEntry(filmIdOrTmdbId, { silent = false } = {}) {
  const target = normalizeText(filmIdOrTmdbId);
  if (!target) {
    return false;
  }
  const previousFilms = state.films.slice();
  const removingActiveFilm = previousFilms.some((record) =>
    record.id === state.activeFilmId && (record.id === target || String(record.tmdbId || '') === target)
  );
  state.films = state.films.filter((record) =>
    record.id !== target && String(record.tmdbId || '') !== target
  );
  if (removingActiveFilm) {
    state.filmDetailOpen = false;
    state.activeFilmId = '';
    state.filmMoreActionsOpen = false;
    state.filmNotesEditing = false;
    state.filmNotesDraft = '';
    state.filmNotesPreview = false;
    state.filmMetadataEditing = false;
    state.filmMetadataDraft = null;
    state.filmMetadataFocusField = '';
    state.filmMoreActionsOpen = false;
    state.filmImagePickerMode = '';
    state.filmImagePickerDraft = '';
    state.filmBackdropFrameDraft = null;
    state.filmRemovedUndoRecord = null;
    clearTransientFilmDetail();
    pushNavigationHash({ mode: 'push' });
    render();
  } else {
    renderFilmMutationState();
  }
  try {
    await fetchMovieJson(`/api/manage/movies?id=${encodeURIComponent(target)}`, { method: 'DELETE' });
    if (!silent) {
      showToast('Removed from Films', 'success');
    }
    return true;
  } catch (error) {
    state.films = previousFilms;
    state.filmError = error.message || 'Failed to remove film';
    showToast(state.filmError, 'error');
    render();
    return false;
  }
}

async function removeKnownAccidentalFilmEntries() {
  if (loadJson(FILM_ACCIDENTAL_ENTRY_CLEANUP_KEY, false)) {
    return;
  }
  const accidentalTitles = new Set([
    'No More Bets',
    '\u5b64\u6ce8\u4e00\u63b7',
    'But Always',
    '\u4e00\u751f\u4e00\u4e16',
    'Ikkyu-san',
    'Ikkyu San',
    '\u4e00\u4f11\u3055\u3093'
  ]);
  const targets = state.films
    .filter((record) => [record.title, record.localTitle, record.originalTitle].some((title) => accidentalTitles.has(normalizeText(title))))
    .map((record) => record.id || String(record.tmdbId))
    .filter(Boolean);
  let allDeleted = true;
  for (const target of targets) {
    allDeleted = await deleteFilmEntry(target, { silent: true }) && allDeleted;
  }
  if (allDeleted) {
    saveJson(FILM_ACCIDENTAL_ENTRY_CLEANUP_KEY, true);
  }
}

function getVisibleFilmRecords() {
  const activeFilter = FILM_FILTERS.includes(state.filmActiveFilter)
    ? state.filmActiveFilter
    : FILM_FILTERS[0];
  const libraryQuery = normalizeText(state.filmLibraryQuery).toLowerCase();
  const matchesLibraryQuery = (record = {}) => {
    if (!libraryQuery) {
      return true;
    }
    return [
      record.localTitle,
      record.title,
      record.originalTitle,
      record.director,
      ...(Array.isArray(record.genres) ? record.genres : []),
      record.year,
      record.releaseDate,
      record.overview,
      record.note,
      record.journal,
      record.noteMarkdown
    ].some((value) => normalizeText(value).toLowerCase().includes(libraryQuery));
  };
  const filteredByQuery = state.films.filter(matchesLibraryQuery);
  if (activeFilter === 'Favorites') {
    return filteredByQuery.filter((record) => record.favorite);
  }
  if (activeFilter === 'Favourites') {
    return filteredByQuery.filter((record) => record.favorite);
  }
  if (activeFilter === 'Watched') {
    return filteredByQuery.filter((record) => record.status === 'watched');
  }
  if (activeFilter === 'Watching') {
    return filteredByQuery.filter((record) => record.status === 'watching');
  }
  if (activeFilter === 'Watchlist') {
    return filteredByQuery.filter((record) => record.status === 'watchlist' || record.status === 'wantToWatch');
  }
  return filteredByQuery;
}

function getSavedFilmRecordsByTmdbId() {
  const records = new Map();
  state.films.forEach((record) => {
    const tmdbId = Number(record.tmdbId);
    if (Number.isFinite(tmdbId) && tmdbId > 0) {
      records.set(tmdbId, record);
    }
  });
  return records;
}

async function loadMovieEntries({ forceRender = false } = {}) {
  try {
    const payload = await fetchJson('/api/manage/movies?action=entries');
    applyMovieEntries(payload?.entries || []);
    void removeKnownAccidentalFilmEntries();
    state.filmError = '';
    if (forceRender) {
      render();
    }
  } catch (error) {
    state.filmError = error.message || 'Failed to load local film list';
    if (forceRender) {
      render();
    }
  }
}

function shouldRunFilmSearch(query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return false;
  }
  const hasCjk = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(normalizedQuery);
  return hasCjk ? normalizedQuery.length >= 1 : normalizedQuery.length >= 2;
}

function clearPendingFilmSearch() {
  if (filmSearchDebounceTimer) {
    window.clearTimeout(filmSearchDebounceTimer);
    filmSearchDebounceTimer = 0;
  }
}

function abortPendingFilmSearch() {
  if (filmSearchAbortController) {
    filmSearchAbortController.abort();
    filmSearchAbortController = null;
  }
}

async function warmFilmSearch() {
  if (filmWarmupStarted) {
    return;
  }
  filmWarmupStarted = true;
  try {
    await fetchMovieJson('/api/manage/movies?action=warmup', { timeoutMs: 7000 });
  } catch {
    // Warmup is opportunistic; real searches still surface actionable errors.
  }
}

function setFilmSearchResults(results, { append = false, page = state.filmSearchPage, totalPages = state.filmSearchTotalPages, totalResults = state.filmSearchTotalResults } = {}) {
  const nextResults = Array.isArray(results) ? results : [];
  const previousLength = state.filmSearchResults.length;
  state.filmSearchResults = append
    ? [...state.filmSearchResults, ...nextResults.filter((movie) =>
      !state.filmSearchResults.some((existing) => Number(existing.tmdbId) === Number(movie.tmdbId))
    )]
    : nextResults;
  state.filmSearchAppendStartIndex = append ? previousLength : 0;
  state.filmSearchPage = Number(page) || (state.filmSearchResults.length ? 1 : 0);
  state.filmSearchTotalPages = Number(totalPages) || 0;
  state.filmSearchTotalResults = Number(totalResults) || state.filmSearchResults.length;
  state.filmSearchResultKey += 1;
  state.filmSearchSettling = true;
}

function settleFilmSearchResults(requestId) {
  requestAnimationFrame(() => {
    if (requestId !== undefined && requestId !== filmSearchRequestId) {
      return;
    }
    state.filmSearchSettling = false;
    render();
  });
}

function clearFilmSearchResultsSmoothly() {
  if (!state.filmSearchResults.length && !state.filmSearchClearing) {
    state.filmSearchResults = [];
    state.filmSearchPage = 0;
    state.filmSearchTotalPages = 0;
    state.filmSearchTotalResults = 0;
    state.filmSearchLoadingMore = false;
    state.filmSearchAppendStartIndex = 0;
    return;
  }
  const clearRequestId = ++filmSearchRequestId;
  state.filmSearchLoading = false;
  state.filmSearchLoadingMore = false;
  state.filmSearchSettling = false;
  state.filmSearchClearing = true;
  state.filmError = '';
  render();
  window.setTimeout(() => {
    if (clearRequestId !== filmSearchRequestId) {
      return;
    }
    state.filmSearchResults = [];
    state.filmSearchPage = 0;
    state.filmSearchTotalPages = 0;
    state.filmSearchTotalResults = 0;
    state.filmSearchAppendStartIndex = 0;
    state.filmSearchClearing = false;
    render();
  }, FILM_SEARCH_CLEAR_TRANSITION_MS);
}

function readFilmSearchCache(query) {
  const cached = filmSearchCache.get(normalizeText(query));
  if (!cached) {
    return null;
  }
  if (Array.isArray(cached)) {
    return {
      results: cached,
      page: cached.length ? 1 : 0,
      totalPages: 0,
      totalResults: cached.length
    };
  }
  return {
    results: Array.isArray(cached.results) ? cached.results : [],
    page: Number(cached.page) || 0,
    totalPages: Number(cached.totalPages) || 0,
    totalResults: Number(cached.totalResults) || 0
  };
}

function writeFilmSearchCache(query, payload) {
  filmSearchCache.set(normalizeText(query), {
    results: Array.isArray(payload.results) ? payload.results : [],
    page: Number(payload.page) || 0,
    totalPages: Number(payload.totalPages) || 0,
    totalResults: Number(payload.totalResults) || 0
  });
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, Math.max(0, ms));
  });
}

function scheduleFilmSearch(query) {
  const inputQuery = String(query ?? '');
  const normalizedQuery = normalizeText(inputQuery);
  state.filmSearchQuery = inputQuery;
  state.filmTmdbAddOpen = true;
  clearPendingFilmSearch();
  if (!shouldRunFilmSearch(normalizedQuery)) {
    abortPendingFilmSearch();
    clearFilmSearchResultsSmoothly();
    return;
  }
  state.filmSearchClearing = false;
  const cached = readFilmSearchCache(normalizedQuery);
  if (cached) {
    state.filmSearchResults = cached.results;
    state.filmSearchPage = cached.page;
    state.filmSearchTotalPages = cached.totalPages;
    state.filmSearchTotalResults = cached.totalResults;
  }
  filmSearchRequestId += 1;
  abortPendingFilmSearch();
  state.filmSearchLoading = true;
  state.filmSearchLoadingMore = false;
  state.filmError = '';
  render();
  filmSearchDebounceTimer = window.setTimeout(() => {
    filmSearchDebounceTimer = 0;
    void searchFilms({ query: inputQuery });
  }, FILM_SEARCH_DEBOUNCE_MS);
}

async function searchFilms({ query = state.filmSearchQuery, page = 1, append = false } = {}) {
  const inputQuery = String(query ?? '');
  const normalizedQuery = normalizeText(query);
  state.filmSearchQuery = inputQuery;
  state.filmTmdbAddOpen = true;
  clearPendingFilmSearch();
  if (!shouldRunFilmSearch(normalizedQuery)) {
    abortPendingFilmSearch();
    clearFilmSearchResultsSmoothly();
    return;
  }
  state.filmSearchClearing = false;
  const requestId = ++filmSearchRequestId;
  abortPendingFilmSearch();
  filmSearchAbortController = new AbortController();
  const normalizedPage = Math.max(1, Number(page) || 1);
  const cached = readFilmSearchCache(normalizedQuery);
  if (!append && cached) {
    state.filmSearchResults = cached.results;
    state.filmSearchPage = cached.page;
    state.filmSearchTotalPages = cached.totalPages;
    state.filmSearchTotalResults = cached.totalResults;
  }
  state.filmSearchLoading = !append;
  state.filmSearchLoadingMore = Boolean(append);
  state.filmError = '';
  render();
  const startedAt = performance.now();
  try {
    const payload = await fetchMovieJson(`/api/manage/movies?action=search&q=${encodeURIComponent(normalizedQuery)}&page=${encodeURIComponent(String(normalizedPage))}`, {
      signal: filmSearchAbortController.signal
    });
    if (requestId !== filmSearchRequestId) {
      return;
    }
    const results = Array.isArray(payload?.results) ? payload.results : [];
    const nextResults = append
      ? [...state.filmSearchResults, ...results.filter((movie) =>
        !state.filmSearchResults.some((existing) => Number(existing.tmdbId) === Number(movie.tmdbId))
      )]
      : results;
    const nextTotalResults = Number(payload?.totalResults) || nextResults.length;
    writeFilmSearchCache(normalizedQuery, {
      results: nextResults,
      page: Number(payload?.page) || normalizedPage,
      totalPages: Number(payload?.totalPages) || 0,
      totalResults: Number(payload?.totalResults) || nextResults.length
    });
    const remainingLoadingMs = FILM_SEARCH_MIN_LOADING_MS - (performance.now() - startedAt);
    if (remainingLoadingMs > 0) {
      await delay(remainingLoadingMs);
      if (requestId !== filmSearchRequestId) {
        return;
      }
    }
    setFilmSearchResults(results, {
      append,
      page: Number(payload?.page) || normalizedPage,
      totalPages: Number(payload?.totalPages) || 0,
      totalResults: nextTotalResults
    });
    state.filmError = '';
  } catch (error) {
    if (error?.name === 'AbortError' || requestId !== filmSearchRequestId) {
      return;
    }
    state.filmError = error.message || 'TMDb search failed';
  } finally {
    if (requestId === filmSearchRequestId) {
      state.filmSearchLoading = false;
      state.filmSearchLoadingMore = false;
      filmSearchAbortController = null;
      render();
      if (state.filmSearchSettling) {
        settleFilmSearchResults(requestId);
      }
    }
  }
}

async function openTmdbFilmDetail(tmdbId) {
  const normalizedId = Number(tmdbId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
    return;
  }
  if (filmDetailLoadingTmdbIds.has(normalizedId)) {
    return;
  }
  const existing = state.films.find((record) => Number(record.tmdbId) === normalizedId) || null;
  const source = existing || state.filmSearchResults.find((movie) => Number(movie.tmdbId) === normalizedId) || { tmdbId: normalizedId };
  state.filmTransientDetailRecord = createTransientFilmDetailRecord(source, existing);
  state.activeFilmId = state.filmTransientDetailRecord.id;
  state.filmBackdropIndexByFilmId = {
    ...(state.filmBackdropIndexByFilmId || {}),
    [state.activeFilmId]: 0
  };
  state.filmDetailOpen = true;
  state.filmError = '';
  state.filmNotesEditing = false;
  state.filmNotesDraft = '';
  state.filmNotesPreview = false;
  state.filmMetadataEditing = false;
  state.filmMetadataDraft = null;
  state.filmMetadataFocusField = '';
  state.filmMoreActionsOpen = false;
  state.filmImagePickerMode = '';
  state.filmImagePickerDraft = '';
  state.filmBackdropFrameDraft = null;
  pushNavigationHash({ mode: 'push' });
  render();
  filmDetailLoadingTmdbIds.add(normalizedId);
  try {
    const payload = await fetchMovieJson(`/api/manage/movies?action=detail&tmdbId=${encodeURIComponent(String(normalizedId))}`);
    const activeRecord = getActiveFilmRecord();
    if (!state.filmDetailOpen || Number(activeRecord?.tmdbId) !== normalizedId) {
      return;
    }
    const latestExisting = state.films.find((record) => Number(record.tmdbId) === normalizedId) || null;
    if (latestExisting) {
      upsertFilmRecord(normalizeMovieRecord(payload?.movie || source, latestExisting), { preserveLocal: true });
    }
    state.filmTransientDetailRecord = createTransientFilmDetailRecord(payload?.movie || source, latestExisting, { isLoading: false });
    state.activeFilmId = state.filmTransientDetailRecord.id;
    state.filmError = '';
    renderFilmMutationState();
  } catch (error) {
    if (state.filmTransientDetailRecord && Number(state.filmTransientDetailRecord.tmdbId) === normalizedId) {
      state.filmTransientDetailRecord = {
        ...state.filmTransientDetailRecord,
        isSaving: false
      };
    }
    state.filmError = error.message || 'Failed to load movie detail';
    renderFilmMutationState();
  } finally {
    filmDetailLoadingTmdbIds.delete(normalizedId);
  }
}

async function saveFilmStatus(tmdbId, watchStatus, { openAfterSave = false, silent = false, showSaving = !silent } = {}) {
  const normalizedId = Number(tmdbId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
    return;
  }
  const previousFilms = state.films.slice();
  const watchedAt = watchStatus === 'watched' ? new Date().toISOString().slice(0, 10) : undefined;
  if (showSaving) {
    state.filmSavingTmdbIds.add(normalizedId);
  }
  const optimisticPatch = { watchStatus };
  if (watchedAt) {
    optimisticPatch.watchedAt = watchedAt;
    optimisticPatch.appendWatchEvent = watchedAt;
  }
  const optimisticRecord = createOptimisticFilmRecord(normalizedId, optimisticPatch, { isSaving: showSaving });
  upsertFilmRecord(optimisticRecord);
  clearMatchingTransientFilmDetail(normalizedId);
  if (openAfterSave) {
    state.activeFilmId = optimisticRecord.id;
    state.filmDetailOpen = true;
    pushNavigationHash({ mode: 'push' });
  }
  state.filmError = '';
  renderFilmMutationState();
  try {
    const body = {
      tmdbId: normalizedId,
      watchStatus,
      movie: toMoviePayload(findMovieSourceByTmdbId(normalizedId), normalizedId)
    };
    if (watchedAt) {
      body.watchedAt = watchedAt;
      body.appendWatchEvent = watchedAt;
    }
    const payload = await postJson('/api/manage/movies', body);
    const record = normalizeMovieRecord(payload?.movie || {}, payload?.entry || null);
    upsertFilmRecord(record);
    clearMatchingTransientFilmDetail(normalizedId);
    if (openAfterSave) {
      state.activeFilmId = record.id;
      state.filmDetailOpen = true;
      pushNavigationHash({ mode: 'replace' });
    }
    state.filmError = '';
    if (!silent && !openAfterSave && !state.filmDetailOpen) {
      showToast(watchStatus === 'watched' ? 'Marked watched' : 'Added to Films', 'success');
    }
    if (state.filmDetailOpen || openAfterSave) {
      markFilmSaved('Status saved');
    }
    renderFilmMutationState({ allowRenderFallback: false });
  } catch (error) {
    state.films = previousFilms;
    state.filmError = error.message || 'Failed to save movie';
    clearFilmSaveStatus();
    showToast(state.filmError, 'error');
    renderFilmMutationState();
  } finally {
    if (showSaving) {
      state.filmSavingTmdbIds.delete(normalizedId);
      state.films = state.films.map((record) =>
        Number(record.tmdbId) === normalizedId ? { ...record, isSaving: false } : record
      );
      renderFilmMutationState();
    }
  }
}

async function saveFilmRating(tmdbId, userRating, { silent = true } = {}) {
  const normalizedId = Number(tmdbId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
    return;
  }
  if (isUnsavedActiveFilmPreview(normalizedId)) {
    return;
  }
  const normalizedRating = normalizeFilmUserRating(userRating);
  const existing = state.films.find((record) => Number(record.tmdbId) === normalizedId) || null;
  const watchStatus = normalizeWatchStatusForPayload(existing?.status || 'watched');
  const previousFilms = state.films.slice();
  const optimisticRecord = createOptimisticFilmRecord(normalizedId, {
    watchStatus,
    userRating: normalizedRating,
    watchedAt: watchStatus === 'watched' ? (existing?.watchedAt || new Date().toISOString().slice(0, 10)) : existing?.watchedAt || ''
  }, { isSaving: false });
  upsertFilmRecord(optimisticRecord);
  clearMatchingTransientFilmDetail(normalizedId);
  state.activeFilmId = optimisticRecord.id;
  state.filmDetailOpen = true;
  state.filmError = '';
  markFilmSaving('Saving rating...');
  renderFilmMutationState();
  try {
    const payload = await postJson('/api/manage/movies', {
      tmdbId: normalizedId,
      watchStatus,
      userRating: normalizedRating,
      watchedAt: optimisticRecord.watchedAt || '',
      movie: toMoviePayload(findMovieSourceByTmdbId(normalizedId), normalizedId)
    });
    const record = normalizeMovieRecord(payload?.movie || {}, payload?.entry || null);
    upsertFilmRecord(record);
    clearMatchingTransientFilmDetail(normalizedId);
    state.activeFilmId = record.id;
    state.filmDetailOpen = true;
    state.filmError = '';
    if (!silent) {
      showToast(normalizedRating === null ? 'Rating cleared' : `Rating saved: ${normalizedRating.toFixed(1)} stars`, 'success');
    }
    markFilmSaved('Rating saved');
    renderFilmMutationState({ allowRenderFallback: false });
  } catch (error) {
    state.films = previousFilms;
    state.filmError = error.message || 'Failed to save rating';
    clearFilmSaveStatus();
    showToast(state.filmError, 'error');
    renderFilmMutationState();
  }
}

function saveFilmStatusForTarget({ tmdbId = '', filmId = '', watchStatus = 'wantToWatch', openAfterSave = false, silent = true } = {}) {
  const record = filmId ? findFilmRecordByTarget(filmId) : null;
  const recordTmdbId = Number(record?.tmdbId);
  const normalizedTmdbId = Number(tmdbId || recordTmdbId || 0);
  if (record && (!Number.isFinite(recordTmdbId) || recordTmdbId <= 0)) {
    const watchedAt = watchStatus === 'watched' ? new Date().toISOString().slice(0, 10) : record.watchedAt || '';
    void saveFilmEntryPatch(record.id, {
      watchStatus,
      watchedAt,
      ...(watchStatus === 'watched' ? { appendWatchEvent: watchedAt } : {})
    }, { successMessage: silent ? '' : 'Film updated', keepDetailOpen: true, savedLabel: 'Status saved' });
    return;
  }
  void saveFilmStatus(normalizedTmdbId, watchStatus, { openAfterSave, silent });
}

function saveFilmRatingForTarget(target = '', userRating, options = {}) {
  const record = findFilmRecordByTarget(target);
  if (!record) {
    return;
  }
  const tmdbId = Number(record.tmdbId);
  if (Number.isFinite(tmdbId) && tmdbId > 0) {
    void saveFilmRating(tmdbId, userRating, options);
    return;
  }
  void saveFilmEntryPatch(record.id, {
    userRating: normalizeFilmUserRating(userRating)
  }, { successMessage: '', keepDetailOpen: true, savedLabel: 'Rating saved' });
}

async function saveFilmWatchedDate(tmdbId, watchedAt, { silent = true } = {}) {
  const normalizedId = Number(tmdbId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
    return;
  }
  if (isUnsavedActiveFilmPreview(normalizedId)) {
    return;
  }
  const normalizedDate = normalizeText(watchedAt).slice(0, 10);
  const existing = state.films.find((record) => Number(record.tmdbId) === normalizedId) || null;
  const watchStatus = normalizeWatchStatusForPayload(existing?.status || 'watched');
  const previousFilms = state.films.slice();
  const optimisticRecord = createOptimisticFilmRecord(normalizedId, {
    watchStatus: watchStatus === 'wantToWatch' ? 'watched' : watchStatus,
    watchedAt: normalizedDate,
    watchEvents: replacePrimaryFilmWatchEvent(existing?.watchEvents || [], existing?.watchedAt || '', normalizedDate)
  }, { isSaving: false });
  upsertFilmRecord(optimisticRecord);
  clearMatchingTransientFilmDetail(normalizedId);
  state.activeFilmId = optimisticRecord.id;
  state.filmDetailOpen = true;
  state.filmError = '';
  markFilmSaving('Saving date...');
  renderFilmMutationState();
  try {
    const payload = await postJson('/api/manage/movies', {
      tmdbId: normalizedId,
      watchStatus: optimisticRecord.status === 'watchlist' ? 'wantToWatch' : optimisticRecord.status,
      userRating: existing?.userRating ?? null,
      watchedAt: normalizedDate,
      watchEvents: optimisticRecord.watchEvents || [],
      movie: toMoviePayload(findMovieSourceByTmdbId(normalizedId), normalizedId)
    });
    const record = normalizeMovieRecord(payload?.movie || {}, payload?.entry || null);
    upsertFilmRecord(record);
    clearMatchingTransientFilmDetail(normalizedId);
    state.activeFilmId = record.id;
    state.filmDetailOpen = true;
    state.filmError = '';
    if (!silent) {
      showToast('Watched date saved', 'success');
    }
    markFilmSaved('Date saved');
    renderFilmMutationState({ allowRenderFallback: false });
  } catch (error) {
    state.films = previousFilms;
    state.filmError = error.message || 'Failed to save watched date';
    clearFilmSaveStatus();
    showToast(state.filmError, 'error');
    renderFilmMutationState();
  }
}

function patchActiveFilmDetailView({ allowRenderFallback = false } = {}) {
  if (!refs.root || !state.filmDetailOpen || !state.activeFilmId) {
    return false;
  }
  const currentPage = refs.root.querySelector('[data-film-detail-page]');
  if (!(currentPage instanceof HTMLElement)) {
    return false;
  }
  const record = getActiveFilmRecord();
  if (!record) {
    return false;
  }
  const html = FilmDetailPage({
    record,
    notesEditing: state.filmNotesEditing,
    notesDraft: state.filmNotesDraft,
    notesPreview: state.filmNotesPreview,
    metadataEditing: state.filmMetadataEditing,
    metadataDraft: state.filmMetadataDraft,
    metadataFocusField: state.filmMetadataFocusField,
    moreActionsOpen: state.filmMoreActionsOpen,
    imagePickerMode: state.filmImagePickerMode,
    imagePickerDraft: state.filmImagePickerDraft,
    imagePickerFrameDraft: state.filmBackdropFrameDraft,
    backdropIndex: getActiveFilmBackdropIndex(record),
    saveStatus: state.filmSaveStatus
  }).trim();
  if (!html) {
    return false;
  }
  const template = document.createElement('template');
  template.innerHTML = html;
  const nextPage = template.content.firstElementChild;
  if (!(nextPage instanceof HTMLElement)) {
    return false;
  }
  if (!currentPage.isConnected || currentPage !== refs.root.querySelector('[data-film-detail-page]')) {
    return false;
  }
  currentPage.replaceWith(nextPage);
  syncFilmBackdropFrameImages(getActiveFilmRecord() || createFilmBackdropFrameDraft(), {
    includeDetail: true,
    includePicker: true
  });
  return true;
}

function renderFilmMutationState({ allowRenderFallback = true } = {}) {
  if (patchActiveFilmDetailView({ allowRenderFallback })) {
    scheduleFilmBackdropRotation();
    return;
  }
  if (allowRenderFallback) {
    render();
  }
}

function setFilmSaveStatus(label = '', statusState = 'saved', { duration = 1200 } = {}) {
  if (filmSaveStatusTimer) {
    window.clearTimeout(filmSaveStatusTimer);
    filmSaveStatusTimer = 0;
  }
  state.filmSaveStatus = label
    ? { label, state: statusState, updatedAt: Date.now() }
    : null;
  renderFilmMutationState({ allowRenderFallback: true });
  if (label && duration > 0) {
    filmSaveStatusTimer = window.setTimeout(() => {
      filmSaveStatusTimer = 0;
      state.filmSaveStatus = null;
      renderFilmMutationState({ allowRenderFallback: true });
    }, duration);
  }
}

function markFilmSaving(label = 'Saving...') {
  setFilmSaveStatus(label, 'saving', { duration: 0 });
}

function markFilmSaved(label = 'Saved') {
  setFilmSaveStatus(label, 'saved', { duration: 1200 });
}

function markFilmSaveError(label = 'Could not save') {
  setFilmSaveStatus(label, 'error', { duration: 1800 });
}

function clearFilmSaveStatus() {
  setFilmSaveStatus('', 'saved', { duration: 0 });
}

function focusFilmNotesEditor() {
  window.requestAnimationFrame(() => {
    const textarea = refs.root?.querySelector('[data-film-notes-draft]');
    if (!(textarea instanceof HTMLTextAreaElement)) {
      return;
    }
    if (document.activeElement !== textarea) {
      textarea.focus({ preventScroll: true });
    }
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  });
}

function focusFilmMetadataEditor(field = '') {
  window.requestAnimationFrame(() => {
    const preferredField = normalizeText(field || state.filmMetadataFocusField || '');
    const selector = preferredField
      ? `[data-film-metadata-field="${escapeCssIdentifier(preferredField)}"]`
      : '[data-film-metadata-field]';
    const input = refs.root?.querySelector(selector) || refs.root?.querySelector('[data-film-metadata-field]');
    if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) {
      return;
    }
    if (document.activeElement !== input) {
      input.focus({ preventScroll: true });
    }
    if (typeof input.setSelectionRange === 'function') {
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });
}

function focusFilmImagePickerInput() {
  window.requestAnimationFrame(() => {
    const input = refs.root?.querySelector('[data-film-image-picker-url]');
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    if (document.activeElement !== input) {
      input.focus({ preventScroll: true });
    }
    input.setSelectionRange(input.value.length, input.value.length);
  });
}

function buildFilmMetadataPatchFromDraft(draft = {}) {
  return normalizeFilmMetadataOverrides({
    titleOverride: draft.titleOverride,
    originalTitleOverride: draft.originalTitleOverride,
    directorOverride: draft.directorOverride,
    releaseDateOverride: draft.releaseDateOverride,
    runtimeOverride: draft.runtimeOverride,
    genresOverride: draft.genresOverride,
    overviewOverride: draft.overviewOverride,
    posterPathOverride: draft.posterPathOverride,
    backdropPathOverride: draft.backdropPathOverride,
    posterUrlOverride: draft.posterUrlOverride,
    backdropUrlOverride: draft.backdropUrlOverride
  });
}

function metadataPatchEqualsRecord(patch = {}, record = {}) {
  const existing = normalizeFilmMetadataOverrides(record);
  return FILM_METADATA_FIELDS.every((field) => {
    const left = patch[field];
    const right = existing[field];
    if (Array.isArray(left) || Array.isArray(right)) {
      return JSON.stringify(left || []) === JSON.stringify(right || []);
    }
    return (left ?? '') === (right ?? '');
  });
}

function buildFilmEntryPatchBody(existing = {}, patch = {}, watchStatus = normalizeWatchStatusForPayload(existing.status || 'wantToWatch')) {
  const target = getFilmRecordSaveTarget(existing);
  const body = {
    source: target.source,
    id: existing.id,
    watchStatus
  };
  if (target.tmdbId) {
    body.tmdbId = target.tmdbId;
    body.movie = toMoviePayload(findMovieSourceByTmdbId(target.tmdbId), target.tmdbId);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'userRating')) {
    body.userRating = patch.userRating;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'note')) {
    body.note = patch.note;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'journal')) {
    body.journal = patch.journal;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'noteMarkdown')) {
    body.noteMarkdown = patch.noteMarkdown;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'isFavorite')) {
    body.isFavorite = Boolean(patch.isFavorite);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'watchedAt')) {
    body.watchedAt = patch.watchedAt;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'watchEvents')) {
    body.watchEvents = patch.watchEvents;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'appendWatchEvent')) {
    body.appendWatchEvent = patch.appendWatchEvent;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'watchEventId')) {
    body.watchEventId = patch.watchEventId;
  }
  FILM_METADATA_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(patch, field)) {
      body[field] = patch[field];
    }
  });
  FILM_BACKDROP_FRAME_FIELDS.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(patch, field)) {
      body[field] = patch[field];
    }
  });
  return body;
}

function persistManualFilmEntry(record = {}, { showErrorToast = true, throwOnError = false } = {}) {
  if (!record?.id || normalizeFilmSource(record.source) !== 'manual') {
    return Promise.resolve(null);
  }
  if (!normalizeText(record.titleOverride || record.localTitle || record.title)) {
    return Promise.resolve(null);
  }
  markFilmSaving('Saving...');
  const request = postJson('/api/manage/movies', restoreFilmEntryPayload(record))
    .then((payload) => {
      const saved = normalizeMovieRecord(payload?.movie || {}, payload?.entry || null);
      upsertFilmRecord(saved, { preserveLocal: true });
      if (state.filmManualDraft?.id === saved.id) {
        state.filmManualDraft = null;
      }
      const activeMetadataEdit = state.filmMetadataEditing && state.activeFilmId === saved.id;
      markFilmSaved('Saved');
      if (!activeMetadataEdit) {
        renderFilmMutationState({ allowRenderFallback: false });
      }
      return saved;
    })
    .catch((error) => {
      state.filmError = error.message || 'Failed to create manual film';
      markFilmSaveError('Could not save');
      if (showErrorToast) {
        showToast(state.filmError, 'error');
      }
      const activeMetadataEdit = state.filmMetadataEditing && state.activeFilmId === record.id;
      if (!activeMetadataEdit) {
        renderFilmMutationState();
      }
      if (throwOnError) {
        throw error;
      }
      return null;
    });
  filmManualCreateRequests.set(record.id, request);
  request.finally(() => {
    if (filmManualCreateRequests.get(record.id) === request) {
      filmManualCreateRequests.delete(record.id);
    }
  });
  return request;
}

function createManualFilmEntry() {
  const createdAt = new Date().toISOString();
  const draft = createManualDraftFilmRecord({
    id: `manual-${Date.now()}`,
    createdAt
  });
  clearTransientFilmDetail();
  state.filmManualDraft = draft;
  state.activeFilmId = draft.id;
  state.filmDetailOpen = true;
  state.filmMetadataEditing = true;
  state.filmMetadataDraft = createFilmMetadataDraft(draft);
  state.filmMetadataFocusField = 'titleOverride';
  state.filmMoreActionsOpen = false;
  state.filmTmdbAddOpen = false;
  state.filmImagePickerMode = '';
  state.filmImagePickerDraft = '';
  state.filmBackdropFrameDraft = null;
  clearFilmSaveStatus();
  pushNavigationHash({ mode: 'push' });
  render();
  focusFilmMetadataEditor('titleOverride');
}

async function saveFilmEntryPatch(filmId, patch = {}, { successMessage = 'Film updated', keepDetailOpen = true, showSaving = false, showErrorToast = true, savedLabel = 'Saved' } = {}) {
  const existing = state.films.find((record) => record.id === filmId);
  const normalizedId = Number(existing?.tmdbId);
  if (!existing) {
    return false;
  }
  const previousFilms = state.films.slice();
  const hasWatchStatusPatch = Object.prototype.hasOwnProperty.call(patch, 'watchStatus');
  const watchStatus = normalizeWatchStatusForPayload(hasWatchStatusPatch ? patch.watchStatus : existing.status || 'wantToWatch');
  const isTmdbEntry = Number.isFinite(normalizedId) && normalizedId > 0;
  if (showSaving && isTmdbEntry) {
    state.filmSavingTmdbIds.add(normalizedId);
  }
  const changedMetadataPatch = Object.fromEntries(FILM_METADATA_FIELDS
    .filter((field) => Object.prototype.hasOwnProperty.call(patch, field))
    .map((field) => [field, patch[field]]));
  const changedBackdropFramePatch = Object.fromEntries(FILM_BACKDROP_FRAME_FIELDS
    .filter((field) => Object.prototype.hasOwnProperty.call(patch, field))
    .map((field) => [field, patch[field]]));
  const optimisticPatch = {
    watchStatus,
    userRating: Object.prototype.hasOwnProperty.call(patch, 'userRating') ? patch.userRating : existing.userRating ?? null,
    note: Object.prototype.hasOwnProperty.call(patch, 'note') ? patch.note : existing.note || '',
    journal: Object.prototype.hasOwnProperty.call(patch, 'journal') ? patch.journal : existing.journal || existing.noteMarkdown || '',
    noteMarkdown: Object.prototype.hasOwnProperty.call(patch, 'noteMarkdown') ? patch.noteMarkdown : existing.noteMarkdown || existing.journal || '',
    ...changedMetadataPatch,
    ...changedBackdropFramePatch,
    isFavorite: Object.prototype.hasOwnProperty.call(patch, 'isFavorite') ? patch.isFavorite : Boolean(existing.favorite),
    watchedAt: Object.prototype.hasOwnProperty.call(patch, 'watchedAt') ? patch.watchedAt : existing.watchedAt || '',
    watchEvents: Object.prototype.hasOwnProperty.call(patch, 'watchEvents')
      ? patch.watchEvents
      : (Object.prototype.hasOwnProperty.call(patch, 'appendWatchEvent')
        ? appendFilmWatchEvent(existing.watchEvents || [], patch.appendWatchEvent)
        : (Object.prototype.hasOwnProperty.call(patch, 'watchedAt')
          ? replacePrimaryFilmWatchEvent(existing.watchEvents || [], existing.watchedAt || '', patch.watchedAt, patch.watchEventId)
          : normalizeFilmWatchEvents(existing.watchEvents || [])))
  };
  const optimisticRecord = isTmdbEntry
    ? createOptimisticFilmRecord(normalizedId, optimisticPatch, { isSaving: showSaving })
    : createOptimisticManualFilmRecord(existing, optimisticPatch);
  upsertFilmRecord(optimisticRecord);
  if (isTmdbEntry) {
    clearMatchingTransientFilmDetail(normalizedId);
  }
  if (keepDetailOpen) {
    state.activeFilmId = optimisticRecord.id;
    state.filmDetailOpen = true;
  }
  state.filmError = '';
  if (state.filmDetailOpen || keepDetailOpen) {
    markFilmSaving('Saving...');
  }
  renderFilmMutationState();
  try {
    markFilmSaving('Saving...');
    if (!isTmdbEntry && filmManualCreateRequests.has(existing.id)) {
      const created = await filmManualCreateRequests.get(existing.id);
      if (!created) {
        throw new Error('Manual film has not saved yet');
      }
    }
    const body = buildFilmEntryPatchBody(existing, { ...patch, ...changedMetadataPatch, ...changedBackdropFramePatch }, watchStatus);
    const payload = await postJson('/api/manage/movies', body);
    const record = normalizeMovieRecord(payload?.movie || {}, payload?.entry || null);
    upsertFilmRecord(record);
    if (isTmdbEntry) {
      clearMatchingTransientFilmDetail(normalizedId);
    }
    if (keepDetailOpen) {
      state.activeFilmId = record.id;
      state.filmDetailOpen = true;
    }
    state.filmError = '';
    if (successMessage) {
      showToast(successMessage, 'success');
    }
    markFilmSaved(savedLabel);
    renderFilmMutationState({ allowRenderFallback: false });
    return true;
  } catch (error) {
    state.films = previousFilms;
    state.filmError = error.message || 'Failed to update film';
    markFilmSaveError('Could not save');
    if (showErrorToast) {
      showToast(state.filmError, 'error');
    }
    renderFilmMutationState();
    return false;
  } finally {
    if (showSaving && isTmdbEntry) {
      state.filmSavingTmdbIds.delete(normalizedId);
      state.films = state.films.map((record) =>
        Number(record.tmdbId) === normalizedId ? { ...record, isSaving: false } : record
      );
      renderFilmMutationState();
    }
  }
}

function editFilmNotes(filmId) {
  const film = state.films.find((record) => record.id === filmId);
  if (!film) {
    return;
  }
  closeFilmImagePicker({ shouldRender: false });
  clearTransientFilmDetail();
  state.activeFilmId = film.id;
  state.filmDetailOpen = true;
  state.filmNotesEditing = true;
  state.filmNotesDraft = film.noteMarkdown || film.journal || '';
  state.filmNotesPreview = false;
  state.filmMoreActionsOpen = false;
  renderFilmMutationState();
  focusFilmNotesEditor();
}

function editFilmMetadata(filmId, { focusField = '' } = {}) {
  const film = state.films.find((record) => record.id === filmId) || getFilmDraftRecordById(filmId);
  if (!film) {
    return;
  }
  closeFilmImagePicker({ shouldRender: false });
  clearTransientFilmDetail();
  state.activeFilmId = film.id;
  state.filmDetailOpen = true;
  state.filmMetadataEditing = true;
  state.filmMetadataDraft = createFilmMetadataDraft(film);
  state.filmMetadataFocusField = normalizeText(focusField);
  state.filmMoreActionsOpen = false;
  renderFilmMutationState();
  if (state.filmMetadataFocusField) {
    focusFilmMetadataEditor(focusField);
  }
}

function exitFilmMetadataEdit() {
  state.filmMetadataEditing = false;
  state.filmMetadataDraft = null;
  state.filmMetadataFocusField = '';
}

function cancelFilmMetadataEdit() {
  if (state.filmManualDraft?.id && state.activeFilmId === state.filmManualDraft.id) {
    state.filmManualDraft = null;
    state.filmDetailOpen = false;
    state.activeFilmId = '';
    exitFilmMetadataEdit();
    pushNavigationHash({ mode: 'push' });
    render();
    return;
  }
  exitFilmMetadataEdit();
  render();
}

function closeFilmImagePicker({ shouldRender = true } = {}) {
  state.filmImagePickerMode = '';
  state.filmImagePickerDraft = '';
  state.filmBackdropFrameDraft = null;
  if (shouldRender) {
    renderFilmMutationState();
  }
}

function saveFilmWatchedDateForTarget(target = '', watchedAt, options = {}) {
  const record = findFilmRecordByTarget(target);
  if (!record) {
    return;
  }
  const tmdbId = Number(record.tmdbId);
  if (Number.isFinite(tmdbId) && tmdbId > 0) {
    void saveFilmWatchedDate(tmdbId, watchedAt, options);
    return;
  }
  const normalizedDate = normalizeText(watchedAt).slice(0, 10);
  void saveFilmEntryPatch(record.id, {
    watchStatus: record.status === 'watchlist' || record.status === 'wantToWatch'
      ? 'watched'
      : normalizeWatchStatusForPayload(record.status || 'watched'),
    watchedAt: normalizedDate,
    watchEvents: replacePrimaryFilmWatchEvent(record.watchEvents || [], record.watchedAt || '', normalizedDate)
  }, { successMessage: '', keepDetailOpen: true, savedLabel: 'Date saved' });
}

function loadMoreFilmSearchResults() {
  const normalizedQuery = normalizeText(state.filmSearchQuery);
  if (!shouldRunFilmSearch(normalizedQuery) || state.filmSearchLoading || state.filmSearchLoadingMore) {
    return;
  }
  const nextPage = (Number(state.filmSearchPage) || 1) + 1;
  if (state.filmSearchTotalPages > 0 && nextPage > state.filmSearchTotalPages) {
    return;
  }
  void searchFilms({ query: state.filmSearchQuery, page: nextPage, append: true });
}

function focusFilmTmdbSearchInput() {
  window.requestAnimationFrame(() => {
    const input = refs.root?.querySelector('[data-films-search-input]');
    if (input instanceof HTMLInputElement) {
      input.focus({ preventScroll: true });
    }
  });
}

function moveFromFilmDetailToIndex() {
  if (!state.filmDetailOpen && !state.activeFilmId) {
    return;
  }
  state.filmDetailOpen = false;
  state.activeFilmId = '';
  state.filmManualDraft = null;
  clearTransientFilmDetail();
  resetFilmBackdropRotation();
  state.filmNotesEditing = false;
  state.filmNotesDraft = '';
  state.filmNotesPreview = false;
  state.filmMetadataEditing = false;
  state.filmMetadataDraft = null;
  state.filmMetadataFocusField = '';
  state.filmMoreActionsOpen = false;
  state.filmImagePickerMode = '';
  state.filmImagePickerDraft = '';
  state.filmBackdropFrameDraft = null;
  pushNavigationHash({ mode: 'push' });
}

async function openFilmTmdbAddFlow({ focus = true } = {}) {
  if (!await commitPendingFilmEditsBeforeAction({ actionName: 'toggle-film-tmdb-add', keepDetailOpen: false })) {
    return false;
  }
  moveFromFilmDetailToIndex();
  state.filmTmdbAddOpen = true;
  render();
  if (focus) {
    focusFilmTmdbSearchInput();
  }
  return true;
}

async function toggleFilmTmdbAddFlow() {
  if (!await commitPendingFilmEditsBeforeAction({ actionName: 'toggle-film-tmdb-add', keepDetailOpen: false })) {
    return;
  }
  moveFromFilmDetailToIndex();
  if (state.filmTmdbAddOpen && !normalizeText(state.filmSearchQuery) && !state.filmSearchResults.length) {
    state.filmTmdbAddOpen = false;
    render();
    return;
  }
  state.filmTmdbAddOpen = true;
  render();
  focusFilmTmdbSearchInput();
}

async function openFilmImagePicker(filmId, mode = 'poster') {
  const film = state.films.find((record) => record.id === filmId);
  if (!film) {
    return;
  }
  if (!await commitPendingFilmEditsBeforeAction({ actionName: `film-change-${mode === 'backdrop' ? 'backdrop' : 'poster'}`, keepDetailOpen: true })) {
    return;
  }
  state.activeFilmId = film.id;
  state.filmDetailOpen = true;
  state.filmImagePickerMode = mode === 'backdrop' ? 'backdrop' : 'poster';
  state.filmImagePickerDraft = state.filmImagePickerMode === 'backdrop'
    ? normalizeText(film.backdropUrlOverride || '')
    : normalizeText(film.posterUrlOverride || '');
  state.filmBackdropFrameDraft = state.filmImagePickerMode === 'backdrop'
    ? createFilmBackdropFrameDraft(film)
    : null;
  state.filmMoreActionsOpen = false;
  renderFilmMutationState();
  focusFilmImagePickerInput();
}

function getFilmImageOverrideFields(mode = 'poster') {
  const normalizedMode = mode === 'backdrop' ? 'backdrop' : 'poster';
  return {
    mode: normalizedMode,
    pathField: normalizedMode === 'backdrop' ? 'backdropPathOverride' : 'posterPathOverride',
    urlField: normalizedMode === 'backdrop' ? 'backdropUrlOverride' : 'posterUrlOverride'
  };
}

function createFilmBackdropFrameDraft(record = {}) {
  return normalizeFilmBackdropFrameOverrides(record);
}

function getFilmBackdropFrameStyleForImage(image, frame = createFilmBackdropFrameDraft()) {
  if (!(image instanceof HTMLImageElement)) {
    return null;
  }
  const container = image.parentElement;
  if (!(container instanceof HTMLElement)) {
    return null;
  }
  const containerWidth = container.clientWidth || container.getBoundingClientRect().width;
  const containerHeight = container.clientHeight || container.getBoundingClientRect().height;
  const naturalWidth = image.naturalWidth || 0;
  const naturalHeight = image.naturalHeight || 0;
  if (!containerWidth || !containerHeight || !naturalWidth || !naturalHeight) {
    return null;
  }
  const normalized = normalizeFilmBackdropFrameOverrides(frame);
  const containScale = Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight);
  const coverScale = Math.max(containerWidth / naturalWidth, containerHeight / naturalHeight);
  const extraZoom = Math.max(1, normalized.backdropZoomOverride);
  const scale = normalized.backdropZoomOverride < 1
    ? containScale + ((coverScale - containScale) * ((normalized.backdropZoomOverride - 0.5) / 0.5))
    : coverScale * extraZoom;
  const fittedWidth = Math.max(1, naturalWidth * scale);
  const fittedHeight = Math.max(1, naturalHeight * scale);
  const left = fittedWidth <= containerWidth
    ? Math.max(0, (containerWidth - fittedWidth) / 2)
    : (containerWidth - fittedWidth) * (normalized.backdropPositionXOverride / 100);
  const top = fittedHeight <= containerHeight
    ? 0
    : (containerHeight - fittedHeight) * (normalized.backdropPositionYOverride / 100);
  return {
    x: `${normalized.backdropPositionXOverride}%`,
    y: `${normalized.backdropPositionYOverride}%`,
    left: `${left}px`,
    top: `${top}px`,
    width: `${fittedWidth}px`,
    height: `${fittedHeight}px`
  };
}

function applyFilmBackdropFrameToImage(image, frame = createFilmBackdropFrameDraft()) {
  if (!(image instanceof HTMLImageElement)) {
    return false;
  }
  const normalized = normalizeFilmBackdropFrameOverrides(frame);
  image.style.setProperty('--film-backdrop-position-x', `${normalized.backdropPositionXOverride}%`);
  image.style.setProperty('--film-backdrop-position-y', `${normalized.backdropPositionYOverride}%`);
  image.style.setProperty('--film-backdrop-scale', String(normalized.backdropZoomOverride));
  const fitted = getFilmBackdropFrameStyleForImage(image, normalized);
  if (!fitted) {
    return false;
  }
  image.classList.add('is-frame-fitted');
  image.style.width = fitted.width;
  image.style.height = fitted.height;
  image.style.left = fitted.left;
  image.style.top = fitted.top;
  image.style.transform = 'none';
  return true;
}

function syncFilmBackdropFrameImages(frame = getActiveFilmRecord() || createFilmBackdropFrameDraft(), { includeDetail = true, includePicker = true } = {}) {
  if (!refs.root) {
    return;
  }
  const normalized = normalizeFilmBackdropFrameOverrides(frame);
  const selectors = [];
  if (includeDetail) {
    selectors.push('.cml-film-detail-page__backdrop-image');
  }
  if (includePicker) {
    selectors.push('.cml-film-image-picker__preview.is-backdrop img');
  }
  if (!selectors.length) {
    return;
  }
  refs.root.querySelectorAll(selectors.join(', ')).forEach((node) => {
    if (!(node instanceof HTMLImageElement)) {
      return;
    }
    if (!applyFilmBackdropFrameToImage(node, normalized)) {
      const onLoad = () => applyFilmBackdropFrameToImage(node, normalized);
      node.addEventListener('load', onLoad, { once: true });
    }
  });
}

function setFilmBackdropFrameStyle(frame = createFilmBackdropFrameDraft()) {
  const normalized = normalizeFilmBackdropFrameOverrides(frame);
  const x = `${normalized.backdropPositionXOverride}%`;
  const y = `${normalized.backdropPositionYOverride}%`;
  const zoom = String(normalized.backdropZoomOverride);
  refs.root?.querySelectorAll('.cml-film-image-picker__preview.is-backdrop img').forEach((node) => {
    if (!(node instanceof HTMLImageElement)) {
      return;
    }
    node.style.setProperty('--film-backdrop-position-x', x);
    node.style.setProperty('--film-backdrop-position-y', y);
    node.style.setProperty('--film-backdrop-scale', zoom);
    applyFilmBackdropFrameToImage(node, normalized);
  });
  refs.root?.querySelectorAll('[data-film-backdrop-frame-field]').forEach((node) => {
    if (!(node instanceof HTMLInputElement)) {
      return;
    }
    const field = node.dataset.filmBackdropFrameField || '';
    const nextValue = field === 'zoom'
      ? normalized.backdropZoomOverride
      : field === 'x'
      ? normalized.backdropPositionXOverride
      : normalized.backdropPositionYOverride;
    node.value = String(nextValue);
    const output = node.closest('.cml-film-image-picker__range')?.querySelector('output');
    if (output instanceof HTMLOutputElement) {
      output.textContent = field === 'zoom'
        ? `${normalized.backdropZoomOverride.toFixed(2)}x`
        : `${nextValue}%`;
    }
  });
}

function updateFilmBackdropFrameDraft(field = '', value = '') {
  if (state.filmImagePickerMode !== 'backdrop') {
    return;
  }
  const film = getActiveFilmRecord();
  const current = state.filmBackdropFrameDraft || createFilmBackdropFrameDraft(film || {});
  const next = { ...current };
  if (field === 'zoom') {
    next.backdropZoomOverride = normalizeFilmBackdropZoomOverride(value);
  } else if (field === 'x') {
    next.backdropPositionXOverride = normalizeFilmBackdropPositionOverride(value);
  } else if (field === 'y') {
    next.backdropPositionYOverride = normalizeFilmBackdropPositionOverride(value);
  } else {
    return;
  }
  state.filmBackdropFrameDraft = next;
  setFilmBackdropFrameStyle(next);
}

async function saveFilmBackdropFrameDraft({ keepDetailOpen = true, savedLabel = 'Frame saved' } = {}) {
  if (state.filmImagePickerMode !== 'backdrop') {
    return true;
  }
  const film = getActiveFilmRecord();
  if (!film?.id) {
    return true;
  }
  const frame = state.filmBackdropFrameDraft || createFilmBackdropFrameDraft(film);
  if (backdropFrameEqualsRecord(frame, film)) {
    return true;
  }
  const saved = await saveFilmEntryPatch(film.id, normalizeFilmBackdropFrameOverrides(frame), {
    successMessage: '',
    keepDetailOpen,
    showErrorToast: false,
    savedLabel
  });
  if (saved) {
    state.filmBackdropFrameDraft = createFilmBackdropFrameDraft(getActiveFilmRecord() || frame);
  }
  return saved;
}

async function resetFilmBackdropFrame() {
  if (state.filmImagePickerMode !== 'backdrop') {
    return;
  }
  const film = getActiveFilmRecord();
  if (!film?.id) {
    return;
  }
  const defaults = createFilmBackdropFrameDraft({});
  state.filmBackdropFrameDraft = defaults;
  setFilmBackdropFrameStyle(defaults);
  await saveFilmEntryPatch(film.id, defaults, {
    successMessage: '',
    keepDetailOpen: true,
    showErrorToast: false,
    savedLabel: 'Frame reset'
  });
}

async function applyFilmImagePathOverride(mode = state.filmImagePickerMode, path = '', { keepPickerOpen = true } = {}) {
  const film = getActiveFilmRecord();
  const { mode: normalizedMode, pathField, urlField } = getFilmImageOverrideFields(mode);
  if (!film?.id) {
    closeFilmImagePicker();
    return false;
  }
  const nextPath = normalizeFilmImagePathOverride(path);
  const currentPath = normalizeFilmImagePathOverride(film[pathField] || '');
  if (!nextPath) {
    state.filmError = 'No TMDb image path selected';
    markFilmSaveError('Could not save');
    renderFilmMutationState();
    return false;
  }
  if (nextPath === currentPath && !normalizeFilmImageOverride(film[urlField] || '')) {
    if (!keepPickerOpen) {
      closeFilmImagePicker();
    }
    return true;
  }
  state.filmImagePickerMode = normalizedMode;
  state.filmImagePickerDraft = '';
  if (normalizedMode === 'backdrop' && !state.filmBackdropFrameDraft) {
    state.filmBackdropFrameDraft = createFilmBackdropFrameDraft(film);
  }
  if (!keepPickerOpen) {
    closeFilmImagePicker({ shouldRender: false });
  }
  return saveFilmEntryPatch(film.id, {
    [pathField]: nextPath,
    [urlField]: ''
  }, { successMessage: '', keepDetailOpen: true, showErrorToast: false, savedLabel: normalizedMode === 'backdrop' ? 'Backdrop saved' : 'Poster saved' });
}

async function applyFilmImageOverride(mode = state.filmImagePickerMode, value = state.filmImagePickerDraft, { keepPickerOpen = true } = {}) {
  const film = getActiveFilmRecord();
  const { mode: normalizedMode, pathField, urlField } = getFilmImageOverrideFields(mode);
  if (!film?.id) {
    closeFilmImagePicker();
    return false;
  }
  const rawValue = normalizeText(value);
  const nextValue = normalizeFilmImageOverride(rawValue);
  const currentValue = normalizeFilmImageOverride(film[urlField] || '');
  if (rawValue && !nextValue) {
    state.filmError = 'Use an http(s) or /file/ image URL';
    markFilmSaveError('Could not save');
    renderFilmMutationState();
    focusFilmImagePickerInput();
    return false;
  }
  if (nextValue === currentValue && !normalizeFilmImagePathOverride(film[pathField] || '')) {
    if (!keepPickerOpen) {
      closeFilmImagePicker();
    }
    return true;
  }
  state.filmImagePickerMode = normalizedMode;
  state.filmImagePickerDraft = nextValue;
  if (!keepPickerOpen) {
    closeFilmImagePicker({ shouldRender: false });
  }
  return saveFilmEntryPatch(film.id, {
    [pathField]: '',
    [urlField]: nextValue
  }, { successMessage: '', keepDetailOpen: true, showErrorToast: false, savedLabel: normalizedMode === 'backdrop' ? 'Backdrop saved' : 'Poster saved' });
}

function resetFilmImageOverride(mode = state.filmImagePickerMode) {
  const film = getActiveFilmRecord();
  const { mode: normalizedMode, pathField, urlField } = getFilmImageOverrideFields(mode);
  if (!film?.id) {
    closeFilmImagePicker();
    return;
  }
  state.filmImagePickerMode = normalizedMode;
  state.filmImagePickerDraft = '';
  state.filmBackdropFrameDraft = normalizedMode === 'backdrop'
    ? createFilmBackdropFrameDraft(film)
    : null;
  void saveFilmEntryPatch(film.id, {
    [pathField]: '',
    [urlField]: '',
    ...(normalizedMode === 'backdrop' ? createFilmBackdropFrameDraft({}) : {})
  }, { successMessage: '', keepDetailOpen: true, showErrorToast: false, savedLabel: 'Reset' });
}

async function commitFilmImagePickerDraft({ keepDetailOpen = true } = {}) {
  if (!state.filmImagePickerMode) {
    return true;
  }
  const film = getActiveFilmRecord();
  if (!film?.id) {
    closeFilmImagePicker({ shouldRender: false });
    return true;
  }
  const { pathField, urlField } = getFilmImageOverrideFields(state.filmImagePickerMode);
  const rawValue = normalizeText(state.filmImagePickerDraft);
  const currentValue = normalizeFilmImageOverride(film[urlField] || '');
  let imageSaved = true;
  if (!rawValue && !currentValue) {
    imageSaved = true;
  } else {
    const nextValue = normalizeFilmImageOverride(rawValue);
    if (rawValue && !nextValue) {
      state.filmError = 'Use an http(s) or /file/ image URL';
      markFilmSaveError('Could not save');
      renderFilmMutationState();
      focusFilmImagePickerInput();
      return false;
    }
    if (nextValue !== currentValue) {
      state.filmImagePickerDraft = nextValue;
      imageSaved = await saveFilmEntryPatch(film.id, {
        [pathField]: '',
        [urlField]: nextValue
      }, { successMessage: '', keepDetailOpen, showErrorToast: false, savedLabel: 'Image saved' });
    }
  }
  if (!imageSaved) {
    return false;
  }
  return saveFilmBackdropFrameDraft({ keepDetailOpen, savedLabel: 'Frame saved' });
}

async function commitFilmMetadataEdit({ keepDetailOpen = Boolean(state.filmDetailOpen) } = {}) {
  if (!state.filmMetadataEditing) {
    return true;
  }
  const film = getActiveFilmRecord();
  if (!film) {
    exitFilmMetadataEdit();
    render();
    return true;
  }
  const patch = buildFilmMetadataPatchFromDraft(state.filmMetadataDraft || {});
  if (film.manualDraft === true) {
    const title = normalizeText(patch.titleOverride);
    if (!title) {
      exitFilmMetadataEdit();
      state.filmManualDraft = null;
      state.filmDetailOpen = false;
      state.activeFilmId = '';
      clearFilmSaveStatus();
      pushNavigationHash({ mode: 'push' });
      render();
      return true;
    }
    const createdAt = film.addedAt || film.updatedAt || new Date().toISOString();
    const draftRecord = createOptimisticManualFilmRecord({
      ...film,
      manualDraft: false,
      addedAt: createdAt,
      updatedAt: createdAt
    }, {
      ...patch,
      watchStatus: normalizeWatchStatusForPayload(film.status || 'wantToWatch')
    });
    state.filmManualDraft = null;
    upsertFilmRecord(draftRecord);
    state.activeFilmId = draftRecord.id;
    state.filmDetailOpen = true;
    renderFilmMutationState();
    try {
      const saved = await persistManualFilmEntry(draftRecord, { showErrorToast: false, throwOnError: true });
      if (!saved) {
        return false;
      }
      state.activeFilmId = saved.id;
      state.filmDetailOpen = true;
      exitFilmMetadataEdit();
      renderFilmMutationState({ allowRenderFallback: false });
    } catch {
      state.films = state.films.filter((record) => record.id !== draftRecord.id);
      state.filmManualDraft = film;
      state.activeFilmId = film.id;
      state.filmDetailOpen = true;
      state.filmMetadataEditing = true;
      state.filmMetadataDraft = { ...(state.filmMetadataDraft || {}), ...patch };
      state.filmMetadataFocusField = state.filmMetadataFocusField || 'titleOverride';
      renderFilmMutationState();
      focusFilmMetadataEditor(state.filmMetadataFocusField);
      return false;
    }
    return true;
  }
  if (metadataPatchEqualsRecord(patch, film)) {
    exitFilmMetadataEdit();
    renderFilmMutationState();
    return true;
  }
  const saved = await saveFilmEntryPatch(film.id, patch, { successMessage: '', keepDetailOpen, showErrorToast: false, savedLabel: 'Saved' });
  if (!saved) {
    state.filmMetadataEditing = true;
    state.filmMetadataDraft = { ...(state.filmMetadataDraft || {}), ...patch };
    renderFilmMutationState();
    focusFilmMetadataEditor(state.filmMetadataFocusField);
    return false;
  }
  exitFilmMetadataEdit();
  renderFilmMutationState({ allowRenderFallback: false });
  return true;
}

function exitFilmNotesEdit() {
  state.filmNotesEditing = false;
  state.filmNotesDraft = '';
  state.filmNotesPreview = false;
}

function cancelFilmNotesEdit() {
  exitFilmNotesEdit();
  render();
}

function toggleFilmNotesPreview() {
  state.filmNotesPreview = !state.filmNotesPreview;
  renderFilmMutationState({ allowRenderFallback: true });
  if (!state.filmNotesPreview) {
    focusFilmNotesEditor();
  }
}

function applyFilmNotesFormat(format = '') {
  if (!state.filmNotesEditing) {
    return;
  }
  if (state.filmNotesPreview) {
    state.filmNotesPreview = false;
    renderFilmMutationState({ allowRenderFallback: true });
    window.requestAnimationFrame(() => applyFilmNotesFormat(format));
    return;
  }
  const textarea = refs.root?.querySelector('[data-film-notes-draft]');
  if (!(textarea instanceof HTMLTextAreaElement)) {
    return;
  }
  const value = textarea.value;
  const start = textarea.selectionStart ?? value.length;
  const end = textarea.selectionEnd ?? value.length;
  const selected = value.slice(start, end);
  let nextValue = value;
  let nextStart = start;
  let nextEnd = end;
  const replaceSelection = (replacement, innerStart = 0, innerEnd = replacement.length) => {
    nextValue = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
    nextStart = start + innerStart;
    nextEnd = start + innerEnd;
  };
  const wrapSelection = (prefix, suffix, placeholder) => {
    const body = selected || placeholder;
    replaceSelection(`${prefix}${body}${suffix}`, prefix.length, prefix.length + body.length);
  };
  const prefixLines = (builder) => {
    const blockStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const nextLineIndex = value.indexOf('\n', end);
    const blockEnd = nextLineIndex === -1 ? value.length : nextLineIndex;
    const block = value.slice(blockStart, blockEnd);
    const lines = block.split('\n');
    const replacement = lines.map((line, index) => builder(line, index)).join('\n');
    nextValue = `${value.slice(0, blockStart)}${replacement}${value.slice(blockEnd)}`;
    nextStart = blockStart;
    nextEnd = blockStart + replacement.length;
  };

  switch (format) {
    case 'bold':
      wrapSelection('**', '**', 'bold text');
      break;
    case 'italic':
      wrapSelection('*', '*', 'italic text');
      break;
    case 'strike':
      wrapSelection('~~', '~~', 'struck text');
      break;
    case 'code':
      if (selected.includes('\n')) {
        wrapSelection('```\n', '\n```', selected || 'code');
      } else {
        wrapSelection('`', '`', 'code');
      }
      break;
    case 'bullet-list':
      prefixLines((line) => `- ${line.replace(/^[-*]\s+/, '')}`);
      break;
    case 'numbered-list':
      prefixLines((line, index) => `${index + 1}. ${line.replace(/^\d+\.\s+/, '')}`);
      break;
    case 'quote':
      prefixLines((line) => `> ${line.replace(/^>\s?/, '')}`);
      break;
    case 'link':
      wrapSelection('[', '](https://)', selected || 'link');
      break;
    default:
      return;
  }
  textarea.value = nextValue;
  state.filmNotesDraft = nextValue;
  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(nextStart, nextEnd);
}

async function commitFilmNotesEdit({ silent = false, keepDetailOpen = Boolean(state.filmDetailOpen) } = {}) {
  if (!state.filmNotesEditing) {
    return true;
  }
  const film = getActiveFilmRecord();
  if (!film) {
    exitFilmNotesEdit();
    render();
    return true;
  }
  const draft = normalizeMultilineText(state.filmNotesDraft);
  const savedNote = normalizeMultilineText(film.noteMarkdown || film.journal || '');
  if (draft === savedNote) {
    exitFilmNotesEdit();
    renderFilmMutationState();
    return true;
  }
  const saved = await saveFilmEntryPatch(film.id, {
    journal: draft,
    noteMarkdown: draft
  }, { successMessage: '', keepDetailOpen, showErrorToast: false });
  if (!saved) {
    state.filmNotesEditing = true;
    state.filmNotesDraft = draft;
    renderFilmMutationState();
    focusFilmNotesEditor();
    return false;
  }
  exitFilmNotesEdit();
  if (!silent) {
    markFilmSaved('Notes saved');
  }
  renderFilmMutationState({ allowRenderFallback: false });
  return true;
}

async function commitPendingFilmEditsBeforeAction({ actionName = '', keepDetailOpen = true } = {}) {
  if (state.filmNotesEditing) {
    const notesSaved = await commitFilmNotesEdit({ silent: true, keepDetailOpen });
    if (!notesSaved) {
      return false;
    }
  }
  if (state.filmMetadataEditing) {
    const metadataSaved = await commitFilmMetadataEdit({ keepDetailOpen });
    if (!metadataSaved) {
      return false;
    }
  }
  if (state.filmImagePickerMode && !FILM_ACTIONS_WITHOUT_IMAGE_URL_AUTOSAVE.has(actionName)) {
    const imageSaved = await commitFilmImagePickerDraft({ keepDetailOpen });
    if (!imageSaved) {
      return false;
    }
  }
  return true;
}

function editFilmWatchEvent(filmId, watchEventId, previousDate, nextDate) {
  const film = state.films.find((record) => record.id === filmId);
  if (!film) {
    return;
  }
  const normalizedId = normalizeText(watchEventId);
  const normalizedPrevious = normalizeText(previousDate).slice(0, 10);
  const normalizedNext = normalizeText(nextDate).slice(0, 10);
  if (!normalizedId || !/^\d{4}-\d{2}-\d{2}$/.test(normalizedNext)) {
    return;
  }
  const events = normalizeFilmWatchEvents(film.watchEvents || []);
  const nextEvents = normalizeFilmWatchEvents(events.map((event) =>
    event.id === normalizedId
      ? { ...event, watchedAt: normalizedNext }
      : event
  ));
  const editedWasPrimary = film.watchedAt === normalizedPrevious || events[0]?.id === normalizedId;
  const watchedAt = editedWasPrimary ? normalizedNext : (nextEvents[0]?.watchedAt || film.watchedAt || '');
  void saveFilmEntryPatch(film.id, {
    watchStatus: 'watched',
    watchedAt,
    watchEvents: nextEvents,
    watchEventId: normalizedId
  }, { successMessage: '', savedLabel: 'Date saved' });
}

async function deleteFilmWatchEvent(filmId, watchEventId) {
  const film = state.films.find((record) => record.id === filmId);
  if (!film) {
    return;
  }
  if (!await commitPendingFilmEditsBeforeAction({ actionName: 'film-delete-watch-event', keepDetailOpen: true })) {
    return;
  }
  const normalizedId = normalizeText(watchEventId);
  if (!normalizedId) {
    return;
  }
  const events = normalizeFilmWatchEvents(film.watchEvents || []);
  const deletedEvent = events.find((event) => event.id === normalizedId);
  if (!deletedEvent) {
    return;
  }
  const nextEvents = events.filter((event) => event.id !== normalizedId);
  const watchedAtPatch = film.watchedAt === deletedEvent?.watchedAt ? (nextEvents[0]?.watchedAt || '') : film.watchedAt || '';
  const saved = await saveFilmEntryPatch(film.id, {
    watchStatus: watchedAtPatch ? 'watched' : normalizeWatchStatusForPayload(film.status || 'wantToWatch'),
    watchedAt: watchedAtPatch,
    watchEvents: nextEvents,
    watchEventId: normalizedId
  }, { successMessage: '', savedLabel: 'Watch removed' });
  if (saved) {
    state.filmDeletedWatchEventUndo = {
      filmId: film.id,
      event: deletedEvent,
      watchedAt: film.watchedAt || '',
      status: normalizeWatchStatusForPayload(film.status || 'wantToWatch')
    };
    showToast('Watch removed', 'success', {
      action: { label: 'Undo', action: 'film-undo-watch-event-delete' }
    });
  }
}

async function undoDeleteFilmWatchEvent() {
  const undoRecord = state.filmDeletedWatchEventUndo;
  if (!undoRecord?.filmId || !undoRecord?.event?.id) {
    dismissToast();
    return;
  }
  const film = state.films.find((record) => record.id === undoRecord.filmId);
  state.filmDeletedWatchEventUndo = null;
  dismissToast();
  if (!film) {
    return;
  }
  const nextEvents = normalizeFilmWatchEvents([
    ...normalizeFilmWatchEvents(film.watchEvents || []),
    undoRecord.event
  ]);
  await saveFilmEntryPatch(film.id, {
    watchStatus: 'watched',
    watchedAt: undoRecord.watchedAt || nextEvents[0]?.watchedAt || '',
    watchEvents: nextEvents,
    watchEventId: undoRecord.event.id
  }, { successMessage: '', savedLabel: 'Watch restored' });
}

function saveFilmNotes() {
  void commitFilmNotesEdit({ silent: false });
}

async function toggleFilmFavourite(filmId) {
  const film = state.films.find((record) => record.id === filmId);
  if (!film) {
    return;
  }
  if (!await commitPendingFilmEditsBeforeAction({ actionName: 'film-toggle-favourite', keepDetailOpen: true })) {
    return;
  }
  void saveFilmEntryPatch(film.id, {
    isFavorite: !film.favorite
  }, { successMessage: '', savedLabel: !film.favorite ? 'Favourite saved' : 'Favourite removed' });
}

async function markFilmRewatch(filmId) {
  const film = state.films.find((record) => record.id === filmId);
  if (!film) {
    return;
  }
  const watchedAt = new Date().toISOString().slice(0, 10);
  if (!await commitPendingFilmEditsBeforeAction({ actionName: 'film-mark-rewatch', keepDetailOpen: true })) {
    return;
  }
  void saveFilmEntryPatch(film.id, {
    watchStatus: 'watched',
    watchedAt,
    appendWatchEvent: watchedAt
  }, { successMessage: '', savedLabel: 'Added watch' });
}

async function toggleFilmMoreActions() {
  if (!await commitPendingFilmEditsBeforeAction({ actionName: 'film-toggle-more-actions', keepDetailOpen: true })) {
    return;
  }
  state.filmMoreActionsOpen = !state.filmMoreActionsOpen;
  renderFilmMutationState();
}

function changeFilmPoster(filmId) {
  void openFilmImagePicker(filmId, 'poster');
}

function changeFilmBackdrop(filmId) {
  void openFilmImagePicker(filmId, 'backdrop');
}

function openFilmTmdbPage(tmdbId) {
  const normalizedId = Number(tmdbId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
    return;
  }
  window.open(`https://www.themoviedb.org/movie/${encodeURIComponent(String(normalizedId))}`, '_blank', 'noopener,noreferrer');
}

async function refreshFilmFromTmdb(filmId) {
  const film = state.films.find((record) => record.id === filmId);
  const normalizedId = Number(film?.tmdbId);
  if (!film || !Number.isFinite(normalizedId) || normalizedId <= 0) {
    return;
  }
  if (!await commitPendingFilmEditsBeforeAction({ actionName: 'film-refresh-tmdb', keepDetailOpen: true })) {
    return;
  }
  closeFilmImagePicker({ shouldRender: false });
  state.filmMoreActionsOpen = false;
  state.filmError = '';
  try {
    markFilmSaving('Refreshing...');
    const payload = await fetchMovieJson(`/api/manage/movies?action=detail&tmdbId=${encodeURIComponent(String(normalizedId))}&forceRefresh=1`);
    const refreshed = normalizeMovieRecord(payload?.movie || {}, film);
    upsertFilmRecord(refreshed, { preserveLocal: true });
    clearMatchingTransientFilmDetail(normalizedId);
    state.activeFilmId = film.id;
    state.filmDetailOpen = true;
    markFilmSaved('Refreshed');
    renderFilmMutationState();
  } catch (error) {
    state.filmError = error.message || 'Failed to refresh from TMDb';
    clearFilmSaveStatus();
    showToast(state.filmError, 'error');
    renderFilmMutationState();
  }
}

function restoreFilmEntryPayload(record = {}) {
  const target = getFilmRecordSaveTarget(record);
  const payload = {
    id: record.id,
    source: target.source,
    watchStatus: normalizeWatchStatusForPayload(record.status || 'wantToWatch'),
    userRating: record.userRating ?? null,
    note: record.note || '',
    journal: record.journal || record.noteMarkdown || '',
    noteMarkdown: record.noteMarkdown || record.journal || '',
    isFavorite: Boolean(record.favorite),
    watchedAt: record.watchedAt || '',
    watchEvents: normalizeFilmWatchEvents(record.watchEvents || []),
    ...normalizeFilmMetadataOverrides(record),
    ...normalizeFilmBackdropFrameOverrides(record)
  };
  if (target.tmdbId) {
    payload.tmdbId = target.tmdbId;
    payload.movie = toMoviePayload(record, target.tmdbId);
  }
  return payload;
}

async function undoRemoveFilmEntry() {
  const record = state.filmRemovedUndoRecord;
  if (!record?.id && !record?.tmdbId) {
    dismissToast();
    return;
  }
  if (filmRemoveUndoTimer) {
    window.clearTimeout(filmRemoveUndoTimer);
    filmRemoveUndoTimer = 0;
  }
  state.filmRemovedUndoRecord = null;
  dismissToast();
  upsertFilmRecord(record, { preserveLocal: true });
  renderFilmMutationState();
  void postJson('/api/manage/movies', restoreFilmEntryPayload(record))
    .then((payload) => {
      const restored = normalizeMovieRecord(payload?.movie || {}, payload?.entry || null);
      upsertFilmRecord(restored, { preserveLocal: true });
      renderFilmMutationState({ allowRenderFallback: false });
    })
    .catch(async (error) => {
      state.filmError = error.message || 'Failed to restore film';
      showToast(state.filmError, 'error');
      await loadMovieEntries({ forceRender: true });
    });
}

function commitPendingFilmRemoval() {
  if (!filmRemoveUndoTimer) {
    return;
  }
  window.clearTimeout(filmRemoveUndoTimer);
  filmRemoveUndoTimer = 0;
  const record = state.filmRemovedUndoRecord;
  state.filmRemovedUndoRecord = null;
  const target = record?.id || String(record?.tmdbId || '');
  if (!target) {
    return;
  }
  void fetchMovieJson(`/api/manage/movies?id=${encodeURIComponent(target)}`, { method: 'DELETE' })
    .catch((error) => {
      upsertFilmRecord(record, { preserveLocal: true });
      state.filmError = error.message || 'Failed to remove film';
      showToast(state.filmError, 'error');
      renderFilmMutationState();
    });
}

async function removeFilmEntry(filmId) {
  const targetFilmId = normalizeText(filmId);
  if (!targetFilmId || !state.films.some((record) => record.id === targetFilmId)) {
    return;
  }
  if (!await commitPendingFilmEditsBeforeAction({ actionName: 'film-remove-entry', keepDetailOpen: true })) {
    return;
  }
  state.filmMoreActionsOpen = false;
  const film = state.films.find((record) => record.id === targetFilmId);
  if (!film) {
    return;
  }
  commitPendingFilmRemoval();
  exitFilmNotesEdit();
  exitFilmMetadataEdit();
  closeFilmImagePicker({ shouldRender: false });
  state.filmMoreActionsOpen = false;
  state.filmRemovedUndoRecord = { ...film };
  const target = film.id || String(film.tmdbId || '');
  state.films = state.films.filter((record) => record.id !== film.id);
  if (state.activeFilmId === film.id) {
    state.filmDetailOpen = false;
    state.activeFilmId = '';
    clearTransientFilmDetail();
    resetFilmBackdropRotation();
    pushNavigationHash({ mode: 'push' });
  }
  showToast('Removed from Films', 'success', {
    action: { label: 'Undo', action: 'film-undo-remove-entry' }
  });
  if (!state.filmDetailOpen) {
    render();
  }
  if (filmRemoveUndoTimer) {
    window.clearTimeout(filmRemoveUndoTimer);
  }
  filmRemoveUndoTimer = window.setTimeout(() => {
    filmRemoveUndoTimer = 0;
    if (state.filmRemovedUndoRecord?.id === film.id) {
      state.filmRemovedUndoRecord = null;
      void fetchMovieJson(`/api/manage/movies?id=${encodeURIComponent(target)}`, { method: 'DELETE' })
        .catch((error) => {
          upsertFilmRecord(film, { preserveLocal: true });
          state.filmError = error.message || 'Failed to remove film';
          showToast(state.filmError, 'error');
          renderFilmMutationState();
        });
    }
  }, 4500);
}

async function openFilmDetail(filmId) {
  if (!await commitPendingFilmEditsBeforeAction({ actionName: 'open-film-detail', keepDetailOpen: false })) {
    return;
  }
  closeFilmImagePicker({ shouldRender: false });
  const film = state.films.find((record) => record.id === filmId);
  if (!film) {
    return;
  }
  state.activeFilmId = film.id;
  state.filmBackdropIndexByFilmId = {
    ...(state.filmBackdropIndexByFilmId || {}),
    [film.id]: 0
  };
  state.filmDetailOpen = true;
  state.filmNotesEditing = false;
  state.filmNotesDraft = '';
  state.filmNotesPreview = false;
  state.filmMetadataEditing = false;
  state.filmMetadataDraft = null;
  state.filmMetadataFocusField = '';
  state.filmMoreActionsOpen = false;
  state.filmImagePickerMode = '';
  state.filmImagePickerDraft = '';
  state.filmBackdropFrameDraft = null;
  pushNavigationHash({ mode: 'push' });
  render();
}

async function closeFilmDetail() {
  if (!await commitPendingFilmEditsBeforeAction({ actionName: 'close-film-detail', keepDetailOpen: false })) {
    return;
  }
  closeFilmImagePicker({ shouldRender: false });
  if (!state.filmDetailOpen && !state.activeFilmId) {
    return;
  }
  state.filmDetailOpen = false;
  state.activeFilmId = '';
  state.filmManualDraft = null;
  clearTransientFilmDetail();
  resetFilmBackdropRotation();
  state.filmNotesEditing = false;
  state.filmNotesDraft = '';
  state.filmNotesPreview = false;
  state.filmMetadataEditing = false;
  state.filmMetadataDraft = null;
  state.filmMetadataFocusField = '';
  state.filmMoreActionsOpen = false;
  state.filmImagePickerMode = '';
  state.filmImagePickerDraft = '';
  state.filmBackdropFrameDraft = null;
  pushNavigationHash({ mode: 'push' });
  render();
}
function patchTopbarStorageTrigger() {
  if (!refs.root) return false;
  const currentTrigger = refs.root.querySelector('.cml-topbar .cml-storage-trigger');
  if (!(currentTrigger instanceof HTMLElement)) {
    return false;
  }
  const currentTopbar = currentTrigger.closest('.cml-topbar');
  if (!(currentTopbar instanceof HTMLElement)) {
    return false;
  }
  const selectedItems = getSelectedItems();
  const activeAlbumName = getActiveAlbumName();
  const canSetAlbumCover = Boolean(
    activeAlbumName
    && selectedItems.length === 1
    && itemBelongsToAlbum(selectedItems[0], activeAlbumName)
  );
  const markup = TopSearchBar({
    state,
    storageSummary: state.storageSummary,
    canDeleteSelection: state.primaryFilter !== 'Bin' && selectedItems.length > 0 && selectedItems.every((item) => canDeleteItem(item)),
    canDownloadSelection: state.primaryFilter !== 'Bin' && getDownloadableItems(selectedItems).length > 0,
    canSetAlbumCover
  }).trim();
  if (!markup) {
    return false;
  }
  const template = document.createElement('template');
  template.innerHTML = markup;
  const nextTopbar = template.content.firstElementChild;
  if (!(nextTopbar instanceof HTMLElement)) {
    return false;
  }
  const nextTrigger = nextTopbar.querySelector('.cml-storage-trigger');
  if (!(nextTrigger instanceof HTMLElement)) {
    return false;
  }
  currentTrigger.replaceWith(nextTrigger);
  return true;
}

function patchSidebarFooter(nextSidebar) {
  if (!refs.root || !(nextSidebar instanceof HTMLElement)) {
    return false;
  }
  const currentFooter = refs.root.querySelector('.cml-sidebar .cml-sidebar__footer');
  const nextFooter = nextSidebar.querySelector('.cml-sidebar__footer');
  if (!(currentFooter instanceof HTMLElement) || !(nextFooter instanceof HTMLElement)) {
    return false;
  }
  currentFooter.replaceWith(nextFooter.cloneNode(true));
  return true;
}

function getSidebarFooterSignature(sidebar) {
  if (!(sidebar instanceof HTMLElement)) {
    return '';
  }
  const footer = sidebar.querySelector('.cml-sidebar__footer');
  if (!(footer instanceof HTMLElement)) {
    return '';
  }
  return `${footer.dataset.hasAudioDock || 'false'}::${footer.dataset.audioDockKey || ''}`;
}

function getSidebarStructureSignature(sidebar) {
  if (!(sidebar instanceof HTMLElement)) {
    return '';
  }
  const primary = [...sidebar.querySelectorAll('.cml-sidebar__nav-item')]
    .map((button) => normalizeText(button.dataset.primary || ''))
    .filter(Boolean)
    .join('|');
  const secondary = [...sidebar.querySelectorAll('.cml-sidebar__subnav-item')]
    .map((button) => normalizeText(button.dataset.secondary || ''))
    .filter(Boolean)
    .join('|');
  return `${primary}::${secondary}`;
}

let pendingNavRaf = 0;
let pendingSelectionChromeRaf = 0;
/** Batched render — collapses rapid nav clicks into one render frame */
function scheduleRender() {
  if (pendingNavRaf) cancelAnimationFrame(pendingNavRaf);
  pendingNavRaf = requestAnimationFrame(() => {
    pendingNavRaf = 0;
    render();
  });
}

function scheduleSelectionChromeSync() {
  if (pendingSelectionChromeRaf) {
    return;
  }
  pendingSelectionChromeRaf = requestAnimationFrame(() => {
    pendingSelectionChromeRaf = 0;
    syncTopbarSelectionState();
    syncTimelineSelectionControls();
  });
}

function renderRenameItemDialog() {
  if (!state.renameItemDialogOpen) {
    return '';
  }
  const title = state.renameItemField === 'Title'
    ? 'Rename track'
    : state.renameItemField === 'Artist'
      ? 'Edit artist'
      : state.renameItemField === 'Album'
        ? 'Edit album'
        : 'Rename file';
  const label = state.renameItemField === 'Title'
    ? 'Track title'
    : state.renameItemField === 'Artist'
      ? 'Artist'
      : state.renameItemField === 'Album'
        ? 'Album'
        : 'File name';
  return `
    <div class="cml-dialog" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="cml-dialog__backdrop" data-action="close-rename-item-dialog"></div>
      <div class="cml-dialog__panel cml-simple-dialog">
        <header class="cml-dialog__header">
          <div>
            <p class="cml-confirm-dialog__eyebrow">Metadata</p>
            <h3 class="cml-dialog__title">${title}</h3>
          </div>
        </header>
        <div class="cml-simple-dialog__body">
          <label class="cml-simple-dialog__field">
            <span>${label}</span>
            <input type="text" class="cml-simple-dialog__input" data-rename-item-input value="${escapeHtml(state.renameItemDraftValue || '')}" maxlength="120" autocomplete="off" />
          </label>
          ${state.renameItemError ? `<p class="cml-simple-dialog__error">${escapeHtml(state.renameItemError)}</p>` : ''}
        <footer class="cml-dialog__footer">
          <button type="button" class="cml-topbar__secondary-button" data-action="close-rename-item-dialog" ${state.renameItemBusy ? 'disabled' : ''}>Cancel</button>
          <button type="button" class="cml-topbar__secondary-button" data-action="submit-rename-item" ${state.renameItemBusy ? 'disabled' : ''}>${state.renameItemBusy ? 'Saving...' : 'Save'}</button>
        </footer>
      </div>
    </div>
  `;
}

function renderPlaylistDialog() {
  if (!state.playlistDialogOpen) {
    return '';
  }
  const targetItem = state.playlistDialogTargetItemId
    ? getAllItems().find((entry) => entry.id === state.playlistDialogTargetItemId)
    : null;
  const availablePlaylists = buildMusicPlaylistSummaries(getAccessibleItems());
  const title = state.playlistDialogMode === 'rename'
    ? 'Rename playlist'
    : state.playlistDialogMode === 'attach'
      ? 'Add to playlist'
      : 'Create playlist';
  const attachChoicesHtml = state.playlistDialogMode === 'attach' ? `
    <div class="cml-simple-dialog__body">
      <p class="cml-simple-dialog__copy">
        ${targetItem ? `Choose where to save "${escapeHtml(targetItem.audioTitle || targetItem.label || 'this track')}".` : 'Choose a playlist for this track.'}
      </p>
      ${availablePlaylists.length ? `
        <div class="cml-simple-dialog__choices">
          ${availablePlaylists.map((playlist) => {
            const isAssigned = targetItem ? itemBelongsToPlaylist(targetItem, playlist.name) : false;
            return `
              <button
                type="button"
                class="cml-simple-dialog__choice ${isAssigned ? 'is-active' : ''}"
                data-action="attach-audio-to-playlist"
                data-playlist-name="${escapeHtml(playlist.name)}"
                ${state.playlistDialogBusy ? 'disabled' : ''}
              >
                <span>${escapeHtml(playlist.name)}</span>
                <span>${isAssigned ? 'Added' : `${playlist.itemCount} tracks`}</span>
              </button>
            `;
          }).join('')}
      ` : '<p class="cml-simple-dialog__empty">No playlists yet.</p>'}
      <button
        type="button"
        class="cml-simple-dialog__create"
        data-action="switch-playlist-dialog-create"
        ${state.playlistDialogBusy ? 'disabled' : ''}
      >Create a new playlist</button>
      ${state.playlistDialogError ? `<p class="cml-simple-dialog__error">${escapeHtml(state.playlistDialogError)}</p>` : ''}
    </div>
  ` : `
    <div class="cml-simple-dialog__body">
      <label class="cml-simple-dialog__field">
        <span>Playlist name</span>
        <input type="text" class="cml-simple-dialog__input" data-playlist-input value="${escapeHtml(state.playlistDraftName || '')}" maxlength="80" autocomplete="off" />
      </label>
      ${state.playlistDialogError ? `<p class="cml-simple-dialog__error">${escapeHtml(state.playlistDialogError)}</p>` : ''}
    </div>
  `;
  return `
    <div class="cml-dialog" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="cml-dialog__backdrop" data-action="close-playlist-dialog"></div>
      <div class="cml-dialog__panel cml-simple-dialog">
        <header class="cml-dialog__header">
          <div>
            <p class="cml-confirm-dialog__eyebrow">Music</p>
            <h3 class="cml-dialog__title">${title}</h3>
          </div>
        </header>
        ${attachChoicesHtml}
        <footer class="cml-dialog__footer">
          <button type="button" class="cml-topbar__secondary-button" data-action="close-playlist-dialog" ${state.playlistDialogBusy ? 'disabled' : ''}>Cancel</button>
          ${state.playlistDialogMode === 'attach'
            ? ''
            : `<button type="button" class="cml-topbar__secondary-button" data-action="submit-playlist-dialog" ${state.playlistDialogBusy ? 'disabled' : ''}>${state.playlistDialogBusy ? 'Saving...' : 'Save'}</button>`}
        </footer>
      </div>
    </div>
  `;
}

function getToastMarkup() {
  if (!state.toastMessage) {
    return '';
  }
  const safeMessage = escapeHtml(state.toastMessage);
  const safeActionLabel = state.toastAction?.label ? escapeHtml(state.toastAction.label) : '';
  const safeAction = state.toastAction?.action ? escapeHtml(state.toastAction.action) : '';
  return `
    <div class="cml-toast cml-toast--${state.toastType}" role="alert" aria-live="polite">
      <span class="cml-toast__message">${safeMessage}</span>
      ${safeActionLabel && safeAction ? `<button type="button" class="cml-toast__action" data-action="${safeAction}">${safeActionLabel}</button>` : ''}
      <button type="button" class="cml-toast__dismiss" data-action="dismiss-toast" aria-label="Dismiss">✕</button>
    </div>
  `;
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
  const previousMindSettingsScrollTop = refs.root?.querySelector('.cml-mind__settings-card')?.scrollTop || 0;
  const searchWasFocused = document.activeElement instanceof HTMLInputElement
    && (
      document.activeElement.classList.contains('cml-topbar__search-input')
      || document.activeElement.classList.contains('cml-sidebar__search-input')
    );
  const filmSearchWasFocused = document.activeElement instanceof HTMLInputElement
    && document.activeElement.hasAttribute('data-films-search-input');
  const filmSearchSelectionStart = filmSearchWasFocused ? document.activeElement.selectionStart : null;
  const filmSearchSelectionEnd = filmSearchWasFocused ? document.activeElement.selectionEnd : null;
  const filmLibrarySearchWasFocused = document.activeElement instanceof HTMLInputElement
    && document.activeElement.hasAttribute('data-film-library-search-input');
  const filmLibrarySearchSelectionStart = filmLibrarySearchWasFocused ? document.activeElement.selectionStart : null;
  const filmLibrarySearchSelectionEnd = filmLibrarySearchWasFocused ? document.activeElement.selectionEnd : null;
  const viewModel = getViewModel();
  const themeState = getThemeState();
  const contentViewKey = buildContentViewKey(viewModel);
  const shouldAnimateContentView = Boolean(lastContentViewKey) && lastContentViewKey !== contentViewKey;
  lastContentViewKey = contentViewKey;
  const storageInsights = buildStorageInsights();
  const parsedSearch = parseMediaSearchQuery(state.searchQuery);
  const activeVideoAlbumLabel = getVideoAlbumDisplayName(state.videoCategoryFilter);
  const searchFilterParts = summarizeMediaSearch(parsedSearch.filters);

  // ── Incremental render: preserve the sidebar DOM to avoid flicker ──
  const existingSidebar = refs.root.querySelector('.cml-sidebar');
  const existingShell = refs.root.querySelector('.cml-app-shell');

  const showMobileBinEntry = viewModel.isCollectionRoot && state.layoutWidth <= 640;
  const showMobileAlbumCreateEntry = viewModel.isCollectionRoot && state.layoutWidth <= 640;
  const hideMobileCollectionSummary = viewModel.isCollectionRoot && state.layoutWidth <= 640;
  const showDesktopAudioPanel = viewModel.isMusicView && !isMobileLayout() && Boolean(viewModel.currentAudioItem);
  const showDesktopSidebarAudioDock = !viewModel.isMusicView && !viewModel.isMindView && !isMobileLayout() && Boolean(viewModel.currentAudioItem);
  const showMobileAudioPlayer = !viewModel.isMindView && isMobileLayout() && Boolean(viewModel.currentAudioItem);
  const desktopAudioDockKey = showDesktopSidebarAudioDock
    ? `${normalizeText(viewModel.currentAudioItem?.id)}|${state.audioPlaying ? 'playing' : 'paused'}|${normalizeAudioMode(state.audioMode)}`
    : '';
  const fullHtml = `
    <div class="cml-app-shell" data-cml-theme-color="${themeState.themeColor}" data-cml-theme-mode="${themeState.resolvedThemeMode}" data-cml-theme-mode-preference="${themeState.themeMode}">
      ${Sidebar({
        navigationModel: viewModel.navigationModel,
        state,
        storageSummary: state.storageSummary,
        desktopAudioDockKey,
        desktopAudioDock: showDesktopSidebarAudioDock
          ? SidebarAudioPlayer({
              currentItem: viewModel.currentAudioItem,
              currentTime: state.audioCurrentTime,
              duration: state.audioDuration,
              isPlaying: state.audioPlaying,
              mode: state.audioMode,
              volume: state.audioVolume
            })
          : '',
        searchQuery: state.searchDraft
      })}
      <div class="cml-main-shell ${showMobileAudioPlayer ? 'has-mobile-audio-player' : ''} ${showDesktopAudioPanel ? 'has-desktop-audio-player' : ''}">
        ${TopSearchBar({
          state,
          storageSummary: state.storageSummary,
          canDeleteSelection: viewModel.canDeleteSelection,
          canDownloadSelection: viewModel.canDownloadSelection,
          canSetAlbumCover: viewModel.canSetAlbumCover
        })}
        <div class="cml-main-content-shell ${viewModel.isMindView ? 'is-mind-view' : ''} ${viewModel.isMusicView ? 'cml-main-content-shell--music' : ''}">
          <main class="cml-main-content ${viewModel.isMindView ? 'is-mind-view' : ''} ${viewModel.isMusicView ? 'cml-main-content--music' : ''}" tabindex="-1">
            <div
              class="cml-main-content__inner ${viewModel.isMindView ? 'is-mind-view' : ''} ${viewModel.isMusicView ? 'is-music-view' : ''} ${viewModel.isGlobalSearchView ? 'is-search-view' : ''}"
              data-primary-view="${normalizeText(state.primaryFilter || 'Photos')}"
              data-secondary-view="${normalizeText(state.secondaryFilter || '')}"
              data-private-view="${state.privateViewOpen ? '1' : '0'}"
              data-active-album="${normalizeText(state.activeAlbumName || '')}"
              data-active-playlist="${normalizeText(state.activePlaylistName || '')}"
              data-search-view="${viewModel.isGlobalSearchView ? '1' : '0'}"
              data-search-query="${escapeHtml(normalizeText(state.searchQuery || ''))}"
            >
              ${state.primaryFilter === 'Bin'
                ? BinGrid({
                  items: viewModel.binItems,
                  sections: viewModel.sections,
                  binSelectedIds: viewModel.binSelectedIds,
                  isBinLoading: viewModel.isBinLoading,
                  layoutWidth: state.layoutWidth,
                  activeSectionAnchor: state.activeSectionAnchor
                })
                : viewModel.isGlobalSearchView
                ? SearchResultsView({
                    query: parsedSearch.textQuery,
                    totalCount: viewModel.globalSearchResultCount,
                    filterParts: searchFilterParts,
                    hasActiveFilters: Boolean(searchFilterParts.length),
                    photoSections: viewModel.searchPhotoSections,
                    photoCount: viewModel.searchPhotoItems.length,
                    videoSections: viewModel.searchVideoSections,
                    videoCount: viewModel.searchVideoItems.length,
                    audioItems: viewModel.searchAudioItems,
                    audioCount: viewModel.searchAudioItems.length,
                    fileItems: viewModel.searchFileItems,
                    fileCount: viewModel.searchFileItems.length,
                    albumCards: viewModel.searchAlbumCards,
                    albumCount: viewModel.searchAlbumCards.length,
                    state,
                    layoutWidth: state.layoutWidth,
                    audioState: {
                      currentId: state.audioCurrentId,
                      isPlaying: state.audioPlaying
                    },
                    playlists: viewModel.musicPlaylists,
                    activePlaylistName: viewModel.activePlaylistName,
                    contextLabel: getSearchContextLabel(),
                    resultsLimited: Boolean(state.librarySyncMeta?.isTruncated || state.librarySyncMeta?.source === 'dom'),
                    resultSource: state.librarySyncMeta?.source || 'indexed',
                    loadedCount: state.librarySyncMeta?.loadedCount || 0
                  })
                : viewModel.isMindView
                ? ((!state.mindHydrated && state.mindLoading)
                  ? MindLoadingView({
                      settings: state.mindSettings,
                      wallpaperUrl: resolveMindWallpaperUrl(state.mindSettings)
                    })
                  : MindChatView({
                    messages: state.mindMessages,
                    draft: state.mindDraft,
                    settingsBusy: state.mindSettingsBusy,
                    deletingIds: state.mindDeletingIds,
                    settings: state.mindSettings,
                    settingsDraft: state.mindSettingsDraft,
                    settingsOpen: state.mindSettingsOpen,
                    wallpaperUrl: resolveMindWallpaperUrl(state.mindSettings),
                    wallpaperDraftUrl: resolveMindWallpaperUrl(state.mindSettingsDraft),
                    wallpaperPhotoChoices: getMindWallpaperPhotoChoices(),
                    layoutWidth: state.layoutWidth
                  }))
                : viewModel.isFilmsView
                ? (state.filmDetailOpen && viewModel.filmRecord
                  ? FilmDetailPage({
                    record: viewModel.filmRecord,
                    notesEditing: state.filmNotesEditing,
                    notesDraft: state.filmNotesDraft,
                    notesPreview: state.filmNotesPreview,
                    metadataEditing: state.filmMetadataEditing,
                    metadataDraft: state.filmMetadataDraft,
                    metadataFocusField: state.filmMetadataFocusField,
                    moreActionsOpen: state.filmMoreActionsOpen,
                    imagePickerMode: state.filmImagePickerMode,
                    imagePickerDraft: state.filmImagePickerDraft,
                    imagePickerFrameDraft: state.filmBackdropFrameDraft,
                    backdropIndex: getActiveFilmBackdropIndex(viewModel.filmRecord),
                    saveStatus: state.filmSaveStatus
                  })
                  : FilmsPage({
                    records: getVisibleFilmRecords(),
                    totalCount: state.films.length,
                    activeFilter: state.filmActiveFilter,
                    viewMode: state.filmViewMode,
                    libraryQuery: state.filmLibraryQuery,
                    searchQuery: state.filmSearchQuery,
                    addFlowOpen: state.filmTmdbAddOpen
                      || Boolean(normalizeText(state.filmSearchQuery))
                      || state.filmSearchResults.length > 0
                      || state.filmSearchLoading
                      || state.filmSearchLoadingMore
                      || state.filmSearchClearing,
                    searchPanelHtml: FilmSearchResults({
                      results: state.filmSearchResults,
                      loading: state.filmSearchLoading,
                      loadingMore: state.filmSearchLoadingMore,
                      settling: state.filmSearchSettling,
                      clearing: state.filmSearchClearing,
                      resultKey: state.filmSearchResultKey,
                      error: state.filmError,
                      query: state.filmSearchQuery,
                      page: state.filmSearchPage,
                      totalPages: state.filmSearchTotalPages,
                      totalResults: state.filmSearchTotalResults,
                      savingTmdbIds: state.filmSavingTmdbIds,
                      savedRecordsByTmdbId: getSavedFilmRecordsByTmdbId(),
                      newResultStartIndex: state.filmSearchAppendStartIndex
                    })
                  }))
                : viewModel.isMusicView
                ? `${MusicSummary({
                    totalCount: viewModel.musicItems.length,
                    isMobile: isMobileLayout(),
                    currentItem: viewModel.currentAudioItem,
                    queueItems: viewModel.audioQueueItems,
                    isPlaying: state.audioPlaying,
                    mode: state.audioMode,
                    playlists: viewModel.musicPlaylists,
                    activePlaylistName: viewModel.activePlaylistName
                  })}
                  ${viewModel.musicItems.length
                    ? MusicListView({
                        items: viewModel.musicItems,
                        state,
                        audioState: {
                          currentId: state.audioCurrentId,
                          isPlaying: state.audioPlaying
                        },
                        currentItem: viewModel.currentAudioItem,
                        currentTime: state.audioCurrentTime,
                        duration: state.audioDuration,
                        queueItems: viewModel.audioQueueItems,
                        playlists: viewModel.musicPlaylists,
                        activePlaylistName: viewModel.activePlaylistName
                      })
                    : EmptyState({
                        query: parsedSearch.textQuery,
                        isLoading: state.isLibraryLoading,
                        mode: 'music',
                        actionLabel: 'Create playlist',
                        actionAction: 'open-create-playlist'
                      })}`
                : !viewModel.isGlobalSearchView && state.secondaryFilter === 'Documents'
                ? DocumentsListView({ items: viewModel.filteredItems, state })
                : state.privateViewOpen && !state.privateRouteUnlocked
                ? PrivateAlbumGate({ error: state.privatePasswordError, value: state.privatePasswordDraft })
                : `${state.primaryFilter === 'Collections' && (viewModel.activeAlbumName || isMobileLayout()) && !hideMobileCollectionSummary
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
                ${state.privateViewOpen && isMobileLayout()
                  ? PrivateAlbumSummary({ itemCount: viewModel.filteredItems.length, locked: false })
                  : ''}
                ${state.secondaryFilter === 'Videos' && (state.videoCategoryFilter || isMobileLayout())
                  ? VideoAlbumSummary({
                      activeCategory: activeVideoAlbumLabel,
                      albumCount: viewModel.videoAlbumCount,
                      groupedVideoCount: viewModel.videoAlbumGroupedItemCount,
                      totalVideoCount: state.videoCategoryFilter ? viewModel.activeVideoAlbumItemCount : viewModel.videoCategoryScopeCount
                    })
                  : ''}
                ${state.secondaryFilter === 'Videos' && !viewModel.isVideoAlbumRoot && !state.videoCategoryFilter
                  ? VideoCategoryBar({
                      categories: viewModel.videoCategoryOptions,
                      activeCategory: state.videoCategoryFilter,
                      totalCount: viewModel.videoCategoryScopeCount
                    })
                  : ''}
                ${viewModel.isCollectionRoot
                  ? ((viewModel.collectionCards.length || showMobileBinEntry)
                     ? CollectionGrid({
                       collections: viewModel.collectionCards,
                       showBinEntry: showMobileBinEntry,
                       showCreateEntry: showMobileAlbumCreateEntry
                     })
                     : EmptyState({ query: parsedSearch.textQuery, isLoading: state.isLibraryLoading, mode: 'collections' }))
                  : viewModel.isVideoAlbumRoot
                    ? (viewModel.videoAlbumCards.length
                        ? VideoAlbumGrid({ albums: viewModel.videoAlbumCards })
                        : EmptyState({ query: parsedSearch.textQuery, isLoading: state.isLibraryLoading, mode: 'media' }))
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
                      actionLabel: viewModel.activeAlbumName ? 'Add from library' : (viewModel.isAlbumPickerMode ? 'Cancel picker' : ''),
                      actionAction: viewModel.activeAlbumName ? 'open-add-to-current-album' : (viewModel.isAlbumPickerMode ? 'cancel-add-to-current-album' : '')
                    }))}`}
            </div>
          </main>
          ${!showDesktopAudioPanel && !viewModel.isMindView && !viewModel.isMusicView && !viewModel.isCollectionRoot && !viewModel.isGlobalSearchView && state.secondaryFilter !== 'Documents' ? YearScroller({
            scrubberSections: viewModel.scrubberSections,
            activeSectionAnchor: state.activeSectionAnchor,
            activeScrubberLabel: state.activeScrubberLabel
          }) : ''}
        </div>
        ${showDesktopAudioPanel
          ? AudioPlayerPanel({
              currentItem: viewModel.currentAudioItem,
              queueItems: viewModel.audioQueueItems,
              currentTime: state.audioCurrentTime,
              duration: state.audioDuration,
              isPlaying: state.audioPlaying,
              mode: state.audioMode,
              volume: state.audioVolume
            })
          : ''}
      </div>
      ${PreviewModal(getPreviewOverlayModel())}
      ${AdminPanel({ state, storageSummary: state.storageSummary })}
      ${StoragePanel({ state, insights: storageInsights })}
      ${AlbumDialog({ state, albums: getDialogAlbumEntries(getAccessibleItems()), target: state.albumDialogTarget })}
      ${renderPlaylistDialog()}
      ${renderRenameItemDialog()}
      ${ConfirmDialog({ state })}
      ${getToastMarkup()}
      ${'' && `
          <button type="button" class="cml-toast__dismiss" data-action="dismiss-toast" aria-label="Dismiss">✕</button>
        </div>
      `}
      ${showMobileAudioPlayer ? MobileAudioMiniPlayer({
        currentItem: viewModel.currentAudioItem,
        isPlaying: state.audioPlaying
      }) : ''}
      ${MobileBottomNav({ navigationModel: viewModel.navigationModel, state })}
    </div>
  `;

  // ── Incremental patch: keep sidebar alive across live-sync re-renders ──
  // Replace only non-sidebar siblings inside .cml-app-shell so the sidebar
  // DOM is never detached — no layout thrash, no flicker.
  if (existingSidebar && existingShell) {
    const tpl = document.createElement('template');
    tpl.innerHTML = fullHtml;
    const newShell = tpl.content.querySelector('.cml-app-shell');
    let nextSidebar = null;
    if (newShell) {
      nextSidebar = newShell.querySelector('.cml-sidebar');
      if (nextSidebar instanceof HTMLElement) {
        const currentSignature = getSidebarStructureSignature(existingSidebar);
        const nextSignature = getSidebarStructureSignature(nextSidebar);
        const currentFooterSignature = getSidebarFooterSignature(existingSidebar);
        const nextFooterSignature = getSidebarFooterSignature(nextSidebar);
        if (currentSignature !== nextSignature || currentFooterSignature !== nextFooterSignature) {
          existingSidebar.replaceWith(nextSidebar);
        } else {
          newShell.removeChild(nextSidebar);
        }
      }
      const liveSidebar = existingShell.querySelector('.cml-sidebar');
      // Remove every child of the existing shell EXCEPT the sidebar
      const toRemove = [];
      for (let c = existingShell.firstChild; c; c = c.nextSibling) {
        if (c !== liveSidebar) toRemove.push(c);
      }
      toRemove.forEach((c) => c.remove());
      // Append everything from the new shell EXCEPT its sidebar
      while (newShell.firstChild) {
        const child = newShell.firstChild;
        if (child instanceof Element && child.classList.contains('cml-sidebar')) {
          newShell.removeChild(child);
        } else {
          existingShell.appendChild(child);
        }
      }
    } else {
      refs.root.innerHTML = fullHtml;
    }
    patchSidebarActive();
    patchSidebarFooter(nextSidebar);
  } else {
    refs.root.innerHTML = fullHtml;
  }

  const liveShell = refs.root.querySelector('.cml-app-shell');
  if (liveShell instanceof HTMLElement) {
    applyThemeToElement(liveShell, themeState);
  }

  if (state.renameAlbumDialogOpen) {
    focusInlineRenameInput({ select: true });
  }

  refs.root.classList.toggle('has-selection', state.selectedIds.size > 0);

  refs.scrollRegion = viewModel.isMindView
    ? refs.root.querySelector('.cml-mind__history')
    : refs.root.querySelector('.cml-main-content');
  refs.sectionAnchors = [...refs.root.querySelectorAll('.cml-timeline-section')];
  refs.contentInner = refs.root.querySelector('.cml-main-content__inner');
  syncViewportHeightVar({ force: stableAppViewportHeight === 0 });
  refs.sectionItemIds = new Map(viewModel.sections.map((section) => [
    section.anchorId,
    section.items.map((item) => item.id)
  ]));
  refs.timelineLayoutSections = viewModel.timelineLayoutSections || [];
  refs.timelineVirtualSignature = viewModel.timelineVirtualSignature || '';
  refs.timelineVirtualEnabled = Boolean(viewModel.timelineVirtualEnabled);
  syncMobileMindInputIsolation();

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

  if (state.mindSettingsOpen && previousMindSettingsScrollTop > 0) {
    const nextSettingsCard = refs.root.querySelector('.cml-mind__settings-card');
    if (nextSettingsCard instanceof HTMLElement) {
      nextSettingsCard.scrollTop = previousMindSettingsScrollTop;
    }
  }

  if (searchWasFocused && !(viewModel.isMindView && isMobileLayout())) {
    focusSearchInput();
  }
  if (filmSearchWasFocused && viewModel.isFilmsView && !state.filmDetailOpen) {
    const filmsSearchInput = refs.root.querySelector('[data-films-search-input]');
    if (filmsSearchInput instanceof HTMLInputElement) {
      filmsSearchInput.focus({ preventScroll: true });
      const cursorStart = Number.isInteger(filmSearchSelectionStart)
        ? Math.min(filmsSearchInput.value.length, filmSearchSelectionStart)
        : filmsSearchInput.value.length;
      const cursorEnd = Number.isInteger(filmSearchSelectionEnd)
        ? Math.min(filmsSearchInput.value.length, filmSearchSelectionEnd)
        : cursorStart;
      try {
        filmsSearchInput.setSelectionRange(cursorStart, cursorEnd);
      } catch {
        // Search inputs can reject selection APIs in some browsers.
      }
    }
  }
  if (filmLibrarySearchWasFocused && viewModel.isFilmsView && !state.filmDetailOpen) {
    const librarySearchInput = refs.root.querySelector('[data-film-library-search-input]');
    if (librarySearchInput instanceof HTMLInputElement) {
      librarySearchInput.focus({ preventScroll: true });
      const cursorStart = Number.isInteger(filmLibrarySearchSelectionStart)
        ? Math.min(librarySearchInput.value.length, filmLibrarySearchSelectionStart)
        : librarySearchInput.value.length;
      const cursorEnd = Number.isInteger(filmLibrarySearchSelectionEnd)
        ? Math.min(librarySearchInput.value.length, filmLibrarySearchSelectionEnd)
        : cursorStart;
      try {
        librarySearchInput.setSelectionRange(cursorStart, cursorEnd);
      } catch {
        // Search inputs can reject selection APIs in some browsers.
      }
    }
  }

  syncLayoutWidth();
  updateActiveYear();
  updateScrubberThumb();
  setupPreviewTouchHandlers();
  setupYearScrollerDrag();
  setupImageLoadAnimations();
  syncFilmBackdropFrameImages(getActiveFilmRecord() || createFilmBackdropFrameDraft(), {
    includeDetail: viewModel.isFilmsView && state.filmDetailOpen,
    includePicker: viewModel.isFilmsView && state.filmImagePickerMode === 'backdrop'
  });
  scheduleFilmBackdropRotation();
  if (viewModel.isMindView) {
    window.requestAnimationFrame(() => scrollMindToBottom({ force: false }));
  }
  syncAudioProgressUi();
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
    && itemBelongsToAlbum(selectedItems[0], activeAlbumName)
  );
  const markup = TopSearchBar({
    state,
    storageSummary: state.storageSummary,
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
    nextTopbar.classList.add('is-selection-transitioning');
    nextTopbar.style.minHeight = `${Math.max(currentTopbar.offsetHeight, 40)}px`;
    currentTopbar.replaceWith(nextTopbar);
    requestAnimationFrame(() => {
      if (!(nextTopbar instanceof HTMLElement)) {
        return;
      }
      nextTopbar.classList.add('is-selection-transition-settled');
      window.setTimeout(() => {
        nextTopbar.classList.remove('is-selection-transitioning', 'is-selection-transition-settled');
        nextTopbar.style.minHeight = '';
      }, 170);
    });
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

function syncDocsRowSelectionState(row, selected) {
  if (!(row instanceof HTMLElement)) {
    return;
  }
  row.classList.toggle('is-selected', selected);
  const checkbox = row.querySelector('.cml-docs-row__checkbox');
  if (checkbox instanceof HTMLElement) {
    checkbox.innerHTML = selected ? TILE_SELECTION_CHECK_MARKUP : '';
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
  const isCollectionRoot = state.primaryFilter === 'Collections' && !getActiveAlbumName();
  if (!(refs.root instanceof HTMLElement) || state.primaryFilter === 'Bin' || state.needsLogin || isCollectionRoot) {
    return false;
  }
  const visibleTiles = [...refs.root.querySelectorAll('.cml-media-tile[data-tile-id]')];
  const visibleDocRows = [...refs.root.querySelectorAll('.cml-docs-row[data-id]')];
  if (!visibleTiles.length && !visibleDocRows.length) {
    return false;
  }
  const changedSet = new Set(changedItemIds.filter(Boolean));
  let patchedTiles = 0;
  visibleTiles.forEach((tile) => {
    const itemId = tile.getAttribute('data-tile-id') || '';
    if (changedSet.size && !changedSet.has(itemId)) {
      return;
    }
    patchedTiles += 1;
    syncSelectionTileState(tile, state.selectedIds.has(itemId));
  });
  let patchedRows = 0;
  visibleDocRows.forEach((row) => {
    const itemId = row.getAttribute('data-id') || '';
    if (changedSet.size && !changedSet.has(itemId)) {
      return;
    }
    patchedRows += 1;
    syncDocsRowSelectionState(row, state.selectedIds.has(itemId));
  });
  if (changedSet.size && patchedTiles === 0 && patchedRows === 0) {
    return false;
  }
  refs.root.classList.toggle('has-selection', state.selectedIds.size > 0);
  scheduleSelectionChromeSync();
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
        sourceHint: state.previewSourceHint
      });
  const resolvedPreviewItem = previewItem || fallbackPreviewItem;
  const finalPreviewIndex = resolvedPreviewIndex >= 0 && resolvedPreviewItem
    ? resolvedPreviewIndex
    : resolvedPreviewItems.findIndex((item) => item.id === resolvedPreviewItem?.id);
  const displayTotalCount = resolvedPreviewItems.length || (resolvedPreviewItem ? 1 : 0);
  return {
    item: resolvedPreviewItem,
    selected: resolvedPreviewItem ? state.selectedIds.has(resolvedPreviewItem.id) : false,
    favorited: resolvedPreviewItem ? state.favoriteIds.has(resolvedPreviewItem.id) : false,
    currentIndex: Math.max(finalPreviewIndex, 0),
    totalCount: displayTotalCount,
    isBinView: state.primaryFilter === 'Bin',
    infoOpen: state.infoOpen,
    immersive: state.previewImmersive,
    albumDrawerOpen: state.albumDialogOpen && state.albumDialogOrigin === 'preview',
    albumEntries: Array.isArray(albumEntries) ? albumEntries : getDialogAlbumEntries(),
    albumDraftName: state.albumDraftName,
    albumDialogError: state.albumDialogError,
    albumDrawerSearch: state.albumDrawerSearch,
    albumDrawerCreateMode: state.albumDrawerCreateMode,
    albumDialogTarget: state.albumDialogTarget
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

function getPreviewItems(items = getAccessibleItems()) {
  return state.primaryFilter === 'Bin' ? state.binItems : getFilteredItems(items);
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

function replaceFloatingLayer(currentLayer, nextLayer) {
  if (currentLayer instanceof HTMLElement && nextLayer instanceof HTMLElement) {
    currentLayer.replaceWith(nextLayer);
    return;
  }
  if (currentLayer instanceof HTMLElement) {
    currentLayer.remove();
    return;
  }
  if (nextLayer instanceof HTMLElement) {
    const container = getFloatingLayerContainer();
    if (container instanceof HTMLElement) {
      container.appendChild(nextLayer);
    }
  }
}

function patchAlbumDialogSearchResults() {
  if (!refs.root || !state.albumDialogOpen || state.albumDialogOrigin === 'preview') {
    return false;
  }
  const currentDialog = refs.root.querySelector('.cml-album-dialog');
  if (!(currentDialog instanceof HTMLElement)) {
    return false;
  }
  const allItems = getAllItems();
  const template = document.createElement('template');
  template.innerHTML = AlbumDialog({
    state,
    albums: getDialogAlbumEntries(allItems),
    target: state.albumDialogTarget
  }).trim();
  const nextDialog = template.content.querySelector('.cml-album-dialog');
  if (!(nextDialog instanceof HTMLElement)) {
    return false;
  }
  const currentBody = currentDialog.querySelector('.cml-album-dialog__body');
  const nextBody = nextDialog.querySelector('.cml-album-dialog__body');
  if (!(currentBody instanceof HTMLElement) || !(nextBody instanceof HTMLElement)) {
    return false;
  }
  currentBody.replaceWith(nextBody);
  return true;
}

function patchAlbumDialogCreateMode() {
  if (!refs.root || !state.albumDialogOpen || state.albumDialogOrigin === 'preview') {
    return false;
  }
  const currentDialog = refs.root.querySelector('.cml-album-dialog');
  if (!(currentDialog instanceof HTMLElement)) {
    return false;
  }
  const allItems = getAllItems();
  const template = document.createElement('template');
  template.innerHTML = AlbumDialog({
    state,
    albums: getDialogAlbumEntries(allItems),
    target: state.albumDialogTarget
  }).trim();
  const nextDialog = template.content.querySelector('.cml-album-dialog');
  if (!(nextDialog instanceof HTMLElement)) {
    return false;
  }
  const currentBody = currentDialog.querySelector('.cml-album-dialog__body');
  const nextBody = nextDialog.querySelector('.cml-album-dialog__body');
  if (!(currentBody instanceof HTMLElement) || !(nextBody instanceof HTMLElement)) {
    return false;
  }
  currentBody.replaceWith(nextBody);
  return true;
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
    ${AlbumDialog({ state, albums: getDialogAlbumEntries(allItems), target: state.albumDialogTarget })}
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
    const indexedResult = await fetchIndexedMediaItems(domItems);
    state.librarySyncMeta = {
      source: 'indexed',
      totalCount: indexedResult.totalCount,
      loadedCount: indexedResult.loadedCount,
      isTruncated: indexedResult.isTruncated
    };
    if (indexedResult.items.length) {
      items = indexedResult.items;
      surfaceReady = true;
    }
  } catch (error) {
    console.warn('[media-library] falling back to DOM extraction', error);
    state.librarySyncMeta = {
      source: error?.message === 'Request timed out' ? 'timeout' : 'dom',
      totalCount: domItems.length,
      loadedCount: domItems.length,
      isTruncated: false
    };
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
      sourceHint: state.previewSourceHint
    });
    if (!nextPreviewItem) {
      state.previewId = null;
      changed = true;
    } else if (nextPreviewItem.id !== state.previewId) {
      state.previewId = nextPreviewItem.id;
      changed = true;
    }
  }

  const timedOutWithoutFallback = items.length === 0
    && state.librarySyncMeta?.source === 'timeout'
    && state.liveSyncAttempts >= 3;
  const shouldKeepLoading = !timedOutWithoutFallback
    && items.length === 0
    && (!surfaceReady || state.liveSyncAttempts < 4);
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
      const shouldRetrySync = delay === 0 || state.isLibraryLoading || !state.liveMediaSignature || state.mediaItems.length === 0;
      if (shouldRetrySync) {
        syncLiveMedia({ forceRender: delay === 0 });
      }
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
  lockDocumentScroll();
  state.liveSyncAttempts = 0;
  void loadPersistedAlbumState({ forceRender: true });
  void loadPersistedPlaylistState({ forceRender: true });
  void loadMovieEntries({ forceRender: true });
  if (state.primaryFilter === 'Mind') {
    void loadMindState({ forceRender: true, mirrorAfterLoad: true });
  }
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
    refs.root.addEventListener('dblclick', handleDoubleClick, true);
    refs.root.addEventListener('input', handleInput);
    refs.root.addEventListener('change', handleChange);
    refs.root.addEventListener('compositionstart', handleCompositionStart);
    refs.root.addEventListener('compositionend', handleCompositionEnd);
    refs.root.addEventListener('focusin', handleFocusIn);
    refs.root.addEventListener('focusout', handleFocusOut);
    refs.root.addEventListener('submit', (e) => {
      if (e.target instanceof HTMLFormElement && e.target.dataset.form === 'login') {
        e.preventDefault();
        void submitLogin();
        return;
      }
      if (e.target instanceof HTMLFormElement && e.target.dataset.form === 'private-access') {
        e.preventDefault();
        e.stopPropagation();
        unlockPrivateRoute();
        return;
      }
      if (e.target instanceof HTMLFormElement && e.target.dataset.form === 'mind') {
        e.preventDefault();
        void sendMindMessage();
        return;
      }
      if (e.target instanceof HTMLFormElement && e.target.dataset.form === 'films-search') {
        e.preventDefault();
        state.filmTmdbAddOpen = true;
        void searchFilms({ query: state.filmSearchQuery });
        return;
      }
      if (e.target instanceof HTMLFormElement && e.target.dataset.form === 'film-image-picker-url') {
        e.preventDefault();
        void applyFilmImageOverride(state.filmImagePickerMode, state.filmImagePickerDraft);
        return;
      }
      if (e.target instanceof HTMLFormElement && e.target.dataset.form === 'mind-settings') {
        e.preventDefault();
        void saveMindSettings();
      }
    }, true);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleDocumentVisibilityChange);
    window.addEventListener('pagehide', handleWindowPageHide);
    window.addEventListener('resize', handleWindowResize);
    window.visualViewport?.addEventListener('resize', handleVisualViewportResize);
    window.visualViewport?.addEventListener('scroll', handleVisualViewportResize);
    document.addEventListener('click', (e) => {
      if (state.docsContextMenu && !(e.target instanceof Element && e.target.closest('.cml-docs-ctx'))) {
        state.docsContextMenu = null;
        render();
      }
    });
    refs.root.addEventListener('contextmenu', (e) => {
      const row = e.target instanceof Element ? e.target.closest('.cml-docs-row:not(.cml-docs-row--folder):not(.cml-docs-row--new-folder)') : null;
      if (!row) return;
      const id = row.dataset.id;
      if (!id) return;
      e.preventDefault();
      state.docsContextMenu = { id, x: e.clientX, y: e.clientY };
      render();
    });
    mounted = true;
  }
}

function unmount() {
  unlockDocumentScroll();
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
  state.previewSourceHint = sourceHint || resolvedPreviewItem?.thumbnailUrl || resolvedPreviewItem?.sourceUrl || '';
  state.infoOpen = false;
  state.previewImmersive = false;
  state.previewRotation = 0;
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
    const selectBtn = event.target.closest('[data-action="toggle-select"], [data-action="toggle-bin-select"]');
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

function findPreviewSectionAnchor(itemId) {
  const normalizedId = normalizeText(itemId);
  if (!normalizedId) {
    return '';
  }
  const sections = state.primaryFilter === 'Bin'
    ? buildSections(state.binItems, {
        anchorPrefix: 'bin',
        getLabel: (item) => item.timelineLabel || createTimelineLabel(item.deletedAt || item.takenAt),
        getScrubberLabel: (item) => formatScrubberLabel(item.deletedAt || item.takenAt)
      })
    : buildSections(getFilteredItems());
  return sections.find((section) => section.items.some((item) => item.id === normalizedId))?.anchorId || '';
}

function restorePreviewPosition(itemId) {
  const normalizedId = normalizeText(itemId);
  if (!normalizedId || !(refs.root instanceof HTMLElement)) {
    return false;
  }
  const tile = refs.root.querySelector(`.cml-media-tile[data-tile-id="${normalizedId}"]`);
  if (tile instanceof HTMLElement) {
    state.focusedTileId = normalizedId;
    tile.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    return true;
  }
  const targetAnchor = findPreviewSectionAnchor(normalizedId);
  if (!targetAnchor) {
    return false;
  }
  state.activeSectionAnchor = targetAnchor;
  if (!(refs.root.querySelector(`#${CSS.escape(targetAnchor)}`) instanceof HTMLElement)) {
    render();
  }
  scrollToYear(targetAnchor);
  scheduleTimelineRender();
  return true;
}

function closePreview() {
  const previewId = state.previewId;
  const previewAlbumFlow = state.albumDialogOrigin === 'preview';
  const finalizeClosePreview = () => {
    state.previewId = null;
    state.previewSourceHint = '';
    state.infoOpen = false;
    if (previewAlbumFlow) {
      state.albumDialogOpen = false;
      state.albumDialogOrigin = '';
      state.albumDialogError = '';
      state.albumDraftName = '';
      state.albumDrawerSearch = '';
      state.albumDrawerScope = 'all';
      state.albumDrawerCreateMode = false;
      clearSelection({ shouldRender: false });
    }
    state.previewImmersive = false;
    state.previewRotation = 0;
    touchZoom.currentScale = 1;
    touchZoom.tx = 0;
    touchZoom.ty = 0;
    if (!renderPreviewTransientLayers()) {
      render();
    }
    if (previewId) {
      window.requestAnimationFrame(() => {
        restorePreviewPosition(previewId);
      });
    }
  };
  animatePreviewCloseToTile(finalizeClosePreview);
}

function applyPreviewRotation() {
  const mediaEl = refs.root?.querySelector('.cml-preview__media');
  if (!(mediaEl instanceof HTMLElement)) return;
  const deg = state.previewRotation;
  if (!deg) {
    mediaEl.style.transform = '';
    return;
  }
  const isSwapped = deg === 90 || deg === 270;
  if (isSwapped) {
    const stage = mediaEl.closest('.cml-preview__stage');
    if (stage) {
      const sw = stage.clientWidth;
      const sh = stage.clientHeight;
      const mw = mediaEl.naturalWidth || mediaEl.videoWidth || mediaEl.offsetWidth;
      const mh = mediaEl.naturalHeight || mediaEl.videoHeight || mediaEl.offsetHeight;
      if (mw && mh) {
        const fitW = Math.min(sw, mw);
        const fitH = Math.min(sh, mh);
        const rotatedNeedsW = fitH;
        const rotatedNeedsH = fitW;
        const scaleX = sw / rotatedNeedsW;
        const scaleY = sh / rotatedNeedsH;
        const scale = Math.min(scaleX, scaleY, 1);
        mediaEl.style.transform = `rotate(${deg}deg) scale(${scale})`;
        return;
      }
    }
  }
  mediaEl.style.transform = `rotate(${deg}deg)`;
}

function movePreview(direction) {
  const items = getPreviewItems();
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
  state.previewRotation = 0;
  const sourceTile = refs.root?.querySelector(`.cml-media-tile[data-tile-id="${nextItem.id}"]`) || null;
  state.previewSourceHint = getMediaSourceFromTile(sourceTile);
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
  const isCurrentPreviewItem = Boolean(state.previewId) && normalizeText(itemId) === normalizeText(state.previewId);
  if (isCurrentPreviewItem && syncPreviewFavoriteButton(itemId)) {
    return;
  }
  const preferPreviewRender = isCurrentPreviewItem && state.secondaryFilter !== 'Favourites';
  if (!(preferPreviewRender && renderPreviewTransientLayers())) {
    render();
  }
}

function applyLocationRouteToMountedUi() {
  if (state.filmNotesEditing || state.filmMetadataEditing || state.filmImagePickerMode) {
    void commitPendingFilmEditsBeforeAction({ actionName: 'route-change', keepDetailOpen: false });
  }
  restoreNavigationFromHash();
  if (!refs.root) {
    syncMount();
    return;
  }
  if (state.primaryFilter === 'Mind') {
    const shouldForceMindRender = state.mindMessages.length === 0;
    if (shouldRefreshMindOnEnter()) {
      void loadMindState({ forceRender: shouldForceMindRender, mirrorAfterLoad: true });
    } else if (hasFreshMindMessages()) {
      void mirrorMindMessagesIfNeeded();
    }
  }
  if (state.primaryFilter === 'Bin') {
    void fetchBinItems();
  }
  if (state.primaryFilter === 'Films') {
    void warmFilmSearch();
  }
  render();
}

function openRenameItemDialog(itemId, field = 'FileName') {
  const item = getAllItems().find((entry) => entry.id === itemId);
  if (!item?.sourceId) {
    showToast('Cannot rename this item');
    return;
  }
  state.renameItemDialogOpen = true;
  state.renameItemTargetId = itemId;
  state.renameItemField = ['Title', 'Artist', 'Album'].includes(field) ? field : 'FileName';
  state.renameItemDraftValue = state.renameItemField === 'Title'
    ? normalizeText(item.audioTitle || item.label || '')
    : state.renameItemField === 'Artist'
      ? normalizeText(item.audioArtist || '')
      : state.renameItemField === 'Album'
        ? normalizeText(item.audioAlbum || '')
        : normalizeText(item.label || item.audioTitle || '');
  state.renameItemError = '';
  state.renameItemBusy = false;
  render();
}

function closeRenameItemDialog() {
  state.renameItemDialogOpen = false;
  state.renameItemTargetId = '';
  state.renameItemField = 'FileName';
  state.renameItemDraftValue = '';
  state.renameItemError = '';
  state.renameItemBusy = false;
  render();
}

async function submitRenameItem() {
  const item = getAllItems().find((entry) => entry.id === state.renameItemTargetId);
  if (!item?.sourceId) {
    state.renameItemError = 'Item not found';
    render();
    return;
  }
  const nextValue = normalizeText(state.renameItemDraftValue);
  if (!nextValue) {
    state.renameItemError = 'Name cannot be empty';
    render();
    return;
  }
  const payload = state.renameItemField === 'Title'
    ? { Title: nextValue }
    : state.renameItemField === 'Artist'
      ? { Artist: nextValue }
      : state.renameItemField === 'Album'
        ? { Album: nextValue }
        : { FileName: nextValue };
  state.renameItemBusy = true;
  state.renameItemError = '';
  render();
  try {
    const encodedPath = encodeMetadataPath(item.sourceId);
    const response = await apiFetch(`/api/manage/metadata/${encodedPath}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok || !data?.success) {
      throw new Error(data?.message || 'Failed to rename item');
    }
    const mediaItem = state.mediaItems.find((entry) => entry.id === state.renameItemTargetId);
    if (mediaItem) {
      if (state.renameItemField === 'Title') {
        mediaItem.audioTitle = nextValue;
      } else if (state.renameItemField === 'Artist') {
        mediaItem.audioArtist = nextValue;
      } else if (state.renameItemField === 'Album') {
        mediaItem.audioAlbum = nextValue;
      } else {
        mediaItem.label = nextValue;
      }
    }
    closeRenameItemDialog();
    render();
  } catch (error) {
    state.renameItemError = error.message || 'Failed to rename item';
    state.renameItemBusy = false;
    render();
  }
}

function openPlaylistDialog(mode = 'create', { itemId = '' } = {}) {
  state.playlistDialogOpen = true;
  state.playlistDialogMode = mode;
  state.playlistDialogTargetItemId = normalizeText(itemId);
  state.playlistDraftName = mode === 'rename' ? getActivePlaylistName() : '';
  state.playlistDialogError = '';
  state.playlistDialogBusy = false;
  render();
}

function closePlaylistDialog() {
  state.playlistDialogOpen = false;
  state.playlistDialogMode = 'create';
  state.playlistDialogTargetItemId = '';
  state.playlistDraftName = '';
  state.playlistDialogError = '';
  state.playlistDialogBusy = false;
  render();
}

async function submitPlaylistDialog() {
  if (state.playlistDialogMode === 'attach') {
    return;
  }
  const dialogMode = state.playlistDialogMode;
  const targetItemId = state.playlistDialogTargetItemId;
  const nextName = normalizeText(state.playlistDraftName);
  if (!nextName) {
    state.playlistDialogError = 'Playlist name cannot be empty';
    render();
    return;
  }
  state.playlistDialogBusy = true;
  state.playlistDialogError = '';
  render();
  try {
    let payload = dialogMode === 'rename'
      ? await apiFetch('/api/manage/playlists', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: getActivePlaylistName(), newName: nextName })
      }).then((response) => response.json())
      : await postJson('/api/manage/playlists', { name: nextName });
    if (payload?.error) {
      throw new Error(payload.error);
    }
    if (dialogMode === 'create' && targetItemId) {
      const createdItemId = targetItemId;
      payload = await updatePlaylistMembership(nextName, createdItemId, 'add', { silent: true, returnPayload: true }) || payload;
    }
    applyPersistedPlaylistState(payload);
    saveJson(PLAYLISTS_STORAGE_KEY, state.playlistNames);
    saveJson(PLAYLIST_ASSIGNMENTS_STORAGE_KEY, state.playlistAssignments);
    if (dialogMode === 'rename' && getActivePlaylistName()) {
      state.activePlaylistName = nextName;
    } else if (dialogMode === 'create') {
      state.activePlaylistName = nextName;
    }
    closePlaylistDialog();
    render();
    showToast(
      dialogMode === 'rename'
        ? 'Playlist renamed'
        : (targetItemId ? 'Playlist created and track added' : 'Playlist created'),
      'success'
    );
  } catch (error) {
    state.playlistDialogError = error.message || 'Failed to save playlist';
    state.playlistDialogBusy = false;
    render();
  }
}

async function deleteActivePlaylist() {
  const activePlaylistName = getActivePlaylistName();
  if (!activePlaylistName) {
    return;
  }
  try {
    const payload = await apiFetch(`/api/manage/playlists?name=${encodeURIComponent(activePlaylistName)}`, {
      method: 'DELETE'
    }).then((response) => response.json());
    if (payload?.error) {
      throw new Error(payload.error);
    }
    applyPersistedPlaylistState(payload);
    saveJson(PLAYLISTS_STORAGE_KEY, state.playlistNames);
    saveJson(PLAYLIST_ASSIGNMENTS_STORAGE_KEY, state.playlistAssignments);
    state.activePlaylistName = '';
    render();
    showToast('Playlist deleted', 'success');
  } catch (error) {
    showToast(error.message || 'Failed to delete playlist');
  }
}

async function updatePlaylistMembership(playlistName, itemId, action = 'add', { silent = false, returnPayload = false } = {}) {
  const item = getAllItems().find((entry) => entry.id === itemId);
  if (!item) {
    return null;
  }
  const fileId = getPersistentItemKey(item);
  if (!playlistName || !fileId) {
    return null;
  }
  try {
    const payload = await postJson('/api/manage/playlists', {
      playlistId: playlistName,
      action,
      fileIds: [fileId]
    });
    applyPersistedPlaylistState(payload);
    saveJson(PLAYLISTS_STORAGE_KEY, state.playlistNames);
    saveJson(PLAYLIST_ASSIGNMENTS_STORAGE_KEY, state.playlistAssignments);
    if (!returnPayload) {
      render();
    }
    if (!silent) {
      showToast(action === 'remove' ? 'Removed from playlist' : 'Added to playlist', 'success');
    }
    return payload;
  } catch (error) {
    if (!silent) {
      showToast(error.message || 'Failed to update playlist');
    }
    throw error;
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
    ? getAccessibleItems().filter((item) => itemBelongsToAlbum(item, activeAlbumName))
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
  if (scrubberClickSuppressUntil && Date.now() < scrubberClickSuppressUntil) {
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
  if (state.primaryFilter === 'Mind') {
    return state.mindMessages.length;
  }
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
  syncViewportHeightVar();
  if (refs.scrollRegion) {
    state.virtualViewportHeight = refs.scrollRegion.clientHeight;
    state.virtualScrollTop = refs.scrollRegion.scrollTop;
  }
  syncLayoutWidth();
  if (isMobileMindComposerFocused()) {
    window.requestAnimationFrame(() => {
      scrollMindToBottom({ force: true });
    });
    return;
  }
  render();
}

function handleVisualViewportResize() {
  if (!document.body.classList.contains('codex-media-library-active')) {
    return;
  }
  syncViewportHeightVar();
  if (refs.scrollRegion) {
    state.virtualViewportHeight = refs.scrollRegion.clientHeight;
    state.virtualScrollTop = refs.scrollRegion.scrollTop;
  }
  if (isMobileMindComposerFocused()) {
    window.requestAnimationFrame(() => {
      stabilizeMobileMindViewport();
      scrollMindToBottom({ force: true });
    });
  }
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
  const actionName = actionTarget.dataset.action || '';
  switch (actionTarget.dataset.action) {
    case 'open-preview':
      if (actionTarget.dataset.id) {
        const targetItem = getAllItems().find((e) => e.id === actionTarget.dataset.id);
        if (targetItem && targetItem.type === 'document') {
          downloadPreviewItem(actionTarget.dataset.id);
        } else {
          openPreview(actionTarget.dataset.id);
        }
      }
      return true;
    case 'open-upload':
      requestNativeUpload();
      return true;
    case 'send-mind-message':
      void sendMindMessage();
      return true;
    case 'toggle-mind-settings':
      setMindSettingsOpen(!state.mindSettingsOpen);
      return true;
    case 'leave-mobile-mind':
      leaveMobileMindView();
      return true;
    case 'open-mobile-album-search':
      state.mobileAlbumSearchOpen = true;
      render();
      requestAnimationFrame(() => focusSearchInput());
      return true;
    case 'close-mobile-album-search':
      state.mobileAlbumSearchOpen = false;
      render();
      return true;
    case 'close-mind-settings':
      setMindSettingsOpen(false);
      return true;
    case 'set-mind-background-preset':
      if (!state.mindSettingsBusy) {
        state.mindSettingsDraft = {
          ...state.mindSettingsDraft,
          backgroundPreset: normalizeMindSettings({
            ...state.mindSettingsDraft,
            backgroundPreset: actionTarget.dataset.value || ''
          }).backgroundPreset
        };
        if (!patchMindDraftPreview()) {
          render();
        }
      }
      return true;
    case 'clear-mind-avatar':
      if (!state.mindSettingsBusy) {
        state.mindSettingsDraft = {
          ...state.mindSettingsDraft,
          contactAvatarData: ''
        };
        render();
      }
      return true;
    case 'clear-mind-wallpaper':
      if (!state.mindSettingsBusy) {
        state.mindSettingsDraft = {
          ...state.mindSettingsDraft,
          backgroundImageData: '',
          backgroundPhotoId: ''
        };
        render();
      }
      return true;
    case 'set-mind-wallpaper-photo':
      if (!state.mindSettingsBusy) {
        state.mindSettingsDraft = {
          ...state.mindSettingsDraft,
          backgroundPhotoId: normalizeText(actionTarget.dataset.id),
          backgroundImageData: ''
        };
        if (!patchMindDraftPreview()) {
          render();
        }
      }
      return true;
    case 'set-mind-background-position':
      if (!state.mindSettingsBusy) {
        state.mindSettingsDraft = {
          ...state.mindSettingsDraft,
          backgroundPosition: normalizeMindSettings({
            ...state.mindSettingsDraft,
            backgroundPosition: actionTarget.dataset.value || ''
          }).backgroundPosition
        };
        if (!patchMindDraftPreview()) {
          render();
        }
      }
      return true;
    case 'set-mind-send-button-color':
      if (!state.mindSettingsBusy) {
        state.mindSettingsDraft = {
          ...state.mindSettingsDraft,
          sendButtonColor: normalizeMindSettings({
            ...state.mindSettingsDraft,
            sendButtonColor: actionTarget.dataset.value || ''
          }).sendButtonColor
        };
        if (!patchMindDraftPreview()) {
          render();
        }
      }
      return true;
    case 'delete-mind-message':
      if (actionTarget.dataset.id) {
        void deleteMindMessageById(actionTarget.dataset.id);
      }
      return true;
    case 'play-audio-item':
      if (actionTarget.dataset.id) {
        const queueItems = state.primaryFilter === 'Music'
          ? getMusicContextItems(getAccessibleItems())
          : getAudioQueueItems(getAccessibleItems());
        void playAudioItemById(actionTarget.dataset.id, { queueItems });
      }
      return true;
    case 'audio-open-queue':
      if (!state.primaryFilter || state.primaryFilter !== 'Music') {
        state.primaryFilter = 'Music';
        pushNavigationHash();
        render();
        requestAnimationFrame(() => {
          scrollToMusicLibrary();
        });
      } else {
        scrollToMusicLibrary();
      }
      return true;
    case 'audio-toggle-play':
      toggleAudioPlayback();
      return true;
    case 'audio-prev':
      playAdjacentAudio(-1);
      return true;
    case 'audio-next':
      playAdjacentAudio(1);
      return true;
    case 'audio-set-mode':
      setAudioMode(actionTarget.dataset.mode || '');
      return true;
    case 'audio-remove-queue-item':
      if (actionTarget.dataset.id) {
        removeAudioQueueItem(actionTarget.dataset.id);
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
    case 'clear-selection':
      clearSelection();
      return true;
    case 'open-add-to-album':
      if (state.albumSelectionTarget) {
        commitSelectionToAlbum(state.albumSelectionTarget);
        return true;
      }
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
    case 'toggle-immersive':
      state.previewImmersive = !state.previewImmersive;
      if (!renderPreviewTransientLayers()) { render(); }
      return true;
    case 'rotate-preview':
      state.previewRotation = (state.previewRotation + 90) % 360;
      applyPreviewRotation();
      return true;
    case 'open-add-to-current-album':
      openAlbumSelection();
      return true;
    case 'open-add-to-current-video-album':
      openVideoAlbumSelection(state.videoCategoryFilter);
      return true;
    case 'open-add-to-private':
      openPrivateSelection();
      return true;
    case 'cancel-add-to-current-album':
      closeAlbumSelection();
      return true;
    case 'confirm-add-to-current-album':
      commitSelectionToCurrentTarget();
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
    case 'open-video-album':
      if (actionTarget.dataset.category) {
        openVideoAlbum(actionTarget.dataset.category);
      }
      return true;
    case 'close-video-album':
      closeVideoAlbum();
      return true;
    case 'toggle-private-selection':
      void setSelectionPrivateAlbum(!isPrivateRouteActive());
      return true;
    case 'unlock-private-route':
      unlockPrivateRoute();
      return true;
    case 'close-album-dialog':
      closeAlbumDialog();
      return true;
    case 'toggle-album-picker-distinct':
      toggleAlbumPickerDistinctOnly();
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
      void submitAlbumDialog();
      return true;
    case 'assign-album':
      if (actionTarget.dataset.albumName) {
        void assignSelectionToAlbum(actionTarget.dataset.albumName);
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
    case 'open-create-playlist':
      openPlaylistDialog('create');
      return true;
    case 'open-rename-playlist':
      openPlaylistDialog('rename');
      return true;
    case 'switch-playlist-dialog-create':
      openPlaylistDialog('create', { itemId: state.playlistDialogTargetItemId });
      return true;
    case 'close-playlist-dialog':
      closePlaylistDialog();
      return true;
    case 'submit-playlist-dialog':
      void submitPlaylistDialog();
      return true;
    case 'attach-audio-to-playlist':
      if (actionTarget.dataset.playlistName && state.playlistDialogTargetItemId) {
        state.playlistDialogBusy = true;
        state.playlistDialogError = '';
        render();
        void updatePlaylistMembership(actionTarget.dataset.playlistName, state.playlistDialogTargetItemId, 'add', { silent: true })
          .then(() => {
            closePlaylistDialog();
            render();
            showToast('Added to playlist', 'success');
          })
          .catch((error) => {
            state.playlistDialogError = error.message || 'Failed to update playlist';
            state.playlistDialogBusy = false;
            render();
          });
      }
      return true;
    case 'open-music-playlist':
      if (actionTarget.dataset.playlistName) {
        openMusicPlaylist(actionTarget.dataset.playlistName);
      }
      return true;
    case 'close-music-playlist':
      closeMusicPlaylist();
      return true;
    case 'delete-playlist':
      void deleteActivePlaylist();
      return true;
    case 'rename-audio-item':
      if (actionTarget.dataset.id) {
        openRenameItemDialog(actionTarget.dataset.id, 'Title');
      }
      return true;
    case 'rename-audio-artist':
      if (actionTarget.dataset.id) {
        openRenameItemDialog(actionTarget.dataset.id, 'Artist');
      }
      return true;
    case 'rename-audio-album':
      if (actionTarget.dataset.id) {
        openRenameItemDialog(actionTarget.dataset.id, 'Album');
      }
      return true;
    case 'add-audio-to-playlist':
      if (actionTarget.dataset.id) {
        if (getActivePlaylistName()) {
          void updatePlaylistMembership(getActivePlaylistName(), actionTarget.dataset.id, 'add');
        } else if (state.playlistNames.length) {
          openPlaylistDialog('attach', { itemId: actionTarget.dataset.id });
        } else {
          openPlaylistDialog('create', { itemId: actionTarget.dataset.id });
        }
      }
      return true;
    case 'remove-audio-from-playlist':
      if (actionTarget.dataset.id && getActivePlaylistName()) {
        void updatePlaylistMembership(getActivePlaylistName(), actionTarget.dataset.id, 'remove');
      }
      return true;
    case 'close-rename-item-dialog':
      closeRenameItemDialog();
      return true;
    case 'submit-rename-item':
      void submitRenameItem();
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
    case 'docs-navigate':
      state.docsCurrentDir = actionTarget.dataset.dir || '';
      state.docsNewFolderOpen = false;
      render();
      return true;
    case 'docs-delete-folder':
      if (actionTarget.dataset.dir) {
        void deleteDocFolder(actionTarget.dataset.dir);
      }
      return true;
    case 'docs-new-folder':
      state.docsNewFolderOpen = true;
      render();
      window.requestAnimationFrame(() => {
        const input = refs.root ? refs.root.querySelector('[data-focus-key="docs-new-folder-input"]') : null;
        if (input instanceof HTMLInputElement) input.focus();
      });
      return true;
    case 'docs-download':
      if (actionTarget.dataset.id) {
        downloadPreviewItem(actionTarget.dataset.id);
      }
      return true;
    case 'docs-download-selected':
      downloadSelectedDocs();
      return true;
    case 'docs-delete-selected':
      requestDeleteSelection(false, { origin: 'documents' });
      return true;
    case 'docs-clear-selection':
      clearSelection();
      return true;
    case 'docs-move-selected':
      openDocsMoveDialog();
      return true;
    case 'docs-move-nav':
      state.docsMoveDialogDir = actionTarget.dataset.dir || '';
      render();
      return true;
    case 'docs-move-confirm': {
      const targetDir = state.docsMoveDialogDir || '';
      void moveSelectedDocsToFolder(targetDir);
      return true;
    }
    case 'docs-move-cancel':
      state.docsMoveDialogOpen = false;
      state.docsMoveCreateOpen = false;
      state.docsMoveCreateName = '';
      render();
      return true;
    case 'docs-move-create-open':
      state.docsMoveCreateOpen = true;
      state.docsMoveCreateName = '';
      render();
      requestAnimationFrame(() => {
        const inp = refs.root?.querySelector('[data-docs-move-create-input]');
        if (inp) inp.focus();
      });
      return true;
    case 'docs-move-create-cancel':
      state.docsMoveCreateOpen = false;
      state.docsMoveCreateName = '';
      render();
      return true;
    case 'docs-move-create-confirm': {
      const folderName = normalizeText(state.docsMoveCreateName);
      if (!folderName) return true;
      const newDir = state.docsMoveDialogDir ? state.docsMoveDialogDir + '/' + folderName : folderName;
      if (!(state.docsFolders instanceof Set)) state.docsFolders = new Set();
      state.docsFolders.add(newDir);
      state.docsMoveCreateOpen = false;
      state.docsMoveCreateName = '';
      state.docsMoveDialogDir = newDir;
      render();
      return true;
    }
    case 'docs-row-menu': {
      const id = actionTarget.dataset.id;
      if (!id) return true;
      const rect = actionTarget.getBoundingClientRect();
      state.docsContextMenu = { id, x: rect.right - 200, y: rect.bottom + 4 };
      render();
      return true;
    }
    case 'docs-ctx-close':
      state.docsContextMenu = null;
      render();
      return true;
    case 'docs-ctx-download': {
      const ctxId = actionTarget.dataset.id;
      state.docsContextMenu = null;
      if (ctxId) downloadPreviewItem(ctxId);
      render();
      return true;
    }
    case 'docs-ctx-rename': {
      const ctxId = actionTarget.dataset.id;
      state.docsContextMenu = null;
      if (ctxId) {
        openRenameItemDialog(ctxId, 'FileName');
      } else {
        render();
      }
      return true;
    }
    case 'docs-ctx-move': {
      const ctxId = actionTarget.dataset.id;
      state.docsContextMenu = null;
      if (ctxId) {
        state.selectedIds.clear();
        state.selectedIds.add(ctxId);
        openDocsMoveDialog();
      }
      return true;
    }
    case 'docs-ctx-delete': {
      const ctxId = actionTarget.dataset.id;
      state.docsContextMenu = null;
      if (ctxId) {
        state.selectedIds.clear();
        state.selectedIds.add(ctxId);
        requestDeleteSelection(false, { origin: 'documents' });
      }
      return true;
    }
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
    case 'restore-bin-preview':
      restoreBinPreview(actionTarget.dataset.id || state.previewId);
      return true;
    case 'delete-bin-permanently':
      requestDeleteBinSelectionPermanently();
      return true;
    case 'request-delete-bin-preview-permanently':
      requestDeleteBinPreviewPermanently(actionTarget.dataset.id || state.previewId);
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
          resetConfirmDialog();
          if (!(preferPreviewRender && renderPreviewTransientLayers())) {
            render();
          }
          void emptyBin();
        } else if (state.confirmDialogMode === 'delete-bin-permanently') {
          resetConfirmDialog();
          if (!(preferPreviewRender && renderPreviewTransientLayers())) {
            render();
          }
          void deleteBinSelectionPermanently();
        } else {
          const deleteOrigin = state.confirmDialogOrigin;
          const permanentDelete = state.confirmDialogMode === 'delete-permanently';
          resetConfirmDialog();
          if (!(preferPreviewRender && renderPreviewTransientLayers())) {
            render();
          }
          void deleteSelectedItems({
            permanent: permanentDelete,
            origin: deleteOrigin
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
    case 'edit-description': {
      const descSection = refs.root.querySelector('.cml-preview__info-section--description');
      if (!descSection) { return true; }
      const currentItem = getAllItems().find((entry) => entry.id === state.previewId);
      const currentDesc = currentItem?.description || '';
      descSection.textContent = '';
      descSection.removeAttribute('data-action');
      const textarea = document.createElement('textarea');
      textarea.className = 'cml-preview__info-description-input';
      textarea.setAttribute('data-focus-key', 'description-edit');
      textarea.rows = 3;
      textarea.placeholder = 'Add a description';
      textarea.value = currentDesc;
      const actions = document.createElement('div');
      actions.className = 'cml-preview__info-editor-actions';
      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.className = 'cml-topbar__secondary-button';
      cancelButton.textContent = 'Cancel';
      const saveButton = document.createElement('button');
      saveButton.type = 'button';
      saveButton.className = 'cml-topbar__secondary-button';
      saveButton.textContent = 'Save';
      let finalized = false;
      const restoreDescription = () => {
        patchDescriptionDisplay(descSection, currentDesc);
      };
      const commitEdit = (mode = 'save') => {
        if (finalized) return;
        finalized = true;
        if (mode === 'cancel') {
          restoreDescription();
          return;
        }
        const value = textarea.value.trim();
        patchDescriptionDisplay(descSection, value);
        void savePreviewDescription(state.previewId, value);
      };
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          commitEdit('save');
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          commitEdit('cancel');
        }
      });
      cancelButton.addEventListener('click', () => commitEdit('cancel'));
      saveButton.addEventListener('click', () => commitEdit('save'));
      actions.append(cancelButton, saveButton);
      descSection.append(textarea, actions);
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      return true;
    }
    case 'edit-video-category': {
      const categorySection = refs.root.querySelector('.cml-preview__info-section--video-category');
      if (!categorySection) { return true; }
      const currentItem = getAllItems().find((entry) => entry.id === state.previewId);
      if (!currentItem || currentItem.type !== 'video') { return true; }
      const currentCategory = normalizeVideoCategory(currentItem.videoCategory);
      categorySection.textContent = '';
      categorySection.removeAttribute('data-action');
      const heading = document.createElement('h5');
      heading.className = 'cml-preview__info-heading';
      heading.textContent = 'Video album';
      const picker = document.createElement('div');
      picker.className = 'cml-preview__info-choice-chips';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'cml-preview__info-category-input';
      input.setAttribute('data-focus-key', 'video-category-edit');
      input.placeholder = 'Travel, Scenery, Tutorial...';
      input.maxLength = VIDEO_CATEGORY_MAX_LENGTH;
      input.value = currentCategory;
      const suggestions = getVideoCategorySuggestions(getAccessibleItems(), currentCategory);
      suggestions.forEach((suggestion) => {
        const optionButton = document.createElement('button');
        optionButton.type = 'button';
        optionButton.className = `cml-preview__info-choice-chip ${suggestion === currentCategory ? 'is-active' : ''}`;
        optionButton.textContent = suggestion;
        optionButton.addEventListener('click', () => {
          patchVideoCategoryDisplay(categorySection, suggestion);
          void savePreviewVideoCategory(state.previewId, suggestion, currentItem);
        });
        picker.appendChild(optionButton);
      });
      const hint = document.createElement('p');
      hint.className = 'cml-preview__info-category-hint';
      hint.textContent = 'Choose an existing video album or type a new one.';
      const actions = document.createElement('div');
      actions.className = 'cml-preview__info-editor-actions';
      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.className = 'cml-topbar__secondary-button';
      cancelButton.textContent = 'Cancel';
      const saveButton = document.createElement('button');
      saveButton.type = 'button';
      saveButton.className = 'cml-topbar__secondary-button';
      saveButton.textContent = 'Save';
      const clearButton = document.createElement('button');
      clearButton.type = 'button';
      clearButton.className = 'cml-topbar__secondary-button';
      clearButton.textContent = 'Clear';
      const previousItem = { ...currentItem };
      const commitEdit = (shouldRestore = false) => {
        if (shouldRestore) {
          patchVideoCategoryDisplay(categorySection, previousItem.videoCategory);
          return;
        }
        const nextCategory = normalizeVideoCategory(input.value);
        patchVideoCategoryDisplay(categorySection, nextCategory);
        void savePreviewVideoCategory(state.previewId, input.value, previousItem);
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitEdit(false);
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          commitEdit(true);
        }
      });
      cancelButton.addEventListener('click', () => commitEdit(true));
      saveButton.addEventListener('click', () => commitEdit(false));
      clearButton.addEventListener('click', () => {
        patchVideoCategoryDisplay(categorySection, '');
        void savePreviewVideoCategory(state.previewId, '', previousItem);
      });
      if (currentCategory) {
        actions.appendChild(clearButton);
      }
      actions.append(cancelButton, saveButton);
      categorySection.append(heading, picker, input, hint, actions);
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      return true;
    }
    case 'edit-capture-time': {
      const captureSection = refs.root.querySelector('.cml-preview__info-section--capture-time');
      if (!captureSection) { return true; }
      const currentItem = getAllItems().find((entry) => entry.id === state.previewId);
      if (!currentItem) { return true; }
      captureSection.textContent = '';
      captureSection.removeAttribute('data-action');
      const heading = document.createElement('h5');
      heading.className = 'cml-preview__info-heading';
      heading.textContent = 'Date & time';
      const input = document.createElement('input');
      input.type = 'datetime-local';
      input.className = 'cml-preview__info-time-input';
      input.setAttribute('data-focus-key', 'capture-time-edit');
      input.step = '60';
      input.value = formatCaptureTimeInputValue(currentItem.takenAt);
      const hint = document.createElement('p');
      hint.className = 'cml-preview__info-time-hint';
      hint.textContent = 'Local time. Press Enter to save or Esc to cancel.';
      let cancelled = false;
      const previousItem = { ...currentItem };
      const commitEdit = () => {
        if (cancelled) {
          patchCaptureTimeDisplay(captureSection, previousItem);
          return;
        }
        if (!input.value) {
          patchCaptureTimeDisplay(captureSection, previousItem);
          showToast('Please choose a date & time');
          return;
        }
        const previewState = buildPreviewCaptureTimeState(previousItem, parseCaptureTimeInputValue(input.value));
        patchCaptureTimeDisplay(captureSection, previewState);
        void savePreviewCaptureTime(state.previewId, input.value, previousItem);
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          cancelled = true;
          input.blur();
        }
      });
      input.addEventListener('blur', () => {
        commitEdit();
      });
      captureSection.append(heading, input, hint);
      input.focus();
      return true;
    }
    case 'edit-tags': {
      const tagsSection = refs.root.querySelector('.cml-preview__info-section--tags');
      if (!tagsSection) { return true; }
      const currentItem = getAllItems().find((entry) => entry.id === state.previewId);
      if (!currentItem) { return true; }
      const currentTags = normalizeExplicitTags(currentItem.explicitTags || currentItem.tags || []);
      tagsSection.textContent = '';
      tagsSection.removeAttribute('data-action');
      const heading = document.createElement('h5');
      heading.className = 'cml-preview__info-heading';
      heading.textContent = 'Tags';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'cml-preview__info-tags-input';
      input.setAttribute('data-focus-key', 'tags-edit');
      input.placeholder = 'night, river, canon';
      input.value = formatPreviewTagsValue(currentTags);
      const hint = document.createElement('p');
      hint.className = 'cml-preview__info-tags-hint';
      hint.textContent = 'Separate tags with commas or spaces. Press Enter to save or Esc to cancel.';
      const actions = document.createElement('div');
      actions.className = 'cml-preview__info-editor-actions';
      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.className = 'cml-topbar__secondary-button';
      cancelButton.textContent = 'Cancel';
      const clearButton = document.createElement('button');
      clearButton.type = 'button';
      clearButton.className = 'cml-topbar__secondary-button';
      clearButton.textContent = 'Clear';
      const saveButton = document.createElement('button');
      saveButton.type = 'button';
      saveButton.className = 'cml-topbar__secondary-button';
      saveButton.textContent = 'Save';
      const previousItem = { ...currentItem, explicitTags: [...currentTags], tags: [...(currentItem.tags || [])] };
      const restoreTags = () => patchTagsDisplay(tagsSection, previousItem.explicitTags || previousItem.tags || []);
      const commitEdit = (mode = 'save') => {
        if (mode === 'cancel') {
          restoreTags();
          return;
        }
        const nextValue = mode === 'clear' ? '' : input.value;
        const nextTags = parsePreviewTagsInput(nextValue);
        patchTagsDisplay(tagsSection, nextTags);
        void savePreviewTags(state.previewId, nextValue, previousItem);
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitEdit('save');
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          commitEdit('cancel');
        }
      });
      cancelButton.addEventListener('click', () => commitEdit('cancel'));
      clearButton.addEventListener('click', () => commitEdit('clear'));
      saveButton.addEventListener('click', () => commitEdit('save'));
      if (currentTags.length) {
        actions.appendChild(clearButton);
      }
      actions.append(cancelButton, saveButton);
      tagsSection.append(heading, input, hint, actions);
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      return true;
    }
    case 'save-description': {
      const textarea = refs.root.querySelector('.cml-preview__info-description-input');
      const value = textarea ? textarea.value.trim() : '';
      const descSection = refs.root.querySelector('.cml-preview__info-section--description');
      if (descSection) {
        patchDescriptionDisplay(descSection, value);
      }
      void savePreviewDescription(state.previewId, value);
      return true;
    }
    case 'cancel-description': {
      const descSection = refs.root.querySelector('.cml-preview__info-section--description');
      if (descSection) {
        const currentItem = getAllItems().find((entry) => entry.id === state.previewId);
        patchDescriptionDisplay(descSection, currentItem?.description || '');
      }
      return true;
    }
    case 'clear-search-filters':
      resetSearchQuery();
      if (state.secondaryFilter === 'Videos') {
        state.videoCategoryFilter = '';
      }
      clearSelection({ shouldRender: false });
      resetLoadedCount();
      pushNavigationHash();
      render();
      return true;
    case 'clear-search-input':
      clearSearchInputAndFocus();
      return true;
    case 'focus-search-input':
      focusSearchInput();
      return true;
    case 'jump-search-group':
      if (actionTarget.dataset.searchGroup) {
        scrollToSearchGroup(actionTarget.dataset.searchGroup);
      }
      return true;
    case 'toggle-avatar':
      state.avatarMenuOpen = !state.avatarMenuOpen;
      patchAvatarMenu();
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
      patchAdminOverlays();
      return true;
    case 'trigger-admin-avatar-upload':
      void triggerAdminAvatarUpload();
      return true;
    case 'remove-admin-avatar':
      state.adminProfileDraft.avatarData = '';
      state.adminPanelError = '';
      patchAdminOverlays();
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
    case 'run-admin-recover-capture-times':
      void runAdminRecoveryTask('captureTimes', { dryRun: false });
      return true;
    case 'dry-run-admin-recover-capture-times':
      void runAdminRecoveryTask('captureTimes', { dryRun: true });
      return true;
    case 'run-admin-recover-tg-file-ids':
      void runAdminRecoveryTask('tgFileIds', { dryRun: false });
      return true;
    case 'dry-run-admin-recover-tg-file-ids':
      void runAdminRecoveryTask('tgFileIds', { dryRun: true });
      return true;
    case 'run-admin-recover-tg-thumbnails':
      void runAdminRecoveryTask('tgThumbnails', { dryRun: false });
      return true;
    case 'dry-run-admin-recover-tg-thumbnails':
      void runAdminRecoveryTask('tgThumbnails', { dryRun: true });
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
    case 'close-film-detail':
      void closeFilmDetail();
      return true;
    case 'toggle-film-tmdb-add':
      void toggleFilmTmdbAddFlow();
      return true;
    case 'search-films':
      state.filmTmdbAddOpen = true;
      void searchFilms({ query: state.filmSearchQuery });
      return true;
    case 'add-manual-film':
      void (async () => {
        if (await commitPendingFilmEditsBeforeAction({ actionName, keepDetailOpen: false })) {
          createManualFilmEntry();
        }
      })();
      return true;
    case 'load-more-film-search-results':
      loadMoreFilmSearchResults();
      return true;
    case 'clear-film-library-search':
      state.filmLibraryQuery = '';
      render();
      return true;
    case 'filter-films':
      if (FILM_FILTERS.includes(actionTarget.dataset.filmFilter || '')) {
        state.filmActiveFilter = actionTarget.dataset.filmFilter;
        render();
      }
      return true;
    case 'set-film-view-mode':
      if (['ticket', 'poster'].includes(actionTarget.dataset.filmViewMode || '')) {
        state.filmViewMode = actionTarget.dataset.filmViewMode;
        render();
      }
      return true;
    case 'open-film-detail':
      if (actionTarget.dataset.filmId) {
        void openFilmDetail(actionTarget.dataset.filmId);
      }
      return true;
    case 'open-tmdb-film-detail':
      void (async () => {
        if (await commitPendingFilmEditsBeforeAction({ actionName, keepDetailOpen: false })) {
          void openTmdbFilmDetail(actionTarget.dataset.tmdbId);
        }
      })();
      return true;
    case 'save-film-status':
      void (async () => {
        if (await commitPendingFilmEditsBeforeAction({ actionName, keepDetailOpen: true })) {
          saveFilmStatusForTarget({
            tmdbId: actionTarget.dataset.tmdbId,
            filmId: actionTarget.dataset.filmId,
            watchStatus: actionTarget.dataset.watchStatus || 'wantToWatch',
            openAfterSave: state.filmDetailOpen && Number(getActiveFilmRecord()?.tmdbId) === Number(actionTarget.dataset.tmdbId),
            silent: true
          });
        }
      })();
      return true;
    case 'clear-film-rating':
      saveFilmRatingForTarget(actionTarget.dataset.filmId || actionTarget.dataset.tmdbId, null);
      return true;
    case 'save-film-watched-date': {
      const input = actionTarget.closest('.cml-film-detail__date-control')?.querySelector('[data-film-watched-at-input]');
      saveFilmWatchedDateForTarget(actionTarget.dataset.filmId || actionTarget.dataset.tmdbId, input instanceof HTMLInputElement ? input.value : '');
      return true;
    }
    case 'film-toggle-favourite':
      void toggleFilmFavourite(actionTarget.dataset.filmId || state.activeFilmId);
      return true;
    case 'film-mark-rewatch':
      void markFilmRewatch(actionTarget.dataset.filmId || state.activeFilmId);
      return true;
    case 'film-edit-notes':
      void (async () => {
        if (await commitPendingFilmEditsBeforeAction({ actionName, keepDetailOpen: true })) {
          state.filmMoreActionsOpen = false;
          editFilmNotes(actionTarget.dataset.filmId || state.activeFilmId);
        }
      })();
      return true;
    case 'film-notes-format':
      applyFilmNotesFormat(actionTarget.dataset.filmNotesFormat || '');
      return true;
    case 'film-notes-preview-toggle':
      toggleFilmNotesPreview();
      return true;
    case 'film-toggle-more-actions':
      void toggleFilmMoreActions();
      return true;
    case 'film-edit-metadata':
      void (async () => {
        if (await commitPendingFilmEditsBeforeAction({ actionName, keepDetailOpen: true })) {
          state.filmMoreActionsOpen = false;
          editFilmMetadata(actionTarget.dataset.filmId || state.activeFilmId, {
            focusField: actionTarget.dataset.filmMetadataFocusField || ''
          });
        }
      })();
      return true;
    case 'film-change-poster':
      void (async () => {
        if (await commitPendingFilmEditsBeforeAction({ actionName, keepDetailOpen: true })) {
          state.filmMoreActionsOpen = false;
          changeFilmPoster(actionTarget.dataset.filmId || state.activeFilmId);
        }
      })();
      return true;
    case 'film-change-backdrop':
      void (async () => {
        if (await commitPendingFilmEditsBeforeAction({ actionName, keepDetailOpen: true })) {
          state.filmMoreActionsOpen = false;
          changeFilmBackdrop(actionTarget.dataset.filmId || state.activeFilmId);
        }
      })();
      return true;
    case 'film-pick-image':
      void applyFilmImagePathOverride(actionTarget.dataset.filmImageMode || state.filmImagePickerMode, actionTarget.dataset.filmImagePath || '');
      return true;
    case 'film-apply-image-url':
      void applyFilmImageOverride(state.filmImagePickerMode, state.filmImagePickerDraft);
      return true;
    case 'film-clear-image-override':
      resetFilmImageOverride(actionTarget.dataset.filmImageMode || state.filmImagePickerMode);
      return true;
    case 'film-reset-backdrop-frame':
      void resetFilmBackdropFrame();
      return true;
    case 'film-close-image-picker':
      void (async () => {
        if (await commitPendingFilmEditsBeforeAction({ actionName, keepDetailOpen: true })) {
          closeFilmImagePicker();
        }
      })();
      return true;
    case 'film-refresh-tmdb':
      void refreshFilmFromTmdb(actionTarget.dataset.filmId || state.activeFilmId);
      return true;
    case 'film-open-tmdb':
      void (async () => {
        if (await commitPendingFilmEditsBeforeAction({ actionName, keepDetailOpen: true })) {
          state.filmMoreActionsOpen = false;
          renderFilmMutationState({ allowRenderFallback: false });
          openFilmTmdbPage(actionTarget.dataset.tmdbId || getActiveFilmRecord()?.tmdbId);
        }
      })();
      return true;
    case 'film-remove-entry':
      void removeFilmEntry(actionTarget.dataset.filmId || state.activeFilmId);
      return true;
    case 'film-undo-remove-entry':
      void undoRemoveFilmEntry();
      return true;
    case 'film-delete-watch-event':
      void deleteFilmWatchEvent(actionTarget.dataset.filmId || state.activeFilmId, actionTarget.dataset.filmWatchEventId || '');
      return true;
    case 'film-undo-watch-event-delete':
      void undoDeleteFilmWatchEvent();
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
  const filmCardTarget = event.target instanceof Element ? event.target.closest('.cml-film-card, .cml-film-poster-card') : null;
  const tileTarget = event.target instanceof Element ? event.target.closest('.cml-media-tile') : null;
  const clickedInsideFilmMore = event.target instanceof Element && event.target.closest('.cml-film-detail__more');
  const clickedControl = event.target instanceof HTMLElement
    ? event.target.closest('button, a, input, textarea, select, label')
    : null;
  const pendingActionName = actionTarget instanceof HTMLElement ? actionTarget.dataset.action || '' : '';
  const clickedFilmAction = FILM_ACTION_NAMES.has(pendingActionName);
  const clickedSavedFilmCard = filmCardTarget instanceof HTMLElement && Boolean(filmCardTarget.dataset.filmId);
  const clickedRenderedFilmNoteLink = pendingActionName === 'film-edit-notes'
    && clickedControl instanceof HTMLAnchorElement;

  if (clickedRenderedFilmNoteLink) {
    return;
  }

  if (state.filmMoreActionsOpen && !clickedInsideFilmMore) {
    state.filmMoreActionsOpen = false;
    if (!(actionTarget instanceof HTMLElement) || !FILM_ACTION_NAMES.has(actionTarget.dataset.action || '')) {
      renderFilmMutationState();
    }
  }

  if (state.filmNotesEditing) {
    const notesEditor = refs.root?.querySelector('.cml-film-notes-editor');
    const clickedInsideNotesEditor = event.target instanceof Element
      && notesEditor instanceof HTMLElement
      && notesEditor.contains(event.target);
    const clickedNotesEditAction = actionTarget instanceof HTMLElement
      && actionTarget.dataset.action === 'film-edit-notes';
    if (!clickedInsideNotesEditor && !clickedNotesEditAction) {
      if (!clickedFilmAction && !clickedSavedFilmCard) {
        void commitFilmNotesEdit({ silent: false, keepDetailOpen: true });
      }
    }
  }

  if (state.filmMetadataEditing) {
    const metadataEditor = refs.root?.querySelector('.cml-film-metadata-editor');
    const clickedInsideMetadataEditor = event.target instanceof Element
      && metadataEditor instanceof HTMLElement
      && metadataEditor.contains(event.target);
    const clickedMetadataEditAction = actionTarget instanceof HTMLElement
      && actionTarget.dataset.action === 'film-edit-metadata';
    if (!clickedInsideMetadataEditor && !clickedMetadataEditAction) {
      if (!clickedFilmAction && !clickedSavedFilmCard) {
        void commitFilmMetadataEdit({ keepDetailOpen: true });
      }
    }
  }

  if (state.filmImagePickerMode) {
    const imagePicker = refs.root?.querySelector('.cml-film-image-picker');
    const clickedInsideImagePicker = event.target instanceof Element
      && imagePicker instanceof HTMLElement
      && imagePicker.contains(event.target);
    const clickedImagePickerAction = actionTarget instanceof HTMLElement
      && ['film-pick-image', 'film-apply-image-url', 'film-clear-image-override', 'film-close-image-picker'].includes(actionTarget.dataset.action || '');
    if (!clickedInsideImagePicker && !clickedImagePickerAction && !clickedFilmAction && !clickedSavedFilmCard) {
      void commitFilmImagePickerDraft({ keepDetailOpen: true });
    }
  }

  if (clickedControl instanceof HTMLElement && clickedControl.hasAttribute('disabled')) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  const isSelectClick = event.target instanceof Element && event.target.closest('[data-action="toggle-select"]');
  const inSelectionMode = state.selectedIds.size > 0
    || hasAnyPickerTarget(state);
  const clickedInsideThemeSwitcher = event.target instanceof Element && event.target.closest('.cml-theme-switcher');
  const shouldCloseThemeMenu = state.uiThemeMenuOpen && !clickedInsideThemeSwitcher;

  if (shouldCloseThemeMenu) {
    dismissThemeMenu({ allowRenderFallback: true });
  }

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

  if (
    state.filmDetailOpen
    && (state.filmNotesEditing || state.filmMetadataEditing || state.filmImagePickerMode)
    && actionTarget instanceof HTMLElement
    && actionTarget.dataset.action === 'toggle-film-tmdb-add'
  ) {
    event.preventDefault();
    event.stopPropagation();
    void toggleFilmTmdbAddFlow();
    return;
  }

  if (
    state.filmDetailOpen
    && (state.filmNotesEditing || state.filmMetadataEditing || state.filmImagePickerMode)
    && actionTarget instanceof HTMLElement
    && actionTarget.dataset.action === 'add-manual-film'
  ) {
    event.preventDefault();
    event.stopPropagation();
    void (async () => {
      if (await commitPendingFilmEditsBeforeAction({ actionName: 'add-manual-film', keepDetailOpen: false })) {
        createManualFilmEntry();
      }
    })();
    return;
  }

  if (actionTarget instanceof HTMLElement && FILM_ACTION_NAMES.has(actionTarget.dataset.action || '')) {
    event.preventDefault();
    event.stopPropagation();
    handleAction(actionTarget);
    return;
  }

  if (filmCardTarget instanceof HTMLElement && !(clickedControl instanceof HTMLElement) && filmCardTarget.dataset.filmId) {
    event.preventDefault();
    event.stopPropagation();
    void openFilmDetail(filmCardTarget.dataset.filmId);
    return;
  }

  if (actionTarget instanceof HTMLElement) {
    if (actionTarget.dataset.action === 'submit-login') {
      event.preventDefault();
    }

    if (actionTarget.dataset.primary) {
      const nextPrimary = actionTarget.dataset.primary;
      const alreadyOnPrimary = nextPrimary !== 'Private'
        && state.primaryFilter === nextPrimary
        && isPrimaryViewDomInSync(nextPrimary)
        && !hasActiveSearchUiState()
        && !state.secondaryFilter
        && !state.activeAlbumName
        && !state.activePlaylistName
        && !state.privateViewOpen
        && !hasAnyPickerTarget(state)
        && !state.previewId
        && !state.filmDetailOpen
        && state.selectedIds.size === 0
        && state.binSelectedIds.size === 0;
      if (alreadyOnPrimary) {
        patchSidebarActive();
        return;
      }
      if (nextPrimary === 'Mind' && isMobileLayout() && state.primaryFilter !== 'Mind') {
        rememberMobileMindReturnRoute();
      }
      handleMindViewTransition(nextPrimary, '');
      if (nextPrimary === 'Private') {
        state.primaryFilter = 'Photos';
        state.privateViewOpen = true;
        state.privateRouteUnlocked = false;
        state.privatePasswordDraft = '';
        state.privatePasswordError = '';
        state.focusedTileId = null;
      } else {
        state.primaryFilter = nextPrimary;
        clearPrivateViewState();
      }
      state.storagePanelOpen = false;
      state.secondaryFilter = '';
      state.videoCategoryFilter = '';
      state.activeAlbumName = '';
      state.activePlaylistName = '';
      state.activeFilmId = '';
      state.filmDetailOpen = false;
      state.filmManualDraft = null;
      clearTransientFilmDetail();
      resetFilmBackdropRotation();
      resetAddToTargetModes(state);
      resetSearchQuery();
      state.previewId = null;
      state.selectedIds.clear();
      state.binSelectedIds.clear();
      resetLoadedCount();
      state.uiThemeMenuOpen = false;
      pushNavigationHash();
      applyLocationRouteToMountedUi();
      if (state.primaryFilter === 'Films') {
        void warmFilmSearch();
      }
      return;
    }

    if (actionTarget.dataset.secondary) {
      const nextSecondary = actionTarget.dataset.secondary === state.secondaryFilter ? '' : actionTarget.dataset.secondary;
      const alreadyOnSecondary = state.primaryFilter === 'Photos'
        && state.secondaryFilter === nextSecondary
        && !hasActiveSearchUiState()
        && !state.activeAlbumName
        && !state.privateViewOpen
        && !hasAnyPickerTarget(state)
        && !state.previewId
        && state.selectedIds.size === 0
        && state.binSelectedIds.size === 0;
      if (alreadyOnSecondary) {
        patchSidebarActive();
        return;
      }
      handleMindViewTransition('Photos', nextSecondary);
      state.primaryFilter = 'Photos';
      state.secondaryFilter = nextSecondary;
      if (state.secondaryFilter !== 'Videos') {
        state.videoCategoryFilter = '';
      }
      clearPrivateViewState();
      state.storagePanelOpen = false;
      state.activeAlbumName = '';
      resetAddToTargetModes(state);
      state.previewId = null;
      state.selectedIds.clear();
      state.binSelectedIds.clear();
      resetLoadedCount();
      state.uiThemeMenuOpen = false;
      pushNavigationHash();
      applyLocationRouteToMountedUi();
      return;
    }

    if (actionTarget.dataset.action === 'filter-video-category') {
      const nextCategory = normalizeVideoAlbumRouteValue(actionTarget.dataset.category || '');
      const currentCategory = normalizeVideoAlbumRouteValue(state.videoCategoryFilter);
      state.videoCategoryFilter = nextCategory === currentCategory ? '' : nextCategory;
      clearPrivateViewState();
      state.previewId = null;
      state.selectedIds.clear();
      resetLoadedCount();
      pushNavigationHash();
      render();
      if (refs.scrollRegion) {
        refs.scrollRegion.scrollTo({ top: 0, behavior: 'auto' });
      }
      return true;
    }

    if (actionTarget.dataset.action === 'toggle-ui-theme-menu') {
      state.avatarMenuOpen = false;
      state.uiThemeMenuOpen = !state.uiThemeMenuOpen;
      if (!patchThemeSwitcher()) {
        render();
      }
      return;
    }

    if (actionTarget.dataset.action === 'set-ui-theme-color') {
      const nextTheme = commitThemeState({
        ...getThemeState(),
        themeColor: actionTarget.dataset.themeColor || getThemeState().themeColor
      });
      dismissThemeMenu({ allowRenderFallback: false });
      applyThemeToLiveShell(nextTheme);
      if (!patchThemeSwitcher()) {
        render();
      }
      return;
    }

    if (actionTarget.dataset.action === 'set-ui-theme-mode') {
      const nextTheme = commitThemeState({
        ...getThemeState(),
        themeMode: actionTarget.dataset.themeMode || getThemeState().themeMode
      });
      dismissThemeMenu({ allowRenderFallback: false });
      applyThemeToLiveShell(nextTheme);
      if (!patchThemeSwitcher()) {
        render();
      }
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
          const changedIds = [];
          items.slice(lo, hi + 1).forEach(item => {
            if (!state.selectedIds.has(item.id)) {
              state.selectedIds.add(item.id);
              changedIds.push(item.id);
            }
          });
          if (!syncSelectionUi(changedIds)) {
            render();
          }
          return;
        }
      }
      state.lastSelectedId = actionTarget.dataset.id;
    }

    if (handleAction(actionTarget)) {
      return;
    }
  }

  // Close avatar menu when clicking outside it, but don't swallow
  // actionable sidebar/navigation clicks.
  if (state.avatarMenuOpen && event.target instanceof Element && !event.target.closest('.cml-avatar-wrap')) {
    state.avatarMenuOpen = false;
    patchAvatarMenu();
    return;
  }

  if (shouldCloseThemeMenu) {
    if (!patchThemeSwitcher()) {
      render();
    }
  }
}

function handleDoubleClick(event) {
  if (!(event.target instanceof Element) || !refs.root) {
    return;
  }
  const docsRow = event.target.closest('.cml-docs-row[data-id]');
  const clickedControl = event.target.closest('button, a, input, textarea, select, label');
  if (!(docsRow instanceof HTMLElement) || clickedControl instanceof HTMLElement) {
    return;
  }
  const itemId = normalizeText(docsRow.getAttribute('data-id'));
  if (!itemId || state.secondaryFilter !== 'Documents') {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  state.docsContextMenu = null;
  downloadPreviewItem(itemId);
}

function handleInput(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement) && !(input instanceof HTMLElement)) {
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
  if (input.dataset.privateAccess === 'password') {
    state.privatePasswordDraft = input.value;
    if (state.privatePasswordError) {
      resetPrivateRouteUnlockError();
    }
    return;
  }
  if (input.dataset.mindInput === 'message') {
    state.mindDraft = input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement
      ? input.value
      : readMindDraftFromEditor(input);
    return;
  }
  if (input instanceof HTMLInputElement && input.hasAttribute('data-audio-progress')) {
    seekAudio(input.value);
    return;
  }
  if (input instanceof HTMLInputElement && input.hasAttribute('data-audio-volume')) {
    setAudioVolume(input.value);
    return;
  }
  if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) {
    return;
  }
  if (input.dataset.mindSettingsField) {
    state.mindSettingsDraft = {
      ...state.mindSettingsDraft,
      [input.dataset.mindSettingsField]: input.value
    };
    return;
  }
  if (input.classList.contains('cml-topbar__search-input') || input.classList.contains('cml-sidebar__search-input')) {
    state.searchDraft = input.value;
    scheduleSearchQueryApply(input.value, {
      selectionStart: input.selectionStart,
      selectionEnd: input.selectionEnd
    });
    return;
  }
  if (input.hasAttribute('data-films-search-input')) {
    state.filmSearchQuery = input.value;
    if (event.isComposing || state.filmSearchComposing) {
      return;
    }
    scheduleFilmSearch(input.value);
    return;
  }
  if (input.hasAttribute('data-film-library-search-input')) {
    state.filmLibraryQuery = input.value;
    if (event.isComposing || state.filmLibrarySearchComposing) {
      return;
    }
    render();
    return;
  }
  if (input.hasAttribute('data-film-notes-draft')) {
    state.filmNotesDraft = input.value;
    return;
  }
  if (input.hasAttribute('data-film-image-picker-url')) {
    state.filmImagePickerDraft = input.value;
    return;
  }
  if (input.hasAttribute('data-film-backdrop-frame-field')) {
    updateFilmBackdropFrameDraft(input.dataset.filmBackdropFrameField || '', input.value);
    return;
  }
  if (input.hasAttribute('data-film-metadata-field')) {
    const field = input.dataset.filmMetadataField;
    if (field && FILM_METADATA_FIELDS.includes(field)) {
      state.filmMetadataDraft = {
        ...(state.filmMetadataDraft || {}),
        [field]: input.value
      };
    }
    return;
  }
  if (input.hasAttribute('data-film-rating-input')) {
    const section = input.closest('.cml-film-detail__rating, .cml-film-detail__signal-value--rating');
    const control = input.closest('.cml-film-detail__rating-control');
    const normalizedRating = normalizeFilmUserRating(input.value) || 0.5;
    const mood = section?.querySelector('[data-film-rating-mood]');
    const activeDetail = input.closest('[data-film-detail-page]');
    if (control instanceof HTMLElement) {
      control.style.setProperty('--film-detail-rating-fill', `${(normalizedRating / 5) * 100}%`);
      control.style.setProperty('--film-detail-rating-progress', String((normalizedRating - 0.5) / 4.5));
    }
    activeDetail?.querySelectorAll('[data-film-rating-output]').forEach((output) => {
      output.textContent = `${normalizedRating.toFixed(1)} / 5.0`;
    });
    if (mood instanceof HTMLElement) {
      mood.textContent = getFilmUserRatingMood(normalizedRating);
    }
    return;
  }
  if (input.hasAttribute('data-film-watched-at-input')) {
    const activeDetail = input.closest('[data-film-detail-page]');
    activeDetail?.querySelectorAll('[data-film-watched-at-output]').forEach((output) => {
      output.textContent = input.value || 'Not set';
    });
    return;
  }
  if (input.hasAttribute('data-film-watch-event-input')) {
    input.dataset.filmWatchEventDraft = input.value;
    return;
  }
  if (input.dataset.focusKey === 'album-search') {
    state.albumDrawerSearch = input.value;
    if (!patchAlbumDialogSearchResults()) {
      renderAlbumDialogState({
        preferPreviewRender: state.albumDialogOrigin === 'preview',
        focusKey: 'search',
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd
      });
    }
    return;
  }
  if (input.classList.contains('cml-album-dialog__input')) {
    const selectionStart = input.selectionStart;
    const selectionEnd = input.selectionEnd;
    state.albumDraftName = input.value;
    if (state.albumDialogError) {
      state.albumDialogError = '';
    }
    if (!patchAlbumDialogCreateMode()) {
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
  if (input.hasAttribute('data-rename-item-input')) {
    state.renameItemDraftValue = input.value;
    if (state.renameItemError) {
      state.renameItemError = '';
    }
    return;
  }
  if (input.hasAttribute('data-playlist-input')) {
    state.playlistDraftName = input.value;
    if (state.playlistDialogError) {
      state.playlistDialogError = '';
    }
    return;
  }
  if (input.hasAttribute('data-docs-folder-input')) {
    return;
  }
  if (input.hasAttribute('data-docs-move-create-input')) {
    state.docsMoveCreateName = input.value;
    return;
  }
  if (input.hasAttribute('data-admin-recovery-target-chat')) {
    state.adminRecoveryTargetChatId = input.value;
    state.adminRecoverTgFileIdsError = '';
    state.adminRecoverTgThumbnailsError = '';
    return;
  }
  if (input.hasAttribute('data-admin-recovery-matches')) {
    state.adminRecoveryMatchesText = input.value;
    state.adminRecoverTgFileIdsError = '';
    return;
  }
  if (input.dataset.adminField && input.dataset.adminSection) {
    const value = input instanceof HTMLInputElement && input.type === 'checkbox'
      ? input.checked
      : input.value;
    updateAdminDraftField(state, input.dataset.adminSection, input.dataset.adminField, value);
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
    return;
  }
  if (target.dataset.mindFile) {
    void handleMindAssetSelection(target.dataset.mindFile, target.files && target.files[0] ? target.files[0] : null);
    target.value = '';
    return;
  }
  if (target.hasAttribute('data-film-rating-input')) {
    saveFilmRatingForTarget(target.dataset.filmId || target.dataset.tmdbId, Number(target.value));
    return;
  }
  if (target.hasAttribute('data-film-watched-at-input')) {
    target.dataset.lastSavedValue = target.value;
    saveFilmWatchedDateForTarget(target.dataset.filmId || target.dataset.tmdbId, target.value);
    return;
  }
  if (target.hasAttribute('data-film-watch-event-input')) {
    const previousDate = target.dataset.filmWatchEvent || '';
    const watchEventId = target.dataset.filmWatchEventId || '';
    if (target.value && target.value !== previousDate) {
      editFilmWatchEvent(target.dataset.filmId || state.activeFilmId, watchEventId, previousDate, target.value);
      target.dataset.filmWatchEvent = target.value;
    }
  }
  if (target.hasAttribute('data-film-backdrop-frame-field')) {
    updateFilmBackdropFrameDraft(target.dataset.filmBackdropFrameField || '', target.value);
    void saveFilmBackdropFrameDraft({ keepDetailOpen: true });
  }
}

function handleFocusIn(event) {
  if (event.target instanceof HTMLInputElement && event.target.hasAttribute('data-films-search-input')) {
    void warmFilmSearch();
  }
  const tile = event.target instanceof Element ? event.target.closest('.cml-media-tile') : null;
  if (tile instanceof HTMLElement) {
    state.focusedTileId = tile.getAttribute('data-tile-id');
  }
  if (event.target instanceof HTMLElement && event.target.dataset.mindInput === 'message' && isMobileLayout()) {
    if (event.target.isContentEditable) {
      syncMindDraftEditorValue();
      placeCaretAtEnd(event.target);
    }
    stabilizeMobileMindViewport();
    [0, 80, 220].forEach((delay) => {
      window.setTimeout(() => {
        stabilizeMobileMindViewport();
        scrollMindToBottom({ force: true });
      }, delay);
    });
  }
}

function handleFocusOut(event) {
  if (state.renameAlbumDialogOpen && event.target instanceof HTMLInputElement && event.target.hasAttribute('data-rename-album-input')) {
    const draft = normalizeText(event.target.value).replace(/\s+/g, ' ');
    state.renameAlbumDraftName = draft;
    if (!draft || draft.toLowerCase() === state.renameAlbumTarget.toLowerCase()) {
      closeRenameAlbumDialog();
    } else {
      void submitRenameAlbum();
    }
  }
  if (state.docsNewFolderOpen && event.target instanceof HTMLInputElement && event.target.hasAttribute('data-docs-folder-input')) {
    const folderName = normalizeText(event.target.value).replace(/[\/\\:*?"<>|]/g, '_').replace(/\s+/g, ' ');
    if (folderName) {
      createDocFolder(folderName);
    } else {
      state.docsNewFolderOpen = false;
      render();
    }
  }
  if (event.target instanceof HTMLInputElement && event.target.hasAttribute('data-film-watched-at-input')) {
    if (event.target.dataset.lastSavedValue !== event.target.value) {
      event.target.dataset.lastSavedValue = event.target.value;
      saveFilmWatchedDateForTarget(event.target.dataset.filmId || event.target.dataset.tmdbId, event.target.value);
    }
    return;
  }
  if (event.target instanceof HTMLInputElement && event.target.hasAttribute('data-film-watch-event-input')) {
    const previousDate = event.target.dataset.filmWatchEvent || '';
    const watchEventId = event.target.dataset.filmWatchEventId || '';
    if (event.target.value && event.target.value !== previousDate) {
      editFilmWatchEvent(event.target.dataset.filmId || state.activeFilmId, watchEventId, previousDate, event.target.value);
      event.target.dataset.filmWatchEvent = event.target.value;
    }
    return;
  }
  if (event.target instanceof HTMLInputElement && event.target.hasAttribute('data-film-image-picker-url')) {
    void commitFilmImagePickerDraft({ keepDetailOpen: true });
    return;
  }
  if (event.target instanceof HTMLInputElement && event.target.hasAttribute('data-film-backdrop-frame-field')) {
    void saveFilmBackdropFrameDraft({ keepDetailOpen: true });
    return;
  }
  if (event.target instanceof HTMLElement && event.target.dataset.mindInput === 'message' && isMobileLayout()) {
    window.setTimeout(() => {
      stabilizeMobileMindViewport();
      scrollMindToBottom({ force: true });
    }, 180);
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

  if (event.target instanceof HTMLInputElement && event.target.dataset.privateAccess === 'password') {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      unlockPrivateRoute(event.target.value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      state.privatePasswordDraft = '';
      state.privatePasswordError = '';
      state.focusedTileId = null;
      render();
    }
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    focusSearchInput();
    return;
  }

  if (state.filmDetailOpen) {
    const focusedNotesSection = event.target instanceof HTMLElement && event.target.dataset.action === 'film-edit-notes'
      ? event.target
      : null;
    if (focusedNotesSection && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      event.stopPropagation();
      handleAction(focusedNotesSection);
      return;
    }
    if (event.key === 'Escape') {
      if (state.filmMoreActionsOpen) {
        state.filmMoreActionsOpen = false;
        renderFilmMutationState();
        return;
      }
      if (state.filmImagePickerMode) {
        void commitFilmImagePickerDraft({ keepDetailOpen: true }).then((saved) => {
          if (saved) {
            closeFilmImagePicker();
          }
        });
        return;
      }
      void closeFilmDetail();
    }
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

  if (state.docsMoveDialogOpen && !state.docsMoveCreateOpen) {
    if (event.key === 'Escape') {
      state.docsMoveDialogOpen = false;
      render();
      return;
    }
    // Let other keys fall through to folder navigation
  }

  if (state.docsMoveCreateOpen) {
    if (event.key === 'Escape') {
      state.docsMoveCreateOpen = false;
      state.docsMoveCreateName = '';
      render();
      return;
    }
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.hasAttribute('data-docs-move-create-input')) {
      event.preventDefault();
      const folderName = normalizeText(state.docsMoveCreateName);
      if (folderName) {
        const newDir = state.docsMoveDialogDir ? state.docsMoveDialogDir + '/' + folderName : folderName;
        if (!(state.docsFolders instanceof Set)) state.docsFolders = new Set();
        state.docsFolders.add(newDir);
        state.docsMoveCreateOpen = false;
        state.docsMoveCreateName = '';
        state.docsMoveDialogDir = newDir;
        render();
      }
      return;
    }
    return;
  }

  if (state.docsNewFolderOpen) {
    if (event.key === 'Escape') {
      state.docsNewFolderOpen = false;
      render();
      return;
    }
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.hasAttribute('data-docs-folder-input')) {
      event.preventDefault();
      event.target.blur();
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
      event.target.blur();
    }
    return;
  }

  if (state.renameItemDialogOpen) {
    if (event.key === 'Escape') {
      closeRenameItemDialog();
      return;
    }
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.hasAttribute('data-rename-item-input')) {
      event.preventDefault();
      void submitRenameItem();
    }
    return;
  }

  if (state.playlistDialogOpen) {
    if (event.key === 'Escape') {
      closePlaylistDialog();
      return;
    }
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.hasAttribute('data-playlist-input')) {
      event.preventDefault();
      void submitPlaylistDialog();
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
      void submitAlbumDialog();
    }
    return;
  }

  // Escape cancels album-selection (picker) mode
  if (hasAnyPickerTarget(state) && event.key === 'Escape') {
    closeAlbumSelection();
    return;
  }

  if (event.target instanceof HTMLInputElement && (event.target.classList.contains('cml-sidebar__search-input') || event.target.classList.contains('cml-topbar__search-input'))) {
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

  if (event.target instanceof HTMLInputElement && event.target.hasAttribute('data-films-search-input')) {
    if (event.isComposing || state.filmSearchComposing || event.key === 'Process') {
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      clearPendingFilmSearch();
      void searchFilms({ query: event.target.value });
    }
    return;
  }

  if (event.target instanceof HTMLInputElement && event.target.dataset.mindInput === 'message') {
    if (event.key === 'Enter') {
      event.preventDefault();
      void sendMindMessage();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.target.blur();
      return;
    }
    return;
  }

  if (event.target instanceof HTMLTextAreaElement && event.target.hasAttribute('data-film-notes-draft')) {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelFilmNotesEdit();
    }
    return;
  }

  if (
    (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
    && event.target.hasAttribute('data-film-metadata-field')
  ) {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelFilmMetadataEdit();
    } else if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      event.target.blur();
    }
    return;
  }

  if (event.target instanceof HTMLInputElement && event.target.hasAttribute('data-film-image-picker-url')) {
    if (event.key === 'Escape') {
      event.preventDefault();
      void commitFilmImagePickerDraft({ keepDetailOpen: true }).then((saved) => {
        if (saved) {
          closeFilmImagePicker();
        }
      });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      void applyFilmImageOverride(state.filmImagePickerMode, event.target.value);
    }
    return;
  }

  if (event.target instanceof HTMLInputElement && event.target.hasAttribute('data-film-watch-event-input')) {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.target.blur();
    }
    return;
  }

  if (event.target instanceof HTMLElement && event.target.dataset.mindInput === 'message' && event.target.isContentEditable) {
    if (event.isComposing || state.mindComposerComposing) {
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMindMessage();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.target.blur();
      return;
    }
    return;
  }

  if (event.target instanceof HTMLTextAreaElement && event.target.classList.contains('cml-preview__info-description-input')) {
    if (event.key === 'Escape') {
      event.preventDefault();
      const descSection = refs.root.querySelector('.cml-preview__info-section--description');
      if (descSection) {
        const currentItem = getAllItems().find((entry) => entry.id === state.previewId);
        patchDescriptionDisplay(descSection, currentItem?.description || '');
      }
    }
    return;
  }

  if (event.target instanceof HTMLInputElement && event.target.classList.contains('cml-preview__info-time-input')) {
    if (event.key === 'Escape') {
      event.preventDefault();
      const captureSection = refs.root.querySelector('.cml-preview__info-section--capture-time');
      if (captureSection) {
        const currentItem = getAllItems().find((entry) => entry.id === state.previewId);
        patchCaptureTimeDisplay(captureSection, currentItem || null);
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      event.target.blur();
    }
    return;
  }

  if (state.previewId) {
    const isBinPreview = state.primaryFilter === 'Bin';
    if (event.key === 'Escape') {
      if (state.previewImmersive) {
        state.previewImmersive = false;
        if (!renderPreviewTransientLayers()) { render(); }
      } else if (state.infoOpen) {
        setPreviewInfoOpen(false, { allowRenderFallback: false });
      } else {
        closePreview();
      }
    } else if (event.key === 'ArrowRight') {
      movePreview(1);
    } else if (event.key === 'ArrowLeft') {
      movePreview(-1);
    } else if (!isBinPreview && (event.key === 'f' || event.key === 'F')) {
      toggleFavorite(state.previewId);
    } else if (event.key === 'i' || event.key === 'I') {
      setPreviewInfoOpen(!state.infoOpen, { allowRenderFallback: false });
    } else if (!isBinPreview && (event.key === 'e' || event.key === 'E')) {
      state.previewImmersive = !state.previewImmersive;
      if (!renderPreviewTransientLayers()) { render(); }
    } else if (!isBinPreview && (event.key === 'r' || event.key === 'R')) {
      state.previewRotation = (state.previewRotation + 90) % 360;
      applyPreviewRotation();
    } else if (isBinPreview && (event.key === 'Backspace' || event.key === 'Delete')) {
      event.preventDefault();
      requestDeleteBinPreviewPermanently(state.previewId);
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
    const previousPath = `${window.location.pathname}${window.location.search}`;
    const result = pushState.apply(this, args);
    const nextPath = `${window.location.pathname}${window.location.search}`;
    queueMicrotask(previousPath === nextPath ? applyLocationRouteToMountedUi : syncMount);
    return result;
  };
  window.history.replaceState = function patchedReplaceState(...args) {
    const previousPath = `${window.location.pathname}${window.location.search}`;
    const result = replaceState.apply(this, args);
    const nextPath = `${window.location.pathname}${window.location.search}`;
    queueMicrotask(previousPath === nextPath ? applyLocationRouteToMountedUi : syncMount);
    return result;
  };
  window.addEventListener('popstate', syncMount);
}

// ── URL hash navigation persistence ──
function buildNavigationHash() {
  const primary = state.primaryFilter || 'Photos';
  const secondary = state.secondaryFilter || '';
  const album = state.activeAlbumName || '';
  if (isPrivateRouteActive()) {
    return `#/photos/${PRIVATE_ROUTE_SEGMENT}`;
  }
  if (secondary) {
    if (secondary === 'Videos' && state.videoCategoryFilter) {
      const routeValue = isUngroupedVideoAlbum(state.videoCategoryFilter)
        ? UNGROUPED_VIDEO_ROUTE_SEGMENT
        : state.videoCategoryFilter;
      return '#/videos/' + encodeURIComponent(routeValue);
    }
    if (secondary === 'TODO') {
      return '#/todo';
    }
    return '#/' + secondary.toLowerCase();
  }
  if (primary === 'Collections' && album) {
    return '#/albums/' + encodeURIComponent(album);
  }
  if (primary === 'Collections') {
    return '#/albums';
  }
  if (primary === 'Films') {
    if (state.filmDetailOpen && state.activeFilmId) {
      return '#/films/' + encodeURIComponent(state.activeFilmId);
    }
    return '#/films';
  }
  if (primary === 'Music') {
    return getActivePlaylistName()
      ? '#/music/' + encodeURIComponent(getActivePlaylistName())
      : '#/music';
  }
  if (primary === 'Mind') {
    return '#/mind';
  }
  if (primary === 'Bin') {
    return '#/bin';
  }
  return '#/photos';
}

function pushNavigationHash({ mode = 'replace' } = {}) {
  const nextHash = buildNavigationHash();
  if (window.location.hash !== nextHash) {
    if (mode === 'push') {
      history.pushState(null, '', nextHash);
    } else {
      history.replaceState(null, '', nextHash);
    }
  }
}

function restoreNavigationFromHash() {
  const rawHash = decodeURIComponent(window.location.hash || '').replace(/^#\/?/, '');
  const {
    preserveAlbumSelectionTarget,
    preserveVideoAlbumSelectionTarget,
    preservePrivateSelectionMode,
    preserveAlbumPickerDistinctOnly,
  } = buildPickerPreserveFlags(state, rawHash);
  resetAddToTargetModes(state, {
    preserveAlbumSelectionTarget,
    preserveVideoAlbumSelectionTarget,
    preservePrivateSelectionMode,
    preserveAlbumPickerDistinctOnly
  });
  if (!rawHash) {
    state.primaryFilter = 'Photos';
    state.secondaryFilter = '';
    state.videoCategoryFilter = '';
    state.activeAlbumName = '';
    state.activePlaylistName = '';
    state.activeFilmId = '';
    state.filmDetailOpen = false;
    state.filmManualDraft = null;
    clearTransientFilmDetail();
    resetFilmBackdropRotation();
    clearPrivateViewState();
    return;
  }

  const parts = rawHash.split('/');
  const route = parts[0].toLowerCase();

  switch (route) {
    case 'photos':
      state.primaryFilter = 'Photos';
      state.secondaryFilter = '';
      state.videoCategoryFilter = '';
      state.activeAlbumName = '';
      state.activePlaylistName = '';
      if (parts[1] && parts[1].toLowerCase() === PRIVATE_ROUTE_SEGMENT) {
        resetAddToTargetModes(state);
        state.privateViewOpen = true;
        state.privateRouteUnlocked = false;
        state.privatePasswordDraft = '';
        state.privatePasswordError = '';
        state.focusedTileId = null;
      } else {
        clearPrivateViewState();
      }
      break;
    case 'albums':
      state.primaryFilter = 'Collections';
      state.secondaryFilter = '';
      state.videoCategoryFilter = '';
      state.activePlaylistName = '';
      clearPrivateViewState();
      if (parts[1]) {
        // Preserve the original album name casing from the hash
        state.activeAlbumName = parts.slice(1).join('/');
      } else {
        state.activeAlbumName = '';
      }
      break;
    case 'films':
      state.primaryFilter = 'Films';
      state.secondaryFilter = '';
      state.videoCategoryFilter = '';
      state.activeAlbumName = '';
      state.activePlaylistName = '';
      if (parts[1]) {
        state.activeFilmId = parts.slice(1).join('/');
        state.filmDetailOpen = true;
        clearTransientFilmDetail();
      } else {
        state.activeFilmId = '';
        state.filmDetailOpen = false;
        state.filmManualDraft = null;
        clearTransientFilmDetail();
        resetFilmBackdropRotation();
      }
      state.filmNotesEditing = false;
      state.filmNotesDraft = '';
      state.filmNotesPreview = false;
      state.filmMetadataEditing = false;
      state.filmMetadataDraft = null;
      state.filmMetadataFocusField = '';
      state.filmMoreActionsOpen = false;
      state.filmImagePickerMode = '';
      state.filmImagePickerDraft = '';
      state.filmBackdropFrameDraft = null;
      clearPrivateViewState();
      break;
    case 'mind':
      state.primaryFilter = 'Mind';
      state.secondaryFilter = '';
      state.videoCategoryFilter = '';
      state.activeAlbumName = '';
      state.activePlaylistName = '';
      clearPrivateViewState();
      break;
    case 'music':
      state.primaryFilter = 'Music';
      state.secondaryFilter = '';
      state.videoCategoryFilter = '';
      state.activeAlbumName = '';
      state.activePlaylistName = parts[1] ? parts.slice(1).join('/') : '';
      clearPrivateViewState();
      break;
    case 'bin':
      state.primaryFilter = 'Bin';
      state.secondaryFilter = '';
      state.videoCategoryFilter = '';
      state.activeAlbumName = '';
      state.activePlaylistName = '';
      clearPrivateViewState();
      break;
    case 'videos':
      state.primaryFilter = 'Photos';
      state.secondaryFilter = 'Videos';
      state.videoCategoryFilter = normalizeVideoAlbumRouteValue(parts.slice(1).join('/'));
      state.activeAlbumName = '';
      state.activePlaylistName = '';
      clearPrivateViewState();
      break;
    case 'todo':
      state.primaryFilter = 'Photos';
      state.secondaryFilter = 'TODO';
      state.videoCategoryFilter = '';
      state.activeAlbumName = '';
      state.activePlaylistName = '';
      clearPrivateViewState();
      break;
    case 'documents':
      state.primaryFilter = 'Photos';
      state.secondaryFilter = 'Documents';
      state.videoCategoryFilter = '';
      state.activeAlbumName = '';
      state.activePlaylistName = '';
      clearPrivateViewState();
      break;
    case 'favourites':
      state.primaryFilter = 'Photos';
      state.secondaryFilter = 'Favourites';
      state.videoCategoryFilter = '';
      state.activeAlbumName = '';
      state.activePlaylistName = '';
      clearPrivateViewState();
      break;
    default:
      state.primaryFilter = 'Photos';
      state.secondaryFilter = '';
      state.videoCategoryFilter = '';
      state.activeAlbumName = '';
      state.activePlaylistName = '';
      state.activeFilmId = '';
      state.filmDetailOpen = false;
      clearTransientFilmDetail();
      resetFilmBackdropRotation();
      state.filmNotesEditing = false;
      state.filmNotesDraft = '';
      state.filmNotesPreview = false;
      state.filmMetadataEditing = false;
      state.filmMetadataDraft = null;
      state.filmMetadataFocusField = '';
      state.filmMoreActionsOpen = false;
      clearPrivateViewState();
      break;
  }
  if (state.primaryFilter !== 'Films') {
    state.activeFilmId = '';
    state.filmDetailOpen = false;
    clearTransientFilmDetail();
    resetFilmBackdropRotation();
    state.filmNotesEditing = false;
    state.filmNotesDraft = '';
    state.filmNotesPreview = false;
    state.filmMetadataEditing = false;
    state.filmMetadataDraft = null;
    state.filmMetadataFocusField = '';
    state.filmMoreActionsOpen = false;
  }
  if (state.primaryFilter !== 'Mind') {
    clearMindVisitStickyMessages();
  }
}

function boot() {
  window.__cmlOpenPreview = openPreviewFromEvent;
  commitThemeState(getThemeState(), { dispatch: false });
  patchHistory();
  restoreNavigationFromHash();
  syncMount();
  window.addEventListener('hashchange', () => {
    applyLocationRouteToMountedUi();
  });
  document.addEventListener('visibilitychange', scheduleFilmBackdropRotation);
  window.addEventListener(THEME_CHANGE_EVENT, (event) => {
    if (!event.detail) {
      return;
    }
    syncThemeState(event.detail);
    applyThemeToLiveShell(event.detail);
    if (!patchThemeSwitcher() && refs.root) {
      render();
    }
  });
  if (typeof window.matchMedia === 'function') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (getThemeState().themeMode === 'auto') {
        const nextTheme = commitThemeState(getThemeState());
        applyThemeToLiveShell(nextTheme);
        if (!patchThemeSwitcher() && refs.root) {
          render();
        }
      }
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleSystemThemeChange);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
