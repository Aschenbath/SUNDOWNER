import {
  applyPersistedPlaylistTrackMutation,
  createPersistedPlaylist,
  deletePersistedPlaylist,
  getPersistedPlaylistState,
  renamePersistedPlaylist,
  replacePersistedPlaylistState,
} from '../../utils/playlistsStore.js';

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
    return jsonResponse(await getPersistedPlaylistState(env));
  }

  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, { status: 400 });
    }

    try {
      if (body?.state) {
        return jsonResponse(await replacePersistedPlaylistState(env, body.state));
      }
      if (body?.name) {
        return jsonResponse(await createPersistedPlaylist(env, body.name));
      }
      if (body?.playlistId && Array.isArray(body?.fileIds)) {
        return jsonResponse(await applyPersistedPlaylistTrackMutation(env, body.playlistId, body));
      }
      return jsonResponse({ error: 'Unsupported playlist operation' }, { status: 400 });
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
      return jsonResponse(await renamePersistedPlaylist(env, playlistId, newName));
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
      return jsonResponse(await deletePersistedPlaylist(env, playlistId));
    } catch (error) {
      return jsonResponse({ error: error.message || 'Failed to delete playlist' }, { status: 400 });
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
}
