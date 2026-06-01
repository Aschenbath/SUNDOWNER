import { getDatabase } from './databaseAdapter.js';
import { TMDbClient } from './tmdbClient.js';

const MOVIE_CACHE_KEY_PREFIX = 'manage@sysConfig@movieCache@';
const USER_MOVIE_ENTRIES_KEY = 'manage@sysConfig@userMovieEntries';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MOVIE_HYDRATE_CONCURRENCY = 3;
const BACKDROP_DEFAULT_FRAME = Object.freeze({
  backdropZoomOverride: 0.5,
  backdropPositionXOverride: 50,
  backdropPositionYOverride: 50,
  backdropOpacityOverride: 0.92,
});
const BACKDROP_LEGACY_DEFAULT_FRAME = Object.freeze({
  backdropZoomOverride: 1.02,
  backdropPositionXOverride: 50,
  backdropPositionYOverride: 50,
  backdropOpacityOverride: 0.66,
});
const BACKDROP_FRAME_FIELDS = Object.keys(BACKDROP_DEFAULT_FRAME);

export const WATCH_STATUSES = new Set(['wantToWatch', 'watching', 'watched', 'paused', 'dropped']);
export const MOVIE_SOURCES = new Set(['tmdb', 'manual']);

function createStatusError(message, status, { expose = true } = {}) {
  const error = new Error(message);
  error.status = status;
  error.expose = expose;
  return error;
}

function normalizeText(value, maxLength = 0) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  return maxLength > 0 ? normalized.slice(0, maxLength) : normalized;
}

function normalizeMultilineText(value, maxLength = 0) {
  const normalized = String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  return maxLength > 0 ? normalized.slice(0, maxLength) : normalized;
}

function normalizeNumber(value, fallback = null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeRuntimeOverride(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
}

function normalizeImageUrlOverride(value, maxLength = 1000) {
  const normalized = normalizeText(value, maxLength);
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

function normalizeImagePathOverride(value, maxLength = 240) {
  const normalized = normalizeText(value, maxLength);
  if (!normalized || /^https?:\/\//i.test(normalized) || normalized.startsWith('data:') || normalized.startsWith('/file/')) {
    return '';
  }
  return normalized;
}

function normalizeBackdropZoomOverride(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0.5;
  }
  return Math.max(0.5, Math.min(1.8, Math.round(numeric * 100) / 100));
}

function normalizeBackdropPositionOverride(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 50;
  }
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeBackdropOpacityOverride(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0.92;
  }
  return Math.max(0.18, Math.min(0.92, Math.round(numeric * 100) / 100));
}

function normalizeBackdropFrameOverrides(input = {}, existing = null) {
  const normalized = {
    backdropZoomOverride: normalizeBackdropZoomOverride(input.backdropZoomOverride ?? existing?.backdropZoomOverride),
    backdropPositionXOverride: normalizeBackdropPositionOverride(input.backdropPositionXOverride ?? existing?.backdropPositionXOverride),
    backdropPositionYOverride: normalizeBackdropPositionOverride(input.backdropPositionYOverride ?? existing?.backdropPositionYOverride),
    backdropOpacityOverride: normalizeBackdropOpacityOverride(input.backdropOpacityOverride ?? existing?.backdropOpacityOverride),
  };
  const isLegacyDefault = BACKDROP_FRAME_FIELDS.every((field) =>
    normalized[field] === BACKDROP_LEGACY_DEFAULT_FRAME[field]
  );
  return isLegacyDefault ? { ...BACKDROP_DEFAULT_FRAME } : normalized;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function normalizeUserRating(value, { strict = false } = {}) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = Number(value);
  const rounded = Math.round(numeric * 10) / 10;
  const valid = Number.isFinite(numeric)
    && numeric >= 0.5
    && numeric <= 5
    && Math.abs(numeric - rounded) < 0.000001;
  if (!valid) {
    if (strict) {
      throw new Error('userRating must be between 0.5 and 5.0 in 0.1 steps');
    }
    return null;
  }
  return rounded;
}

function nowIso() {
  return new Date().toISOString();
}

function cacheKey(tmdbId) {
  return `${MOVIE_CACHE_KEY_PREFIX}${Number(tmdbId)}`;
}

