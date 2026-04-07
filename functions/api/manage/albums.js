import {
  applyPersistedAlbumFileMutation,
  buildAlbumStatePayload,
  createPersistedAlbum,
  deletePersistedAlbum,
  getPersistedAlbumState,
  replacePersistedAlbumState,
} from '../../utils/albumsStore.js';

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
    const state = await getPersistedAlbumState(env);
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
        return jsonResponse(state);
      }

      if (body?.name) {
        const state = await createPersistedAlbum(env, body.name);
        return jsonResponse(state);
      }

      if (body?.albumId && Array.isArray(body?.fileIds)) {
        const state = await applyPersistedAlbumFileMutation(env, body.albumId, body);
        return jsonResponse(state);
      }

      return jsonResponse({ error: 'Unsupported album operation' }, { status: 400 });
    } catch (error) {
      return jsonResponse({ error: error.message || 'Failed to update albums' }, { status: 400 });
    }
  }

  if (request.method === 'DELETE') {
    const albumId = url.searchParams.get('id') || url.searchParams.get('name');
    if (!albumId) {
      return jsonResponse({ error: 'Album id is required' }, { status: 400 });
    }

    try {
      const state = await deletePersistedAlbum(env, albumId);
      return jsonResponse(state);
    } catch (error) {
      return jsonResponse({ error: error.message || 'Failed to delete album' }, { status: 400 });
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
}
