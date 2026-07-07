import {
  applyPersistedAlbumFileMutation,
  buildAlbumStatePayload,
  createPersistedAlbum,
  deletePersistedAlbum,
  getPersistedAlbumState,
  renamePersistedAlbum,
  replacePersistedAlbumState,
} from '../../utils/albumsStore.js';
import { getCachedOrFetch, CACHE_CONFIG, invalidateCache } from '../../utils/apiCache.js';

function jsonResponse(payload, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  });
}

const ALBUM_CLIENT_ERRORS = new Set([
  'Album not found',
  'Album name is required',
  'Cannot rename favourites',
  'An album with that name already exists',
]);

function albumErrorResponse(error, fallbackMessage, operation) {
  const message = error?.message || '';
  if (ALBUM_CLIENT_ERRORS.has(message)) {
    return jsonResponse({ error: message }, { status: 400 });
  }

  console.error(`${operation} failed:`, error);
  return jsonResponse({ error: fallbackMessage }, { status: 500 });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'GET') {
    // Use cache for GET requests
    const state = await getCachedOrFetch(
      env.img_url,
      CACHE_CONFIG.albums.key,
      async () => getPersistedAlbumState(env),
      CACHE_CONFIG.albums.ttl
    );
    return jsonResponse(state);
  }

  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, { status: 400 });
    }

    try {
      if (body?.state || body?.migrate) {
        const nextState = buildAlbumStatePayload(body.state || body.migrate || {});
        const state = await replacePersistedAlbumState(env, nextState);
        // Invalidate cache after mutation
        await invalidateCache(env.img_url, CACHE_CONFIG.albums.key);
        return jsonResponse(state);
      }

      if (body?.name) {
        const state = await createPersistedAlbum(env, body.name);
        // Invalidate cache after mutation
        await invalidateCache(env.img_url, CACHE_CONFIG.albums.key);
        return jsonResponse(state);
      }

      if (body?.albumId && Array.isArray(body?.fileIds)) {
        const state = await applyPersistedAlbumFileMutation(env, body.albumId, body);
        // Invalidate cache after mutation
        await invalidateCache(env.img_url, CACHE_CONFIG.albums.key);
        return jsonResponse(state);
      }

      return jsonResponse({ error: 'Unsupported album operation' }, { status: 400 });
    } catch (error) {
      return albumErrorResponse(error, 'Internal server error.', 'Update albums');
    }
  }

  if (request.method === 'PATCH') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, { status: 400 });
    }

    const albumId = body?.id || body?.name || url.searchParams.get('id') || url.searchParams.get('name');
    const newName = body?.newName;
    if (!albumId || !newName) {
      return jsonResponse({ error: 'Album id and newName are required' }, { status: 400 });
    }

    try {
      const state = await renamePersistedAlbum(env, albumId, newName);
      // Invalidate cache after mutation
      await invalidateCache(env.img_url, CACHE_CONFIG.albums.key);
      return jsonResponse(state);
    } catch (error) {
      return albumErrorResponse(error, 'Internal server error.', 'Rename album');
    }
  }

  if (request.method === 'DELETE') {
    const albumId = url.searchParams.get('id') || url.searchParams.get('name');
    if (!albumId) {
      return jsonResponse({ error: 'Album id is required' }, { status: 400 });
    }

    try {
      const state = await deletePersistedAlbum(env, albumId);
      // Invalidate cache after mutation
      await invalidateCache(env.img_url, CACHE_CONFIG.albums.key);
      return jsonResponse(state);
    } catch (error) {
      return albumErrorResponse(error, 'Internal server error.', 'Delete album');
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
}
