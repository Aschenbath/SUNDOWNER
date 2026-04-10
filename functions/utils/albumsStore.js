import { getDatabase } from './databaseAdapter.js';

const FAVORITES_ALBUM_ID = '__favorites__';
const FAVORITES_ALBUM_NAME = '__favorites__';
const FALLBACK_STORAGE_KEY = 'manage@sysConfig@mediaLibraryAlbums';

const D1_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS albums (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cover_file_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_albums_name_ci ON albums(LOWER(name))',
  `CREATE TABLE IF NOT EXISTS album_files (
    album_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (album_id, file_id),
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
  )`,
  'CREATE INDEX IF NOT EXISTS idx_album_files_file_id ON album_files(file_id)',
];

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeAlbumName(value) {
  return normalizeText(value);
}

function normalizeAlbumLookup(value) {
  return normalizeAlbumName(value).toLowerCase();
}

function normalizeFileId(value) {
  return normalizeText(value);
}

function dedupeAlbumNames(values) {
  const names = [];
  const seen = new Set();
  for (const rawValue of Array.isArray(values) ? values : []) {
    const albumName = normalizeAlbumName(rawValue);
    const lookup = normalizeAlbumLookup(albumName);
    if (!albumName || seen.has(lookup)) {
      continue;
    }
    seen.add(lookup);
    names.push(albumName);
  }
  return names;
}

function dedupeFileIds(values) {
  const fileIds = [];
  const seen = new Set();
  for (const rawValue of Array.isArray(values) ? values : []) {
    const fileId = normalizeFileId(rawValue);
    if (!fileId || seen.has(fileId)) {
      continue;
    }
    seen.add(fileId);
    fileIds.push(fileId);
  }
  return fileIds;
}

function createEmptyAlbumState() {
  return {
    albums: [],
    albumNames: [],
    albumAssignments: {},
    albumCovers: {},
    favorites: [],
  };
}

function normalizeAlbumStatePayload(input = {}) {
  const albumNames = dedupeAlbumNames(input.albumNames || []);
  const assignmentEntries = Object.entries(input.albumAssignments || {})
    .map(([fileId, albumName]) => [normalizeFileId(fileId), normalizeAlbumName(albumName)])
    .filter(([fileId, albumName]) => fileId && albumName);
  const coverEntries = Object.entries(input.albumCovers || {})
    .map(([albumName, fileId]) => [normalizeAlbumName(albumName), normalizeFileId(fileId)])
    .filter(([albumName, fileId]) => albumName && fileId);
  const favorites = dedupeFileIds(input.favorites || []);

  const allAlbumNames = dedupeAlbumNames([
    ...albumNames,
    ...assignmentEntries.map(([, albumName]) => albumName),
    ...coverEntries.map(([albumName]) => albumName),
  ]);
  const canonicalByLookup = new Map(allAlbumNames.map((albumName) => [normalizeAlbumLookup(albumName), albumName]));

  const albumAssignments = {};
  for (const [fileId, albumName] of assignmentEntries) {
    const canonicalName = canonicalByLookup.get(normalizeAlbumLookup(albumName));
    if (canonicalName) {
      albumAssignments[fileId] = canonicalName;
    }
  }

  const albumCovers = {};
  for (const [albumName, fileId] of coverEntries) {
    const canonicalName = canonicalByLookup.get(normalizeAlbumLookup(albumName));
    if (canonicalName) {
      albumCovers[normalizeAlbumLookup(canonicalName)] = fileId;
    }
  }

  return {
    albums: allAlbumNames.map((albumName) => ({
      id: '',
      name: albumName,
      coverFileId: albumCovers[normalizeAlbumLookup(albumName)] || '',
      createdAt: '',
    })),
    albumNames: allAlbumNames,
    albumAssignments,
    albumCovers,
    favorites,
  };
}

function isD1Configured(env) {
  return Boolean(env?.img_d1 && typeof env.img_d1.prepare === 'function');
}

async function d1Run(env, sql, params = []) {
  const statement = env.img_d1.prepare(sql);
  const bound = params.length ? statement.bind(...params) : statement;
  return bound.run();
}

async function d1All(env, sql, params = []) {
  const statement = env.img_d1.prepare(sql);
  const bound = params.length ? statement.bind(...params) : statement;
  const response = await bound.all();
  return response?.results || [];
}

