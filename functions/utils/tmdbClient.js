const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';

function normalizeText(value, maxLength = 0) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  return maxLength > 0 ? normalized.slice(0, maxLength) : normalized;
}

function normalizeNumber(value, fallback = null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeGenres(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => typeof entry === 'string' ? entry : entry?.name)
    .map((entry) => normalizeText(entry, 60))
    .filter(Boolean);
}

function resolveAccessToken(env = {}) {
  return normalizeText(env.TMDB_ACCESS_TOKEN || env.TMDB_API_TOKEN || '');
}

function resolveApiKey(env = {}) {
  return normalizeText(env.TMDB_API_KEY || '');
}

function buildTmdbUrl(pathname, params = {}) {
  const url = new URL(`${TMDB_API_BASE_URL}${pathname}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

async function fetchTmdbJson(env, pathname, params = {}, fetchImpl = fetch) {
  const accessToken = resolveAccessToken(env);
  const apiKey = resolveApiKey(env);
  if (!accessToken && !apiKey) {
    throw new Error('TMDb credentials are not configured. Set TMDB_ACCESS_TOKEN or TMDB_API_KEY.');
  }

  const requestParams = apiKey && !accessToken
    ? { ...params, api_key: apiKey }
    : params;
  const requestHeaders = {
    Accept: 'application/json',
  };
  if (accessToken) {
    requestHeaders.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetchImpl(buildTmdbUrl(pathname, requestParams), {
    headers: {
      ...requestHeaders,
    },
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = normalizeText(payload?.status_message || payload?.error || '');
    throw new Error(message || `TMDb request failed with ${response.status}`);
  }

  return payload || {};
}

export function normalizeTmdbMovie(dto = {}) {
  const tmdbId = normalizeNumber(dto.id, 0);
  if (!tmdbId) {
    return null;
  }
  const directors = Array.isArray(dto.credits?.crew)
    ? dto.credits.crew
      .filter((person) => normalizeText(person?.job, 80) === 'Director')
      .map((person) => normalizeText(person?.name, 120))
      .filter(Boolean)
    : [];

  return {
    tmdbId,
    title: normalizeText(dto.title || dto.name, 240),
    originalTitle: normalizeText(dto.original_title || dto.original_name || dto.title || dto.name, 240),
    director: directors.slice(0, 3).join(' / '),
    overview: normalizeText(dto.overview, 4000),
    posterPath: normalizeText(dto.poster_path, 240),
    backdropPath: normalizeText(dto.backdrop_path, 240),
    releaseDate: normalizeText(dto.release_date || dto.first_air_date, 40),
    runtime: normalizeNumber(dto.runtime, null),
    genres: normalizeGenres(dto.genres || dto.genre_names),
    voteAverage: normalizeNumber(dto.vote_average, null),
    voteCount: normalizeNumber(dto.vote_count, null),
  };
}

export function normalizeTmdbSearchResult(dto = {}) {
  const movie = normalizeTmdbMovie(dto);
  if (!movie) {
    return null;
  }
  return {
    ...movie,
    runtime: null,
    genres: [],
  };
}

export class TMDbClient {
  constructor(env = {}, options = {}) {
    this.env = env;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  async warmup() {
    await fetchTmdbJson(this.env, '/configuration', {}, this.fetchImpl);
    return { warmed: true };
  }

  async searchMovies(query, page = 1) {
    const normalizedQuery = normalizeText(query, 160);
    if (!normalizedQuery) {
      return {
        page: 1,
        totalPages: 0,
        totalResults: 0,
        results: [],
      };
    }

    const payload = await fetchTmdbJson(this.env, '/search/movie', {
      query: normalizedQuery,
      page: Math.max(1, normalizeNumber(page, 1)),
      include_adult: 'false',
    }, this.fetchImpl);

    return {
      page: normalizeNumber(payload.page, 1),
      totalPages: normalizeNumber(payload.total_pages, 0),
      totalResults: normalizeNumber(payload.total_results, 0),
      results: (Array.isArray(payload.results) ? payload.results : [])
        .map(normalizeTmdbSearchResult)
        .filter(Boolean),
    };
  }

  async movieDetail(tmdbId) {
    const normalizedId = normalizeNumber(tmdbId, 0);
    if (!normalizedId) {
      throw new Error('TMDb movie id is required');
    }

    const payload = await fetchTmdbJson(this.env, `/movie/${encodeURIComponent(String(normalizedId))}`, {
      append_to_response: 'credits',
    }, this.fetchImpl);
    const movie = normalizeTmdbMovie(payload);
    if (!movie) {
      throw new Error('Invalid TMDb movie detail payload');
    }
    return movie;
  }
}
