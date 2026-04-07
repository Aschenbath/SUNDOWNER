import {
  applyPersistedAlbumFileMutation,
  getPersistedAlbumFiles,
} from '../../../utils/albumsStore.js';

function jsonResponse(payload, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  });
}

function resolveAlbumId(params) {
  const pathSegments = Array.isArray(params?.path) ? params.path.filter(Boolean) : [];
  return pathSegments.length ? decodeURIComponent(pathSegments[0]) : '';
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const albumId = resolveAlbumId(params);

  if (!albumId) {
    return jsonResponse({ error: 'Album id is required' }, { status: 400 });
  }

  if (request.method === 'GET') {
    const result = await getPersistedAlbumFiles(env, albumId);
    if (!result) {
      return jsonResponse({ error: 'Album not found' }, { status: 404 });
    }
    return jsonResponse(result);
  }

  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, { status: 400 });
    }

    try {
      const state = await applyPersistedAlbumFileMutation(env, albumId, body || {});
      return jsonResponse(state);
    } catch (error) {
      return jsonResponse({ error: error.message || 'Failed to update album files' }, { status: 400 });
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
}
