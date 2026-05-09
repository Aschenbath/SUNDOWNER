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
      vote_average: 8.4,
      vote_count: 26000,
      userRating: 10,
      watchStatus: 'watched',
    });

    assert.deepEqual(movie, {
      tmdbId: 550,
      title: 'Fight Club',
      originalTitle: 'Fight Club',
      overview: 'A detail payload',
      posterPath: '/poster.jpg',
      backdropPath: '/backdrop.jpg',
      releaseDate: '1999-10-15',
      runtime: 139,
      genres: ['Drama'],
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
                original_title: '千と千尋の神隠し',
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
      originalTitle: '千と千尋の神隠し',
      overview: '',
      posterPath: '/poster.jpg',
      backdropPath: '',
      releaseDate: '2001-07-20',
      runtime: null,
      genres: [],
      voteAverage: 8.5,
      voteCount: 12000,
    }]);
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

    await client.searchMovies('花样年华');

    const url = new URL(calls[0].url);
    assert.equal(url.searchParams.get('api_key'), 'key-123');
    assert.equal(calls[0].options.headers.Authorization, undefined);
  });
});
