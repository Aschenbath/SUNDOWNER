import assert from 'node:assert/strict';

import { TMDbClient, normalizeTmdbMovie } from '../functions/utils/tmdbClient.js';

describe('TMDbClient', () => {
  it('normalizes TMDb movie DTOs without mixing user fields', () => {
    const movie = normalizeTmdbMovie({
      id: 550,
      title: 'Fight Club',
      original_title: 'Fight Club',
      overview: 'A detail payload',
      poster_path: '/poster.jpg',
      backdrop_path: '/backdrop.jpg',
      release_date: '1999-10-15',
      runtime: 139,
      genres: [{ id: 18, name: 'Drama' }],
      production_countries: [{ iso_3166_1: 'US', name: 'United States of America' }],
      spoken_languages: [{ iso_639_1: 'en', english_name: 'English' }],
      original_language: 'en',
      vote_average: 8.4,
      vote_count: 26000,
      userRating: 10,
      watchStatus: 'watched',
    });

    assert.deepEqual(movie, {
      tmdbId: 550,
      title: 'Fight Club',
      originalTitle: 'Fight Club',
      director: '',
      overview: 'A detail payload',
      posterPath: '/poster.jpg',
      posterPaths: ['/poster.jpg'],
      backdropPath: '/backdrop.jpg',
      backdropPaths: ['/backdrop.jpg'],
      releaseDate: '1999-10-15',
      runtime: 139,
      genres: ['Drama'],
      country: 'United States of America',
      language: 'English',
      voteAverage: 8.4,
      voteCount: 26000,
    });
  });

  it('requires TMDb credentials before remote requests', async () => {
    const client = new TMDbClient({}, {
      fetchImpl: async () => {
        throw new Error('fetch should not run');
      },
    });

    await assert.rejects(
      () => client.searchMovies('yi yi'),
      /TMDb credentials are not configured/
    );
  });

  it('returns an empty search result for blank queries without requiring credentials', async () => {
    const client = new TMDbClient({}, {
      fetchImpl: async () => {
        throw new Error('fetch should not run for blank search');
      },
    });

    assert.deepEqual(await client.searchMovies('   '), {
      page: 1,
      totalPages: 0,
      totalResults: 0,
      results: [],
    });
  });

  it('searches movies with bearer token and normalized results', async () => {
    const calls = [];
    const client = new TMDbClient({ TMDB_ACCESS_TOKEN: 'token-123' }, {
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              page: 1,
              total_pages: 1,
              total_results: 1,
              results: [{
                id: 129,
                title: 'Spirited Away',
                original_title: '鍗冦仺鍗冨皨銇闅犮仐',
                poster_path: '/poster.jpg',
                release_date: '2001-07-20',
                vote_average: 8.5,
                vote_count: 12000,
              }],
            };
          },
        };
      },
    });

    const result = await client.searchMovies('spirited away', 2);

    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/search\/movie/);
    assert.equal(calls[0].options.headers.Authorization, 'Bearer token-123');
    assert.equal(new URL(calls[0].url).searchParams.get('query'), 'spirited away');
    assert.equal(new URL(calls[0].url).searchParams.get('page'), '2');
    assert.deepEqual(result.results, [{
      tmdbId: 129,
      title: 'Spirited Away',
      originalTitle: '鍗冦仺鍗冨皨銇闅犮仐',
      director: '',
      overview: '',
      posterPath: '/poster.jpg',
      posterPaths: ['/poster.jpg'],
      backdropPath: '',
      backdropPaths: [],
      releaseDate: '2001-07-20',
      runtime: null,
      genres: [],
      country: '',
      language: '',
      voteAverage: 8.5,
      voteCount: 12000,
    }]);
  });

  it('trims search queries and clamps invalid pages before remote requests', async () => {
    const calls = [];
    const client = new TMDbClient({ TMDB_ACCESS_TOKEN: 'token-123' }, {
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return {
          ok: true,
          status: 200,
          async json() {
            return { page: 1, total_pages: 0, total_results: 0, results: [] };
          },
        };
      },
    });

    await client.searchMovies('  movie title  ', -3);

    const url = new URL(calls[0].url);
    assert.equal(url.searchParams.get('query'), 'movie title');
    assert.equal(url.searchParams.get('page'), '1');
    assert.equal(url.searchParams.get('include_adult'), 'false');
  });

  it('surfaces TMDb error payload messages', async () => {
    const client = new TMDbClient({ TMDB_ACCESS_TOKEN: 'token-123' }, {
      fetchImpl: async () => ({
        ok: false,
        status: 401,
        async json() {
          return { status_message: 'Invalid API key' };
        },
      }),
    });

    await assert.rejects(
      () => client.searchMovies('movie'),
      /Invalid API key/
    );
  });

  it('supports TMDB_API_KEY when a v4 access token is not configured', async () => {
    const calls = [];
    const client = new TMDbClient({ TMDB_API_KEY: 'key-123' }, {
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return {
          ok: true,
          status: 200,
          async json() {
            return { page: 1, total_pages: 0, total_results: 0, results: [] };
          },
        };
      },
    });

    await client.searchMovies('鑺辨牱骞村崕');

    const url = new URL(calls[0].url);
    assert.equal(url.searchParams.get('api_key'), 'key-123');
    assert.equal(calls[0].options.headers.Authorization, undefined);
  });

  it('warms TMDb configuration without fetching search results', async () => {
    const calls = [];
    const client = new TMDbClient({ TMDB_ACCESS_TOKEN: 'token-123' }, {
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return {
          ok: true,
          status: 200,
          async json() {
            return { images: { base_url: 'https://image.tmdb.org/t/p/' } };
          },
        };
      },
    });

    const result = await client.warmup();
    const url = new URL(calls[0].url);

    assert.deepEqual(result, { warmed: true });
    assert.equal(calls.length, 1);
    assert.match(url.pathname, /\/configuration$/);
    assert.equal(url.searchParams.get('query'), null);
    assert.equal(calls[0].options.headers.Authorization, 'Bearer token-123');
  });

  it('requests movie detail credits and normalizes directors', async () => {
    const calls = [];
    const client = new TMDbClient({ TMDB_ACCESS_TOKEN: 'token-123' }, {
      fetchImpl: async (url) => {
        calls.push(url);
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              id: 597,
              title: 'Titanic',
              original_title: 'Titanic',
              backdrop_path: '/primary.jpg',
              poster_path: '/primary-poster.jpg',
              images: {
                posters: [
                  { file_path: '/small-poster.jpg', vote_average: 4, vote_count: 1, width: 500 },
                  { file_path: '/best-poster.jpg', vote_average: 8, vote_count: 10, width: 1000 },
                  { file_path: '/primary-poster.jpg', vote_average: 9, vote_count: 20, width: 1000 },
                ],
                backdrops: [
                  { file_path: '/muted.jpg', vote_average: 4, vote_count: 1, width: 1920 },
                  { file_path: '/wide.jpg', vote_average: 8, vote_count: 12, width: 1920 },
                  { file_path: '/primary.jpg', vote_average: 9, vote_count: 20, width: 1920 },
                ],
              },
              credits: {
                crew: [
                  { job: 'Director', name: 'James Cameron' },
                  { job: 'Producer', name: 'Jon Landau' },
                ],
              },
            };
          },
        };
      },
    });

    const movie = await client.movieDetail(597);
    const detailUrl = new URL(calls[0]);

    assert.equal(detailUrl.searchParams.get('append_to_response'), 'credits,images');
    assert.equal(detailUrl.searchParams.get('include_image_language'), 'null,en');
    assert.equal(movie.director, 'James Cameron');
    assert.deepEqual(movie.posterPaths, ['/primary-poster.jpg', '/best-poster.jpg', '/small-poster.jpg']);
    assert.deepEqual(movie.backdropPaths, ['/primary.jpg', '/wide.jpg', '/muted.jpg']);
  });
});