async function ensureD1AlbumTables(env) {
  if (!isD1Configured(env)) {
    return false;
  }

  for (const sql of D1_SCHEMA_STATEMENTS) {
    await d1Run(env, sql);
  }

  await d1Run(
    env,
    'INSERT OR IGNORE INTO albums (id, name) VALUES (?, ?)',
    [FAVORITES_ALBUM_ID, FAVORITES_ALBUM_NAME],
  );
  return true;
}

async function loadAlbumStateFromD1(env) {
  await ensureD1AlbumTables(env);

  const albums = await d1All(
    env,
    'SELECT id, name, cover_file_id, created_at FROM albums WHERE id != ? ORDER BY datetime(created_at) ASC, LOWER(name) ASC',
    [FAVORITES_ALBUM_ID],
  );
  const assignments = await d1All(
    env,
    `SELECT af.file_id, a.name
       FROM album_files af
       INNER JOIN albums a ON a.id = af.album_id
      WHERE a.id != ?
      ORDER BY datetime(af.created_at) ASC, af.file_id ASC`,
    [FAVORITES_ALBUM_ID],
  );
  const favorites = await d1All(
    env,
    'SELECT file_id FROM album_files WHERE album_id = ? ORDER BY datetime(created_at) ASC, file_id ASC',
    [FAVORITES_ALBUM_ID],
  );

  const state = createEmptyAlbumState();
  state.albums = albums.map((row) => ({
    id: normalizeText(row.id),
    name: normalizeAlbumName(row.name),
    coverFileId: normalizeFileId(row.cover_file_id),
    createdAt: normalizeText(row.created_at),
  })).filter((album) => album.id && album.name);
  state.albumNames = state.albums.map((album) => album.name);
  state.albumCovers = Object.fromEntries(
    state.albums
      .filter((album) => album.coverFileId)
      .map((album) => [normalizeAlbumLookup(album.name), album.coverFileId]),
  );

  assignments.forEach((row) => {
    const fileId = normalizeFileId(row.file_id);
    const albumName = normalizeAlbumName(row.name);
    if (fileId && albumName) {
      state.albumAssignments[fileId] = albumName;
    }
  });

  state.favorites = dedupeFileIds(favorites.map((row) => row.file_id));
  return state;
}

async function replaceAlbumStateInD1(env, nextState) {
  await ensureD1AlbumTables(env);
  const normalizedState = normalizeAlbumStatePayload(nextState);

  const existingAlbums = await d1All(
    env,
    'SELECT id, name FROM albums WHERE id != ?',
    [FAVORITES_ALBUM_ID],
  );
  const existingByLookup = new Map(
    existingAlbums.map((row) => [normalizeAlbumLookup(row.name), { id: normalizeText(row.id), name: normalizeAlbumName(row.name) }]),
  );

  for (const albumName of normalizedState.albumNames) {
    const lookup = normalizeAlbumLookup(albumName);
    if (existingByLookup.has(lookup)) {
      continue;
    }
    const albumId = crypto.randomUUID();
    await d1Run(
      env,
      'INSERT INTO albums (id, name, cover_file_id) VALUES (?, ?, ?)',
      [albumId, albumName, null],
    );
    existingByLookup.set(lookup, { id: albumId, name: albumName });
  }

  const desiredLookups = new Set(normalizedState.albumNames.map((albumName) => normalizeAlbumLookup(albumName)));
  const resolvedAlbums = await d1All(
    env,
    'SELECT id, name FROM albums WHERE id != ?',
    [FAVORITES_ALBUM_ID],
  );
  const resolvedByLookup = new Map(
    resolvedAlbums.map((row) => [normalizeAlbumLookup(row.name), { id: normalizeText(row.id), name: normalizeAlbumName(row.name) }]),
  );

  await d1Run(env, 'DELETE FROM album_files WHERE album_id = ?', [FAVORITES_ALBUM_ID]);
  await d1Run(env, 'DELETE FROM album_files WHERE album_id != ?', [FAVORITES_ALBUM_ID]);

  for (const [fileId, albumName] of Object.entries(normalizedState.albumAssignments)) {
    const album = resolvedByLookup.get(normalizeAlbumLookup(albumName));
    if (!album) {
      continue;
    }
    await d1Run(
      env,
      'INSERT OR REPLACE INTO album_files (album_id, file_id) VALUES (?, ?)',
      [album.id, fileId],
    );
  }

  for (const fileId of normalizedState.favorites) {
    await d1Run(
      env,
      'INSERT OR REPLACE INTO album_files (album_id, file_id) VALUES (?, ?)',
      [FAVORITES_ALBUM_ID, fileId],
    );
  }

  for (const album of resolvedByLookup.values()) {
    const lookup = normalizeAlbumLookup(album.name);
    if (!desiredLookups.has(lookup)) {
      await d1Run(env, 'DELETE FROM albums WHERE id = ?', [album.id]);
      continue;
    }
    const coverFileId = normalizedState.albumCovers[lookup] || null;
    await d1Run(env, 'UPDATE albums SET cover_file_id = ? WHERE id = ?', [coverFileId, album.id]);
  }

  return loadAlbumStateFromD1(env);
}