function createManualEntryId(timestamp = nowIso()) {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return `manual-${globalThis.crypto.randomUUID()}`;
  }
  return `manual-${String(timestamp).replace(/[^0-9a-z]/gi, '').slice(0, 24)}`;
}

function createWatchEventId(watchedAt = '', timestamp = nowIso(), index = 0) {
  const seed = `${watchedAt}-${timestamp}-${index}`;
  return `watch-${seed.replace(/[^0-9a-z]/gi, '').slice(0, 40)}`;
}

function normalizeMovieSource(value = '', tmdbId = 0) {
  const normalized = normalizeText(value).toLowerCase();
  if (MOVIE_SOURCES.has(normalized)) {
    return normalized;
  }
  return tmdbId ? 'tmdb' : 'manual';
}

function resolveEntrySource(input = {}, existing = null) {
  const normalizedInputSource = normalizeText(input.source).toLowerCase();
  if (MOVIE_SOURCES.has(normalizedInputSource)) {
    return normalizedInputSource;
  }
  const normalizedExistingSource = normalizeText(existing?.source).toLowerCase();
  if (MOVIE_SOURCES.has(normalizedExistingSource)) {
    return normalizedExistingSource;
  }
  return normalizeMovieSource('', normalizeNumber(input.tmdbId ?? existing?.tmdbId, 0));
}

function parseJson(rawValue, fallback) {
  if (!rawValue) {
    return fallback;
  }
  try {
    return JSON.parse(rawValue);
  } catch {
    return fallback;
  }
}

function normalizeStringArray(values = [], maxItemLength = 60) {
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeText(value, maxItemLength))
    .filter(Boolean)
    .slice(0, 40);
}

function normalizeImagePathArray(values = [], maxItemLength = 240) {
  const paths = [];
  (Array.isArray(values) ? values : [])
    .map((value) => normalizeText(value, maxItemLength))
    .filter(Boolean)
    .forEach((value) => {
      if (!paths.includes(value)) {
        paths.push(value);
      }
    });
  return paths.slice(0, 20);
}

function normalizeWatchDate(value) {
  const normalized = normalizeText(value, 40).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function normalizeWatchEvents(value = [], timestamp = nowIso()) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  return source
    .map((item, index) => {
      const watchedAt = normalizeWatchDate(typeof item === 'string' ? item : item?.watchedAt || item?.date);
      const createdAt = normalizeText(typeof item === 'object' ? item?.createdAt : '', 40) || (watchedAt ? `${watchedAt}T00:00:00.000Z` : timestamp);
      const fallbackId = watchedAt ? createWatchEventId(watchedAt, createdAt, index) : '';
      const id = normalizeText(typeof item === 'object' ? item?.id || item?.watchEventId : '', 120) || fallbackId;
      if (!watchedAt || !id || seen.has(id)) {
        return null;
      }
      seen.add(id);
      return {
        id,
        watchedAt,
        rating: normalizeUserRating(typeof item === 'object' ? item?.rating : null),
        note: normalizeText(typeof item === 'object' ? item?.note : '', 1000),
        createdAt
      };
    })
    .filter(Boolean)
    .sort((left, right) =>
      String(right.watchedAt || '').localeCompare(String(left.watchedAt || ''))
      || String(right.createdAt || '').localeCompare(String(left.createdAt || ''))
    )
    .slice(0, 80);
}

function ensureWatchEvent(events = [], watchedAt = '', timestamp = nowIso()) {
  const normalizedDate = normalizeWatchDate(watchedAt);
  const normalizedEvents = normalizeWatchEvents(events, timestamp);
  if (!normalizedDate) {
    return normalizedEvents;
  }
  return normalizeWatchEvents([...normalizedEvents, {
    id: createWatchEventId(normalizedDate, timestamp, normalizedEvents.length),
    watchedAt: normalizedDate,
    createdAt: timestamp
  }], timestamp);
}

function isAutoPrimaryWatchEvent(event = {}, previousDate = '') {
  const normalizedDate = normalizeWatchDate(previousDate);
  if (!normalizedDate || event.watchedAt !== normalizedDate) {
    return false;
  }
  return !normalizeText(event.note)
    && event.rating === null;
}

