import assert from 'node:assert/strict';

import { onRequest } from '../functions/api/manage/movies.js';

class MemoryKV {
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

  async getWithMetadata(key) {
    return { value: await this.get(key), metadata: null };
  }

  async list() {
    return { keys: [], list_complete: true, cursor: '' };
  }
}

describe('manage movies route', () => {
  it('returns a clear 503 when searching without TMDb credentials', async () => {
    const response = await onRequest({
      request: new Request('https://example.com/api/manage/movies?action=search&q=yi+yi'),
      env: { img_url: new MemoryKV() },
    });

    const payload = await response.json();
    assert.equal(response.status, 503);
    assert.match(payload.error, /TMDb credentials are not configured/);
  });

  it('passes TMDb search pagination through the route', async () => {
    let receivedPage = 0;
    const response = await onRequest({
      request: new Request('https://example.com/api/manage/movies?action=search&q=movie&page=3'),
      env: { img_url: new MemoryKV() },
      repository: {
        async searchMovies(query, page) {
          receivedPage = page;
          return {
            page,
            totalPages: 5,
            totalResults: 91,
            results: [{ tmdbId: 42, title: query }],
          };
        },
      },
    });

    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(receivedPage, 3);
    assert.equal(payload.page, 3);
    assert.equal(payload.totalPages, 5);
    assert.equal(payload.totalResults, 91);
  });

  it('passes warmup requests through without touching search or entries', async () => {
    let warmupCalled = false;
    const response = await onRequest({
      request: new Request('https://example.com/api/manage/movies?action=warmup'),
      env: { img_url: new MemoryKV() },
      repository: {
        async warmup() {
          warmupCalled = true;
          return { warmed: true };
        },
      },
    });

    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(warmupCalled, true);
    assert.deepEqual(payload, { warmed: true });
  });

  it('rejects unsupported entry status filters before listing', async () => {
    const response = await onRequest({
      request: new Request('https://example.com/api/manage/movies?action=entries&status=archived'),
      env: { img_url: new MemoryKV() },
      repository: {
        async listUserEntries() {
          throw new Error('list should not run for invalid status');
        },
      },
    });

    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.equal(payload.error, 'Unsupported watchStatus');
  });

  it('maps invalid JSON bodies to a 400 response', async () => {
    const response = await onRequest({
      request: new Request('https://example.com/api/manage/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{bad json',
      }),
      env: { img_url: new MemoryKV() },
      repository: {
        async saveOrUpdateUserEntry() {
          throw new Error('save should not run for invalid json');
        },
      },
    });

    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.equal(payload.error, 'Invalid JSON');
  });

  it('lists locally saved movie entries', async () => {
    const env = { img_url: new MemoryKV() };
    await env.img_url.put('manage@sysConfig@movieCache@42', JSON.stringify({
      tmdbId: 42,
      title: 'Movie',
      originalTitle: 'Movie',
      overview: '',
      posterPath: '',
      posterPaths: ['/cached-poster.jpg'],
      backdropPath: '',
      backdropPaths: ['/cached-backdrop.jpg'],
      releaseDate: '2026-01-01',
      runtime: 100,
      genres: ['Drama'],
      voteAverage: 7,
      voteCount: 1200,
      updatedAt: new Date().toISOString(),
    }));
    await env.img_url.put('manage@sysConfig@userMovieEntries', JSON.stringify([{
      id: 'tmdb-42',
      tmdbId: 42,
      watchStatus: 'watched',
      userRating: 4.5,
      note: 'local only',
      tags: [],
      isFavorite: false,
      watchedAt: '2026-05-09',
      createdAt: '2026-05-09T00:00:00.000Z',
      updatedAt: '2026-05-09T00:00:00.000Z',
    }]));

    const response = await onRequest({
      request: new Request('https://example.com/api/manage/movies?action=entries&status=watched'),
      env,
    });

    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.entries.length, 1);
    assert.equal(payload.entries[0].entry.note, 'local only');
    assert.equal(payload.entries[0].entry.userRating, 4.5);
    assert.equal(payload.entries[0].movie.voteAverage, 7);
    assert.equal(payload.entries[0].movie.voteCount, 1200);
    assert.equal(payload.entries[0].movie.title, 'Movie');
    assert.deepEqual(payload.entries[0].movie.posterPaths, ['/cached-poster.jpg']);
    assert.deepEqual(payload.entries[0].movie.backdropPaths, ['/cached-backdrop.jpg']);
  });

  it('persists local movie metadata overrides through the route entry payload', async () => {
    const env = { img_url: new MemoryKV() };
    await env.img_url.put('manage@sysConfig@movieCache@42', JSON.stringify({
      tmdbId: 42,
      title: 'TMDb Movie',
      originalTitle: 'TMDb Movie',
      overview: '',
      posterPath: '/poster.jpg',
      backdropPath: '/backdrop.jpg',
      releaseDate: '2026-01-01',
      runtime: 100,
      genres: ['Drama'],
      director: 'TMDb Director',
      voteAverage: 7,
      voteCount: 1200,
      updatedAt: new Date().toISOString(),
    }));
    await env.img_url.put('manage@sysConfig@userMovieEntries', JSON.stringify([{
      id: 'tmdb-42',
      tmdbId: 42,
      watchStatus: 'watched',
      userRating: null,
      note: '',
      journal: '',
      noteMarkdown: '',
      tags: [],
      isFavorite: false,
      watchedAt: '2026-05-09',
      createdAt: '2026-05-09T00:00:00.000Z',
      updatedAt: '2026-05-09T00:00:00.000Z',
    }]));

    const response = await onRequest({
      request: new Request('https://example.com/api/manage/movies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId: 42,
          titleOverride: 'Local Movie',
          posterPathOverride: '/chosen-poster.jpg',
          backdropPathOverride: '/chosen-backdrop.jpg',
          posterUrlOverride: 'https://example.com/poster.jpg',
          backdropUrlOverride: '/file/backdrop.jpg',
        }),
      }),
      env,
    });

    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.entry.titleOverride, 'Local Movie');
    assert.equal(payload.entry.watchStatus, 'watched');
    assert.equal(payload.entry.watchedAt, '2026-05-09');
    assert.equal(payload.entry.posterPathOverride, '/chosen-poster.jpg');
    assert.equal(payload.entry.backdropPathOverride, '/chosen-backdrop.jpg');
    assert.equal(payload.entry.posterUrlOverride, 'https://example.com/poster.jpg');
    assert.equal(payload.entry.backdropUrlOverride, '/file/backdrop.jpg');
    assert.equal(payload.movie.title, 'TMDb Movie');
    assert.equal(payload.movie.posterPathOverride, undefined);
    assert.equal(payload.movie.posterUrlOverride, undefined);
  });

  it('passes forceRefresh through detail requests', async () => {
    let receivedForceRefresh = false;
    const response = await onRequest({
      request: new Request('https://example.com/api/manage/movies?action=detail&tmdbId=42&forceRefresh=1'),
      env: { img_url: new MemoryKV() },
      repository: {
        async getMovieDetail(tmdbId, options = {}) {
          receivedForceRefresh = options.forceRefresh === true;
          return {
            tmdbId,
            title: 'Fresh Movie',
            originalTitle: 'Fresh Movie',
            overview: '',
            posterPath: '',
            backdropPath: '',
            backdropPaths: [],
            releaseDate: '',
            runtime: null,
            genres: [],
            voteAverage: null,
            voteCount: null,
            updatedAt: new Date().toISOString(),
          };
        },
      },
    });

    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(receivedForceRefresh, true);
    assert.equal(payload.movie.title, 'Fresh Movie');
  });

  it('appends private watch history through the route entry payload', async () => {
    const env = { img_url: new MemoryKV() };
    await env.img_url.put('manage@sysConfig@movieCache@42', JSON.stringify({
      tmdbId: 42,
      title: 'TMDb Movie',
      originalTitle: 'TMDb Movie',
      overview: '',
      posterPath: '/poster.jpg',
      backdropPath: '/backdrop.jpg',
      releaseDate: '2026-01-01',
      runtime: 100,
      genres: ['Drama'],
      director: 'TMDb Director',
      voteAverage: 7,
      voteCount: 1200,
      updatedAt: new Date().toISOString(),
    }));
    await env.img_url.put('manage@sysConfig@userMovieEntries', JSON.stringify([{
      id: 'tmdb-42',
      tmdbId: 42,
      watchStatus: 'watched',
      watchedAt: '2026-05-01',
      watchEvents: [{ watchedAt: '2026-05-01', createdAt: '2026-05-01T00:00:00.000Z' }],
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    }]));

    const response = await onRequest({
      request: new Request('https://example.com/api/manage/movies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId: 42,
          watchedAt: '2026-05-10',
          appendWatchEvent: '2026-05-10',
        }),
      }),
      env,
    });

    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.entry.watchedAt, '2026-05-10');
    assert.deepEqual(payload.entry.watchEvents.map((event) => event.watchedAt), ['2026-05-10', '2026-05-01']);
    assert.ok(payload.entry.watchEvents.every((event) => event.id));
    assert.equal(payload.movie.watchEvents, undefined);
  });

  it('edits private watch history by watch event id through the route', async () => {
    const env = { img_url: new MemoryKV() };
    await env.img_url.put('manage@sysConfig@movieCache@42', JSON.stringify({
      tmdbId: 42,
      title: 'TMDb Movie',
      originalTitle: 'TMDb Movie',
      overview: '',
      posterPath: '/poster.jpg',
      backdropPath: '/backdrop.jpg',
      releaseDate: '2026-01-01',
      runtime: 100,
      genres: ['Drama'],
      director: 'TMDb Director',
      voteAverage: 7,
      voteCount: 1200,
      updatedAt: new Date().toISOString(),
    }));
    await env.img_url.put('manage@sysConfig@userMovieEntries', JSON.stringify([{
      id: 'tmdb-42',
      tmdbId: 42,
      watchStatus: 'watched',
      watchedAt: '2026-05-01',
      watchEvents: [
        { id: 'watch-a', watchedAt: '2026-05-01', createdAt: '2026-05-01T00:00:00.000Z' },
        { id: 'watch-b', watchedAt: '2026-05-01', createdAt: '2026-05-01T01:00:00.000Z' },
      ],
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    }]));

    const response = await onRequest({
      request: new Request('https://example.com/api/manage/movies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId: 42,
          watchedAt: '2026-05-03',
          watchEventId: 'watch-b',
        }),
      }),
      env,
    });

    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.entry.watchEvents.find((event) => event.id === 'watch-a').watchedAt, '2026-05-01');
    assert.equal(payload.entry.watchEvents.find((event) => event.id === 'watch-b').watchedAt, '2026-05-03');
  });

  it('persists manual films without requiring TMDb credentials or cache', async () => {
    const env = { img_url: new MemoryKV() };
    const response = await onRequest({
      request: new Request('https://example.com/api/manage/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'manual',
          watchStatus: 'wantToWatch',
          titleOverride: 'Manual Movie',
          directorOverride: 'Local Director',
          releaseDateOverride: '2026-05-10',
          genresOverride: ['Diary'],
          posterUrlOverride: 'https://example.com/poster.jpg',
        }),
      }),
      env,
    });

    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.entry.source, 'manual');
    assert.equal(payload.entry.tmdbId, null);
    assert.equal(payload.entry.titleOverride, 'Manual Movie');
    assert.equal(payload.movie.title, 'Manual Movie');
    assert.equal(payload.movie.posterUrl, 'https://example.com/poster.jpg');

    const listResponse = await onRequest({
      request: new Request('https://example.com/api/manage/movies?action=entries'),
      env,
    });
    const listPayload = await listResponse.json();
    assert.equal(listPayload.entries.length, 1);
    assert.equal(listPayload.entries[0].entry.source, 'manual');
    assert.equal(listPayload.entries[0].movie.title, 'Manual Movie');
  });

  it('updates and deletes manual films by local id through the route', async () => {
    const env = { img_url: new MemoryKV() };
    const createResponse = await onRequest({
      request: new Request('https://example.com/api/manage/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'manual',
          watchStatus: 'wantToWatch',
          titleOverride: 'Manual Movie',
          posterPathOverride: '/manual-poster.jpg',
        }),
      }),
      env,
    });
    const created = await createResponse.json();
    assert.equal(createResponse.status, 200);

    const updateResponse = await onRequest({
      request: new Request('https://example.com/api/manage/movies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: created.entry.id,
          titleOverride: 'Updated Manual Movie',
          userRating: 4.4,
        }),
      }),
      env,
    });
    const updated = await updateResponse.json();
    assert.equal(updateResponse.status, 200);
    assert.equal(updated.entry.id, created.entry.id);
    assert.equal(updated.entry.source, 'manual');
    assert.equal(updated.entry.tmdbId, null);
    assert.equal(updated.entry.titleOverride, 'Updated Manual Movie');
    assert.equal(updated.entry.posterPathOverride, '/manual-poster.jpg');
    assert.equal(updated.movie.title, 'Updated Manual Movie');

    const deleteResponse = await onRequest({
      request: new Request(`https://example.com/api/manage/movies?id=${encodeURIComponent(created.entry.id)}`, {
        method: 'DELETE',
      }),
      env,
    });
    const deleted = await deleteResponse.json();
    assert.equal(deleteResponse.status, 200);
    assert.deepEqual(deleted, { deleted: true });

    const listResponse = await onRequest({
      request: new Request('https://example.com/api/manage/movies?action=entries'),
      env,
    });
    const listPayload = await listResponse.json();
    assert.equal(listPayload.entries.length, 0);
  });

  it('rejects blank manual films through the route', async () => {
    const env = { img_url: new MemoryKV() };
    const response = await onRequest({
      request: new Request('https://example.com/api/manage/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'manual',
          watchStatus: 'wantToWatch',
          titleOverride: '',
        }),
      }),
      env,
    });

    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.match(payload.error, /Manual film title is required/);
  });
});