async function loadAlbumStateFromFallback(env) {
  const db = getDatabase(env);
  const rawValue = await db.get(FALLBACK_STORAGE_KEY);
  if (!rawValue) {
    return createEmptyAlbumState();
  }
  try {
    return normalizeAlbumStatePayload(JSON.parse(rawValue));
  } catch {
    return createEmptyAlbumState();
  }
}

async function replaceAlbumStateInFallback(env, nextState) {
  const db = getDatabase(env);
  const normalizedState = normalizeAlbumStatePayload(nextState);
  await db.put(FALLBACK_STORAGE_KEY, JSON.stringify({
    albumNames: normalizedState.albumNames,
    albumAssignments: normalizedState.albumAssignments,
    albumCovers: normalizedState.albumCovers,
    favorites: normalizedState.favorites,
  }));
  return normalizedState;
}

export async function getPersistedAlbumState(env) {
  if (isD1Configured(env)) {
    return loadAlbumStateFromD1(env);
  }
  return loadAlbumStateFromFallback(env);
}

export async function replacePersistedAlbumState(env, nextState) {
  if (isD1Configured(env)) {
    return replaceAlbumStateInD1(env, nextState);
  }
  return replaceAlbumStateInFallback(env, nextState);
}

export async function getPersistedAlbumFiles(env, albumId) {
  const normalizedAlbumId = normalizeText(albumId);
  const state = await getPersistedAlbumState(env);

  if (normalizedAlbumId === FAVORITES_ALBUM_ID) {
    return {
      album: {
        id: FAVORITES_ALBUM_ID,
        name: FAVORITES_ALBUM_NAME,
      },
      fileIds: [...state.favorites],
    };
  }

  const album = state.albums.find((entry) =>
    normalizeText(entry.id) === normalizedAlbumId
    || normalizeAlbumLookup(entry.name) === normalizeAlbumLookup(normalizedAlbumId)
  );
  if (!album) {
    return null;
  }

  return {
    album,
    fileIds: Object.entries(state.albumAssignments)
      .filter(([, albumName]) => normalizeAlbumLookup(albumName) === normalizeAlbumLookup(album.name))
      .map(([fileId]) => fileId),
  };
}

export async function applyPersistedAlbumFileMutation(env, albumId, mutation = {}) {
  const normalizedAlbumId = normalizeText(albumId);
  const fileIds = dedupeFileIds(mutation.fileIds || []);
  const mode = normalizeText(mutation.mode || 'add').toLowerCase();
  const coverFileId = mutation.coverFileId === null ? '' : normalizeFileId(mutation.coverFileId);
  const state = await getPersistedAlbumState(env);

  if (normalizedAlbumId === FAVORITES_ALBUM_ID) {
    const nextFavorites = new Set(state.favorites);
    if (mode === 'remove') {
      fileIds.forEach((fileId) => nextFavorites.delete(fileId));
    } else {
      fileIds.forEach((fileId) => nextFavorites.add(fileId));
    }
    return replacePersistedAlbumState(env, {
      ...state,
      favorites: [...nextFavorites],
    });
  }

  const album = state.albums.find((entry) =>
    normalizeText(entry.id) === normalizedAlbumId
    || normalizeAlbumLookup(entry.name) === normalizeAlbumLookup(normalizedAlbumId)
  );
  if (!album) {
    throw new Error('Album not found');
  }

  const nextAssignments = { ...state.albumAssignments };
  const albumLookup = normalizeAlbumLookup(album.name);

  if (mode === 'replace') {
    Object.entries(nextAssignments).forEach(([fileId, albumName]) => {
      if (normalizeAlbumLookup(albumName) === albumLookup) {
        delete nextAssignments[fileId];
      }
    });
    fileIds.forEach((fileId) => {
      nextAssignments[fileId] = album.name;
    });
  } else if (mode === 'remove') {
    fileIds.forEach((fileId) => {
      if (normalizeAlbumLookup(nextAssignments[fileId]) === albumLookup) {
        delete nextAssignments[fileId];
      }
    });
  } else {
    fileIds.forEach((fileId) => {
      nextAssignments[fileId] = album.name;
    });
  }

  const nextCovers = { ...state.albumCovers };
  const currentCover = nextCovers[albumLookup] || '';
  if (coverFileId || mutation.coverFileId === null) {
    if (coverFileId) {
      nextCovers[albumLookup] = coverFileId;
    } else {
      delete nextCovers[albumLookup];
    }
  } else if (mode === 'remove' && currentCover && fileIds.includes(currentCover)) {
    delete nextCovers[albumLookup];
  }

  return replacePersistedAlbumState(env, {
    ...state,
    albumAssignments: nextAssignments,
    albumCovers: nextCovers,
  });
}

