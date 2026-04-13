import assert from 'node:assert/strict';

import {
  applyPersistedAlbumFileMutation,
  buildAlbumStatePayload,
  createPersistedAlbum,
  deletePersistedAlbum,
  getPersistedAlbumFiles,
  getPersistedAlbumState,
  replacePersistedAlbumState,
} from '../functions/utils/albumsStore.js';
import { SqliteD1 } from '../server/sqliteD1.js';

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

  async getWithMetadata(key) {
    return { value: await this.get(key), metadata: null };
  }

  async delete(key) {
    this.store.delete(key);
  }

  async list() {
    return {
      keys: [...this.store.keys()].map((name) => ({ name })),
      list_complete: true,
      cursor: '',
    };
  }
}

function createFallbackEnv() {
  return { img_url: new MemoryKV() };
}

function createHybridEnv() {
  return {
    img_url: new MemoryKV(),
    img_d1: new SqliteD1(':memory:'),
  };
}

describe('albumsStore fallback persistence', () => {
  it('normalizes and deduplicates album state payloads', () => {
    const payload = buildAlbumStatePayload({
      albumNames: ['Trips', ' trips ', 'Family'],
      albumAssignments: {
        a1: 'Trips',
        a2: 'family ',
        '': 'ignored',
      },
      albumCovers: {
        TRIPS: 'a1',
        Family: 'a2',
      },
      favorites: ['a1', 'a1', 'a3'],
    });

    assert.deepEqual(payload.albumNames, ['Trips', 'Family']);
    assert.deepEqual(payload.albumAssignments, {
      a1: ['Trips'],
      a2: ['Family'],
    });
    assert.deepEqual(payload.albumCovers, {
      trips: 'a1',
      family: 'a2',
    });
    assert.deepEqual(payload.favorites, ['a1', 'a3']);
    assert.deepEqual(
      payload.albums.map((album) => ({ id: album.id, name: album.name, coverFileId: album.coverFileId })),
      [
        { id: '', name: 'Trips', coverFileId: 'a1' },
        { id: '', name: 'Family', coverFileId: 'a2' },
      ],
    );
  });

  it('round-trips fallback state through KV storage', async () => {
    const env = createFallbackEnv();

    await replacePersistedAlbumState(env, {
      albumNames: ['Trips'],
      albumAssignments: { fileA: 'Trips' },
      albumCovers: { trips: 'fileA' },
      favorites: ['fileB'],
    });

    const state = await getPersistedAlbumState(env);

    assert.deepEqual(state.albumNames, ['Trips']);
    assert.deepEqual(state.albumAssignments, { fileA: ['Trips'] });
    assert.deepEqual(state.albumCovers, { trips: 'fileA' });
    assert.deepEqual(state.favorites, ['fileB']);
    assert.equal(state.albums.length, 1);
    assert.equal(state.albums[0].name, 'Trips');
    assert.equal(state.albums[0].coverFileId, 'fileA');
  });

  it('supports replace/remove album file mutations and favorites mutations', async () => {
    const env = createFallbackEnv();

    await replacePersistedAlbumState(env, {
      albumNames: ['Trips', 'Family'],
      albumAssignments: {
        fileA: 'Trips',
        fileB: 'Trips',
        fileC: 'Family',
      },
      albumCovers: {
        trips: 'fileA',
        family: 'fileC',
      },
      favorites: ['fileA'],
    });

    await applyPersistedAlbumFileMutation(env, 'Trips', {
      mode: 'replace',
      fileIds: ['fileD'],
      coverFileId: null,
    });

    await applyPersistedAlbumFileMutation(env, '__favorites__', {
      mode: 'add',
      fileIds: ['fileD', 'fileE'],
    });

    await applyPersistedAlbumFileMutation(env, '__favorites__', {
      mode: 'remove',
      fileIds: ['fileA'],
    });

    const state = await getPersistedAlbumState(env);
    const tripsFiles = await getPersistedAlbumFiles(env, 'Trips');

    assert.deepEqual(state.albumAssignments, {
      fileC: ['Family'],
      fileD: ['Trips'],
    });
    assert.deepEqual(state.albumCovers, { family: 'fileC' });
    assert.deepEqual(state.favorites, ['fileD', 'fileE']);
    assert.equal(tripsFiles?.album?.name, 'Trips');
    assert.deepEqual(tripsFiles?.fileIds, ['fileD']);
  });

  it('creates and deletes albums case-insensitively without touching favorites', async () => {
    const env = createFallbackEnv();

    await replacePersistedAlbumState(env, {
      albumNames: ['Trips'],
      albumAssignments: { fileA: 'Trips' },
      albumCovers: { trips: 'fileA' },
      favorites: ['fileZ'],
    });

    await createPersistedAlbum(env, ' family ');
    await createPersistedAlbum(env, 'FAMILY');
    await deletePersistedAlbum(env, 'Trips');

    const state = await getPersistedAlbumState(env);
    const deletedAlbum = await getPersistedAlbumFiles(env, 'Trips');

    assert.deepEqual(state.albumNames, ['family']);
    assert.deepEqual(state.albumAssignments, {});
    assert.deepEqual(state.albumCovers, {});
    assert.deepEqual(state.favorites, ['fileZ']);
    assert.equal(deletedAlbum, null);
  });

  it('auto-migrates persisted album state from KV into D1 when album tables are empty', async () => {
    const env = createHybridEnv();

    await env.img_url.put('manage@sysConfig@mediaLibraryAlbums', JSON.stringify({
      albumNames: ['Trips'],
      albumAssignments: {
        fileA: ['Trips'],
      },
      albumCovers: {
        trips: 'fileA',
      },
      favorites: ['fileB'],
    }));

    const firstRead = await getPersistedAlbumState(env);
    const secondRead = await getPersistedAlbumState(env);

    assert.deepEqual(firstRead.albumNames, ['Trips']);
    assert.deepEqual(firstRead.albumAssignments, { fileA: ['Trips'] });
    assert.deepEqual(firstRead.albumCovers, { trips: 'fileA' });
    assert.deepEqual(firstRead.favorites, ['fileB']);
    assert.deepEqual(secondRead.albumNames, ['Trips']);
    assert.deepEqual(secondRead.albumAssignments, { fileA: ['Trips'] });
    assert.deepEqual(secondRead.albumCovers, { trips: 'fileA' });
    assert.deepEqual(secondRead.favorites, ['fileB']);
  });
});
