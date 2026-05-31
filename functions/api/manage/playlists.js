import {
  applyPersistedPlaylistTrackMutation,
  createPersistedPlaylist,
  deletePersistedPlaylist,
  getPersistedPlaylistState,
  renamePersistedPlaylist,
  replacePersistedPlaylistState,
} from '../../utils/playlistsStore.js';
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

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'GET') {
    // Use cache for GET requests
    const state = await getCachedOrFetch(
      env.img_url,
      CACHE_CONFIG.playlists.key,
      async () => getPersistedPlaylistState(env),
      CACHE_CONFIG.playlists.ttl
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
      let result;
      if (body?.state) {
        result = await replacePersistedPlaylistState(env, body.state);
      } else if (body?.name) {
        result = await createPersistedPlaylist(env, body.name);
      } else if (body?.playlistId && Array.isArray(body?.fileIds)) {
        result = await applyPersistedPlaylistTrackMutation(env, body.playlistId, body);
      } else {
        return jsonResponse({ error: 'Unsupported playlist operation' }, { status: 400 });
      }

      // Invalidate cache after mutation
      await invalidateCache(env.img_url, CACHE_CONFIG.playlists.key);
      return jsonResponse(result);
    } catch (error) {
      return jsonResponse({ error: error.message || 'Failed to update playlists' }, { status: 400 });
    }
  }

  if (request.method === 'PATCH') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, { status: 400 });
    }
    const playlistId = body?.id || body?.name || url.searchParams.get('id') || url.searchParams.get('name');
    const newName = body?.newName;
    if (!playlistId || !newName) {
      return jsonResponse({ error: 'Playlist id and newName are required' }, { status: 400 });
    }
    try {
      const result = await renamePersistedPlaylist(env, playlistId, newName);
      // Invalidate cache after mutation
      await invalidateCache(env.img_url, CACHE_CONFIG.playlists.key);
      return jsonResponse(result);
    } catch (error) {
      return jsonResponse({ error: error.message || 'Failed to rename playlist' }, { status: 400 });
    }
  }

  if (request.method === 'DELETE') {
    const playlistId = url.searchParams.get('id') || url.searchParams.get('name');
    if (!playlistId) {
      return jsonResponse({ error: 'Playlist id is required' }, { status: 400 });
    }
    try {
      const result = await deletePersistedPlaylist(env, playlistId);
      // Invalidate cache after mutation
      await invalidateCache(env.img_url, CACHE_CONFIG.playlists.key);
      return jsonResponse(result);
    } catch (error) {
      return jsonResponse({ error: error.message || 'Failed to delete playlist' }, { status: 400 });
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
}