function replaceWatchEvent(events = [], previousWatchedAt = '', nextWatchedAt = '', timestamp = nowIso(), watchEventId = '') {
  const previousDate = normalizeWatchDate(previousWatchedAt);
  const nextDate = normalizeWatchDate(nextWatchedAt);
  const targetId = normalizeText(watchEventId, 120);
  const normalizedEvents = normalizeWatchEvents(events, timestamp);
  if (!nextDate) {
    return normalizedEvents;
  }
  if ((targetId && normalizedEvents.some((event) => event.id === targetId)) || (previousDate && normalizedEvents.some((event) => event.watchedAt === previousDate))) {
    return normalizeWatchEvents(normalizedEvents.map((event) =>
      (targetId ? event.id === targetId : event.watchedAt === previousDate)
        ? { ...event, watchedAt: nextDate, createdAt: event.createdAt || timestamp }
        : event
    ), timestamp);
  }
  return ensureWatchEvent(normalizedEvents, nextDate, timestamp);
}

function prunePrimaryWatchEvent(events = [], previousWatchedAt = '', watchEventId = '', timestamp = nowIso()) {
  const previousDate = normalizeWatchDate(previousWatchedAt);
  const targetId = normalizeText(watchEventId, 120);
  const normalizedEvents = normalizeWatchEvents(events, timestamp);
  if (!normalizedEvents.length) {
    return normalizedEvents;
  }
  if (targetId) {
    return normalizedEvents.filter((event) => event.id !== targetId);
  }
  if (previousDate) {
    const matchingIndexes = normalizedEvents
      .map((event, index) => ({ event, index }))
      .filter(({ event }) => isAutoPrimaryWatchEvent(event, previousDate));
    // Without an explicit watchEventId we only prune an unannotated sole match.
    // Multiple same-date events may be deliberate rewatch history, so preserve them.
    if (matchingIndexes.length === 1) {
      const [{ index: matchIndex }] = matchingIndexes;
      return normalizedEvents.filter((event, index) => index !== matchIndex);
    }
  }
  return normalizedEvents;
}

export function normalizeMovieCache(input = {}, timestamp = nowIso()) {
  const tmdbId = normalizeNumber(input.tmdbId, 0);
  if (!tmdbId) {
    throw new Error('tmdbId is required');
  }
  return {
    tmdbId,
    title: normalizeText(input.title, 240),
    originalTitle: normalizeText(input.originalTitle || input.title, 240),
    director: normalizeText(input.director, 240),
    overview: normalizeText(input.overview, 4000),
    posterPath: normalizeText(input.posterPath, 240),
    posterPaths: normalizeImagePathArray([input.posterPath, ...(Array.isArray(input.posterPaths) ? input.posterPaths : [])], 240),
    backdropPath: normalizeText(input.backdropPath, 240),
    backdropPaths: normalizeImagePathArray([input.backdropPath, ...(Array.isArray(input.backdropPaths) ? input.backdropPaths : [])], 240),
    releaseDate: normalizeText(input.releaseDate, 40),
    runtime: normalizeNumber(input.runtime, null),
    genres: normalizeStringArray(input.genres, 60),
    country: normalizeText(input.country, 120),
    language: normalizeText(input.language, 120),
    voteAverage: normalizeNumber(input.voteAverage, null),
    voteCount: normalizeNumber(input.voteCount, null),
    updatedAt: normalizeText(input.updatedAt || timestamp, 40),
  };
}

