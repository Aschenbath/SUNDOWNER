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
    posterPaths: ['/poster.jpg'],
    backdropPath: '/backdrop.jpg',
    releaseDate: '2026-01-01',
    runtime: 100,
    genres: ['Drama'],
    country: 'United States',
    language: 'English',
    director: 'Jane Director',
    voteAverage: 7.2,
    backdropPaths: ['/backdrop.jpg'],
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
    assert.deepEqual(result.movie.posterPaths, ['/poster.jpg']);
    assert.deepEqual(result.movie.backdropPaths, ['/backdrop.jpg']);
    assert.equal(result.movie.country, 'United States');
    assert.equal(result.movie.language, 'English');

    const cachedMovie = JSON.parse(await db.get('manage@sysConfig@movieCache@42'));
    assert.equal(cachedMovie.title, 'Movie');
    assert.equal(cachedMovie.director, 'Jane Director');
    assert.deepEqual(cachedMovie.posterPaths, ['/poster.jpg']);
    assert.deepEqual(cachedMovie.backdropPaths, ['/backdrop.jpg']);
    assert.equal(cachedMovie.country, 'United States');
    assert.equal(cachedMovie.language, 'English');
    assert.equal(cachedMovie.userRating, undefined);
    assert.equal(cachedMovie.note, undefined);
    assert.equal(cachedMovie.watchStatus, undefined);
    assert.equal(cachedMovie.watchedAt, undefined);

    const list = await repository.listUserEntries({ watchStatus: 'watched' });
    assert.equal(list.length, 1);
    assert.equal(list[0].entry.note, 'My private note');
    assert.equal(list[0].entry.watchedAt, '2026-05-09');
    assert.deepEqual(list[0].entry.watchEvents.map((event) => event.watchedAt), ['2026-05-09']);
    assert.equal(list[0].movie.title, 'Movie');
  });

  it('tracks private watch history on UserMovieEntry without touching MovieCache', async () => {
    const db = new MemoryDB();
    const repository = new MovieRepository({}, {
      db,
      client: {
        async movieDetail() {
          return createMovie();
        },
      },
    });

    await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      watchStatus: 'watched',
      watchedAt: '2026-05-01',
    });
    const updated = await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      appendWatchEvent: '2026-05-10',
      watchedAt: '2026-05-10',
    });

    assert.equal(updated.entry.watchStatus, 'watched');
    assert.equal(updated.entry.watchedAt, '2026-05-10');
    assert.deepEqual(updated.entry.watchEvents.map((event) => event.watchedAt), ['2026-05-10', '2026-05-01']);
    assert.ok(updated.entry.watchEvents.every((event) => event.id && event.id.startsWith('watch-')));
    assert.ok(updated.entry.watchEvents.every((event) => Object.prototype.hasOwnProperty.call(event, 'rating')));
    assert.ok(updated.entry.watchEvents.every((event) => Object.prototype.hasOwnProperty.call(event, 'note')));

    const cachedMovie = JSON.parse(await db.get('manage@sysConfig@movieCache@42'));
    assert.equal(cachedMovie.watchEvents, undefined);
  });

  it('edits watch events by stable id instead of watched date only', async () => {
    const db = new MemoryDB();
    const repository = new MovieRepository({}, {
      db,
      client: {
        async movieDetail() {
          return createMovie();
        },
      },
    });

    await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      watchStatus: 'watched',
      watchedAt: '2026-05-01',
      watchEvents: [
        { id: 'watch-a', watchedAt: '2026-05-01', createdAt: '2026-05-01T00:00:00.000Z' },
        { id: 'watch-b', watchedAt: '2026-05-01', createdAt: '2026-05-01T01:00:00.000Z' },
      ],
    });

    const updated = await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      watchStatus: 'watched',
      watchedAt: '2026-05-03',
      watchEventId: 'watch-b',
    });

    assert.equal(updated.entry.watchEvents.find((event) => event.id === 'watch-a').watchedAt, '2026-05-01');
    assert.equal(updated.entry.watchEvents.find((event) => event.id === 'watch-b').watchedAt, '2026-05-03');
  });

  it('clears the primary watched date without deleting ambiguous manual watch events', async () => {
    const db = new MemoryDB();
    const repository = new MovieRepository({}, {
      db,
      client: {
        async movieDetail() {
          return createMovie();
        },
      },
    });

    await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      watchStatus: 'watched',
      watchedAt: '2026-05-01',
      watchEvents: [
        { id: 'manual-a', watchedAt: '2026-05-01', note: 'first watch', createdAt: '2026-05-01T00:00:00.000Z' },
        { id: 'manual-b', watchedAt: '2026-05-01', rating: 4.5, createdAt: '2026-05-01T01:00:00.000Z' },
      ],
    });

    const updated = await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      watchedAt: '',
    });

    assert.equal(updated.entry.watchedAt, '');
    assert.deepEqual(updated.entry.watchEvents.map((event) => event.id), ['manual-b', 'manual-a']);
  });

  it('supports distinct watchedAt clear and preserve semantics', async () => {
    const db = new MemoryDB();
    const repository = new MovieRepository({}, {
      db,
      client: {
        async movieDetail() {
          return createMovie();
        },
      },
    });

    await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      watchStatus: 'watched',
      watchedAt: '2026-05-01',
    });

    const preserved = await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      userRating: 4.1,
    });
    assert.equal(preserved.entry.watchedAt, '2026-05-01');
    assert.deepEqual(preserved.entry.watchEvents.map((event) => event.watchedAt), ['2026-05-01']);

    const clearedWithNull = await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      watchedAt: null,
    });
    assert.equal(clearedWithNull.entry.watchedAt, '');
    assert.deepEqual(clearedWithNull.entry.watchEvents, []);

    await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      watchStatus: 'watched',
      watchedAt: '2026-05-02',
    });

    const clearedWithEmptyString = await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      watchedAt: '',
    });
    assert.equal(clearedWithEmptyString.entry.watchedAt, '');
    assert.deepEqual(clearedWithEmptyString.entry.watchEvents, []);
  });

  it('stores manual metadata and image overrides on UserMovieEntry only', async () => {
    const db = new MemoryDB();
    const repository = new MovieRepository({}, {
      db,
      client: {
        async movieDetail() {
          return createMovie({ title: 'TMDb Title', director: 'TMDb Director' });
        },
      },
    });

    const result = await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      watchStatus: 'watched',
      titleOverride: 'Local Title',
      directorOverride: 'Local Director',
      releaseDateOverride: '2025-12-24',
      runtimeOverride: '123',
      genresOverride: ['Drama', 'War'],
      overviewOverride: 'Local synopsis.',
      posterPathOverride: '/local-poster.jpg',
      backdropPathOverride: '/local-backdrop.jpg',
      posterUrlOverride: 'https://example.com/poster.jpg',
      backdropUrlOverride: '/file/backdrop.jpg',
    });

    assert.equal(result.entry.titleOverride, 'Local Title');
    assert.equal(result.entry.directorOverride, 'Local Director');
    assert.equal(result.entry.runtimeOverride, 123);
    assert.deepEqual(result.entry.genresOverride, ['Drama', 'War']);
    assert.equal(result.entry.posterPathOverride, '/local-poster.jpg');
    assert.equal(result.entry.backdropPathOverride, '/local-backdrop.jpg');
    assert.equal(result.entry.posterUrlOverride, 'https://example.com/poster.jpg');
    assert.equal(result.entry.backdropUrlOverride, '/file/backdrop.jpg');

    const cachedMovie = JSON.parse(await db.get('manage@sysConfig@movieCache@42'));
    assert.equal(cachedMovie.title, 'TMDb Title');
    assert.equal(cachedMovie.director, 'TMDb Director');
    assert.equal(cachedMovie.titleOverride, undefined);
    assert.equal(cachedMovie.posterPathOverride, undefined);
    assert.equal(cachedMovie.posterUrlOverride, undefined);

    const list = await repository.listUserEntries();
    assert.equal(list[0].entry.titleOverride, 'Local Title');
    assert.equal(list[0].movie.title, 'TMDb Title');
  });

  it('supports true manual films without a TMDb id or MovieCache entry', async () => {
    const db = new MemoryDB();
    const repository = new MovieRepository({}, {
      db,
      client: {
        async movieDetail() {
          throw new Error('manual films should not load TMDb detail');
        },
      },
    });

    const result = await repository.saveOrUpdateUserEntry({
      source: 'manual',
      watchStatus: 'watched',
      titleOverride: 'Local Film',
      originalTitleOverride: '私人电影',
      directorOverride: 'Gilbert',
      releaseDateOverride: '2026-05-10',
      runtimeOverride: 88,
      genresOverride: ['Diary', 'Private'],
      overviewOverride: 'A private archive entry.',
      posterUrlOverride: 'https://example.com/manual-poster.jpg',
      watchedAt: '2026-05-10',
    });

    assert.equal(result.entry.source, 'manual');
    assert.equal(result.entry.tmdbId, null);
    assert.match(result.entry.id, /^manual-/);
    assert.equal(result.movie.source, 'manual');
    assert.equal(result.movie.title, 'Local Film');
    assert.equal(result.movie.director, 'Gilbert');
    assert.equal(result.movie.posterUrl, 'https://example.com/manual-poster.jpg');
    assert.equal(await db.get('manage@sysConfig@movieCache@0'), null);

    const list = await repository.listUserEntries();
    assert.equal(list.length, 1);
    assert.equal(list[0].entry.source, 'manual');
    assert.equal(list[0].movie.title, 'Local Film');

    const patched = await repository.saveOrUpdateUserEntry({
      source: 'manual',
      id: result.entry.id,
      userRating: 4.8,
      journal: 'Manual note',
    });
    assert.equal(patched.entry.userRating, 4.8);
    assert.equal(patched.entry.journal, 'Manual note');
    assert.equal(patched.entry.titleOverride, 'Local Film');

    const deleted = await repository.deleteUserEntry(result.entry.id);
    assert.deepEqual(deleted, { deleted: true });
    assert.deepEqual(await repository.listUserEntries(), []);
  });

  it('updates manual films by id without requiring source or tmdbId', async () => {
    const db = new MemoryDB();
    const repository = new MovieRepository({}, {
      db,
      client: {
        async movieDetail() {
          throw new Error('manual update should not load TMDb detail');
        },
      },
    });

    const saved = await repository.saveOrUpdateUserEntry({
      source: 'manual',
      watchStatus: 'wantToWatch',
      titleOverride: 'Manual One',
      countryOverride: 'Japan',
      languageOverride: 'Japanese',
      posterPathOverride: '/manual-poster.jpg',
      backdropUrlOverride: 'https://example.com/backdrop.jpg',
    });
    const updated = await repository.saveOrUpdateUserEntry({
      id: saved.entry.id,
      titleOverride: 'Manual Two',
      userRating: 4.1,
    });

    assert.equal(updated.entry.id, saved.entry.id);
    assert.equal(updated.entry.source, 'manual');
    assert.equal(updated.entry.tmdbId, null);
    assert.equal(updated.entry.titleOverride, 'Manual Two');
    assert.equal(updated.entry.countryOverride, 'Japan');
    assert.equal(updated.entry.languageOverride, 'Japanese');
    assert.equal(updated.entry.posterPathOverride, '/manual-poster.jpg');
    assert.equal(updated.entry.backdropUrlOverride, 'https://example.com/backdrop.jpg');
    assert.equal(updated.movie.title, 'Manual Two');
    assert.equal(updated.movie.country, 'Japan');
    assert.equal(updated.movie.language, 'Japanese');

    const list = await repository.listUserEntries();
    assert.equal(list.length, 1);
    assert.equal(list[0].entry.id, saved.entry.id);
    assert.equal(list[0].movie.title, 'Manual Two');
  });

  it('keeps existing TMDb entries as TMDb when patching by id without tmdbId', async () => {
    const db = new MemoryDB();
    const repository = new MovieRepository({}, {
      db,
      client: {
        async movieDetail() {
          return createMovie();
        },
      },
    });

    await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      watchStatus: 'wantToWatch',
    });
    const updated = await repository.saveOrUpdateUserEntry({
      id: 'tmdb-42',
      userRating: 4.2,
    });

    assert.equal(updated.entry.id, 'tmdb-42');
    assert.equal(updated.entry.source, 'tmdb');
    assert.equal(updated.entry.tmdbId, 42);
    assert.equal(updated.entry.userRating, 4.2);
    assert.equal(updated.movie.title, 'Movie');
  });

  it('treats explicit manual source as local even if a tmdbId is accidentally present', async () => {
    const db = new MemoryDB();
    const repository = new MovieRepository({}, {
      db,
      client: {
        async movieDetail() {
          throw new Error('manual source should not fetch TMDb detail');
        },
      },
    });

    const saved = await repository.saveOrUpdateUserEntry({
      source: 'manual',
      tmdbId: 42,
      titleOverride: 'Manual With Stray Id',
    });

    assert.equal(saved.entry.source, 'manual');
    assert.equal(saved.entry.tmdbId, null);
    assert.equal(saved.movie.source, 'manual');
    assert.equal(saved.movie.tmdbId, null);
    assert.equal(await db.get('manage@sysConfig@movieCache@42'), null);
  });

  it('normalizes poster and backdrop path choices on MovieCache only', async () => {
    const db = new MemoryDB();
    const repository = new MovieRepository({}, {
      db,
      client: {
        async movieDetail() {
          return createMovie({
            posterPath: '/primary-poster.jpg',
            posterPaths: ['/alt-poster.jpg', '/primary-poster.jpg'],
            backdropPath: '/primary-backdrop.jpg',
            backdropPaths: ['/alt-backdrop.jpg', '/primary-backdrop.jpg'],
          });
        },
      },
    });

    const result = await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      watchStatus: 'wantToWatch',
    });

    assert.deepEqual(result.movie.posterPaths, ['/primary-poster.jpg', '/alt-poster.jpg']);
    assert.deepEqual(result.movie.backdropPaths, ['/primary-backdrop.jpg', '/alt-backdrop.jpg']);

    const cachedMovie = JSON.parse(await db.get('manage@sysConfig@movieCache@42'));
    assert.deepEqual(cachedMovie.posterPaths, ['/primary-poster.jpg', '/alt-poster.jpg']);
    assert.deepEqual(cachedMovie.backdropPaths, ['/primary-backdrop.jpg', '/alt-backdrop.jpg']);
    assert.equal(cachedMovie.posterUrlOverride, undefined);
    assert.equal(result.entry.posterUrlOverride, '');
  });

  it('clears TMDb path and custom URL image overrides independently from MovieCache', async () => {
    const db = new MemoryDB();
    const repository = new MovieRepository({}, {
      db,
      client: {
        async movieDetail() {
          return createMovie({ posterPath: '/tmdb-poster.jpg', backdropPath: '/tmdb-backdrop.jpg' });
        },
      },
    });

    const saved = await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      watchStatus: 'wantToWatch',
      posterPathOverride: '/chosen-poster.jpg',
      backdropPathOverride: '/chosen-backdrop.jpg',
      posterUrlOverride: 'https://example.com/poster.jpg',
      backdropUrlOverride: '/file/backdrop.jpg',
      backdropZoomOverride: 0.52,
      backdropPositionXOverride: 62,
      backdropPositionYOverride: 31,
      backdropOpacityOverride: 0.41,
    });
    assert.equal(saved.entry.posterPathOverride, '/chosen-poster.jpg');
    assert.equal(saved.entry.backdropPathOverride, '/chosen-backdrop.jpg');
    assert.equal(saved.entry.posterUrlOverride, 'https://example.com/poster.jpg');
    assert.equal(saved.entry.backdropUrlOverride, '/file/backdrop.jpg');
    assert.equal(saved.entry.backdropZoomOverride, 0.52);
    assert.equal(saved.entry.backdropPositionXOverride, 62);
    assert.equal(saved.entry.backdropPositionYOverride, 31);
    assert.equal(saved.entry.backdropOpacityOverride, 0.41);

    const reset = await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      posterPathOverride: '',
      backdropPathOverride: '',
      posterUrlOverride: '',
      backdropUrlOverride: '',
      backdropZoomOverride: 0.5,
      backdropPositionXOverride: 50,
      backdropPositionYOverride: 50,
      backdropOpacityOverride: 0.92,
    });
    assert.equal(reset.entry.posterPathOverride, '');
    assert.equal(reset.entry.backdropPathOverride, '');
    assert.equal(reset.entry.posterUrlOverride, '');
    assert.equal(reset.entry.backdropUrlOverride, '');
    assert.equal(reset.entry.backdropZoomOverride, 0.5);
    assert.equal(reset.entry.backdropPositionXOverride, 50);
    assert.equal(reset.entry.backdropPositionYOverride, 50);
    assert.equal(reset.entry.backdropOpacityOverride, 0.92);

    const cachedMovie = JSON.parse(await db.get('manage@sysConfig@movieCache@42'));
    assert.equal(cachedMovie.posterPath, '/tmdb-poster.jpg');
    assert.equal(cachedMovie.backdropPath, '/tmdb-backdrop.jpg');
    assert.equal(cachedMovie.posterPathOverride, undefined);
    assert.equal(cachedMovie.backdropUrlOverride, undefined);
  });

  it('maps legacy saved backdrop defaults to the new calm frame defaults', async () => {
    const db = new MemoryDB();
    const repository = new MovieRepository({}, {
      db,
      client: {
        async movieDetail() {
          return createMovie();
        },
      },
    });

    const saved = await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      watchStatus: 'wantToWatch',
      backdropZoomOverride: 1.02,
      backdropPositionXOverride: 50,
      backdropPositionYOverride: 50,
      backdropOpacityOverride: 0.66,
    });

    assert.equal(saved.entry.backdropZoomOverride, 0.5);
    assert.equal(saved.entry.backdropPositionXOverride, 50);
    assert.equal(saved.entry.backdropPositionYOverride, 50);
    assert.equal(saved.entry.backdropOpacityOverride, 0.92);

    const adjusted = await repository.saveOrUpdateUserEntry({
      tmdbId: 43,
      watchStatus: 'wantToWatch',
      backdropZoomOverride: 1.02,
      backdropPositionXOverride: 48,
      backdropPositionYOverride: 50,
      backdropOpacityOverride: 0.66,
    });

    assert.equal(adjusted.entry.backdropZoomOverride, 1.02);
    assert.equal(adjusted.entry.backdropPositionXOverride, 48);
    assert.equal(adjusted.entry.backdropOpacityOverride, 0.66);
  });

  it('preserves image path and URL overrides when later TMDb data is saved', async () => {
    const db = new MemoryDB();
    const repository = new MovieRepository({}, {
      db,
      client: {
        async movieDetail() {
          return createMovie({ posterPath: '/original-poster.jpg', backdropPath: '/original-backdrop.jpg' });
        },
      },
    });

    await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      watchStatus: 'watched',
      posterPathOverride: '/chosen-poster.jpg',
      backdropPathOverride: '/chosen-backdrop.jpg',
      posterUrlOverride: 'https://example.com/poster.jpg',
      backdropUrlOverride: '/file/custom-backdrop.jpg',
      backdropZoomOverride: 1.33,
      backdropPositionXOverride: 41,
      backdropPositionYOverride: 64,
      backdropOpacityOverride: 0.57,
      journal: 'private note',
    });
    const refreshed = await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      movie: createMovie({
        title: 'Fresh TMDb Title',
        posterPath: '/fresh-poster.jpg',
        backdropPath: '/fresh-backdrop.jpg',
      }),
    });

    assert.equal(refreshed.entry.posterPathOverride, '/chosen-poster.jpg');
    assert.equal(refreshed.entry.backdropPathOverride, '/chosen-backdrop.jpg');
    assert.equal(refreshed.entry.posterUrlOverride, 'https://example.com/poster.jpg');
    assert.equal(refreshed.entry.backdropUrlOverride, '/file/custom-backdrop.jpg');
    assert.equal(refreshed.entry.backdropZoomOverride, 1.33);
    assert.equal(refreshed.entry.backdropPositionXOverride, 41);
    assert.equal(refreshed.entry.backdropPositionYOverride, 64);
    assert.equal(refreshed.entry.backdropOpacityOverride, 0.57);
    assert.equal(refreshed.entry.journal, 'private note');

    const cachedMovie = JSON.parse(await db.get('manage@sysConfig@movieCache@42'));
    assert.equal(cachedMovie.title, 'Fresh TMDb Title');
    assert.equal(cachedMovie.posterPath, '/fresh-poster.jpg');
    assert.equal(cachedMovie.backdropPath, '/fresh-backdrop.jpg');
    assert.equal(cachedMovie.posterPathOverride, undefined);
    assert.equal(cachedMovie.backdropUrlOverride, undefined);
  });

  it('backfills ids for legacy watch events and preserves them on later saves', async () => {
    const db = new MemoryDB();
    const repository = new MovieRepository({}, {
      db,
      client: {
        async movieDetail() {
          return createMovie();
        },
      },
    });

    const saved = await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      watchStatus: 'watched',
      watchedAt: '2026-05-01',
      watchEvents: [{ watchedAt: '2026-05-01', createdAt: '2026-05-01T00:00:00.000Z' }],
    });
    const legacyId = saved.entry.watchEvents[0].id;
    assert.ok(legacyId.startsWith('watch-'));

    const updated = await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      watchedAt: '2026-05-10',
      appendWatchEvent: '2026-05-10',
    });

    assert.equal(updated.entry.watchEvents.find((event) => event.watchedAt === '2026-05-01').id, legacyId);
    assert.ok(updated.entry.watchEvents.find((event) => event.watchedAt === '2026-05-10').id.startsWith('watch-'));
  });

  it('rejects blank manual films before they become useless entries', async () => {
    const db = new MemoryDB();
    const repository = new MovieRepository({}, { db, client: {} });

    await assert.rejects(
      () => repository.saveOrUpdateUserEntry({ source: 'manual', watchStatus: 'wantToWatch', titleOverride: '' }),
      /Manual film title is required/
    );
    assert.deepEqual(await repository.listUserEntries(), []);
  });

  it('rejects unsupported watch statuses without writing partial entries', async () => {
    const db = new MemoryDB();
    const repository = new MovieRepository({}, {
      db,
      client: {
        async movieDetail() {
          return createMovie();
        },
      },
    });

    await assert.rejects(
      () => repository.saveOrUpdateUserEntry({ tmdbId: 42, watchStatus: 'archived' }),
      /Unsupported watch state/
    );
    assert.deepEqual(await repository.listUserEntries(), []);
  });

  it('drops unsafe manual image override protocols while preserving valid file URLs', async () => {
    const db = new MemoryDB();
    const repository = new MovieRepository({}, { db, client: {} });

    const saved = await repository.saveOrUpdateUserEntry({
      source: 'manual',
      titleOverride: 'Local Film',
      posterUrlOverride: 'javascript:alert(1)',
      backdropUrlOverride: '/file/manual-backdrop.jpg',
      posterPathOverride: '/file/not-a-tmdb-path.jpg',
      backdropPathOverride: 'https://example.com/not-a-path.jpg',
    });

    assert.equal(saved.entry.posterUrlOverride, '');
    assert.equal(saved.entry.backdropUrlOverride, '/file/manual-backdrop.jpg');
    assert.equal(saved.entry.posterPathOverride, '');
    assert.equal(saved.entry.backdropPathOverride, '');
    assert.equal(saved.movie.posterUrl, '');
    assert.equal(saved.movie.backdropUrl, '/file/manual-backdrop.jpg');
  });

  it('deletes TMDb user entries by numeric id string without deleting cached movie data', async () => {
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
    const deleted = await repository.deleteUserEntry('42');

    assert.deepEqual(deleted, { deleted: true });
    assert.deepEqual(await repository.listUserEntries(), []);
    assert.ok(await db.get('manage@sysConfig@movieCache@42'));
  });

  it('preserves local entry fields when patching only metadata overrides', async () => {
    const db = new MemoryDB();
    const repository = new MovieRepository({}, {
      db,
      client: {
        async movieDetail() {
          return createMovie();
        },
      },
    });

    await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      watchStatus: 'watched',
      userRating: 4.7,
      isFavorite: true,
      watchedAt: '2026-05-09',
      journal: 'Saved note',
    });
    const patched = await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      titleOverride: 'Local Title',
    });

    assert.equal(patched.entry.watchStatus, 'watched');
    assert.equal(patched.entry.userRating, 4.7);
    assert.equal(patched.entry.isFavorite, true);
    assert.equal(patched.entry.watchedAt, '2026-05-09');
    assert.equal(patched.entry.journal, 'Saved note');
    assert.equal(patched.entry.titleOverride, 'Local Title');
  });

  it('clears metadata overrides when empty override fields are explicitly saved', async () => {
    const db = new MemoryDB();
    const repository = new MovieRepository({}, {
      db,
      client: {
        async movieDetail() {
          return createMovie({
            title: 'TMDb Title',
            originalTitle: 'TMDb Original',
            director: 'TMDb Director',
            overview: 'TMDb overview',
            releaseDate: '2026-01-01',
            runtime: 100,
            genres: ['Drama'],
            country: 'France',
            language: 'French',
          });
        },
      },
    });

    await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      watchStatus: 'watched',
      userRating: 4.6,
      journal: 'Private note',
      titleOverride: 'Local Title',
      originalTitleOverride: 'Local Original',
      directorOverride: 'Local Director',
      releaseDateOverride: '2026-05-10',
      runtimeOverride: 123,
      genresOverride: ['Diary', 'War'],
      countryOverride: 'Local Country',
      languageOverride: 'Local Language',
      overviewOverride: 'Local overview',
    });

    const cleared = await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      titleOverride: '',
      originalTitleOverride: '',
      directorOverride: '',
      releaseDateOverride: '',
      runtimeOverride: '',
      genresOverride: '',
      countryOverride: '',
      languageOverride: '',
      overviewOverride: '',
    });

    assert.equal(cleared.entry.watchStatus, 'watched');
    assert.equal(cleared.entry.userRating, 4.6);
    assert.equal(cleared.entry.journal, 'Private note');
    assert.equal(cleared.entry.titleOverride, '');
    assert.equal(cleared.entry.originalTitleOverride, '');
    assert.equal(cleared.entry.directorOverride, '');
    assert.equal(cleared.entry.releaseDateOverride, '');
    assert.equal(cleared.entry.runtimeOverride, null);
    assert.deepEqual(cleared.entry.genresOverride, []);
    assert.equal(cleared.entry.countryOverride, '');
    assert.equal(cleared.entry.languageOverride, '');
    assert.equal(cleared.entry.overviewOverride, '');
    assert.equal(cleared.movie.title, 'TMDb Title');
    assert.equal(cleared.movie.director, 'TMDb Director');
    assert.equal(cleared.movie.overview, 'TMDb overview');
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

  it('preserves cached directors when saving user rating updates with partial movie payloads', async () => {
    const db = new MemoryDB();
    const repository = new MovieRepository({}, { db, client: {} });
    await db.put('manage@sysConfig@movieCache@42', JSON.stringify(createMovie({ director: 'James Cameron' })));

    const result = await repository.saveOrUpdateUserEntry({
      tmdbId: 42,
      watchStatus: 'watched',
      userRating: 5,
      movie: createMovie({ director: '' }),
    });

    const cachedMovie = JSON.parse(await db.get('manage@sysConfig@movieCache@42'));
    assert.equal(result.movie.director, 'James Cameron');
    assert.equal(cachedMovie.director, 'James Cameron');
  });

  it('validates five-star tenth-step user ratings and allows clearing them', async () => {
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
      userRating: 4.7,
    });
    assert.equal(updated.entry.userRating, 4.7);

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
