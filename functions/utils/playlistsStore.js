import { getDatabase } from './databaseAdapter.js';

const PLAYLIST_STORAGE_KEY = 'manage@sysConfig@mediaLibraryPlaylists';

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizePlaylistName(value) {
  return normalizeText(value).slice(0, 80);
}

function normalizePlaylistLookup(value) {
  return normalizePlaylistName(value).toLowerCase();
}

function normalizeFileId(value) {
  return normalizeText(value);
}

function dedupePlaylistNames(values = []) {
  const seen = new Set();
  const names = [];
  values.forEach((rawValue) => {
    const playlistName = normalizePlaylistName(rawValue);
    const lookup = normalizePlaylistLookup(playlistName);
    if (!playlistName || seen.has(lookup)) {
      return;
    }
    seen.add(lookup);
    names.push(playlistName);
  });
  return names;
}

function createEmptyPlaylistState() {
  return {
    playlistNames: [],
    playlistAssignments: {},
  };
}

function normalizePlaylistStatePayload(input = {}) {
  const playlistNames = dedupePlaylistNames(input.playlistNames || []);
  const canonicalByLookup = new Map(
    playlistNames.map((playlistName) => [normalizePlaylistLookup(playlistName), playlistName])
  );
  const playlistAssignments = {};

  Object.entries(input.playlistAssignments || {}).forEach(([fileId, value]) => {
    const normalizedFileId = normalizeFileId(fileId);
    if (!normalizedFileId) {
      return;
    }
    const names = Array.isArray(value) ? value : [value];
    const canonicalNames = dedupePlaylistNames(names)
      .map((name) => canonicalByLookup.get(normalizePlaylistLookup(name)) || '')
      .filter(Boolean);
    if (canonicalNames.length) {
      playlistAssignments[normalizedFileId] = canonicalNames;
    }
  });

  return {
    playlistNames,
    playlistAssignments,
  };
}

async function savePlaylistState(env, nextState) {
  const db = getDatabase(env);
  const normalized = normalizePlaylistStatePayload(nextState);
  await db.put(PLAYLIST_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export async function getPersistedPlaylistState(env) {
  const db = getDatabase(env);
  const rawValue = await db.get(PLAYLIST_STORAGE_KEY);
  if (!rawValue) {
    return createEmptyPlaylistState();
  }
  try {
    return normalizePlaylistStatePayload(JSON.parse(rawValue));
  } catch {
    return createEmptyPlaylistState();
  }
}

export async function replacePersistedPlaylistState(env, nextState) {
  return savePlaylistState(env, nextState);
}

export async function createPersistedPlaylist(env, name) {
  const playlistName = normalizePlaylistName(name);
  if (!playlistName) {
    throw new Error('Playlist name is required');
  }
  const state = await getPersistedPlaylistState(env);
  if (state.playlistNames.some((entry) => normalizePlaylistLookup(entry) === normalizePlaylistLookup(playlistName))) {
    throw new Error('A playlist with that name already exists');
  }
  return savePlaylistState(env, {
    ...state,
    playlistNames: [...state.playlistNames, playlistName],
  });
}

export async function renamePersistedPlaylist(env, playlistIdOrName, newName) {
  const target = normalizeText(playlistIdOrName);
  const nextName = normalizePlaylistName(newName);
  if (!target || !nextName) {
    throw new Error('Playlist name is required');
  }
  const state = await getPersistedPlaylistState(env);
  const existingName = state.playlistNames.find((entry) =>
    normalizePlaylistLookup(entry) === normalizePlaylistLookup(target)
  );
  if (!existingName) {
    throw new Error('Playlist not found');
  }
  if (state.playlistNames.some((entry) =>
    normalizePlaylistLookup(entry) === normalizePlaylistLookup(nextName)
    && normalizePlaylistLookup(entry) !== normalizePlaylistLookup(existingName)
  )) {
    throw new Error('A playlist with that name already exists');
  }
  const oldLookup = normalizePlaylistLookup(existingName);
  const playlistAssignments = Object.fromEntries(
    Object.entries(state.playlistAssignments).map(([fileId, value]) => {
      const names = (Array.isArray(value) ? value : [value]).map((entry) =>
        normalizePlaylistLookup(entry) === oldLookup ? nextName : entry
      );
      return [fileId, dedupePlaylistNames(names)];
    }).filter(([, value]) => value.length)
  );
  return savePlaylistState(env, {
    playlistNames: state.playlistNames.map((entry) =>
      normalizePlaylistLookup(entry) === oldLookup ? nextName : entry
    ),
    playlistAssignments,
  });
}

export async function deletePersistedPlaylist(env, playlistIdOrName) {
  const target = normalizeText(playlistIdOrName);
  if (!target) {
    throw new Error('Playlist not found');
  }
  const state = await getPersistedPlaylistState(env);
  const existingName = state.playlistNames.find((entry) =>
    normalizePlaylistLookup(entry) === normalizePlaylistLookup(target)
  );
  if (!existingName) {
    throw new Error('Playlist not found');
  }
  const targetLookup = normalizePlaylistLookup(existingName);
  const playlistAssignments = Object.fromEntries(
    Object.entries(state.playlistAssignments).map(([fileId, value]) => {
      const names = (Array.isArray(value) ? value : [value]).filter((entry) =>
        normalizePlaylistLookup(entry) !== targetLookup
      );
      return [fileId, dedupePlaylistNames(names)];
    }).filter(([, value]) => value.length)
  );
  return savePlaylistState(env, {
    playlistNames: state.playlistNames.filter((entry) => normalizePlaylistLookup(entry) !== targetLookup),
    playlistAssignments,
  });
}

export async function applyPersistedPlaylistTrackMutation(env, playlistIdOrName, mutation = {}) {
  const target = normalizeText(playlistIdOrName);
  if (!target) {
    throw new Error('Playlist not found');
  }
  const state = await getPersistedPlaylistState(env);
  const existingName = state.playlistNames.find((entry) =>
    normalizePlaylistLookup(entry) === normalizePlaylistLookup(target)
  );
  if (!existingName) {
    throw new Error('Playlist not found');
  }

  const action = normalizeText(mutation.action || 'add').toLowerCase();
  const fileIds = [...new Set((Array.isArray(mutation.fileIds) ? mutation.fileIds : []).map(normalizeFileId).filter(Boolean))];
  if (!fileIds.length) {
    throw new Error('At least one fileId is required');
  }

  const playlistAssignments = { ...state.playlistAssignments };
  const targetLookup = normalizePlaylistLookup(existingName);

  fileIds.forEach((fileId) => {
    const existing = dedupePlaylistNames(playlistAssignments[fileId] || []);
    let nextNames = existing;
    if (action === 'remove') {
      nextNames = existing.filter((entry) => normalizePlaylistLookup(entry) !== targetLookup);
    } else if (!existing.some((entry) => normalizePlaylistLookup(entry) === targetLookup)) {
      nextNames = [...existing, existingName];
    }

    if (nextNames.length) {
      playlistAssignments[fileId] = nextNames;
    } else {
      delete playlistAssignments[fileId];
    }
  });

  return savePlaylistState(env, {
    playlistNames: state.playlistNames,
    playlistAssignments,
  });
}