export function normalizeUserMovieEntry(input = {}, existing = null, timestamp = nowIso()) {
  const source = resolveEntrySource(input, existing);
  const tmdbId = source === 'tmdb'
    ? normalizeNumber(input.tmdbId ?? existing?.tmdbId, 0)
    : null;
  if (source === 'tmdb' && !tmdbId) {
    throw createStatusError('tmdbId is required', 400);
  }
  const watchStatus = normalizeText(hasOwn(input, 'watchStatus') ? input.watchStatus : existing?.watchStatus || 'wantToWatch');
  if (!WATCH_STATUSES.has(watchStatus)) {
    throw createStatusError('Unsupported watch state', 400);
  }
  const rating = hasOwn(input, 'userRating')
    ? normalizeUserRating(input.userRating, { strict: true })
    : normalizeUserRating(existing?.userRating);
  let watchedAt = hasOwn(input, 'watchedAt')
    ? normalizeText(input.watchedAt, 40)
    : normalizeText(existing?.watchedAt, 40);
  let watchEvents = normalizeWatchEvents(
    hasOwn(input, 'watchEvents') ? input.watchEvents : existing?.watchEvents,
    timestamp
  );
  if (hasOwn(input, 'appendWatchEvent')) {
    watchEvents = ensureWatchEvent(watchEvents, input.appendWatchEvent || watchedAt, timestamp);
  } else if (!hasOwn(input, 'watchEvents') && hasOwn(input, 'watchedAt') && !watchedAt) {
    // When the primary watched date is explicitly cleared, remove the auto-primary
    // event only. Other manually logged watches remain intact.
    watchEvents = prunePrimaryWatchEvent(watchEvents, existing?.watchedAt, input.watchEventId, timestamp);
  } else if (!hasOwn(input, 'watchEvents') && hasOwn(input, 'watchedAt') && watchedAt) {
    watchEvents = replaceWatchEvent(watchEvents, existing?.watchedAt, watchedAt, timestamp, input.watchEventId);
  } else if (watchStatus === 'watched' && watchedAt && watchEvents.length === 0) {
    watchEvents = ensureWatchEvent(watchEvents, watchedAt, timestamp);
  }
  const id = normalizeText(
    existing?.id
      || input.id
      || (tmdbId ? `tmdb-${tmdbId}` : createManualEntryId(timestamp)),
    120
  );
  return {
    id,
    source,
    tmdbId: source === 'tmdb' ? tmdbId : null,
    watchStatus,
    userRating: rating,
    note: normalizeText(input.note ?? existing?.note, 4000),
    journal: normalizeMultilineText(input.journal ?? input.noteMarkdown ?? existing?.journal ?? existing?.noteMarkdown, 12000),
    noteMarkdown: normalizeMultilineText(input.noteMarkdown ?? input.journal ?? existing?.noteMarkdown ?? existing?.journal, 12000),
    titleOverride: normalizeText(input.titleOverride ?? input.title ?? existing?.titleOverride, 240),
    originalTitleOverride: normalizeText(input.originalTitleOverride ?? input.originalTitle ?? existing?.originalTitleOverride, 240),
    directorOverride: normalizeText(input.directorOverride ?? input.director ?? existing?.directorOverride, 240),
    releaseDateOverride: normalizeText(input.releaseDateOverride ?? input.releaseDate ?? existing?.releaseDateOverride, 40),
    runtimeOverride: hasOwn(input, 'runtimeOverride')
      ? normalizeRuntimeOverride(input.runtimeOverride)
      : hasOwn(input, 'runtime')
      ? normalizeRuntimeOverride(input.runtime)
      : normalizeRuntimeOverride(existing?.runtimeOverride),
    genresOverride: normalizeStringArray(input.genresOverride ?? input.genres ?? existing?.genresOverride, 60),
    countryOverride: normalizeText(input.countryOverride ?? input.country ?? existing?.countryOverride, 120),
    languageOverride: normalizeText(input.languageOverride ?? input.language ?? existing?.languageOverride, 120),
    overviewOverride: normalizeText(input.overviewOverride ?? input.overview ?? existing?.overviewOverride, 4000),
    posterPathOverride: normalizeImagePathOverride(input.posterPathOverride ?? existing?.posterPathOverride),
    backdropPathOverride: normalizeImagePathOverride(input.backdropPathOverride ?? existing?.backdropPathOverride),
    posterUrlOverride: normalizeImageUrlOverride(input.posterUrlOverride ?? existing?.posterUrlOverride),
    backdropUrlOverride: normalizeImageUrlOverride(input.backdropUrlOverride ?? existing?.backdropUrlOverride),
    ...normalizeBackdropFrameOverrides(input, existing),
    tags: normalizeStringArray(input.tags ?? existing?.tags, 40),
    isFavorite: Boolean(input.isFavorite ?? existing?.isFavorite ?? false),
    watchedAt,
    watchEvents,
    createdAt: normalizeText(existing?.createdAt || input.createdAt || timestamp, 40),
    updatedAt: timestamp,
  };
}