export async function createPersistedAlbum(env, name) {
  const albumName = normalizeAlbumName(name);
  if (!albumName) {
    throw new Error('Album name is required');
  }

  const state = await getPersistedAlbumState(env);
  const existingAlbum = state.albums.find((album) => normalizeAlbumLookup(album.name) === normalizeAlbumLookup(albumName));
  if (existingAlbum) {
    return state;
  }

  return replacePersistedAlbumState(env, {
    ...state,
    albumNames: [...state.albumNames, albumName],
  });
}

export async function deletePersistedAlbum(env, albumIdOrName) {
  const target = normalizeText(albumIdOrName);
  if (!target || target === FAVORITES_ALBUM_ID || normalizeAlbumLookup(target) === normalizeAlbumLookup(FAVORITES_ALBUM_NAME)) {
    throw new Error('Album not found');
  }

  const state = await getPersistedAlbumState(env);
  const album = state.albums.find((entry) =>
    normalizeText(entry.id) === target || normalizeAlbumLookup(entry.name) === normalizeAlbumLookup(target),
  );
  if (!album) {
    throw new Error('Album not found');
  }

  const nextAssignments = Object.fromEntries(
    Object.entries(state.albumAssignments).filter(([, albumName]) => normalizeAlbumLookup(albumName) !== normalizeAlbumLookup(album.name)),
  );
  const nextCovers = { ...state.albumCovers };
  delete nextCovers[normalizeAlbumLookup(album.name)];

  return replacePersistedAlbumState(env, {
    ...state,
    albumNames: state.albumNames.filter((albumName) => normalizeAlbumLookup(albumName) !== normalizeAlbumLookup(album.name)),
    albumAssignments: nextAssignments,
    albumCovers: nextCovers,
  });
}

export async function renamePersistedAlbum(env, albumIdOrName, newName) {
  const target = normalizeText(albumIdOrName);
  const nextName = normalizeAlbumName(newName);
  if (!target || !nextName) {
    throw new Error('Album name is required');
  }
  if (target === FAVORITES_ALBUM_ID || normalizeAlbumLookup(target) === normalizeAlbumLookup(FAVORITES_ALBUM_NAME)) {
    throw new Error('Cannot rename favourites');
  }

  const state = await getPersistedAlbumState(env);
  const album = state.albums.find((entry) =>
    normalizeText(entry.id) === target || normalizeAlbumLookup(entry.name) === normalizeAlbumLookup(target),
  );
  if (!album) {
    throw new Error('Album not found');
  }

  const duplicate = state.albums.find((entry) =>
    entry !== album && normalizeAlbumLookup(entry.name) === normalizeAlbumLookup(nextName),
  );
  if (duplicate) {
    throw new Error('An album with that name already exists');
  }

  const oldKey = normalizeAlbumLookup(album.name);
  const nextAssignments = Object.fromEntries(
    Object.entries(state.albumAssignments).map(([fileId, albumName]) =>
      normalizeAlbumLookup(albumName) === oldKey ? [fileId, nextName] : [fileId, albumName],
    ),
  );
  const nextCovers = { ...state.albumCovers };
  if (nextCovers[oldKey] !== undefined) {
    nextCovers[normalizeAlbumLookup(nextName)] = nextCovers[oldKey];
    delete nextCovers[oldKey];
  }

  return replacePersistedAlbumState(env, {
    ...state,
    albumNames: state.albumNames.map((n) => normalizeAlbumLookup(n) === oldKey ? nextName : n),
    albumAssignments: nextAssignments,
    albumCovers: nextCovers,
  });
}

export function buildAlbumStatePayload(state) {
  return normalizeAlbumStatePayload(state);
}

export const favoritesAlbum = {
  id: FAVORITES_ALBUM_ID,
  name: FAVORITES_ALBUM_NAME,
};
