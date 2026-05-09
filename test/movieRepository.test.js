import assert from 'node:assert/strict';

import { MovieRepository } from '../functions/utils/movieRepository.js';

class MemoryDB {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async put(key, value) {
    this.store.set(key, String(value));
  }

  async delete(key) {
    this.store.delete(key);
  }
}

function createMovie(overrides = {}) {
  return {
    tmdbId: 42,
    title: 'Movie',
    originalTitle: 'Movie',
    overview: 'Overview',
    posterPath: '/poster.jpg',
    backdropPath: '/backdrop.jpg',
    releaseDate: '2026-01-01',
    runtime: 100,
    genres: ['Drama'],
    director: 'Jane Director',
    voteAverage: 7.2,
    ...overrides,
  };
}

describe('MovieRepository', () => {
  it('caches detail requests and refreshes stale cache after seven days', async () => {
    const db = new MemoryDB();
    let detailCalls = 0;
    const repository = new MovieRepository({}, {
      db,
      client: {
        async searchMovies() {
          return { results: [] };
        },
        async movieDetail() {
          detailCalls += 1;
          return createMovie({ title: `Movie ${detailCalls}` });
        },
      },
    });

    const first = await repository.getMovieDetail(42);
    const second = await repository.getMovieDetail(42);

    assert.equal(first.title, 'Movie 1');
    assert.equal(second.title, 'Movie 1');
    assert.equal(detailCalls, 1);

    const stale = {
      ...second,
      updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    };
    await db.put('manage@sysConfig@movieCache@42', JSON.stringify(stale));

    const third = await repository.getMovieDetail(42);
    assert.equal(third.title, 'Movie 2');
    assert.equal(detailCalls, 2);
  });

  it('keeps MovieCache separate from UserMovieEntry when saving entries', async () => {
    const db = new MemoryDB();
    const repository = new MovieRepository({}, {
      db,
      client: {
        async searchMovies() {
          return { results: [] };
        },
        async movieDetail() {
          return createMovie();
        },
      },
    });

    const result = await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      watchStatus: 'watched',
      userRating: 4.5,
      note: 'My private note',
      tags: ['favorite'],
      isFavorite: true,
      watchedAt: '2026-05-09',
    });

    assert.equal(result.entry.watchStatus, 'watched');
    assert.equal(result.entry.userRating, 4.5);
    assert.equal(result.movie.title, 'Movie');

    const cachedMovie = JSON.parse(await db.get('manage@sysConfig@movieCache@42'));
    assert.equal(cachedMovie.title, 'Movie');
    assert.equal(cachedMovie.director, 'Jane Director');
    assert.equal(cachedMovie.userRating, undefined);
    assert.equal(cachedMovie.note, undefined);
    assert.equal(cachedMovie.watchStatus, undefined);

    const list = await repository.listUserEntries({ watchStatus: 'watched' });
    assert.equal(list.length, 1);
    assert.equal(list[0].entry.note, 'My private note');
    assert.equal(list[0].movie.title, 'Movie');
  });

  it('backfills missing directors while listing saved entries', async () => {
    const db = new MemoryDB();
    let detailCalls = 0;
    const repository = new MovieRepository({}, {
      db,
      client: {
        async movieDetail() {
          detailCalls += 1;
          return createMovie({ director: 'James Cameron' });
        },
      },
    });
    await db.put('manage@sysConfig@movieCache@42', JSON.stringify(createMovie({ director: '' })));
    await db.put('manage@sysConfig@userMovieEntries', JSON.stringify([{
      id: 'tmdb-42',
      tmdbId: 42,
      watchStatus: 'watched',
      userRating: null,
      note: '',
      tags: [],
      isFavorite: false,
      watchedAt: '2026-05-09',
      createdAt: '2026-05-09T00:00:00.000Z',
      updatedAt: '2026-05-09T00:00:00.000Z',
    }]));

    const list = await repository.listUserEntries();

    assert.equal(detailCalls, 1);
    assert.equal(list[0].movie.director, 'James Cameron');
  });

  it('validates five-star half-step user ratings and allows clearing them', async () => {
    const db = new MemoryDB();
    const repository = new MovieRepository({}, {
      db,
      client: {
        async movieDetail() {
          return createMovie({ voteAverage: 8.6 });
        },
      },
    });

    await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      watchStatus: 'watched',
      userRating: 4,
    });
    const updated = await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      watchStatus: 'watched',
      userRating: 4.5,
    });
    assert.equal(updated.entry.userRating, 4.5);

    await assert.rejects(
      () => repository.saveOrUpdateUserEntry({ tmdbId: 42, watchStatus: 'watched', userRating: 4.25 }),
      /userRating must be between 0\.5 and 5\.0/
    );
    await assert.rejects(
      () => repository.saveOrUpdateUserEntry({ tmdbId: 42, watchStatus: 'watched', userRating: 5.5 }),
      /userRating must be between 0\.5 and 5\.0/
    );

    const cleared = await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      watchStatus: 'watched',
      userRating: null,
    });
    assert.equal(cleared.entry.userRating, null);
    assert.equal(cleared.movie.voteAverage, 8.6);
  });

  it('deletes user entries without deleting cached movie data', async () => {
    const db = new MemoryDB();
    const repository = new MovieRepository({}, {
      db,
      client: {
        async movieDetail() {
          return createMovie();
        },
      },
    });

    await repository.saveOrUpdateUserEntry({ tmdbId: 42, watchStatus: 'wantToWatch' });
    const deleted = await repository.deleteUserEntry('tmdb-42');

    assert.deepEqual(deleted, { deleted: true });
    assert.deepEqual(await repository.listUserEntries(), []);
    assert.ok(await db.get('manage@sysConfig@movieCache@42'));
  });
});