function isCacheFresh(movieCache, timestamp = Date.now()) {
  if (!normalizeText(movieCache?.director)) {
    return false;
  }
  if (!Array.isArray(movieCache?.backdropPaths)) {
    return false;
  }
  if (!Array.isArray(movieCache?.posterPaths)) {
    return false;
  }
  const updatedTime = new Date(movieCache?.updatedAt || '').getTime();
  return Number.isFinite(updatedTime) && timestamp - updatedTime <= CACHE_TTL_MS;
}

function buildManualMovieFromEntry(entry = {}, timestamp = nowIso()) {
  return {
    source: 'manual',
    id: normalizeText(entry.id, 120),
    tmdbId: null,
    title: normalizeText(entry.titleOverride, 240) || 'Untitled film',
    originalTitle: normalizeText(entry.originalTitleOverride || entry.titleOverride, 240),
    director: normalizeText(entry.directorOverride, 240),
    overview: normalizeText(entry.overviewOverride, 4000),
    posterPath: normalizeImagePathOverride(entry.posterPathOverride),
    posterPaths: [],
    backdropPath: normalizeImagePathOverride(entry.backdropPathOverride),
    backdropPaths: [],
    posterUrl: normalizeImageUrlOverride(entry.posterUrlOverride),
    backdropUrl: normalizeImageUrlOverride(entry.backdropUrlOverride),
    releaseDate: normalizeText(entry.releaseDateOverride, 40),
    runtime: normalizeRuntimeOverride(entry.runtimeOverride),
    genres: normalizeStringArray(entry.genresOverride, 60),
    country: normalizeText(entry.countryOverride, 120),
    language: normalizeText(entry.languageOverride, 120),
    voteAverage: null,
    voteCount: null,
    updatedAt: normalizeText(entry.updatedAt || timestamp, 40),
  };
}

async function getRawMovieCache(db, tmdbId) {
  return parseJson(await db.get(cacheKey(tmdbId)), null);
}

async function putMovieCache(db, movie, timestamp = nowIso()) {
  const normalized = normalizeMovieCache(movie, timestamp);
  await db.put(cacheKey(normalized.tmdbId), JSON.stringify(normalized));
  return normalized;
}

async function getRawUserEntries(db) {
  const entries = parseJson(await db.get(USER_MOVIE_ENTRIES_KEY), []);
  return Array.isArray(entries) ? entries : [];
}

async function putUserEntries(db, entries, expectedLengthBeforeWrite = -1) {
  const normalized = Array.isArray(entries) ? entries : [];
  if (expectedLengthBeforeWrite >= 0) {
    // Optimistic check: re-read to detect concurrent write; KV has no CAS,
    // so this is a best-effort race guard rather than a true transaction.
    const currentStr = await db.get(USER_MOVIE_ENTRIES_KEY);
    let currentLength = 0;
    if (currentStr) {
      try { currentLength = JSON.parse(currentStr).length; } catch { currentLength = 0; }
    }
    if (currentLength !== expectedLengthBeforeWrite) {
      // Another request mutated the list between our read and this write — signal caller to retry.
      return false;
    }
  }
  await db.put(USER_MOVIE_ENTRIES_KEY, JSON.stringify(normalized));
  return normalized;
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  const runners = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(runners);
  return results;
}

async function hydrateEntries(db, entries, detailLoader = null) {
  return runWithConcurrency(entries, MOVIE_HYDRATE_CONCURRENCY, async (entry) => {
    if (entry?.source === 'manual' || !entry?.tmdbId) {
      return { entry, movie: buildManualMovieFromEntry(entry) };
    }
    let movie = await getRawMovieCache(db, entry.tmdbId);
    const needsDetailRefresh = movie
      && typeof detailLoader === 'function'
      && (!normalizeText(movie.director) || !Array.isArray(movie.backdropPaths) || !Array.isArray(movie.posterPaths));
    if (needsDetailRefresh) {
      try {
        movie = await detailLoader(entry.tmdbId);
      } catch {
        // Listing should remain local-first even if a director backfill request fails.
      }
    }
    return { entry, movie };
  });
}

