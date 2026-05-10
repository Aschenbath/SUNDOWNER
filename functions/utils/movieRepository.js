import { getDatabase } from './databaseAdapter.js';
import { TMDbClient } from './tmdbClient.js';

const MOVIE_CACHE_KEY_PREFIX = 'manage@sysConfig@movieCache@';
const USER_MOVIE_ENTRIES_KEY = 'manage@sysConfig@userMovieEntries';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const WATCH_STATUSES = new Set(['wantToWatch', 'watching', 'watched', 'paused', 'dropped']);

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
  if (normalized.startsWith('/')) {
    return normalized;
  }
  try {
    const url = new URL(normalized);
    return url.protocol === 'http:' || url.protocol === 'https:' ? normalized : '';
  } catch {
    return '';
  }
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
    .map((item) => {
      const watchedAt = normalizeWatchDate(typeof item === 'string' ? item : item?.watchedAt || item?.date);
      if (!watchedAt || seen.has(watchedAt)) {
        return null;
      }
      seen.add(watchedAt);
      return {
        watchedAt,
        createdAt: normalizeText(typeof item === 'object' ? item?.createdAt : '', 40) || timestamp
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
  if (!normalizedDate || normalizedEvents.some((event) => event.watchedAt === normalizedDate)) {
    return normalizedEvents;
  }
  return normalizeWatchEvents([...normalizedEvents, { watchedAt: normalizedDate, createdAt: timestamp }], timestamp);
}

function replaceWatchEvent(events = [], previousWatchedAt = '', nextWatchedAt = '', timestamp = nowIso()) {
  const previousDate = normalizeWatchDate(previousWatchedAt);
  const nextDate = normalizeWatchDate(nextWatchedAt);
  const normalizedEvents = normalizeWatchEvents(events, timestamp);
  if (!nextDate) {
    return normalizedEvents;
  }
  if (previousDate && previousDate !== nextDate && normalizedEvents.some((event) => event.watchedAt === previousDate)) {
    return normalizeWatchEvents(normalizedEvents.map((event) =>
      event.watchedAt === previousDate
        ? { ...event, watchedAt: nextDate, createdAt: event.createdAt || timestamp }
        : event
    ), timestamp);
  }
  return ensureWatchEvent(normalizedEvents, nextDate, timestamp);
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
    voteAverage: normalizeNumber(input.voteAverage, null),
    voteCount: normalizeNumber(input.voteCount, null),
    updatedAt: normalizeText(input.updatedAt || timestamp, 40),
  };
}

export function normalizeUserMovieEntry(input = {}, existing = null, timestamp = nowIso()) {
  const tmdbId = normalizeNumber(input.tmdbId ?? existing?.tmdbId, 0);
  if (!tmdbId) {
    throw new Error('tmdbId is required');
  }
  const watchStatus = normalizeText(hasOwn(input, 'watchStatus') ? input.watchStatus : existing?.watchStatus || 'wantToWatch');
  if (!WATCH_STATUSES.has(watchStatus)) {
    throw new Error('Unsupported watchStatus');
  }
  const rating = hasOwn(input, 'userRating')
    ? normalizeUserRating(input.userRating, { strict: true })
    : normalizeUserRating(existing?.userRating);
  const watchedAt = normalizeText(input.watchedAt ?? existing?.watchedAt, 40);
  let watchEvents = normalizeWatchEvents(
    hasOwn(input, 'watchEvents') ? input.watchEvents : existing?.watchEvents,
    timestamp
  );
  if (hasOwn(input, 'appendWatchEvent')) {
    watchEvents = ensureWatchEvent(watchEvents, input.appendWatchEvent || watchedAt, timestamp);
  } else if (hasOwn(input, 'watchedAt') && watchedAt) {
    watchEvents = replaceWatchEvent(watchEvents, existing?.watchedAt, watchedAt, timestamp);
  } else if (watchStatus === 'watched' && watchedAt && watchEvents.length === 0) {
    watchEvents = ensureWatchEvent(watchEvents, watchedAt, timestamp);
  }
  return {
    id: normalizeText(existing?.id || input.id || `tmdb-${tmdbId}`, 120),
    tmdbId,
    watchStatus,
    userRating: rating,
    note: normalizeText(input.note ?? existing?.note, 4000),
    journal: normalizeMultilineText(input.journal ?? input.noteMarkdown ?? existing?.journal ?? existing?.noteMarkdown, 12000),
    noteMarkdown: normalizeMultilineText(input.noteMarkdown ?? input.journal ?? existing?.noteMarkdown ?? existing?.journal, 12000),
    titleOverride: normalizeText(input.titleOverride ?? existing?.titleOverride, 240),
    originalTitleOverride: normalizeText(input.originalTitleOverride ?? existing?.originalTitleOverride, 240),
    directorOverride: normalizeText(input.directorOverride ?? existing?.directorOverride, 240),
    releaseDateOverride: normalizeText(input.releaseDateOverride ?? existing?.releaseDateOverride, 40),
    runtimeOverride: hasOwn(input, 'runtimeOverride')
      ? normalizeRuntimeOverride(input.runtimeOverride)
      : normalizeRuntimeOverride(existing?.runtimeOverride),
    genresOverride: normalizeStringArray(input.genresOverride ?? existing?.genresOverride, 60),
    overviewOverride: normalizeText(input.overviewOverride ?? existing?.overviewOverride, 4000),
    posterUrlOverride: normalizeImageUrlOverride(input.posterUrlOverride ?? existing?.posterUrlOverride),
    backdropUrlOverride: normalizeImageUrlOverride(input.backdropUrlOverride ?? existing?.backdropUrlOverride),
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
  const updatedTime = new Date(movieCache?.updatedAt || '').getTime();
  return Number.isFinite(updatedTime) && timestamp - updatedTime <= CACHE_TTL_MS;
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

async function putUserEntries(db, entries) {
  const normalized = Array.isArray(entries) ? entries : [];
  await db.put(USER_MOVIE_ENTRIES_KEY, JSON.stringify(normalized));
  return normalized;
}

async function hydrateEntries(db, entries, detailLoader = null) {
  const hydrated = [];
  for (const entry of entries) {
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
    hydrated.push({ entry, movie });
  }
  return hydrated;
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

  async saveOrUpdateUserEntry(input = {}) {
    const db = this.getDb();
    const timestamp = nowIso();
    const tmdbId = normalizeNumber(input.tmdbId, 0);
    if (!tmdbId) {
      throw new Error('tmdbId is required');
    }

    let movie = null;
    if (input.movie) {
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

    const entries = await getRawUserEntries(db);
    const index = entries.findIndex((entry) => Number(entry.tmdbId) === tmdbId);
    const nextEntry = normalizeUserMovieEntry(input, index >= 0 ? entries[index] : null, timestamp);
    const nextEntries = entries.slice();
    if (index >= 0) {
      nextEntries[index] = nextEntry;
    } else {
      nextEntries.unshift(nextEntry);
    }
    await putUserEntries(db, nextEntries);
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

  async deleteUserEntry(idOrTmdbId) {
    const db = this.getDb();
    const target = normalizeText(idOrTmdbId);
    if (!target) {
      throw new Error('Movie entry id is required');
    }
    const entries = await getRawUserEntries(db);
    const nextEntries = entries.filter((entry) =>
      normalizeText(entry.id) !== target && String(entry.tmdbId) !== target
    );
    await putUserEntries(db, nextEntries);
    return { deleted: nextEntries.length !== entries.length };
  }
}
