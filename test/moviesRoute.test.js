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

  it('lists locally saved movie entries', async () => {
    const env = { img_url: new MemoryKV() };
    await env.img_url.put('manage@sysConfig@movieCache@42', JSON.stringify({
      tmdbId: 42,
      title: 'Movie',
      originalTitle: 'Movie',
      overview: '',
      posterPath: '',
      backdropPath: '',
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
    assert.equal(payload.entry.posterUrlOverride, 'https://example.com/poster.jpg');
    assert.equal(payload.entry.backdropUrlOverride, '/file/backdrop.jpg');
    assert.equal(payload.movie.title, 'TMDb Movie');
    assert.equal(payload.movie.posterUrlOverride, undefined);
  });
});