export class MovieRepository {
  constructor(env = {}, options = {}) {
    this.env = env;
    this.client = options.client || new TMDbClient(env, options);
    this.db = options.db || null;
  }

  getDb() {
    return this.db || getDatabase(this.env);
  }

  async searchMovies(query, page = 1) {
    return this.client.searchMovies(query, page);
  }

  async warmup() {
    return this.client.warmup();
  }

  async getMovieDetail(tmdbId, { forceRefresh = false } = {}) {
    const db = this.getDb();
    const cached = await getRawMovieCache(db, tmdbId);
    if (!forceRefresh && cached && isCacheFresh(cached)) {
      return cached;
    }

    const remote = await this.client.movieDetail(tmdbId);
    return putMovieCache(db, remote);
  }

  async saveOrUpdateUserEntry(input = {}, _retries = 3) {
    const db = this.getDb();
    const timestamp = nowIso();
    const entries = await getRawUserEntries(db);
    const inputId = normalizeText(input.id);
    const inputTmdbId = normalizeNumber(input.tmdbId, 0);
    const index = entries.findIndex((entry) =>
      (inputTmdbId && Number(entry.tmdbId) === inputTmdbId)
      || (inputId && normalizeText(entry.id) === inputId)
    );
    const existingEntry = index >= 0 ? entries[index] : null;
    const source = resolveEntrySource(input, existingEntry);
    const tmdbId = source === 'tmdb'
      ? normalizeNumber(input.tmdbId ?? existingEntry?.tmdbId, 0)
      : 0;
    if (source === 'tmdb' && !tmdbId) {
      throw createStatusError('tmdbId is required', 400);
    }

    let movie = null;
    if (source === 'manual') {
      movie = null;
    } else if (input.movie) {
      const existingMovie = await getRawMovieCache(db, tmdbId);
      movie = await putMovieCache(db, {
        ...(existingMovie || {}),
        ...input.movie,
        director: normalizeText(input.movie.director) || normalizeText(existingMovie?.director),
      }, timestamp);
    } else {
      const existingMovie = await getRawMovieCache(db, tmdbId);
      movie = existingMovie
        ? normalizeMovieCache(existingMovie, existingMovie.updatedAt || timestamp)
        : await this.getMovieDetail(tmdbId);
    }

    const nextEntry = normalizeUserMovieEntry({ ...input, source, tmdbId: source === 'tmdb' ? tmdbId : null }, existingEntry, timestamp);
    if (source === 'manual' && !normalizeText(nextEntry.titleOverride || nextEntry.originalTitleOverride)) {
      throw createStatusError('Manual film title is required', 400);
    }
    if (source === 'manual') {
      movie = buildManualMovieFromEntry(nextEntry, timestamp);
    }
    const nextEntries = entries.slice();
    if (index >= 0) {
      nextEntries[index] = nextEntry;
    } else {
      nextEntries.unshift(nextEntry);
    }
    const putOk = await putUserEntries(db, nextEntries, entries.length);
    if (!putOk && _retries > 1) {
      return this.saveOrUpdateUserEntry(input, _retries - 1);
    }
    return { entry: nextEntry, movie };
  }

  async listUserEntries({ watchStatus = '' } = {}) {
    const db = this.getDb();
    const status = normalizeText(watchStatus);
    const entries = (await getRawUserEntries(db))
      .map((entry) => normalizeUserMovieEntry(entry, entry, entry.updatedAt || nowIso()))
      .filter((entry) => !status || entry.watchStatus === status)
      .sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')));
    return hydrateEntries(db, entries, (tmdbId) => this.getMovieDetail(tmdbId));
  }

  async deleteUserEntry(idOrTmdbId, _retries = 3) {
    const db = this.getDb();
    const target = normalizeText(idOrTmdbId);
    if (!target) {
      throw createStatusError('Movie entry id is required', 400);
    }
    const entries = await getRawUserEntries(db);
    const nextEntries = entries.filter((entry) =>
      normalizeText(entry.id) !== target && String(entry.tmdbId) !== target
    );
    const putOk = await putUserEntries(db, nextEntries, entries.length);
    if (!putOk && _retries > 1) {
      return this.deleteUserEntry(idOrTmdbId, _retries - 1);
    }
    return { deleted: nextEntries.length !== entries.length };
  }
}
