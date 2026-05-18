import assert from 'node:assert/strict';
import fs from 'node:fs';

import { AudioPlayerPanel, BinGrid, CollectionGrid, CollectionSummary, DocumentsListView, MediaGrid, MediaTile, MindChatView, MobileAudioMiniPlayer, MobileBottomNav, MusicListView, MusicSummary, PreviewModal, PrivateAlbumGate, PrivateAlbumSummary, SearchResultsView, Sidebar, SidebarAudioPlayer, StorageCard, StorageTrigger, TopSearchBar, VideoAlbumGrid, VideoAlbumSummary, VideoCategoryBar, AlbumDialog } from '../js/media-library/components.js';
import { FilmCard, FilmDetailPage, FilmSearchResults, FilmsPage } from '../js/media-library/films-components.js';

describe('media library download actions', () => {
  it('renders Films search as one local-first input with generic movie-search feedback above the local film list', () => {
    const panel = FilmSearchResults({
      error: 'TMDb credentials are not configured. Set TMDB_ACCESS_TOKEN or TMDB_API_KEY.',
      query: '花样',
    });
    const html = FilmsPage({
      records: [],
      searchQuery: '花样',
      searchPanelHtml: panel,
    });

    assert.match(html, /data-film-library-search-input/);
    assert.doesNotMatch(html, /data-action="toggle-film-tmdb-add"/);
    assert.doesNotMatch(html, /data-form="films-search"/);
    assert.doesNotMatch(html, /data-films-search-input/);
    assert.match(html, /cml-film-search-result--custom/);
    assert.match(html, /data-action="add-manual-film" data-film-manual-title="[^"]+"/);
    assert.match(html, /data-action="filter-films"/);
    assert.match(html, /data-film-filter="Watched"/);
    assert.doesNotMatch(html, /data-film-filter="Watching"/);
    assert.doesNotMatch(html, /cml-films-filters__chip[^>]*disabled/);
    assert.match(html, /Movie search is unavailable\. Try again later\./);
    assert.doesNotMatch(html, /TMDB_ACCESS_TOKEN|TMDB_API_KEY|credentials|Add from TMDb|TMDb result/);
    assert.match(html, /No saved films yet/);
    assert.ok(html.indexOf('cml-films-mvp') < html.indexOf('cml-films-filters'));
    assert.ok(html.indexOf('cml-films-filters') < html.indexOf('cml-films-empty'));
    assert.doesNotMatch(html, /cml-films-library-search__label/);
  });

  it('keeps saved-library search as the only Films entry control at rest', () => {
    const html = FilmsPage({
      records: [],
      totalCount: 2,
      libraryQuery: 'Cure',
      searchQuery: '',
      searchPanelHtml: '',
    });

    assert.doesNotMatch(html, /data-action="toggle-film-tmdb-add"/);
    assert.doesNotMatch(html, /data-films-search-input/);
    assert.doesNotMatch(html, /data-form="films-search"/);
    assert.doesNotMatch(html, /Add from TMDb/);
    assert.match(html, /data-film-library-search-input/);
    assert.match(html, /value="Cure"/);
    assert.match(html, /placeholder="Search by title\.\.\."/);
    assert.doesNotMatch(html, /data-action="add-manual-film"/);
    assert.match(html, /data-action="clear-film-library-search"/);
    assert.match(html, /No saved films found\./);
    assert.match(html, /cml-films-library-search--primary/);

    const openedHtml = FilmsPage({
      records: [],
      totalCount: 2,
      libraryQuery: 'Cure',
      searchQuery: 'Pearl',
      addFlowOpen: true,
      searchPanelHtml: '',
    });
    assert.doesNotMatch(openedHtml, /data-films-search-input/);
    assert.doesNotMatch(openedHtml, /value="Pearl"/);
  });

  it('renders saved Films in a poster-only view mode', () => {
    const html = FilmsPage({
      viewMode: 'poster',
      records: [{
        id: 'tmdb-42',
        tmdbId: 42,
        title: 'Poster Movie',
        originalTitle: 'Poster Original',
        posterPath: '/poster.jpg',
        status: 'watched',
        watchedAt: '2026-05-09',
      }],
    });

    assert.match(html, /data-action="set-film-view-mode"/);
    assert.match(html, /data-film-view-mode="poster" aria-pressed="true"/);
    assert.match(html, /cml-films-poster-grid/);
    assert.match(html, /cml-film-poster-card/);
    assert.match(html, /src="https:\/\/image\.tmdb\.org\/t\/p\/w342\/poster\.jpg"/);
    assert.doesNotMatch(html, /cml-film-card__ticket-panel/);
    assert.doesNotMatch(html, />Poster Movie<\/strong>/);
  });

  it('renders TMDb results as addable movie cards', () => {
    const html = FilmSearchResults({
      query: 'Inception',
      results: [{
        tmdbId: 27205,
        title: 'Inception',
        posterPath: '/poster.jpg',
        releaseDate: '2010-07-16',
        voteAverage: 8.4,
        overview: 'A thief who steals corporate secrets through dream-sharing technology.',
      }],
    });

    assert.match(html, /cml-films-result__poster-wrap/);
    assert.match(html, /cml-film-search-result--custom/);
    assert.match(html, /data-film-manual-title="Inception"/);
    assert.match(html, /data-action="open-tmdb-film-detail"/);
    assert.match(html, /data-action="save-film-status" data-watch-status="wantToWatch"/);
    assert.match(html, /data-action="save-film-status" data-watch-status="watched"/);
  });

  it('places the custom film entry after the first three TMDb results', () => {
    const html = FilmSearchResults({
      query: '希区柯克',
      results: [1, 2, 3, 4].map((id) => ({
        tmdbId: id,
        title: `TMDb ${id}`,
        releaseDate: `200${id}-01-01`,
      })),
    });

    assert.ok(html.indexOf('TMDb 1') < html.indexOf('TMDb 2'));
    assert.ok(html.indexOf('TMDb 2') < html.indexOf('TMDb 3'));
    assert.ok(html.indexOf('TMDb 3') < html.indexOf('Custom entry'));
    assert.ok(html.indexOf('Custom entry') < html.indexOf('TMDb 4'));
  });

  it('marks TMDb search results that already exist in Films', () => {
    const html = FilmSearchResults({
      query: 'Inception',
      savedRecordsByTmdbId: new Map([[27205, {
        id: 'tmdb-27205',
        tmdbId: 27205,
        status: 'watched',
        userRating: 4.5,
      }]]),
      results: [{
        tmdbId: 27205,
        title: 'Inception',
        posterPath: '/poster.jpg',
        releaseDate: '2010-07-16',
        voteAverage: 8.4,
      }],
    });

    assert.match(html, /cml-film-search-result[^"]*is-saved/);
    assert.match(html, /Saved &middot; Watched/);
    assert.match(html, /My rating 4\.5/);
    assert.doesNotMatch(html, /TMDb 8\.4/);
    assert.match(html, /is-current"[^>]*data-watch-status="watched"[^>]*disabled/);
    assert.match(html, />Saved<\/button>/);
  });

  it('restores add actions for TMDb search results after a film is removed from saved state', () => {
    const result = {
      tmdbId: 27205,
      title: 'Inception',
      posterPath: '/poster.jpg',
      releaseDate: '2010-07-16',
      voteAverage: 8.4,
    };
    const savedHtml = FilmSearchResults({
      query: 'Inception',
      savedRecordsByTmdbId: { 27205: { id: 'tmdb-27205', tmdbId: 27205, status: 'wantToWatch' } },
      results: [result],
    });
    const removedHtml = FilmSearchResults({
      query: 'Inception',
      savedRecordsByTmdbId: new Map(),
      results: [result],
    });

    assert.match(savedHtml, /cml-film-search-result[^"]*is-saved/);
    assert.match(savedHtml, /Saved &middot; Want/);
    assert.match(savedHtml, /data-watch-status="wantToWatch"[^>]*disabled>Saved<\/button>/);
    assert.doesNotMatch(removedHtml, /cml-film-search-result[^"]*is-saved/);
    assert.doesNotMatch(removedHtml, /Saved &middot;/);
    assert.match(removedHtml, /data-watch-status="wantToWatch"[^>]*>Want<\/button>/);
    assert.match(removedHtml, /data-watch-status="watched"[^>]*>Watched<\/button>/);
  });

  it('wires Films TMDb search as live debounced input with stale-response guards', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
    const emptyHtml = FilmSearchResults({ query: 'No Match', results: [] });
    const loadingHtml = FilmSearchResults({ query: 'Pearl', loading: true, settling: true, resultKey: 3, results: [] });
    const clearingHtml = FilmSearchResults({ query: '', clearing: true, results: [{ tmdbId: 1, title: 'Old Result' }] });

    assert.match(appSource, /const FILM_SEARCH_DEBOUNCE_MS = 280/);
    assert.match(appSource, /const FILM_SEARCH_MIN_LOADING_MS = 80/);
    assert.match(appSource, /const FILM_SEARCH_CLEAR_TRANSITION_MS = 180/);
    assert.match(appSource, /let filmSearchRequestId = 0/);
    assert.match(appSource, /let filmSearchAbortController = null/);
    assert.match(appSource, /const filmSearchCache = new Map\(\)/);
    assert.match(appSource, /function shouldRunFilmSearch\(query\)/);
    assert.match(appSource, /function filmRecordMatchesLibraryQuery\(record = \{\}, query = state\.filmLibraryQuery\)/);
    assert.match(appSource, /function getFilmRecordsMatchingLibraryQuery\(query = state\.filmLibraryQuery\)/);
    assert.match(appSource, /function shouldFallbackFilmLibrarySearchToTmdb\(query = state\.filmLibraryQuery\)/);
    assert.match(appSource, /function applyFilmLibrarySearchQuery\(query = ''\)/);
    assert.match(appSource, /scheduleFilmSearch\(inputQuery, \{ auto: true \}\)/);
    assert.match(appSource, /function scheduleFilmSearch\(query, \{ auto = false \} = \{\}\)/);
    assert.match(appSource, /function setFilmSearchResults\(results/);
    assert.match(appSource, /filmSearchPage: 0/);
    assert.match(appSource, /filmSearchTotalPages: 0/);
    assert.match(appSource, /filmSearchTotalResults: 0/);
    assert.match(appSource, /filmSearchLoadingMore: false/);
    assert.match(appSource, /function settleFilmSearchResults\(requestId\)/);
    assert.match(appSource, /function clearFilmSearchResultsSmoothly\(\)/);
    assert.match(appSource, /filmSearchComposing: false/);
    assert.match(appSource, /state\.filmSearchComposing = true/);
    assert.match(appSource, /state\.filmSearchComposing = false/);
    assert.match(appSource, /event\.isComposing \|\| state\.filmSearchComposing/);
    assert.match(appSource, /void searchFilms\(\{ query: event\.target\.value \}\)/);
    assert.match(appSource, /void searchFilms\(\{ query: inputQuery, auto \}\)/);
    assert.match(appSource, /scheduleFilmSearch\(input\.value\)/);
    assert.match(appSource, /searchFilms\(\{ query: event\.target\.value \}\)/);
    assert.match(appSource, /function loadMoreFilmSearchResults\(\)/);
    assert.match(appSource, /requestId !== filmSearchRequestId/);
    assert.match(appSource, /signal: filmSearchAbortController\.signal/);
    assert.match(emptyHtml, /cml-film-search-result--custom/);
    assert.match(emptyHtml, /data-film-manual-title="No Match"/);
    assert.doesNotMatch(emptyHtml, /No TMDb results found\./);
    assert.match(loadingHtml, /Searching\.\.\./);
    assert.match(loadingHtml, /cml-film-search-panel\s+is-searching\s+is-settling/);
    assert.match(loadingHtml, /data-film-search-result-key="3"/);
    assert.match(loadingHtml, /cml-film-search-results\s+is-loading\s+is-settling/);
    assert.match(clearingHtml, /cml-film-search-panel\s+is-clearing/);
    assert.match(clearingHtml, /cml-film-search-results\s+is-clearing/);
  });

  it('keeps TMDb search-result save actions on the Films index route', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /function normalizeFilmRecord\(movie = \{\}, entry = null, existingRecord = null\)/);
    assert.match(appSource, /function upsertFilmRecord\(record, \{ preserveLocal = false \} = \{\}\)/);
    assert.match(appSource, /const existingIndex = state\.films\.findIndex/);
    assert.match(appSource, /Number\.isFinite\(normalizedTmdbId\) && normalizedTmdbId > 0 && itemTmdbId === normalizedTmdbId/);
    assert.match(appSource, /filmTransientDetailRecord: null/);
    assert.match(appSource, /const filmDetailLoadingTmdbIds = new Set\(\)/);
    assert.match(appSource, /function createTransientFilmDetailRecord\(source = \{\}, existing = null/);
    assert.match(appSource, /function clearTransientFilmDetail\(\)/);
    assert.match(appSource, /function clearMatchingTransientFilmDetail\(tmdbId\)/);
    assert.match(appSource, /state\.filmTransientDetailRecord = createTransientFilmDetailRecord\(source, existing/);
    assert.match(appSource, /isSavedEntry: false/);
    assert.match(appSource, /Number\(state\.filmTransientDetailRecord\?\.tmdbId\) === normalizedId/);
    assert.match(appSource, /journal: preserveLocal/);
    assert.match(appSource, /const watchedAt = watchStatus === 'watched' \? new Date\(\)\.toISOString\(\)\.slice\(0, 10\) : ''/);
    assert.match(appSource, /body\.watchedAt = watchedAt \|\| null/);
    assert.match(appSource, /shouldClearWatchEventsWhenMovingToWant\(existingEvents\) \? \[\] : existingEvents/);
    assert.match(appSource, /async function saveFilmStatus\(tmdbId, watchStatus, \{ openAfterSave = false, silent = false, showSaving = !silent, savedLabel = 'Saved', perfToken = null \} = \{\}\)/);
    assert.match(appSource, /const filmAutoRefreshTmdbIds = new Set\(\)/);
    assert.match(appSource, /function scheduleFilmAutoRefresh\(filmId = ''\)/);
    assert.match(appSource, /refreshFilmFromTmdb\(film\.id, \{ quiet: true \}\)/);
    assert.match(appSource, /openAfterSave: state\.filmDetailOpen && Number\(getActiveFilmRecord\(\)\?\.tmdbId\) === Number\(actionTarget\.dataset\.tmdbId\)/);
    assert.match(appSource, /pushNavigationHash\(\{ mode: 'replace' \}\)/);
    assert.match(appSource, /case 'save-film-status':[\s\S]*const perfToken = startPerfAction\('search result add -> visual update'\);[\s\S]*if \(await commitPendingFilmEditsBeforeAction\(\{ actionName, keepDetailOpen: true \}\)\) \{[\s\S]*saveFilmStatusForTarget\(\{[\s\S]*perfToken/s);
    assert.match(appSource, /function saveFilmStatusForTarget\(\{/);
    assert.match(appSource, /filmLibrarySearchComposing: false/);
    assert.match(appSource, /state\.filmLibrarySearchComposing = true/);
    assert.match(appSource, /state\.filmLibrarySearchComposing = false/);
    assert.match(appSource, /const FILM_ACTION_NAMES = new Set\(\[/);
    assert.match(appSource, /FILM_ACTION_NAMES\.has\(actionTarget\.dataset\.action \|\| ''\)/);
    assert.match(appSource, /return '#\/films\/' \+ encodeURIComponent\(state\.activeFilmId\)/);
    assert.match(appSource, /state\.filmDetailOpen = false;\s+clearTransientFilmDetail\(\);\s+resetFilmBackdropRotation\(\);\s+state\.filmNotesEditing = false;\s+state\.filmNotesDraft = '';\s+state\.filmNotesActiveLine = 0;\s+state\.filmNotesPreview = false;\s+state\.filmMetadataEditing = false;\s+state\.filmMetadataDraft = null;\s+state\.filmMetadataFocusField = '';\s+state\.filmMoreActionsOpen = false;\s+clearPrivateViewState\(\);/);
    assert.doesNotMatch(appSource, /case 'save-film-status':\s+void saveFilmStatus\([^;]+openAfterSave:\s*true/s);
    const detailFunction = appSource.slice(
      appSource.indexOf('async function openTmdbFilmDetail'),
      appSource.indexOf('async function saveFilmStatus')
    );
    assert.doesNotMatch(detailFunction, /upsertFilmRecord\(record/);
    assert.match(detailFunction, /filmDetailLoadingTmdbIds\.has\(normalizedId\)/);
    assert.match(detailFunction, /state\.filmTransientDetailRecord = createTransientFilmDetailRecord\(source, existing/);
    assert.match(detailFunction, /pushNavigationHash\(\{ mode: 'push' \}\);\s+pendingFilmDetailPaintPerfAction = perfToken;\s+render\(\);\s+filmDetailLoadingTmdbIds\.add\(normalizedId\);/);
    assert.match(detailFunction, /if \(!state\.filmDetailOpen \|\| Number\(activeRecord\?\.tmdbId\) !== normalizedId\)/);
    assert.match(appSource, /function deleteFilmEntry\(filmIdOrTmdbId/);
    assert.match(appSource, /function removeKnownAccidentalFilmEntries\(\)/);
  });

  it('renders film detail as an inner Films page instead of a modal', () => {
    const html = FilmDetailPage({
      record: {
        id: 'tmdb-42',
        tmdbId: 42,
        title: 'Silence of the Sea',
        originalTitle: 'Le silence de la mer',
        status: 'watched',
        year: '2004',
        runtime: 100,
        director: 'Pierre Boutron',
        userRating: 5,
        watchedAt: '2026-05-09',
        watchEvents: [
          { watchedAt: '2026-05-09', createdAt: '2026-05-09T00:00:00.000Z' },
          { watchedAt: '2026-05-01', createdAt: '2026-05-01T00:00:00.000Z' },
        ],
        genres: ['Romance', 'Drama', 'War', 'TV Movie'],
        note: 'In a small coastal town of Nazi-occupied France, an elderly man and his niece maintain absolute silence as an act of quiet resistance against the German officer billeted in their home.',
        journal: 'A masterclass in restraint.',
        posterPath: '/poster.jpg',
        posterPaths: ['/poster.jpg', '/poster-2.jpg'],
        backdropPath: '/backdrop.jpg',
        backdropPaths: ['/backdrop.jpg', '/backdrop-2.jpg'],
        backdropZoomOverride: 0.82,
        backdropPositionXOverride: 62,
        backdropPositionYOverride: 34,
        backdropOpacityOverride: 0.72,
      },
      metadataEditing: true,
      imagePickerMode: 'backdrop',
      imagePickerFrameDraft: {
        backdropZoomOverride: 0.58,
        backdropPositionXOverride: 58,
        backdropPositionYOverride: 29,
        backdropOpacityOverride: 0.44,
      },
      backdropIndex: 1,
    });

    assert.match(html, /cml-film-detail-page/);
    assert.match(html, /data-film-detail-page/);
    assert.match(html, /src="https:\/\/image\.tmdb\.org\/t\/p\/w1280\/backdrop-2\.jpg"/);
    assert.match(html, /data-film-backdrop-index="1"/);
    assert.match(html, /--film-backdrop-position-x: 62%/);
    assert.match(html, /--film-backdrop-position-y: 34%/);
    assert.match(html, /--film-backdrop-scale: 0\.82/);
    assert.match(html, /--film-backdrop-opacity: 0\.72/);
    assert.match(html, /Back to Films/);
    assert.match(html, /Silence of the Sea/);
    assert.match(html, /Le silence de la mer/);
    assert.match(html, /Pierre Boutron/);
    assert.doesNotMatch(html, /cml-film-detail__chips/);
    assert.doesNotMatch(html, /Romance \/ Drama \/ War \/ TV Movie/);
    const heroHtml = html.slice(
      html.indexOf('cml-film-detail__hero'),
      html.indexOf('cml-film-detail__lower')
    );
    assert.doesNotMatch(heroHtml, /cml-film-detail__rating/);
    assert.doesNotMatch(heroHtml, /cml-film-detail__rating-line/);
    assert.match(html, /aria-label="5\.0 out of 5"/);
    assert.match(html, /data-film-rating-output>5\.0<\/span>/);
    assert.doesNotMatch(html, /My rating/);
    assert.match(html, /cml-film-rating-control has-rating/);
    assert.doesNotMatch(html, /cml-film-detail__signal-icon/);
    assert.doesNotMatch(html, /cml-film-detail__rating-ticks/);
    assert.doesNotMatch(html, /data-film-rating-input/);
    assert.doesNotMatch(html, /step="0\.1"/);
    assert.doesNotMatch(html, /TMDb 7\.5/);
    assert.doesNotMatch(html, /TMDb rating/);
    assert.match(html, /May 9, 2026/);
    assert.match(html, /<h2>Watch<\/h2>/);
    assert.match(html, /Latest May 9, 2026/);
    assert.match(html, /cml-film-detail__diary-grid/);
    assert.match(html, /cml-film-detail__lower[\s\S]*cml-film-detail__diary-grid/);
    assert.ok(html.indexOf('cml-film-detail__diary-grid') > html.indexOf('cml-film-detail__lower'));
    assert.ok(html.indexOf('cml-film-detail__diary-grid') > html.indexOf('cml-film-detail__hero'));
    assert.match(html, /cml-film-detail__watch-event-card/);
    assert.doesNotMatch(html, /Add notes or rating for this watch/);
    assert.match(html, /Your take/);
    assert.match(html, /Private notes/);
    assert.match(html, /cml-film-detail__signals-inline/);
    assert.doesNotMatch(html, /Personal rating/);
    assert.doesNotMatch(html, /Private signals|Status|Last watched|Watching|Paused|Dropped|Unset|Not rated|NR/);
    assert.match(html, /2 watches/);
    assert.match(html, /May 1, 2026/);
    assert.doesNotMatch(html, /Synopsis/);
    assert.doesNotMatch(html, /Private film archive/);
    assert.doesNotMatch(html, /My notes/);
    assert.match(html, /cml-film-detail__synopsis-inline/);
    assert.match(html, /Add overview/);
    assert.match(html, /cml-film-detail__markdown/);
    assert.doesNotMatch(html, /Save to Favourites/);
    assert.match(html, /data-action="film-toggle-favourite"/);
    assert.doesNotMatch(html, /data-action="film-toggle-more-actions"/);
    assert.match(html, /data-action="film-edit-metadata"/);
    assert.match(html, /data-film-metadata-focus-field="directorOverride"/);
    assert.match(html, /data-film-metadata-focus-field="runtimeOverride"/);
    assert.match(html, /data-film-metadata-focus-field="overviewOverride"/);
    assert.match(html, /data-film-metadata-focus-field="titleOverride"/);
    assert.doesNotMatch(html, /Open in TMDb/);
    assert.doesNotMatch(html, />More<\/button>/);
    assert.doesNotMatch(html, /cml-film-detail__more/);
    assert.doesNotMatch(html, /Customize/);
    assert.doesNotMatch(html, /Sync/);
    assert.match(html, /cml-film-detail__topline[\s\S]*>Manage<\/button>/);
    assert.match(html, /cml-film-detail__image-tools/);
    assert.match(html, /cml-film-detail__image-hotspot/);
    assert.match(html, /data-action="film-change-poster"/);
    assert.match(html, /data-action="film-change-backdrop"/);
    assert.doesNotMatch(html, />Details<\/button>/);
    assert.doesNotMatch(html, />Refresh<\/button>/);
    assert.doesNotMatch(html, /cml-film-detail__image-hotspot[^>]*>Remove<\/button>/);
    assert.match(html, /data-film-detail-overlays/);
    assert.match(html, /cml-film-image-picker/);
    assert.match(html, /data-film-image-picker="backdrop"/);
    assert.match(html, /cml-film-image-picker__preview/);
    assert.match(html, /src="https:\/\/image\.tmdb\.org\/t\/p\/w780\/backdrop\.jpg"/);
    assert.match(html, /Reposition/);
    assert.match(html, /<h3>Frame<\/h3>/);
    assert.match(html, /min="0\.5" max="1\.8" step="0\.01" value="0\.58" data-film-backdrop-frame-field="zoom"/);
    assert.match(html, /data-film-backdrop-frame-field="zoom" style="--film-frame-range-fill:/);
    assert.match(html, /data-film-backdrop-frame-field="x"/);
    assert.match(html, /data-film-backdrop-frame-field="y"/);
    assert.match(html, /data-film-backdrop-frame-field="opacity"/);
    assert.match(html, /data-action="film-reset-backdrop-frame"/);
    assert.match(html, /data-action="film-pick-image"/);
    assert.match(html, /data-action="film-pin-backdrop"/);
    assert.match(html, /Selected/);
    assert.match(html, /data-film-image-picker-url/);
    assert.doesNotMatch(html, />Apply<\/button>/);
    assert.doesNotMatch(html, /save as you leave the field/);
    assert.match(html, />Use catalog image<\/button>/);
    assert.match(html, /data-action="film-clear-image-override"/);
    assert.doesNotMatch(html, /data-action="film-open-tmdb"/);
    assert.match(html, /data-action="film-edit-notes"/);
    const detailBackdropMatch = html.match(/<img class="cml-film-detail-page__backdrop-image"[\s\S]*?style="([^"]+)"/);
    assert.ok(detailBackdropMatch);
    assert.match(detailBackdropMatch[1], /--film-backdrop-scale: 0\.82/);
    assert.match(detailBackdropMatch[1], /--film-backdrop-opacity: 0\.72/);
    assert.doesNotMatch(detailBackdropMatch[1], /0\.58/);
    const pickerPreviewMatch = html.match(/<div class="cml-film-image-picker__preview is-backdrop">[\s\S]*?<img[^>]*style="([^"]+)"/);
    assert.ok(pickerPreviewMatch);
    assert.match(pickerPreviewMatch[1], /--film-backdrop-scale: 0\.58/);
    assert.match(pickerPreviewMatch[1], /--film-backdrop-opacity: 0\.44/);
    assert.match(html, /data-action="film-mark-rewatch"/);
    assert.match(html, /\+ Rewatch/);
    assert.match(html, /Move to Want/);
    assert.match(html, /data-action="film-refresh-tmdb"/);
    assert.match(html, /Refresh details/);
    assert.match(html, /Remove from library/);
    assert.match(html, /data-action="film-remove-entry"/);
    assert.doesNotMatch(html, />[^<]*(TMDb|TMDB|credentials|override|Private signals|Status|Last watched|Not rated|NR|Unset|Locale|Danger zone|Refresh TMDb|Reset TMDb|Remove from Films|Backdrop frame)[^<]*</);
    assert.doesNotMatch(html, /aria-label="[^"]*(TMDb|TMDB|credentials|override|Private signals|Status|Last watched|Not rated|NR|Unset|Locale|Danger zone)[^"]*"/);
    assert.ok(html.indexOf('cml-film-detail__synopsis-inline') > html.indexOf('cml-film-detail__meta-row'));
    assert.ok(html.indexOf('cml-film-detail__synopsis-inline') < html.indexOf('cml-film-detail__lower'));
    assert.match(html, /data-film-watch-event-input/);
    assert.match(html, /data-film-watch-event-id="watch-[^"]+"/);
    assert.match(html, /data-film-watch-event-rating=""/);
    assert.match(html, /data-film-watch-event-note=""/);
    assert.match(html, /data-action="film-delete-watch-event"/);
    assert.doesNotMatch(html, /quiet resistance against the German officer/);
    assert.doesNotMatch(html, /role="dialog"/);
    assert.doesNotMatch(html, /cml-film-modal/);
    assert.doesNotMatch(html, /cml-film-detail__meta-label">My rating/);
    assert.match(html, /cml-film-detail__meta-label">Runtime/);
  });

  it('keeps metadata draft edits from changing saved backdrop framing', () => {
    const html = FilmDetailPage({
      record: {
        id: 'tmdb-77',
        tmdbId: 77,
        title: 'Saved Frame',
        status: 'watched',
        backdropPath: '/saved-backdrop.jpg',
        backdropZoomOverride: 0.74,
        backdropPositionXOverride: 61,
        backdropPositionYOverride: 39,
      },
      metadataEditing: true,
      metadataDraft: {
        titleOverride: 'Edited title',
        directorOverride: 'Edited director',
        backdropZoomOverride: 1.72,
        backdropPositionXOverride: 4,
        backdropPositionYOverride: 96,
      },
    });

    const detailBackdropMatch = html.match(/<img class="cml-film-detail-page__backdrop-image"[\s\S]*?style="([^"]+)"/);
    assert.ok(detailBackdropMatch);
    assert.match(detailBackdropMatch[1], /--film-backdrop-position-x: 61%/);
    assert.match(detailBackdropMatch[1], /--film-backdrop-position-y: 39%/);
    assert.match(detailBackdropMatch[1], /--film-backdrop-scale: 0\.74/);
    assert.doesNotMatch(detailBackdropMatch[1], /1\.72/);
    assert.match(html, /Edited title/);
    assert.match(html, /Edited director/);
    assert.match(html, /cml-film-metadata-shortcuts/);
  });

  it('renders unsaved TMDb detail previews with explicit add actions only', () => {
    const html = FilmDetailPage({
      record: {
        id: 'tmdb-27205',
        tmdbId: 27205,
        title: 'Inception',
        isSavedEntry: false,
        posterPath: '/poster.jpg',
      },
    });

    assert.match(html, /data-action="save-film-status" data-watch-status="wantToWatch"/);
    assert.match(html, /data-action="save-film-status" data-watch-status="watched"/);
    assert.match(html, /Save as Want/);
    assert.match(html, /Mark Watched/);
    assert.match(html, /Save this film to your diary before rating/);
    assert.doesNotMatch(html, /data-action="film-toggle-favourite"/);
    assert.doesNotMatch(html, /data-action="film-edit-notes"/);
    assert.doesNotMatch(html, /data-action="film-remove-entry"/);
    assert.doesNotMatch(html, /data-film-rating-input/);
    assert.doesNotMatch(html, /data-film-watched-at-input/);
    assert.doesNotMatch(html, /cml-film-detail__status-button/);
  });

  it('renders film detail notes as safe inline Markdown and exposes the editor state', () => {
    const viewHtml = FilmDetailPage({
      record: {
        id: 'tmdb-42',
        tmdbId: 42,
        title: 'Movie',
        journal: '# Private\n\n**Great** [safe](https://example.com) [bad](javascript:alert(1))',
      },
    });
    const editHtml = FilmDetailPage({
      record: {
        id: 'tmdb-42',
        tmdbId: 42,
        title: 'Movie',
        journal: 'Saved note',
      },
      notesEditing: true,
      notesDraft: 'Draft **note**\nRendered **line**',
    });
    const previewHtml = FilmDetailPage({
      record: {
        id: 'tmdb-42',
        tmdbId: 42,
        title: 'Movie',
        journal: 'Saved note',
      },
      notesEditing: true,
      notesDraft: 'Draft **note**\nRendered **line**',
      notesPreview: true,
      saveStatus: { state: 'saving', label: 'Saving...' },
    });

    assert.match(viewHtml, /<h3>Private<\/h3>/);
    assert.match(viewHtml, /<strong>Great<\/strong>/);
    assert.match(viewHtml, /href="https:\/\/example\.com"/);
    assert.doesNotMatch(viewHtml, /javascript:alert/);
    assert.match(viewHtml, /cml-film-detail__section--notes-readable/);
    assert.match(viewHtml, /data-action="film-edit-notes" data-film-id="tmdb-42" role="button" tabindex="0"/);
    assert.doesNotMatch(viewHtml, /My notes/);
    assert.match(editHtml, /data-film-notes-draft/);
    assert.match(editHtml, /cml-film-notes-editor/);
    assert.match(editHtml, /cml-film-notes-editor__surface/);
    assert.match(editHtml, /data-film-notes-surface[^>]*role="textbox" aria-multiline="true" aria-label="Edit notes"[^>]*contenteditable="true"/);
    assert.equal((editHtml.match(/contenteditable="true"/g) || []).length, 1);
    assert.match(editHtml, /data-film-notes-source-line[\s\S]*data-film-notes-line-index="0"[\s\S]*Draft \*\*note\*\*|data-film-notes-line-index="0"[\s\S]*data-film-notes-source-line[\s\S]*Draft \*\*note\*\*/);
    assert.match(editHtml, /data-action="film-edit-notes-line"[\s\S]*<strong>line<\/strong>/);
    assert.match(editHtml, /Draft \*\*note\*\*/);
    assert.doesNotMatch(editHtml, /Autosave on blur/);
    assert.doesNotMatch(editHtml, /data-film-save-status="notes"/);
    assert.doesNotMatch(editHtml, /data-film-notes-live-preview/);
    assert.doesNotMatch(editHtml, /cml-film-notes-editor__live/);
    assert.doesNotMatch(editHtml, /Markdown renders live/);
    assert.doesNotMatch(editHtml, /data-action="film-notes-format"/);
    assert.doesNotMatch(editHtml, /data-film-notes-format="bold"/);
    assert.doesNotMatch(editHtml, /data-action="film-notes-preview-toggle"/);
    assert.doesNotMatch(editHtml, /data-film-notes-preview/);
    assert.doesNotMatch(editHtml, /cml-film-detail__section--notes-readable/);
    assert.doesNotMatch(editHtml, /data-action="film-notes-save"/);
    assert.doesNotMatch(editHtml, /data-action="film-notes-cancel"/);

    assert.doesNotMatch(previewHtml, /data-action="film-notes-preview-toggle"/);
    assert.doesNotMatch(previewHtml, /cml-film-notes-editor__preview-toggle is-active/);
    assert.doesNotMatch(previewHtml, /data-film-notes-preview/);
    assert.doesNotMatch(previewHtml, /data-film-notes-live-preview/);
    assert.doesNotMatch(previewHtml, /<strong>note<\/strong>/);
    assert.match(previewHtml, /<strong>line<\/strong>/);
    assert.doesNotMatch(previewHtml, /data-film-save-status="notes"/);
    assert.doesNotMatch(previewHtml, /Markdown renders live/);
    assert.doesNotMatch(previewHtml, /Saving\.\.\./);
    assert.doesNotMatch(previewHtml, /data-film-save-status="detail">Saving/);
    assert.match(previewHtml, /data-film-notes-draft/);
    assert.doesNotMatch(previewHtml, /data-action="film-notes-save"/);
    assert.doesNotMatch(previewHtml, /data-action="film-notes-cancel"/);
  });

  it('keeps film note live-preview drafts untrimmed while editing', () => {
    const trailingHtml = FilmDetailPage({
      record: {
        id: 'tmdb-42',
        tmdbId: 42,
        title: 'Movie',
        journal: '',
      },
      notesEditing: true,
      notesDraft: '#\n',
      notesActiveLine: 1,
    });
    const switchedHtml = FilmDetailPage({
      record: {
        id: 'tmdb-42',
        tmdbId: 42,
        title: 'Movie',
        journal: '',
      },
      notesEditing: true,
      notesDraft: '# Title\nhello **world**',
      notesActiveLine: 1,
    });
    const blankLinesHtml = FilmDetailPage({
      record: {
        id: 'tmdb-42',
        tmdbId: 42,
        title: 'Movie',
        journal: '',
      },
      notesEditing: true,
      notesDraft: 'one\n\n\nlast',
      notesActiveLine: 2,
    });
    const doubleTrailingHtml = FilmDetailPage({
      record: {
        id: 'tmdb-42',
        tmdbId: 42,
        title: 'Movie',
        journal: '',
      },
      notesEditing: true,
      notesDraft: '#\n\n',
      notesActiveLine: 2,
    });

    assert.equal((trailingHtml.match(/data-film-notes-line-index=/g) || []).length, 2);
    assert.match(trailingHtml, /data-film-notes-line-index="0"[\s\S]*>#<\/p>/);
    assert.match(trailingHtml, /data-film-notes-source-line[\s\S]*data-film-notes-line-index="1"|data-film-notes-line-index="1"[\s\S]*data-film-notes-source-line/);
    assert.doesNotMatch(trailingHtml, /Write a note\.\.\./);
    assert.match(switchedHtml, /data-film-notes-line-index="0"[\s\S]*<h3>Title<\/h3>/);
    assert.match(switchedHtml, /data-film-notes-source-line[\s\S]*data-film-notes-line-index="1"[\s\S]*hello \*\*world\*\*|data-film-notes-line-index="1"[\s\S]*data-film-notes-source-line[\s\S]*hello \*\*world\*\*/);
    assert.doesNotMatch(switchedHtml, /data-film-notes-line-index="1"[\s\S]*<strong>world<\/strong>[\s\S]*<\/div>/);
    assert.equal((blankLinesHtml.match(/data-film-notes-line-index=/g) || []).length, 4);
    assert.equal((blankLinesHtml.match(/cml-film-notes-editor__blank-line/g) || []).length, 1);
    assert.equal((doubleTrailingHtml.match(/data-film-notes-line-index=/g) || []).length, 3);
    assert.match(doubleTrailingHtml, /data-film-notes-source-line[\s\S]*data-film-notes-line-index="2"|data-film-notes-line-index="2"[\s\S]*data-film-notes-source-line/);
  });

  it('renders film note source mode in-place for the active line only', () => {
    const secondHeadingActiveHtml = FilmDetailPage({
      record: {
        id: 'tmdb-42',
        tmdbId: 42,
        title: 'Movie',
        journal: '',
      },
      notesEditing: true,
      notesDraft: '## 1\n\n# \u4f60\u597d',
      notesActiveLine: 2,
    });
    const firstHeadingActiveHtml = FilmDetailPage({
      record: {
        id: 'tmdb-42',
        tmdbId: 42,
        title: 'Movie',
        journal: '',
      },
      notesEditing: true,
      notesDraft: '## 1\n\n# \u4f60\u597d',
      notesActiveLine: 0,
    });
    const codeHtml = FilmDetailPage({
      record: {
        id: 'tmdb-42',
        tmdbId: 42,
        title: 'Movie',
        journal: '',
      },
      notesEditing: true,
      notesDraft: 'before\n```\n# not heading\n```',
      notesActiveLine: 2,
    });
    const activeLineTag = secondHeadingActiveHtml.match(/<[^>\s]+(?=[^>]*data-film-notes-source-line)[^>]*>/)?.[0] || '';
    const firstActiveLineTag = firstHeadingActiveHtml.match(/<[^>\s]+(?=[^>]*data-film-notes-source-line)[^>]*>/)?.[0] || '';

    assert.match(secondHeadingActiveHtml, /cml-film-notes-editor__surface cml-film-detail__markdown" data-film-notes-surface data-film-notes-draft role="textbox" aria-multiline="true" aria-label="Edit notes"[^>]*contenteditable="true"/);
    assert.match(secondHeadingActiveHtml, /data-film-notes-line-index="0"[\s\S]*<h4>1<\/h4>/);
    assert.match(secondHeadingActiveHtml, /data-film-notes-source-line[\s\S]*data-film-notes-line-index="2"[\s\S]*# \u4f60\u597d|data-film-notes-line-index="2"[\s\S]*data-film-notes-source-line[\s\S]*# \u4f60\u597d/);
    assert.match(activeLineTag, /data-film-notes-source-line/);
    assert.match(activeLineTag, /cml-film-notes-editor__line--source--heading-1/);
    assert.match(activeLineTag, /^<h3\b/);
    assert.doesNotMatch(activeLineTag, /contenteditable="true"/);
    assert.doesNotMatch(activeLineTag, /role="textbox"/);
    assert.doesNotMatch(secondHeadingActiveHtml, /data-film-notes-line-index="2"[\s\S]*<h3>\u4f60\u597d<\/h3>/);
    assert.match(secondHeadingActiveHtml, /data-film-notes-line-index="2"[\s\S]*data-film-notes-raw-source="# \u4f60\u597d"/);
    assert.match(firstHeadingActiveHtml, /data-film-notes-source-line[\s\S]*data-film-notes-line-index="0"[\s\S]*## 1|data-film-notes-line-index="0"[\s\S]*data-film-notes-source-line[\s\S]*## 1/);
    assert.match(firstActiveLineTag, /cml-film-notes-editor__line--source--heading-2/);
    assert.match(firstActiveLineTag, /^<h4\b/);
    assert.match(firstHeadingActiveHtml, /data-film-notes-line-index="2"[\s\S]*data-film-notes-line-mode="rendered"[\s\S]*<h3>\u4f60\u597d<\/h3>|data-film-notes-line-mode="rendered"[\s\S]*data-film-notes-line-index="2"[\s\S]*<h3>\u4f60\u597d<\/h3>/);
    assert.doesNotMatch(firstHeadingActiveHtml, /data-film-notes-line-index="2"[\s\S]*data-film-notes-source-line/);
    assert.match(codeHtml, /data-film-notes-line-index="1"[\s\S]*<code>```<\/code>/);
    assert.match(codeHtml, /data-film-notes-source-line[\s\S]*data-film-notes-line-index="2"[\s\S]*# not heading|data-film-notes-line-index="2"[\s\S]*data-film-notes-source-line[\s\S]*# not heading/);
    assert.doesNotMatch(codeHtml, /<h3>not heading<\/h3>/);
  });

  it.skip('preserves raw line identity for heading and blank lines in film notes editor html', () => {
    const html = FilmDetailPage({
      record: {
        id: 'tmdb-42',
        tmdbId: 42,
        title: 'Movie',
        journal: '',
      },
      notesEditing: true,
      notesDraft: '## 1\n\n# 你好',
      notesActiveLine: 2,
    });

    assert.match(html, /data-film-notes-line-mode="rendered"[\s\S]*data-film-notes-line-index="0"[\s\S]*data-film-notes-raw-source="## 1"[\s\S]*<h4>1<\/h4>/);
    assert.match(html, /data-film-notes-line-mode="rendered"[\s\S]*data-film-notes-line-index="1"[\s\S]*data-film-notes-line-kind="blank"[\s\S]*cml-film-notes-editor__blank-line/);
    assert.match(html, /data-film-notes-line-mode="source"[\s\S]*data-film-notes-line-index="2"[\s\S]*data-film-notes-raw-source="# 你好"[\s\S]*># 你好<\/div>/);
    assert.doesNotMatch(html, /data-film-notes-line-index="2"[\s\S]*<h3>你好<\/h3>/);
    assert.match(html, /data-film-notes-line-index="2"[\s\S]*data-film-notes-line-mode="source"|data-film-notes-line-mode="source"[\s\S]*data-film-notes-line-index="2"/);
  });

  it('renders a compact watch summary for a single logged watch', () => {
    const cssSource = fs.readFileSync(new URL('../css/media-library.css', import.meta.url), 'utf8');
    const html = FilmDetailPage({
      record: {
        id: 'tmdb-88',
        tmdbId: 88,
        title: 'Single Watch',
        status: 'watched',
        watchedAt: '2026-05-09',
        watchEvents: [
          { id: 'watch-1', watchedAt: '2026-05-09' }
        ]
      }
    });

    assert.match(html, /<h2>Watch<\/h2>/);
    assert.match(html, /cml-film-detail__watch-inline/);
    assert.match(html, /Watched <strong data-film-watch-date-output>May 9, 2026<\/strong>/);
    assert.match(html, /cml-film-detail__watch-date-control/);
    assert.match(html, /data-action="film-toggle-watch-date-editor"/);
    assert.match(html, /aria-expanded="false"/);
    assert.match(html, /data-film-watch-event-input/);
    assert.match(html, /data-film-watch-event-id="watch-1"/);
    assert.match(html, /value="2026-05-09"/);
    assert.match(cssSource, /\.cml-film-detail__watch-date-input \{[\s\S]*max-height: 0;[\s\S]*opacity: 0;/);
    assert.match(cssSource, /\.cml-film-detail__watch-date-control\.is-open \.cml-film-detail__watch-date-input,[\s\S]*max-height: 32px;[\s\S]*opacity: 1;/);
    assert.doesNotMatch(cssSource, /\.cml-film-detail__watch-date-control:focus-within \.cml-film-detail__watch-date-input/);
    assert.doesNotMatch(cssSource, /\.cml-film-detail__watch-date-control:hover \.cml-film-detail__watch-date-input/);
    assert.match(html, /\+ Rewatch/);
    assert.match(html, /Move to Want/);
    assert.doesNotMatch(html, /cml-film-detail__watch-events/);
    assert.doesNotMatch(html, /Latest watch/);
    assert.match(html, /Private notes/);
    assert.doesNotMatch(html, /1 watch/);
  });

  it('keeps film rating pointer preview inside the visible star bounds', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
    const cssSource = fs.readFileSync(new URL('../css/media-library.css', import.meta.url), 'utf8');
    const boundsFunction = appSource.match(/function getFilmRatingStarBounds[\s\S]*?function getFilmRatingFromPointer/)?.[0] || '';
    const pointerFunction = appSource.match(/function getFilmRatingFromPointer[\s\S]*?function getFilmRatingStarFill/)?.[0] || '';
    const actionCase = appSource.slice(
      appSource.indexOf("case 'set-film-rating':"),
      appSource.indexOf("case 'open-film-detail':")
    );
    const starFillCss = cssSource.match(/\.cml-film-star__fill \{[\s\S]*?\n\}/)?.[0] || '';
    const ratingStarsCss = cssSource.match(/\.cml-film-rating-control__stars \{[\s\S]*?\n\}/)?.[0] || '';

    assert.match(boundsFunction, /function getFilmRatingStarBounds\(control\)/);
    assert.match(boundsFunction, /querySelectorAll\('\.cml-film-star'\)/);
    assert.match(pointerFunction, /event\.clientX < bounds\.left \|\| event\.clientX > bounds\.right/);
    assert.doesNotMatch(pointerFunction, /Math\.max\(0,\s*Math\.min\(1,/);
    assert.match(actionCase, /hasPointerCoordinate && ratingFromPointer === null[\s\S]*clearFilmRatingControlPreview\(actionTarget\);[\s\S]*return true;/);
    assert.match(actionCase, /const ratingSource = ratingFromPointer \?\? actionTarget\.dataset\.previewRating \?\? actionTarget\.dataset\.currentRating \?\? 0;/);
    assert.doesNotMatch(actionCase, /normalizeFilmUserRating\(ratingFromPointer \|\| actionTarget\.dataset\.previewRating/s);
    assert.match(starFillCss, /transition: width 90ms linear, color 100ms ease;/);
    assert.doesNotMatch(starFillCss, /filter: drop-shadow/);
    assert.doesNotMatch(ratingStarsCss, /box-shadow/);
  });

  it('renders moved-to-want films as Want even when previous watches are retained', () => {
    const html = FilmDetailPage({
      record: {
        id: 'tmdb-89',
        tmdbId: 89,
        title: 'Moved Back',
        watchStatus: 'wantToWatch',
        status: 'watchlist',
        watchedAt: '',
        watchEvents: [
          { id: 'watch-a', watchedAt: '2026-05-09', note: 'kept history' },
          { id: 'watch-b', watchedAt: '2026-05-01' }
        ]
      }
    });

    assert.match(html, /<h2>Watch<\/h2>/);
    assert.match(html, /Mark watched/);
    assert.match(html, /Previous watches kept/);
    assert.match(html, /Latest May 9, 2026/);
    assert.doesNotMatch(html, /\+ Rewatch/);
    assert.doesNotMatch(html, /Move to Want/);
    assert.doesNotMatch(html, /cml-film-detail__watch-events/);
  });

  it('preserves raw line identity for heading and blank lines in film notes editor html', () => {
    const html = FilmDetailPage({
      record: {
        id: 'tmdb-42',
        tmdbId: 42,
        title: 'Movie',
        journal: '',
      },
      notesEditing: true,
      notesDraft: '## 1\n\n# \u4f60\u597d',
      notesActiveLine: 2,
    });

    assert.match(html, /data-film-notes-line-mode="rendered"[\s\S]*data-film-notes-line-index="0"[\s\S]*data-film-notes-raw-source="## 1"[\s\S]*<h4>1<\/h4>|data-film-notes-line-index="0"[\s\S]*data-film-notes-line-mode="rendered"[\s\S]*data-film-notes-raw-source="## 1"[\s\S]*<h4>1<\/h4>/);
    assert.match(html, /data-film-notes-line-mode="rendered"[\s\S]*data-film-notes-line-index="1"[\s\S]*data-film-notes-line-kind="blank"[\s\S]*cml-film-notes-editor__blank-line|data-film-notes-line-index="1"[\s\S]*data-film-notes-line-mode="rendered"[\s\S]*data-film-notes-line-kind="blank"[\s\S]*cml-film-notes-editor__blank-line/);
    assert.match(html, /data-film-notes-line-mode="source"[\s\S]*data-film-notes-line-index="2"[\s\S]*data-film-notes-raw-source="# \u4f60\u597d"[\s\S]*># \u4f60\u597d<\/h3>|data-film-notes-line-index="2"[\s\S]*data-film-notes-line-mode="source"[\s\S]*data-film-notes-raw-source="# \u4f60\u597d"[\s\S]*># \u4f60\u597d<\/h3>/);
    assert.doesNotMatch(html, /data-film-notes-line-index="2"[\s\S]*<h3>\u4f60\u597d<\/h3>/);
    assert.match(html, /data-film-notes-line-index="2"[\s\S]*data-film-notes-line-mode="source"|data-film-notes-line-mode="source"[\s\S]*data-film-notes-line-index="2"/);
  });

  it('keeps raw line indexes stable when switching active film note headings', () => {
    const html = FilmDetailPage({
      record: {
        id: 'tmdb-42',
        tmdbId: 42,
        title: 'Movie',
        journal: '',
      },
      notesEditing: true,
      notesDraft: '## 1\n\n# \u4f60\u597d',
      notesActiveLine: 2,
    });

    assert.match(html, /data-film-notes-line-index="0"[\s\S]*data-film-notes-active-line-index="2"[\s\S]*data-film-notes-line-kind="heading-2"[\s\S]*data-film-notes-raw-source="## 1"[\s\S]*<h4>1<\/h4>/);
    assert.match(html, /data-film-notes-line-index="1"[\s\S]*data-film-notes-active-line-index="2"[\s\S]*data-film-notes-line-kind="blank"[\s\S]*data-film-notes-raw-source=""[\s\S]*cml-film-notes-editor__blank-line/);
    assert.match(html, /data-film-notes-line-index="2"[\s\S]*data-film-notes-active-line-index="2"[\s\S]*data-film-notes-line-kind="heading-1"[\s\S]*data-film-notes-raw-source="# \u4f60\u597d"[\s\S]*># \u4f60\u597d<\/h3>/);
    assert.equal((html.match(/>你好<\/h3>/g) || []).length, 0);
  });

  it('keeps film note Enter and save paths split between draft and commit normalization', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
    const componentSource = fs.readFileSync(new URL('../js/media-library/films-components.js', import.meta.url), 'utf8');
    const cssSource = fs.readFileSync(new URL('../css/media-library.css', import.meta.url), 'utf8');

    assert.match(componentSource, /function normalizeFilmNoteDraftForEdit\(value\)[\s\S]*replace\(\/\\r\\n\?\/g, '\\n'\);/);
    assert.match(componentSource, /const draft = notesEditing \? normalizeFilmNoteDraftForEdit\(notesDraft\) : savedNote;/);
    assert.match(componentSource, /const lines = draft === '' \? \[''\] : draft\.split\('\\n'\);/);
    assert.match(appSource, /function normalizeFilmNoteDraftForEdit\(value, maxLength = 12000\)/);
    assert.match(appSource, /function normalizeFilmNoteForSave\(value, maxLength = 12000\)[\s\S]*\.trim\(\);/);
    assert.match(appSource, /const editDraft = normalizeFilmNoteDraftForEdit\(state\.filmNotesDraft\);/);
    assert.match(appSource, /const draft = normalizeFilmNoteForSave\(editDraft\);/);
    assert.match(appSource, /lines\.splice\(lineIndex, 1, before, `\$\{continuation\}\$\{after\}`\);/);
    assert.match(appSource, /filmNotesPendingCaretOffset = continuation\.length;/);
    assert.match(appSource, /showErrorStatus: false,\s+markRecordSyncError: false/);
    assert.match(appSource, /case 'film-retry-notes':/);
    assert.match(appSource, /force = false/);
    assert.match(appSource, /force: true/);
    const retryFunction = appSource.match(/function retryFilmNotesSync[\s\S]*?function hasFilmNotesSyncError/)?.[0] || '';
    assert.match(retryFunction, /shouldUseStoredDraft \? state\.filmNotesSyncDraft/);
    const editFunction = appSource.match(/function editFilmNotes[\s\S]*?function editFilmMetadata/)?.[0] || '';
    assert.doesNotMatch(editFunction, /clearFilmNotesSyncError/);
    assert.match(appSource, /ArrowDown[\s\S]*moveFilmNotesActiveLineFromKeyboard/);
    assert.match(componentSource, /data-action="film-retry-notes"/);
    assert.match(componentSource, /data-film-notes-surface data-film-notes-draft role="textbox" aria-multiline="true" aria-label="Edit notes"[\s\S]*contenteditable="true"/);
    assert.doesNotMatch(componentSource, /data-film-notes-source-line[\s\S]*contenteditable="plaintext-only"/);
    assert.match(componentSource, /return \{ kind: `heading-\$\{heading\[1\]\.length\}`,\s*tag: `h\$\{heading\[1\]\.length \+ 2\}` \};/);
    assert.match(componentSource, /data-film-notes-line-mode="source"/);
    assert.match(componentSource, /data-film-notes-raw-source=/);
    assert.match(cssSource, /cml-film-notes-editor__line \{[\s\S]*border: 0;[\s\S]*border-radius: 0;[\s\S]*background: transparent;/);
    assert.match(cssSource, /cml-film-notes-editor__line--source:focus \{[\s\S]*background: transparent;[\s\S]*box-shadow: none;/);
    assert.match(cssSource, /cml-film-notes-editor__line--source--heading-1/);
    assert.match(cssSource, /cml-film-notes-editor__line--source--heading-2/);
  });

  it('renders film detail metadata overrides as an inline editor for saved films only', () => {
    const savedHtml = FilmDetailPage({
      record: {
        id: 'tmdb-42',
        tmdbId: 42,
        title: 'TMDb Movie',
        localTitle: 'Local Movie',
        originalTitle: 'Original Movie',
        director: 'TMDb Director',
        status: 'watched',
        posterPath: '/poster.jpg',
        backdropPath: '/backdrop.jpg',
      },
      metadataEditing: true,
      metadataDraft: {
        titleOverride: 'Local Movie',
        directorOverride: 'Local Director',
        posterUrlOverride: 'https://example.com/poster.jpg',
        backdropUrlOverride: '/file/backdrop.jpg',
      },
    });
    const previewHtml = FilmDetailPage({
      record: {
        id: 'tmdb-42',
        tmdbId: 42,
        title: 'TMDb Movie',
        isSavedEntry: false,
      },
      metadataEditing: true,
      metadataDraft: { titleOverride: 'Should not matter' },
    });

    assert.match(savedHtml, /cml-film-metadata-shortcuts/);
    assert.match(savedHtml, /Edit details/);
    assert.match(savedHtml, /Identity/);
    assert.match(savedHtml, /Release/);
    assert.match(savedHtml, /Writing/);
    assert.match(savedHtml, /Images/);
    assert.match(savedHtml, /Manage/);
    assert.match(savedHtml, /data-film-metadata-focus-field="titleOverride"/);
    assert.match(savedHtml, /data-film-metadata-focus-field="originalTitleOverride"/);
    assert.match(savedHtml, /data-film-metadata-focus-field="releaseDateOverride"/);
    assert.match(savedHtml, /data-action="film-change-poster"/);
    assert.match(savedHtml, /data-action="film-refresh-tmdb"/);
    assert.match(savedHtml, /data-action="film-remove-entry"/);
    assert.doesNotMatch(savedHtml, /data-film-metadata-field="posterUrlOverride"/);
    assert.doesNotMatch(savedHtml, /Local overrides only/);
    assert.doesNotMatch(savedHtml, /Title override|Director override|fallback to TMDb|Danger zone|Refresh TMDb|Remove from Films/);
    assert.match(savedHtml, /Refresh details/);
    assert.match(savedHtml, /Remove from library/);
    assert.match(savedHtml, /https:\/\/example\.com\/poster\.jpg/);
    assert.match(savedHtml, /src="https:\/\/example\.com\/poster\.jpg"/);
    assert.match(savedHtml, /src="\/file\/backdrop\.jpg"/);
    assert.doesNotMatch(previewHtml, /data-action="film-edit-metadata"/);
    assert.doesNotMatch(previewHtml, /cml-film-metadata-editor/);

    const focusedHtml = FilmDetailPage({
      record: {
        id: 'tmdb-43',
        tmdbId: 43,
        title: 'Focused Movie',
        status: 'watched',
        director: 'Existing Director',
      },
      metadataEditing: true,
      metadataFocusField: 'directorOverride',
      metadataDraft: { directorOverride: 'Draft Director' },
    });

    assert.match(focusedHtml, /cml-film-metadata-editor--focused/);
    assert.match(focusedHtml, /Edit director/);
    assert.match(focusedHtml, /data-film-metadata-field="directorOverride"/);
    assert.doesNotMatch(focusedHtml, /data-film-metadata-field="posterUrlOverride"/);
    assert.doesNotMatch(focusedHtml, /data-film-metadata-field="backdropUrlOverride"/);

    const synopsisHtml = FilmDetailPage({
      record: {
        id: 'tmdb-44',
        tmdbId: 44,
        title: 'Synopsis Movie',
        status: 'watched',
        overview: 'Existing synopsis text',
      },
      metadataEditing: true,
      metadataFocusField: 'overviewOverride',
      metadataDraft: { overviewOverride: 'Draft synopsis text' },
    });

    assert.match(synopsisHtml, /cml-film-detail__synopsis-inline is-editing[\s\S]*cml-film-detail__synopsis-editor[\s\S]*cml-film-detail__synopsis-textarea[\s\S]*data-film-metadata-field="overviewOverride"/);
    assert.equal((synopsisHtml.match(/data-film-metadata-field="overviewOverride"/g) || []).length, 1);
    assert.doesNotMatch(synopsisHtml, /<h2>Synopsis<\/h2>/);
    assert.doesNotMatch(synopsisHtml, /Click outside to save\./);
    assert.ok(synopsisHtml.indexOf('cml-film-detail__meta-row') < synopsisHtml.indexOf('data-film-metadata-field="overviewOverride"'));
    assert.ok(synopsisHtml.indexOf('data-film-metadata-field="overviewOverride"') < synopsisHtml.indexOf('cml-film-detail__lower'));
    assert.doesNotMatch(synopsisHtml, /data-film-metadata-field="directorOverride"/);
    assert.doesNotMatch(synopsisHtml, /cml-film-metadata-editor--popover[\s\S]*data-film-metadata-field="overviewOverride"/);
  });

  it('keeps film detail manage and image edit actions hidden until nearby hover or focus', () => {
    const cssSource = fs.readFileSync(new URL('../css/media-library.css', import.meta.url), 'utf8');
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(cssSource, /\.cml-film-detail__poster-tool \{[\s\S]*opacity: 0;[\s\S]*pointer-events: none;/);
    assert.match(cssSource, /\.cml-film-detail__poster-wrap:hover \.cml-film-detail__poster-tool,[\s\S]*\.cml-film-detail__poster-tool:focus \{[\s\S]*opacity: 0\.92;[\s\S]*pointer-events: auto;/);
    assert.match(cssSource, /\.cml-film-detail__image-hotspot \{[\s\S]*opacity: 0;[\s\S]*pointer-events: none;/);
    assert.match(cssSource, /\.cml-film-detail__image-tools:hover \.cml-film-detail__image-hotspot,[\s\S]*\.cml-film-detail__image-hotspot:focus \{[\s\S]*opacity: 0\.92;[\s\S]*pointer-events: auto;/);
    assert.match(cssSource, /\.cml-film-detail__manage \{[\s\S]*opacity: 0;[\s\S]*pointer-events: none;/);
    assert.match(cssSource, /\.cml-film-detail__topline:hover \.cml-film-detail__manage,[\s\S]*\.cml-film-detail__manage:focus \{[\s\S]*opacity: 1;[\s\S]*pointer-events: auto;/);
    assert.doesNotMatch(cssSource, /\.cml-film-detail__image-hotspot \{[\s\S]*opacity: 0\.85;/);
    assert.match(appSource, /closest\('\.cml-film-detail__synopsis-editor'\)/);
  });

  it('renders TMDb image choices as path overrides and custom URLs separately', () => {
    const html = FilmDetailPage({
      record: {
        id: 'tmdb-42',
        tmdbId: 42,
        title: 'TMDb Movie',
        status: 'watched',
        posterPath: '/poster.jpg',
        posterPaths: ['/poster.jpg', '/poster-alt.jpg'],
        posterPathOverride: '/poster-alt.jpg',
        backdropPath: '/backdrop.jpg',
      },
      imagePickerMode: 'poster',
    });

    assert.match(html, /Selected image/);
    assert.match(html, /data-film-image-path="\/poster-alt\.jpg"[^>]*aria-label="Use this poster"/);
    assert.match(html, /data-action="film-pick-image"/);
    assert.match(html, /data-action="film-clear-image-override"/);
    assert.doesNotMatch(html, /value="https:\/\/image\.tmdb\.org\/t\/p/);
    assert.doesNotMatch(html, /TMDb override|TMDb image|Reset TMDb|No TMDb/);
  });

  it('keeps Films detail local actions wired through app handlers', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
    const repositorySource = fs.readFileSync(new URL('../functions/utils/movieRepository.js', import.meta.url), 'utf8');
    const clientSource = fs.readFileSync(new URL('../functions/utils/tmdbClient.js', import.meta.url), 'utf8');

    assert.match(appSource, /filmNotesEditing: false/);
    assert.match(appSource, /filmMetadataEditing: false/);
    assert.match(appSource, /function saveFilmEntryPatch/);
    assert.match(appSource, /function createManualFilmEntry/);
    assert.match(appSource, /function createManualDraftFilmRecord/);
    assert.match(appSource, /manualDraft: true/);
    assert.match(appSource, /if \(!normalizeText\(record\.titleOverride \|\| record\.localTitle \|\| record\.title\)\) \{\s+return Promise\.resolve\(null\);\s+\}/);
    assert.match(appSource, /if \(!title\) \{\s+exitFilmMetadataEdit\(\);\s+state\.filmManualDraft = null;/);
    assert.match(appSource, /const filmManualCreateRequests = new Map\(\)/);
    assert.match(appSource, /function persistManualFilmEntry/);
    assert.match(appSource, /const created = await filmManualCreateRequests\.get\(existing\.id\)/);
    assert.match(appSource, /Manual film has not saved yet/);
    assert.match(appSource, /if \(!record\?\.id && !record\?\.tmdbId\)/);
    assert.match(appSource, /case 'add-manual-film':/);
    assert.match(appSource, /function buildFilmEntryPatchBody/);
    assert.match(appSource, /const FILM_BACKDROP_FRAME_FIELDS = \[/);
    assert.match(appSource, /FILM_BACKDROP_FRAME_FIELDS\.forEach/);
    const metadataFieldsMatch = appSource.match(/const FILM_METADATA_FIELDS = \[([\s\S]*?)\];/);
    assert.ok(metadataFieldsMatch);
    assert.match(metadataFieldsMatch[1], /countryOverride/);
    assert.match(metadataFieldsMatch[1], /languageOverride/);
    assert.doesNotMatch(metadataFieldsMatch[1], /backdropZoomOverride/);
    assert.match(appSource, /async function commitPendingFilmEditsBeforeAction/);
    assert.match(appSource, /function commitFilmNotesEdit/);
    assert.match(appSource, /function commitFilmMetadataEdit/);
    assert.match(appSource, /case 'film-toggle-favourite':/);
    assert.match(appSource, /case 'film-edit-notes':/);
    assert.match(appSource, /case 'film-notes-format':/);
    assert.match(appSource, /function applyFilmNotesFormat/);
    assert.match(appSource, /case 'film-notes-preview-toggle':/);
    assert.match(appSource, /function toggleFilmNotesPreview/);
    assert.doesNotMatch(appSource, /case 'film-toggle-more-actions':/);
    assert.match(appSource, /case 'toggle-film-tmdb-add':/);
    assert.match(appSource, /function toggleFilmTmdbAddFlow/);
    assert.match(appSource, /filmTmdbAddOpen: false/);
    assert.match(appSource, /case 'film-edit-metadata':/);
    assert.match(appSource, /case 'film-change-poster':/);
    assert.match(appSource, /case 'film-change-backdrop':/);
    assert.match(appSource, /case 'film-pick-image':/);
    assert.match(appSource, /case 'film-pin-backdrop':/);
    assert.match(appSource, /function applyFilmImagePathOverride/);
    assert.match(appSource, /\[pathField\]: nextPath/);
    assert.match(appSource, /\[urlField\]: ''/);
    assert.match(appSource, /keepPickerOpen = true/);
    assert.match(appSource, /case 'film-apply-image-url':/);
    assert.match(appSource, /function commitFilmImagePickerDraft/);
    assert.match(appSource, /case 'film-clear-image-override':/);
    assert.match(appSource, /function resetFilmImageOverride/);
    assert.match(appSource, /case 'film-reset-backdrop-frame':/);
    assert.match(appSource, /function updateFilmBackdropFrameDraft/);
    assert.match(appSource, /function saveFilmBackdropFrameDraft/);
    assert.match(appSource, /function getFilmBackdropFrameStyleForImage/);
    assert.match(appSource, /const containScale = Math\.min/);
    assert.match(appSource, /const coverScale = Math\.max/);
    assert.match(appSource, /normalized\.backdropZoomOverride < 1/);
    assert.match(appSource, /function applyFilmBackdropFrameToImage/);
    const frameStyleFunction = appSource.match(/function setFilmBackdropFrameStyle[\s\S]*?function updateFilmBackdropFrameDraft/);
    assert.ok(frameStyleFunction);
    assert.match(frameStyleFunction[0], /livePreviewTargets/);
    assert.match(frameStyleFunction[0], /cml-film-detail-page__backdrop-image/);
    assert.match(appSource, /data-film-backdrop-frame-field/);
    assert.match(appSource, /backdropZoomOverride/);
    assert.match(appSource, /backdropPositionXOverride/);
    assert.match(appSource, /backdropPositionYOverride/);
    assert.match(appSource, /backdropOpacityOverride/);
    assert.match(appSource, /--film-backdrop-opacity/);
    assert.match(appSource, /case 'film-close-image-picker':/);
    assert.match(appSource, /case 'film-close-image-picker':\s+void closeFilmImagePickerAfterCommit\(\{ keepDetailOpen: true, background: true \}\);/);
    assert.doesNotMatch(appSource, /'film-close-image-picker'\s*\]\);/);
    const closePickerFunction = appSource.match(/async function closeFilmImagePickerAfterCommit[\s\S]*?function editFilmWatchEvent/)?.[0] || '';
    assert.match(closePickerFunction, /commitFilmImagePickerDraft\(\{ keepDetailOpen, background \}\)/);
    assert.match(appSource, /case 'film-refresh-tmdb':/);
    assert.doesNotMatch(appSource, /case 'film-open-tmdb':/);
    assert.match(appSource, /case 'film-remove-entry':/);
    assert.match(appSource, /filmPendingRemoveId: ''/);
    assert.match(appSource, /mode: 'remove-film'/);
    assert.match(appSource, /case 'film-undo-remove-entry':/);
    assert.match(appSource, /function removeFilmEntry\(filmId\)/);
    assert.match(appSource, /function refreshFilmFromTmdb\(filmId, \{ quiet = false, skipCommit = false \} = \{\}\)/);
    assert.match(appSource, /refreshFilmFromTmdb\(actionTarget\.dataset\.filmId \|\| state\.activeFilmId, \{ skipCommit: true \}\)/);
    assert.match(appSource, /forceRefresh=1/);
    assert.match(appSource, /function undoRemoveFilmEntry\(\)/);
    assert.match(appSource, /filmRemovedUndoRecord/);
    assert.match(appSource, /function isUnsavedActiveFilmPreview\(tmdbId = null\)/);
    assert.match(appSource, /if \(isUnsavedActiveFilmPreview\(normalizedId\)\) \{\s+return;\s+\}/);
    assert.match(appSource, /querySelector\('\.cml-film-notes-editor'\)/);
    assert.match(appSource, /clickedRenderedFilmNoteLink/);
    assert.match(appSource, /let filmPointerStartEditSurface = ''/);
    assert.match(appSource, /refs\.root\.addEventListener\('pointerdown', handlePointerDown, true\)/);
    assert.match(appSource, /function handlePointerDown\(event\)/);
    assert.match(appSource, /pointerStartEditSurface !== 'notes'/);
    assert.match(appSource, /optimisticExit: true/);
    assert.doesNotMatch(appSource, /data-film-notes-live-preview/);
    assert.doesNotMatch(appSource, /function syncFilmNotesLivePreview/);
    assert.match(appSource, /focusedNotesSection/);
    assert.match(appSource, /async function saveFilmEntryPatch\(filmId, patch = \{\}, \{[\s\S]*showStatus = false[\s\S]*rollbackOnError = false/);
    assert.match(appSource, /async function commitPendingFilmEditsBeforeAction\(\{ actionName = '', keepDetailOpen = true, background = true \} = \{\}\)/);
    assert.match(appSource, /await commitFilmNotesEdit\(\{ silent: true, keepDetailOpen, optimisticExit: background, background, patchDetail: !background \}\)/);
    assert.match(appSource, /await commitFilmMetadataEdit\(\{ keepDetailOpen, background, patchDetail: !background \}\)/);
    assert.match(appSource, /closeFilmImagePicker\(\{ shouldRender: false, animate: false \}\)/);
    assert.match(appSource, /commitFilmImagePickerDraft\(\{ keepDetailOpen, background \}\)/);
    assert.match(appSource, /commitPendingFilmEditsBeforeAction\(\{ actionName, keepDetailOpen: true, background: false \}\)/);
    assert.match(appSource, /case 'film-mark-rewatch':/);
    assert.match(appSource, /case 'film-mark-watched':/);
    assert.match(appSource, /case 'film-move-to-want':/);
    assert.match(appSource, /function markFilmWatched/);
    assert.match(appSource, /function moveFilmToWant/);
    assert.match(appSource, /'film-toggle-watch-date-editor'/);
    assert.match(appSource, /case 'film-toggle-watch-date-editor':/);
    assert.match(appSource, /function toggleFilmWatchDateEditor\(toggle, \{ perfToken = null \} = \{\}\)/);
    assert.doesNotMatch(appSource, /focusStayedInsideDateControl/);
    assert.doesNotMatch(appSource, /data-film-watch-event-input[\s\S]{0,700}closeFilmWatchDateEditors\(event\.target\.closest/);
    assert.doesNotMatch(appSource, /function handleChange[\s\S]*?data-film-watch-event-input[\s\S]*?editFilmWatchEvent/);
    assert.doesNotMatch(appSource, /function handleFocusOut[\s\S]*?data-film-watch-event-input[\s\S]*?editFilmWatchEvent/);
    assert.match(appSource, /watchStatus,/);
    assert.match(appSource, /function shouldClearWatchEventsWhenMovingToWant/);
    assert.match(appSource, /case 'film-delete-watch-event':/);
    assert.match(appSource, /case 'film-undo-watch-event-delete':/);
    assert.match(appSource, /function undoDeleteFilmWatchEvent/);
    assert.match(appSource, /function editFilmWatchEvent/);
    assert.match(appSource, /function deleteFilmWatchEvent/);
    assert.match(appSource, /dataset\.filmWatchEventId/);
    assert.match(appSource, /watchEventId: normalizedId/);
    assert.match(appSource, /function loadMoreFilmSearchResults/);
    assert.match(appSource, /appendWatchEvent: watchedAt/);
    assert.match(appSource, /data-film-notes-draft/);
    assert.match(appSource, /data-film-metadata-field/);
    assert.match(appSource, /querySelectorAll\('\.cml-film-metadata-editor'\)/);
    assert.match(appSource, /querySelectorAll\('\.cml-film-image-picker'\)/);
    assert.match(appSource, /FILM_METADATA_FIELDS\.forEach/);
    assert.match(appSource, /function patchActiveFilmDetailView/);
    assert.match(appSource, /function patchFilmBackdropLayer/);
    assert.match(appSource, /function patchFilmDetailChild/);
    const detailPatchFunction = appSource.match(/function patchActiveFilmDetailView[\s\S]*?function renderFilmMutationState/);
    assert.ok(detailPatchFunction);
    assert.doesNotMatch(detailPatchFunction[0], /currentPage\.replaceWith\(nextPage\)/);
    assert.doesNotMatch(detailPatchFunction[0], /patchFilmDetailChild\(currentPage, nextPage, '\.cml-film-detail__hero'\)/);
    assert.doesNotMatch(detailPatchFunction[0], /patchFilmDetailChild\(currentPage, nextPage, '\.cml-film-detail__lower'\)/);
    assert.doesNotMatch(detailPatchFunction[0], /patchFilmDetailChild\(currentPage, nextPage, '\.cml-film-detail__rating'\)/);
    assert.match(detailPatchFunction[0], /patchFilmDetailChild\(currentPage, nextPage, '\.cml-film-detail__synopsis-inline'/);
    assert.match(detailPatchFunction[0], /patchFilmDetailChild\(currentPage, nextPage, '\.cml-film-detail__image-tools'/);
    assert.match(detailPatchFunction[0], /patchFilmDetailChild\(currentPage, nextPage, '\.cml-film-detail__diary-rail'\)/);
    assert.match(detailPatchFunction[0], /patchFilmDetailChild\(currentPage, nextPage, '\.cml-film-detail__section--notes'/);
    assert.match(appSource, /function renderFilmMutationState/);
    assert.match(appSource, /patchDetail = true/);
    assert.match(appSource, /renderFilmMutationState\(\);/);
    assert.match(appSource, /const FILM_BACKDROP_ROTATION_MS = 7200/);
    assert.match(appSource, /filmBackdropIndexByFilmId: \{\}/);
    assert.match(appSource, /let filmBackdropRotationTimer = 0/);
    assert.match(appSource, /function getFilmAutoBackdropPaths/);
    assert.match(appSource, /function scheduleFilmBackdropRotation/);
    assert.match(appSource, /function rotateActiveFilmBackdrop/);
    assert.match(appSource, /function patchFilmBackdropImage/);
    assert.match(appSource, /prefers-reduced-motion: reduce/);
    assert.match(appSource, /document\.addEventListener\('visibilitychange', scheduleFilmBackdropRotation\)/);
    assert.match(appSource, /scheduleFilmBackdropRotation\(\);/);
    assert.match(repositorySource, /journal: normalizeMultilineText/);
    assert.match(repositorySource, /noteMarkdown: normalizeMultilineText/);
    assert.match(repositorySource, /titleOverride: normalizeText/);
    assert.match(repositorySource, /posterPathOverride: normalizeImagePathOverride/);
    assert.match(repositorySource, /backdropPathOverride: normalizeImagePathOverride/);
    assert.match(repositorySource, /posterUrlOverride: normalizeImageUrlOverride/);
    assert.match(repositorySource, /countryOverride: normalizeText/);
    assert.match(repositorySource, /languageOverride: normalizeText/);
    assert.match(repositorySource, /backdropZoomOverride: normalizeBackdropZoomOverride/);
    assert.match(repositorySource, /backdropPositionXOverride: normalizeBackdropPositionOverride/);
    assert.match(repositorySource, /backdropPositionYOverride: normalizeBackdropPositionOverride/);
    assert.match(repositorySource, /backdropOpacityOverride: normalizeBackdropOpacityOverride/);
    assert.match(repositorySource, /Manual film title is required/);
    assert.match(repositorySource, /posterPaths: normalizeImagePathArray/);
    assert.match(repositorySource, /backdropPaths: normalizeImagePathArray/);
    assert.match(clientSource, /append_to_response: 'credits,images'/);
    assert.match(clientSource, /function normalizePosterPaths/);
    assert.match(clientSource, /function normalizeBackdropPaths/);
    assert.match(clientSource, /function normalizeCountries/);
    assert.match(clientSource, /function normalizeLanguage/);
  });

  it('anchors shrink-fitted Film backdrop frames from the top without animated geometry', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
    const cssSource = fs.readFileSync(new URL('../css/media-library.css', import.meta.url), 'utf8');
    const detailRule = cssSource.match(/#codex-media-library-root \.cml-film-detail-page__backdrop-image \{[\s\S]*?\n\}/)?.[0] || '';
    const pickerRule = cssSource.match(/#codex-media-library-root \.cml-film-image-picker__preview\.is-backdrop img \{[\s\S]*?\n\}/)?.[0] || '';

    assert.match(appSource, /const top = fittedHeight <= containerHeight\s+\? 0\s+: \(containerHeight - fittedHeight\) \* \(normalized\.backdropPositionYOverride \/ 100\);/);
    assert.match(appSource, /image\.style\.left = fitted\.left;/);
    assert.match(appSource, /image\.style\.top = fitted\.top;/);
    assert.match(appSource, /image\.style\.transform = 'none';/);
    assert.ok(detailRule);
    assert.doesNotMatch(detailRule, /\b(?:transform|width|height|left|top) 260ms/);
    assert.ok(pickerRule);
    assert.match(pickerRule, /transition: none;/);
  });

  it('keeps Film image picker motion and backdrop sliders smooth without immediate full rerenders', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
    const cssSource = fs.readFileSync(new URL('../css/media-library.css', import.meta.url), 'utf8');

    assert.match(appSource, /const FILM_IMAGE_PICKER_CLOSE_MS = 150/);
    assert.match(appSource, /function closeFilmImagePicker\(\{ shouldRender = true, animate = shouldRender \} = \{\}\)/);
    assert.match(appSource, /picker\.classList\.add\('is-closing'\)/);
    assert.match(appSource, /window\.setTimeout\(\(\) => \{\s+filmImagePickerCloseTimer = 0;\s+finalizeFilmImagePickerClose\(\{ shouldRender \}\);/);
    assert.match(appSource, /function scheduleFilmBackdropFrameStyle/);
    assert.match(appSource, /filmBackdropFrameStyleRaf = window\.requestAnimationFrame/);
    assert.match(appSource, /function flushFilmBackdropFrameStyle/);
    assert.match(appSource, /function scheduleFilmBackdropFrameSync/);
    assert.match(appSource, /function handleWindowResize\(\)[\s\S]*scheduleFilmBackdropFrameSync/);
    assert.match(appSource, /let filmBackdropFrameResizeObserver = null/);
    assert.match(appSource, /function syncFilmBackdropFrameResizeObserver/);
    assert.match(appSource, /new ResizeObserver/);
    assert.match(appSource, /querySelectorAll\('\.cml-film-detail-page__backdrop, \.cml-film-image-picker__preview\.is-backdrop'\)/);
    assert.match(appSource, /state\.filmBackdropFrameDraft = next;\s+scheduleFilmBackdropFrameStyle\(next\);/);
    assert.match(appSource, /flushFilmBackdropFrameStyle\(\);\s+const film = getActiveFilmRecord\(\);/);
    assert.match(appSource, /const canPanX = fittedWidth > containerWidth \+ 0\.5;/);
    assert.match(appSource, /const canPanY = fittedHeight > containerHeight \+ 0\.5;/);
    assert.match(appSource, /node\.disabled = isDisabled;/);
    assert.match(appSource, /const filmEntryPatchQueues = new Map\(\)/);
    assert.match(appSource, /function queueFilmEntryPatch/);
    assert.match(appSource, /return queueFilmEntryPatch\(filmId, async \(\) => \{/);
    assert.match(appSource, /filmEntryLatestPatchSequence\.set\(filmId, patchSequence\)/);
    assert.match(appSource, /if \(!isLatestPatch\(\)\) \{\s+return true;\s+\}\s+upsertFilmRecord\(record\);/);
    assert.match(appSource, /function focusFilmBackdropFrameControl/);
    assert.match(cssSource, /@keyframes cml-film-picker-enter/);
    assert.match(cssSource, /\.cml-film-image-picker\.is-closing/);
    assert.match(cssSource, /\.cml-film-image-picker__range\.is-disabled/);
    assert.match(cssSource, /@keyframes cml-film-frame-enter/);
    assert.match(cssSource, /--film-frame-range-fill/);
    assert.match(cssSource, /::-webkit-slider-thumb/);
    assert.match(cssSource, /touch-action: pan-y;/);
  });

  it('removes dead legacy Films components from the live component module', () => {
    const source = fs.readFileSync(new URL('../js/media-library/films-components.js', import.meta.url), 'utf8');

    assert.doesNotMatch(source, /LegacyFilmDetailModal/);
    assert.doesNotMatch(source, /FilmDetailModal/);
    assert.doesNotMatch(source, /LegacyFilmSearchResults/);
    assert.doesNotMatch(source, /LegacyAddableFilmSearchResults/);
    assert.doesNotMatch(source, /renderTicketMetaRow/);
  });

  it('keeps saved film card posters free of overlay labels', () => {
    const html = FilmCard({
      id: 'tmdb-42',
      tmdbId: 42,
      title: 'Movie',
      originalTitle: 'Movie',
      status: 'watched',
      year: '2026',
      runtime: 121,
      posterPath: '/poster.jpg',
    });

    const posterPanel = html.slice(
      html.indexOf('cml-film-card__poster-panel'),
      html.indexOf('cml-film-card__ticket-panel')
    );
    assert.doesNotMatch(posterPanel, /Movie diary/i);
    assert.doesNotMatch(posterPanel, /已看|想看|watch/i);
    assert.doesNotMatch(html, /cml-film-card__eyebrow/);
  });

  it('renders saved film card footers as director spotlights without barcode', () => {
    const html = FilmCard({
      id: 'tmdb-42',
      tmdbId: 42,
      title: 'Movie',
      originalTitle: 'Movie',
      status: 'watched',
      year: '2026',
      runtime: 121,
      director: 'James Cameron',
      posterPath: '/poster.jpg',
    });

    assert.match(html, /cml-film-card__footer-spotlight/);
    assert.match(html, /cml-film-card__director/);
    assert.match(html, /James Cameron/);
    assert.doesNotMatch(html, /cml-film-card__rating/);
    assert.doesNotMatch(html, />NR<\/span>|Not rated/);
    assert.doesNotMatch(html, /TMDB #000042/);
    assert.doesNotMatch(html, /cml-film-card__barcode/);
  });

  it('renders saved film card metadata with dot-separated ticket values', () => {
    const html = FilmCard({
      id: 'tmdb-42',
      tmdbId: 42,
      title: 'Love Letter',
      originalTitle: 'Love Letter',
      status: 'watched',
      year: '1995',
      runtime: 117,
      country: 'Japan / JP',
      language: 'Japanese',
      watchedAt: '2026-05-11',
      posterPath: '/poster.jpg',
    });

    assert.match(html, /cml-film-card__info-item--release[\s\S]*<strong class="cml-film-card__info-value">1995 \u00b7 1h 57m<\/strong>/);
    assert.match(html, /cml-film-card__info-item--watched[\s\S]*<strong class="cml-film-card__info-value">05\/11\/2026<\/strong>/);
    assert.doesNotMatch(html, /cml-film-card__info-label">Release<\/span>/);
    assert.doesNotMatch(html, /cml-film-card__info-item--locale|Locale/);
    assert.doesNotMatch(html, /1995 - 1h 57m/);
    assert.doesNotMatch(html, /Japan \/ JP \/ Japanese/);
  });

  it('keeps saved film card rating rings user-controlled instead of using TMDb scores', () => {
    const html = FilmCard({
      id: 'tmdb-42',
      tmdbId: 42,
      title: 'Movie',
      originalTitle: 'Movie',
      status: 'watched',
      year: '2026',
      runtime: 121,
      director: 'James Cameron',
      posterPath: '/poster.jpg',
      voteAverage: 9,
    });

    assert.match(html, /James Cameron/);
    assert.doesNotMatch(html, /cml-film-card__director-label|>Director<\/span>/);
    assert.doesNotMatch(html, /cml-film-card__rating/);
    assert.doesNotMatch(html, />NR<\/span>|Not rated/);
    assert.doesNotMatch(html, /TMDb rating 9\.0/);
    assert.doesNotMatch(html, />9\.0<\/span>/);
  });

  it('renders saving state for movie add actions', () => {
    const html = FilmSearchResults({
      query: 'Movie',
      savingTmdbIds: new Set([42]),
      results: [{
        tmdbId: 42,
        title: 'Movie',
        posterPath: '/poster.jpg',
        releaseDate: '2026-01-01',
        voteAverage: 8.2,
      }],
    });

    assert.match(html, /cml-films-result cml-film-search-result[^"]*is-saving/);
    assert.match(html, /disabled>Adding\.\.\.<\/button>/);
    assert.doesNotMatch(html, /Saving\.\.\./);
    assert.doesNotMatch(html, /TMDb 8\.2/);
  });

  it('renders Load More for paginated TMDb search results', () => {
    const html = FilmSearchResults({
      query: 'Movie',
      page: 1,
      totalPages: 3,
      totalResults: 45,
      results: [{
        tmdbId: 42,
        title: 'Movie',
        posterPath: '/poster.jpg',
      }],
    });

    assert.match(html, /data-action="load-more-film-search-results"/);
    assert.match(html, />Load more<\/button>/);
    assert.match(html, />1 \/ 45<\/span>/);
  });

  it('keeps Load More loading local to the button and marks appended cards', () => {
    const html = FilmSearchResults({
      query: 'Movie',
      loadingMore: true,
      page: 1,
      totalPages: 3,
      totalResults: 45,
      newResultStartIndex: 1,
      results: [
        { tmdbId: 41, title: 'Old Movie', posterPath: '/old.jpg' },
        { tmdbId: 42, title: 'New Movie', posterPath: '/new.jpg' },
      ],
    });

    assert.match(html, /cml-film-search-panel\s+is-loading-more/);
    assert.doesNotMatch(html, /cml-film-search-results[^"]*is-loading/);
    assert.match(html, /data-action="load-more-film-search-results" disabled>Loading\.\.\.<\/button>/);
    assert.match(html, /cml-film-search-result is-new/);
  });

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

  it('renders the standard add-to-album modal as a themed destination row chooser with search', () => {
    const html = AlbumDialog({
      state: {
        albumDialogOpen: true,
        albumDialogOrigin: '',
        albumDialogMode: 'assign',
        albumDialogTarget: 'photo',
        albumDraftName: '',
        albumDialogError: '',
        albumDrawerSearch: '',
        albumDrawerScope: 'all',
        albumDrawerCreateMode: false,
        activeAlbumName: '',
        selectedIds: new Set(['managed-1']),
      },
      albums: [
        { name: 'scenery', itemCount: 12, coverUrl: '/file/scenery.jpg', scope: 'mine', selected: true },
        { name: 'travel', itemCount: 4, coverUrl: '/file/travel.jpg', scope: 'mine', selected: false }
      ],
      target: 'photo'
    });

    assert.match(html, /class="cml-dialog__panel cml-album-dialog cml-album-dialog--sheet"/);
    assert.match(html, /cml-album-dialog__context/);
    assert.match(html, /1 selected photo/);
    assert.match(html, /Pick a visual destination/);
    assert.match(html, /Search albums/);
    assert.doesNotMatch(html, /My albums/);
    assert.doesNotMatch(html, /Shared with me/);
    assert.match(html, /Last modified/);
    assert.match(html, /cml-album-dialog__chooser/);
    assert.match(html, /cml-album-dialog__chooser-row/);
    assert.doesNotMatch(html, /cml-album-dialog__chooser-card/);
    assert.match(html, /New album/);
    assert.match(html, /12 items/);
    assert.match(html, /Already added/);
    assert.match(html, /cml-album-dialog__entry-check/);
    assert.match(html, /data-action="assign-album"/);
    assert.doesNotMatch(html, /cml-album-dialog__album-chip/);
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

  it('prioritizes above-the-fold photo tiles without making the whole timeline eager', () => {
    const rows = [{
      items: [
        {
          item: {
            id: 'managed-priority-1',
            type: 'photo',
            label: 'front.jpg',
            sourceUrl: '/file/scenery/front.jpg',
            thumbnailUrl: '/file/scenery/front.jpg',
            width: 1200,
            height: 900,
            displayTakenAt: 'April 8, 2026 21:42',
          },
          width: 240,
          height: 180,
        },
        {
          item: {
            id: 'managed-priority-2',
            type: 'photo',
            label: 'below.jpg',
            sourceUrl: '/file/scenery/below.jpg',
            thumbnailUrl: '/file/scenery/below.jpg',
            width: 1200,
            height: 900,
            displayTakenAt: 'April 8, 2026 21:43',
          },
          width: 240,
          height: 180,
        },
      ],
    }];
    const html = MediaGrid({
      rows,
      state: {
        selectedIds: new Set(),
        loadedMediaIds: new Set(),
        fullLoadedMediaIds: new Set(),
      },
      priorityItemLimit: 1,
    });

    assert.match(html, /front\.jpg"[^>]+loading="eager"[^>]+fetchpriority="high"/);
    assert.match(html, /below\.jpg"[^>]+loading="lazy"/);
    assert.doesNotMatch(html, /below\.jpg"[^>]+fetchpriority="high"/);
  });

  it('keeps normal Photos timelines mounted instead of virtualizing during ordinary scroll', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
    const cssSource = fs.readFileSync(new URL('../css/media-library.css', import.meta.url), 'utf8');
    const thresholdMatch = appSource.match(/const TIMELINE_VIRTUALIZATION_ITEM_THRESHOLD = (\d+);/);

    assert.ok(thresholdMatch);
    assert.ok(Number(thresholdMatch[1]) >= 720);
    assert.match(appSource, /timelineItems\.length > TIMELINE_VIRTUALIZATION_ITEM_THRESHOLD/);
    assert.doesNotMatch(cssSource, /\.cml-media-row \{[^}]*?content-visibility:/);
    assert.doesNotMatch(cssSource, /\.cml-media-row \{[^}]*?contain-intrinsic-size:/);
    const applyPatch = appSource.match(/function applyDimensionPatch\(\)[\s\S]*?\n\}/);
    assert.ok(applyPatch, 'applyDimensionPatch should still exist');
    assert.doesNotMatch(applyPatch[0], /\brender\(\)/);
    assert.doesNotMatch(applyPatch[0], /requestAnimationFrame/);

    const rowHtml = MediaGrid({
      rows: [{
        height: 222,
        items: [{
          item: {
            id: 'managed-stable-row',
            type: 'photo',
            label: 'stable.jpg',
            sourceUrl: '/file/scenery/stable.jpg',
            thumbnailUrl: '/file/scenery/stable.jpg',
            width: 1200,
            height: 900,
            displayTakenAt: 'April 8, 2026 21:42',
          },
          width: 296,
          height: 222,
        }],
      }],
      state: {
        selectedIds: new Set(),
        loadedMediaIds: new Set(),
        fullLoadedMediaIds: new Set(),
      },
    });
    assert.match(rowHtml, /<div class="cml-media-row">/);
    assert.doesNotMatch(rowHtml, /contain-intrinsic-size/);
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

  it('renders the redesigned music summary as an immersive dashboard hero with queue and playlist context', () => {
    const html = MusicSummary({
      totalCount: 12,
      isMobile: false,
      currentItem: {
        id: 'audio-1',
        audioTitle: 'Darcy’s Letter',
        audioArtist: 'Dario Marianelli',
        audioAlbum: 'Pride & Prejudice',
        audioDuration: 274,
        thumbnailUrl: 'https://example.com/cover.jpg'
      },
      queueItems: [
        { id: 'audio-1', audioTitle: 'Darcy’s Letter', audioArtist: 'Dario Marianelli', audioAlbum: 'Pride & Prejudice', audioDuration: 274 },
        { id: 'audio-2', audioTitle: 'Arrival of the Birds', audioArtist: 'The Cinematic Orchestra', audioAlbum: 'The Crimson Wing', audioDuration: 231 }
      ],
      isPlaying: true,
      mode: 'sequence',
      playlists: [
        { name: 'Night Drive', itemCount: 5 },
        { name: 'Soft Focus', itemCount: 7 }
      ],
      activePlaylistName: ''
    });

    assert.match(html, /cml-music-summary__hero/);
    assert.match(html, /cml-music-summary__hero-main/);
    assert.match(html, /cml-music-summary__art/);
    assert.match(html, /cml-music-summary__controls/);
    assert.match(html, /cml-music-summary__context/);
    assert.match(html, /cml-music-summary__playlist-card/);
    assert.match(html, /data-action="audio-toggle-play"/);
    assert.match(html, /data-action="open-music-playlist"/);
    assert.match(html, /All tracks/);
    assert.match(html, /Night Drive/);
    assert.match(html, /Soft Focus/);
  });

  it('renders the redesigned music library layout as a list-first main area with secondary right context', () => {
    const items = [
      {
        id: 'audio-1',
        type: 'audio',
        label: 'darcy-letter.mp3',
        audioTitle: 'Darcy’s Letter',
        audioArtist: 'Dario Marianelli',
        audioAlbum: 'Pride & Prejudice',
        audioDuration: 274,
        sizeMb: 6.2,
        takenAt: '2026-05-14T10:00:00.000Z'
      },
      {
        id: 'audio-2',
        type: 'audio',
        label: 'arrival.mp3',
        audioTitle: 'Arrival of the Birds',
        audioArtist: 'The Cinematic Orchestra',
        audioAlbum: 'The Crimson Wing',
        audioDuration: 342,
        sizeMb: 7.8,
        takenAt: '2026-05-13T08:00:00.000Z'
      }
    ];
    const listHtml = MusicListView({
      items,
      state: { layoutWidth: 1440 },
      audioState: { currentId: 'audio-1', isPlaying: true },
      currentItem: { id: 'audio-1', audioTitle: 'Darcy’s Letter', audioArtist: 'Dario Marianelli', audioAlbum: 'Pride & Prejudice' },
      queueItems: [
        { id: 'audio-1', audioTitle: 'Darcy’s Letter', audioArtist: 'Dario Marianelli', audioAlbum: 'Pride & Prejudice' },
        { id: 'audio-2', audioTitle: 'Arrival of the Birds', audioArtist: 'The Cinematic Orchestra', audioAlbum: 'The Crimson Wing' }
      ],
      playlists: [{ name: 'Night Drive', itemCount: 2 }],
      activePlaylistName: ''
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

    assert.match(listHtml, /cml-music-library__main/);
    assert.match(listHtml, /cml-music-library__aside/);
    assert.match(listHtml, /cml-music-playlist__list-shell/);
    assert.match(listHtml, /cml-music-playlist__table/);
    assert.match(listHtml, /cml-music-queue/);
    assert.match(listHtml, /cml-music-library__metric/);
    assert.match(listHtml, /data-action="rename-audio-artist"/);
    assert.match(listHtml, /data-action="rename-audio-album"/);
    assert.match(listHtml, /data-action="add-audio-to-playlist"/);
    assert.match(panelHtml, /Audio player/);
    assert.match(panelHtml, /Queue/);
    assert.match(panelHtml, /data-action="audio-toggle-play"/);
    assert.match(panelHtml, /data-action="audio-set-mode"/);
    assert.match(panelHtml, /data-audio-progress/);
    assert.match(panelHtml, /data-audio-volume/);
  });

  it('bounds the music queue side rail so large libraries do not duplicate every track', () => {
    const items = Array.from({ length: 30 }, (_, index) => ({
      id: `audio-${index}`,
      type: 'audio',
      label: `track-${index}.mp3`,
      audioTitle: `Track ${index}`,
      audioArtist: `Artist ${index % 4}`,
      audioAlbum: `Album ${index % 3}`,
      audioDuration: 180,
      takenAt: '2026-05-14T10:00:00.000Z'
    }));
    const listHtml = MusicListView({
      items,
      state: { layoutWidth: 1440 },
      audioState: { currentId: 'audio-3', isPlaying: true },
      queueItems: items,
      playlists: [{ name: 'Long Queue', itemCount: items.length }],
      activePlaylistName: ''
    });

    const renderedQueueRows = (listHtml.match(/class="cml-music-queue__item/g) || []).length;
    const renderedTrackRows = (listHtml.match(/data-audio-row="/g) || []).length;

    assert.equal(renderedTrackRows, 30);
    assert.equal(renderedQueueRows, 12);
    assert.match(listHtml, /18 more tracks stay in queue/);
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
    assert.match(summaryHtml, /<p class="cml-music-summary__eyebrow">Private music<\/p>/);
    assert.match(summaryHtml, /<h2 class="cml-view-summary__title">Library<\/h2>/);
    assert.match(summaryHtml, /0 items available in your private cloud library\./);
    assert.match(summaryHtml, /Nothing playing/);
    assert.match(summaryHtml, /Your queue will appear here once playback starts\./);
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

  it('defines the immersive music hero, context, metrics, and table selectors', () => {
    const cssSource = fs.readFileSync(new URL('../css/media-library.css', import.meta.url), 'utf8');

    assert.match(cssSource, /cml-music-summary__hero/);
    assert.match(cssSource, /cml-music-summary__hero-main/);
    assert.match(cssSource, /cml-music-summary__context/);
    assert.match(cssSource, /cml-music-summary__playlist-card/);
    assert.match(cssSource, /cml-music-library__metric/);
    assert.match(cssSource, /cml-music-playlist__table/);
  });

  it('keeps the main dashboard content as the internal scroll container', () => {
    const cssSource = fs.readFileSync(new URL('../css/media-library.css', import.meta.url), 'utf8');
    const contentShellRule = cssSource.match(/#codex-media-library-root \.cml-main-content-shell \{[\s\S]*?\n\s*\}/)?.[0] || '';
    const musicShellRule = cssSource.match(/#codex-media-library-root \.cml-main-content-shell--music \{[\s\S]*?\n\s*\}/)?.[0] || '';
    const mainContentRule = [...cssSource.matchAll(/#codex-media-library-root \.cml-main-content \{[\s\S]*?\n\s*\}/g)]
      .map((match) => match[0])
      .find((rule) => rule.includes('overflow: auto;')) || '';

    assert.match(contentShellRule, /grid-template-rows: minmax\(0, 1fr\);/);
    assert.match(musicShellRule, /display: grid;/);
    assert.match(musicShellRule, /grid-template-rows: minmax\(0, 1fr\);/);
    assert.doesNotMatch(musicShellRule, /display: block;/);
    assert.match(mainContentRule, /min-height: 0;/);
    assert.match(mainContentRule, /overflow: auto;/);
    assert.doesNotMatch(cssSource, /cml-music-summary__now-playing/);
    assert.doesNotMatch(cssSource, /cml-music-summary__focus/);
  });

  it('lets Chromium skip offscreen music row layout during free scrolling', () => {
    const cssSource = fs.readFileSync(new URL('../css/media-library.css', import.meta.url), 'utf8');
    const musicRowRule = [...cssSource.matchAll(/#codex-media-library-root \.cml-main-content__inner\.is-music-view \.cml-music-row \{[\s\S]*?\n\s*\}/g)]
      .map((match) => match[0])
      .find((rule) => rule.includes('min-height: 70px;')) || '';
    const queueItemRule = cssSource.match(/#codex-media-library-root \.cml-music-queue__item \{[\s\S]*?\n\s*\}/)?.[0] || '';

    assert.match(musicRowRule, /content-visibility: auto;/);
    assert.match(musicRowRule, /contain-intrinsic-size: 70px;/);
    assert.match(queueItemRule, /content-visibility: auto;/);
    assert.match(queueItemRule, /contain-intrinsic-size: 58px;/);
  });

  it('patches Music playback state without replacing the full library list', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
    const patchStart = appSource.indexOf('function patchAudioUi');
    const patchEnd = appSource.indexOf('function ensureAudioEngine', patchStart);
    assert.ok(patchStart >= 0 && patchEnd > patchStart);
    const patchAudioUiSource = appSource.slice(patchStart, patchEnd);

    assert.match(patchAudioUiSource, /patchMusicAudioRows\(viewModel\);/);
    assert.match(patchAudioUiSource, /patchMusicQueuePanel\(viewModel\);/);
    assert.doesNotMatch(patchAudioUiSource, /currentMusicLibrary\.replaceWith\(nextMusicLibrary\);/);
  });

  it('reports full-render phases and view-model cost behind cmlPerf', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /function measurePerfSpan\(/);
    assert.match(appSource, /function clearPerfMarks\(/);
    assert.match(appSource, /measurePerfSpan\('getViewModel'/);
    assert.match(appSource, /measurePerfSpan\('render:apply-dom'/);
    assert.match(appSource, /clearPerfMarks\(startMark, endMark\);/);
    assert.match(appSource, /clearPerfMarks\(token\.startMark, token\.endMark\);/);
    assert.match(appSource, /pushPerfDiagnosticRow\(/);
    assert.match(appSource, /function getPerfMarkupByteLength\(/);
    assert.match(appSource, /const fullHtmlByteLength = perfReporter\.enabled \? getPerfMarkupByteLength\(fullHtml\) : 0;/);
    assert.match(appSource, /row\['markup bytes'\]/);
    assert.match(appSource, /row\['render path'\]/);
    assert.match(appSource, /PERF_RECENT_MEASURE_LIMIT/);
    assert.match(appSource, /recentMeasures/);
    assert.match(appSource, /performance\.clearMeasures\?/);
    assert.match(appSource, /markup bytes/);
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

  it('keeps desktop Mind focused on the chat header and composer plus launcher', () => {
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

    assert.match(topbarHtml, /cml-topbar--mind/);
    assert.match(topbarHtml, />Willian</);
    assert.doesNotMatch(topbarHtml, /<span>Style<\/span>/);
    assert.doesNotMatch(topbarHtml, /Storage/);
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
    assert.match(appSource, /function animateContentViewTransition\(variant = ''\)/);
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
    const storageSource = fs.readFileSync(new URL('../js/media-library/storage.js', import.meta.url), 'utf8');

    assert.match(appSource, /import \{ loadJson, saveJson \} from '\.\/storage\.js';/);
    assert.match(storageSource, /const badJsonWarnedKeys = new Set\(\);/);
    assert.match(storageSource, /export function loadJson\(key, fallback\)/);
    assert.match(storageSource, /export function saveJson\(key, value\)/);
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

  it('stops indefinite library loading after repeated indexed timeouts without DOM fallback items', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
    assert.match(appSource, /source: error\?\.message === 'Request timed out' \? 'timeout' : 'dom'/);
    assert.match(appSource, /const hasFallbackItems = items\.length > 0/);
    assert.match(appSource, /const timedOutWithoutFallback = !hasFallbackItems/);
    assert.match(appSource, /state\.librarySyncMeta\?\.source === 'timeout'/);
    assert.match(appSource, /state\.liveSyncAttempts >= 3/);
    assert.match(appSource, /const shouldKeepLoading = !hasFallbackItems\s*&& !timedOutWithoutFallback/);
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
    assert.match(appSource, /function getPreviewItems\(items = getAccessibleItems\(\)\) \{/);
    assert.match(appSource, /state\.primaryFilter === 'Bin'[\s\S]*return state\.binItems;/);
    assert.match(appSource, /state\.primaryFilter === 'Moments'[\s\S]*return getMomentAttachmentItems\(\);/);
    assert.match(appSource, /isBinView: state\.primaryFilter === 'Bin'/);
    assert.match(appSource, /function movePreview\(direction\) \{\s*const items = getPreviewItems\(\);/);
  });

  it('keeps Moments preview resolution working for referenced existing Photos items', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
    assert.match(appSource, /buildMomentMutationPayload/);
    assert.match(appSource, /existingFileIds\[\]/);
    assert.match(appSource, /applyMomentPickerSelection/);
    assert.match(appSource, /source: 'existing'/);
  });

  it('consumes explicit preview source hints for non-tile preview triggers', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
    const openPreviewStart = appSource.indexOf('function openPreview(');
    const openPreviewEnd = appSource.indexOf('function openPreviewFromEvent(');
    const openPreviewSection = openPreviewStart >= 0 && openPreviewEnd > openPreviewStart
      ? appSource.slice(openPreviewStart, openPreviewEnd)
      : '';
    const clickPreviewSection = appSource.match(/if \(!isSelectClick && actionTarget instanceof HTMLElement && actionTarget\.dataset\.action === 'open-preview' && actionTarget\.dataset\.id\) \{[\s\S]*?return;\s*\}/)?.[0] || '';
    const handleActionSection = appSource.match(/case 'open-preview':[\s\S]*?return true;/)?.[0] || '';

    assert.ok(openPreviewSection);
    assert.match(openPreviewSection, /function openPreview\(itemId,\s*(?:sourceHint = ''|\{\s*sourceHint = ''\s*\} = \{\})\)/);
    assert.match(openPreviewSection, /sourceHint = normalizeText\(sourceHint\) \|\| getMediaSourceFromTile\(sourceTile\);/);
    assert.match(openPreviewSection, /resolvePreviewItem\(getAllItems\(\), \{[\s\S]*sourceHint[\s\S]*\}\);/);
    assert.match(openPreviewSection, /state\.previewSourceHint = sourceHint \|\| resolvedPreviewItem\?\.thumbnailUrl \|\| resolvedPreviewItem\?\.sourceUrl \|\| '';/);
    assert.match(clickPreviewSection, /dataset\.previewSource/);
    assert.match(clickPreviewSection, /openPreview\(actionTarget\.dataset\.id,\s*(?:actionTarget\.dataset\.previewSource \|\| ''|\{\s*sourceHint: actionTarget\.dataset\.previewSource \|\| ''\s*\})\);/);
    assert.match(handleActionSection, /dataset\.previewSource/);
    assert.match(handleActionSection, /openPreview\(actionTarget\.dataset\.id,\s*(?:actionTarget\.dataset\.previewSource \|\| ''|\{\s*sourceHint: actionTarget\.dataset\.previewSource \|\| ''\s*\})\);/);
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
    assert.match(gateHtml, /name="username"/);
    assert.match(gateHtml, /autocomplete="username"/);
    assert.match(gateHtml, /name="password"/);
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
    assert.match(appSource, /if \(mode === 'cancel'\) \{\s*restoreDescription\(\);/);
    assert.match(appSource, /cancelButton\.addEventListener\('click', \(\) => commitEdit\('cancel'\)\);/);
    assert.match(appSource, /saveButton\.addEventListener\('click', \(\) => commitEdit\('save'\)\);/);    assert.match(appSource, /descSection\.append\(textarea, actions\);/);
  });

  it('keeps preview descriptions multiline after saving and display patching', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /function normalizePreviewDescription\(value\) \{/);
    assert.match(appSource, /replace\(/);
    assert.match(appSource, /function renderPreviewDescriptionHtml\(value\) \{/);
    assert.match(appSource, /replace\(/);
    assert.match(appSource, /p\.innerHTML = renderPreviewDescriptionHtml\(text\);/);
    assert.match(appSource, /mediaItem\.description = normalizePreviewDescription\(description\);/);
  });


  it('routes current-album picker confirm directly into the current album target', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
    const topbarHtml = TopSearchBar({
      state: {
        primaryFilter: 'Photos',
        secondaryFilter: '',
        videoCategoryFilter: '',
        activeAlbumName: '',
        albumSelectionTarget: 'scenery',
        videoAlbumSelectionTarget: '',
        privateSelectionMode: false,
        privateViewOpen: false,
        privateRouteUnlocked: false,
        selectedIds: new Set(['photo-1', 'photo-2']),
        searchDraft: '',
        searchQuery: '',
      },
    });

    assert.match(appSource, /case 'confirm-add-to-current-album':\s*commitSelectionToCurrentTarget\(\);/);
    assert.match(appSource, /return commitSelectionToAlbum\(targetAlbum\);/);
    assert.match(appSource, /case 'open-add-to-album':\s*if \(state\.albumSelectionTarget\) \{\s*commitSelectionToAlbum\(state\.albumSelectionTarget\);\s*return true;\s*\}\s*openAlbumDialog\('assign'\);\s*return true;/);
    assert.match(topbarHtml, /data-action="confirm-add-to-current-album"/);
    assert.match(topbarHtml, /Add selected to scenery/);
    assert.doesNotMatch(topbarHtml, /data-action="open-add-to-album"/);
  });

  it('resets all picker target state by default', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
    const pickerStateSource = fs.readFileSync(new URL('../js/media-library/picker-state.js', import.meta.url), 'utf8');

    assert.match(appSource, /import \{[\s\S]*resetAddToTargetModes,[\s\S]*\} from '\.\/picker-state\.js';/);
    assert.match(pickerStateSource, /export function resetAddToTargetModes\(state, \{[\s\S]*preserveAlbumSelectionTarget = false,[\s\S]*preserveVideoAlbumSelectionTarget = false,[\s\S]*preservePrivateSelectionMode = false,[\s\S]*preserveAlbumPickerDistinctOnly = false[\s\S]*\} = \{\}\) \{/);
    assert.match(pickerStateSource, /if \(!preserveAlbumSelectionTarget\) \{\s*state\.albumSelectionTarget = '';\s*\}/);
    assert.match(pickerStateSource, /if \(!preserveVideoAlbumSelectionTarget\) \{\s*state\.videoAlbumSelectionTarget = '';\s*\}/);
    assert.match(pickerStateSource, /if \(!preservePrivateSelectionMode\) \{\s*state\.privateSelectionMode = false;\s*\}/);
    assert.match(pickerStateSource, /if \(!preserveAlbumPickerDistinctOnly\) \{\s*state\.albumPickerDistinctOnly = false;\s*\}/);
  });

  it('preserves targeted picker state during photos route replay when requested', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
    const pickerStateSource = fs.readFileSync(new URL('../js/media-library/picker-state.js', import.meta.url), 'utf8');

    assert.match(appSource, /const rawHash = decodeURIComponent\(window\.location\.hash \|\| ''\)\.replace\(\/\^#\\\/\?\/, ''\);/);
    assert.match(pickerStateSource, /export function isPhotosRouteReplay\(rawHash\) \{/);
    assert.match(pickerStateSource, /return \/\^photos\(\?:\\\/\|\$\)\/i\.test\(rawHash \|\| 'photos'\);/);
    assert.match(pickerStateSource, /export function buildPickerPreserveFlags\(state, rawHash\) \{/);
    assert.match(pickerStateSource, /preserveAlbumSelectionTarget: Boolean\(state\?\.albumSelectionTarget\) && photosRouteReplay,/);
    assert.match(pickerStateSource, /preserveVideoAlbumSelectionTarget: Boolean\(state\?\.videoAlbumSelectionTarget\) && photosRouteReplay,/);
    assert.match(pickerStateSource, /preservePrivateSelectionMode: Boolean\(state\?\.privateSelectionMode\) && photosRouteReplay,/);
    assert.match(pickerStateSource, /preserveAlbumPickerDistinctOnly: Boolean\(state\?\.albumPickerDistinctOnly\) && photosRouteReplay,/);
    assert.match(appSource, /\} = buildPickerPreserveFlags\(state, rawHash\);/);
    assert.match(appSource, /resetAddToTargetModes\(state, \{[\s\S]*preserveAlbumSelectionTarget,[\s\S]*preserveVideoAlbumSelectionTarget,[\s\S]*preservePrivateSelectionMode,[\s\S]*preserveAlbumPickerDistinctOnly[\s\S]*\}\);/);
  });

  it('keeps current album target and related picker state protected from photos route replay regressions', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
    const pickerStateSource = fs.readFileSync(new URL('../js/media-library/picker-state.js', import.meta.url), 'utf8');

    assert.match(appSource, /case 'open-add-to-album':\s*if \(state\.albumSelectionTarget\) \{\s*commitSelectionToAlbum\(state\.albumSelectionTarget\);\s*return true;\s*\}\s*openAlbumDialog\('assign'\);\s*return true;/);
    assert.match(pickerStateSource, /export function buildPickerPreserveFlags\(state, rawHash\) \{/);
    assert.match(pickerStateSource, /preserveAlbumSelectionTarget: Boolean\(state\?\.albumSelectionTarget\) && photosRouteReplay,/);
    assert.match(pickerStateSource, /preserveVideoAlbumSelectionTarget: Boolean\(state\?\.videoAlbumSelectionTarget\) && photosRouteReplay,/);
    assert.match(pickerStateSource, /preservePrivateSelectionMode: Boolean\(state\?\.privateSelectionMode\) && photosRouteReplay,/);
    assert.match(pickerStateSource, /preserveAlbumPickerDistinctOnly: Boolean\(state\?\.albumPickerDistinctOnly\) && photosRouteReplay,/);
  });

  it('lets the preview album-panel close button close the whole preview and clears preview-side selection state', () => {
    const componentsSource = fs.readFileSync(new URL('../js/media-library/components.js', import.meta.url), 'utf8');
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(componentsSource, /class="cml-preview__info-close" data-action="close-preview" aria-label="Close preview"/);
    assert.match(appSource, /const previewAlbumFlow = state\.albumDialogOrigin === 'preview';/);
    assert.match(appSource, /if \(previewAlbumFlow\) \{[\s\S]*clearSelection\(\{ shouldRender: false \}\);/);
  });
  it('keeps current-album add-photos in a dedicated Photos picker instead of the album detail state', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /function openAlbumSelection\(albumName = getActiveAlbumName\(\)\) \{/);
    assert.match(appSource, /state\.albumSelectionTarget = normalizedName;/);
    assert.match(appSource, /state\.primaryFilter = 'Photos';/);
    assert.match(appSource, /state\.activeAlbumName = '';/);
    assert.match(appSource, /state\.videoCategoryFilter = '';/);
    assert.match(appSource, /clearPrivateViewState\(\);/);
  });
});
