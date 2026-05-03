import {
  applyPersistedAlbumFileMutation,
  buildAlbumStatePayload,
  createPersistedAlbum,
  deletePersistedAlbum,
  getPersistedAlbumFiles,
  getPersistedAlbumState,
  renamePersistedAlbum,
  replacePersistedAlbumState,
} from '../../../utils/albumsStore.js';
import { jsonResponse, optionsResponse } from '../../../utils/cors.js';

function resolveAlbumId(params) {
  const pathSegments = Array.isArray(params?.path) ? params.path.filter(Boolean) : [];
  return pathSegments.length ? decodeURIComponent(pathSegments[0]) : '';
}

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method === 'OPTIONS') {
    return optionsResponse();
  }

  const albumId = resolveAlbumId(params);

  if (!albumId) {
    if (request.method === 'GET') {
      const state = await getPersistedAlbumState(env);
      return jsonResponse(state, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'Invalid JSON' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
      }

      try {
        if (body?.state || body?.migrate) {
          const nextState = buildAlbumStatePayload(body.state || body.migrate || {});
          const state = await replacePersistedAlbumState(env, nextState);
          return jsonResponse(state, { headers: { 'Cache-Control': 'no-store' } });
        }

        if (body?.name) {
          const state = await createPersistedAlbum(env, body.name);
          return jsonResponse(state, { headers: { 'Cache-Control': 'no-store' } });
        }

        return jsonResponse({ error: 'Album id is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
      } catch (error) {
        return jsonResponse({ error: error.message || 'Failed to update albums' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
      }
    }

    if (request.method === 'PATCH') {
      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: 'Invalid JSON' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
      }
      const renameId = body?.id || body?.name;
      const newName = body?.newName;
      if (!renameId || !newName) {
        return jsonResponse({ error: 'Album id and newName are required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
      }
      try {
        const state = await renamePersistedAlbum(env, renameId, newName);
        return jsonResponse(state, { headers: { 'Cache-Control': 'no-store' } });
      } catch (error) {
        return jsonResponse({ error: error.message || 'Failed to rename album' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
      }
    }

    if (request.method === 'DELETE') {
      const url = new URL(request.url);
      const deleteId = url.searchParams.get('id') || url.searchParams.get('name');
      if (!deleteId) {
        return jsonResponse({ error: 'Album id is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
      }
      try {
        const state = await deletePersistedAlbum(env, deleteId);
        return jsonResponse(state, { headers: { 'Cache-Control': 'no-store' } });
      } catch (error) {
        return jsonResponse({ error: error.message || 'Failed to delete album' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
      }
    }

    return jsonResponse({ error: 'Album id is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  if (request.method === 'GET') {
    const result = await getPersistedAlbumFiles(env, albumId);
    if (!result) {
      return jsonResponse({ error: 'Album not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }
    return jsonResponse(result, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    try {
      const state = await applyPersistedAlbumFileMutation(env, albumId, body || {});
      return jsonResponse(state, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return jsonResponse({ error: error.message || 'Failed to update album files' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, {
    status: 405,
    headers: {
      'Cache-Control': 'no-store',
      Allow: 'GET, POST, OPTIONS',
    },
  });
}
