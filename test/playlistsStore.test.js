import assert from 'node:assert/strict';

import {
  applyPersistedPlaylistTrackMutation,
  createPersistedPlaylist,
  deletePersistedPlaylist,
  getPersistedPlaylistState,
  renamePersistedPlaylist,
  replacePersistedPlaylistState,
} from '../functions/utils/playlistsStore.js';
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

describe('playlistsStore persistence', () => {
  it('round-trips normalized playlist state through fallback KV storage', async () => {
    const env = createFallbackEnv();

    await replacePersistedPlaylistState(env, {
      playlistNames: ['Late Night', ' late night ', 'Focus'],
      playlistAssignments: {
        fileA: ['Late Night', 'Focus'],
        fileB: ' focus ',
        '': ['ignored'],
      },
    });

    const state = await getPersistedPlaylistState(env);

    assert.deepEqual(state.playlistNames, ['Late Night', 'Focus']);
    assert.deepEqual(state.playlistAssignments, {
      fileA: ['Late Night', 'Focus'],
      fileB: ['Focus'],
    });
  });

  it('creates, renames, mutates, and deletes playlists case-insensitively', async () => {
    const env = createFallbackEnv();

    await createPersistedPlaylist(env, 'Late Night');
    await createPersistedPlaylist(env, 'Focus');
    await applyPersistedPlaylistTrackMutation(env, 'late night', {
      action: 'add',
      fileIds: ['fileA', 'fileB'],
    });
    await renamePersistedPlaylist(env, 'Late Night', 'Moonlight');
    await applyPersistedPlaylistTrackMutation(env, 'Moonlight', {
      action: 'remove',
      fileIds: ['fileB'],
    });
    await deletePersistedPlaylist(env, 'FOCUS');

    const state = await getPersistedPlaylistState(env);

    assert.deepEqual(state.playlistNames, ['Moonlight']);
    assert.deepEqual(state.playlistAssignments, {
      fileA: ['Moonlight'],
    });
  });

  it('auto-migrates persisted playlist state from KV into D1 when available', async () => {
    const env = createHybridEnv();

    await env.img_url.put('manage@sysConfig@mediaLibraryPlaylists', JSON.stringify({
      playlistNames: ['Moonlight'],
      playlistAssignments: {
        fileA: ['Moonlight'],
      },
    }));

    const firstRead = await getPersistedPlaylistState(env);
    const secondRead = await getPersistedPlaylistState(env);

    assert.deepEqual(firstRead, {
      playlistNames: ['Moonlight'],
      playlistAssignments: {
        fileA: ['Moonlight'],
      },
    });
    assert.deepEqual(secondRead, firstRead);
  });
});
