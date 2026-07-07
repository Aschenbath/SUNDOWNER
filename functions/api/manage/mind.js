import {
  appendWebMindMessage,
  deleteMindMessage,
  getMindState,
  mirrorFreshMindMessages,
  updateMindSettings,
} from '../../utils/mindStore.js';

function jsonResponse(payload, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  });
}

const MIND_CLIENT_ERRORS = new Set([
  'Message text is required',
  'Message id is required',
]);

function mindErrorResponse(error) {
  const message = error?.message || '';
  if (MIND_CLIENT_ERRORS.has(message)) {
    return jsonResponse({ error: message }, { status: 400 });
  }

  console.error('Mind update failed:', error);
  return jsonResponse({ error: 'Internal server error.' }, { status: 500 });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'GET') {
    const state = await getMindState(env);
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
      if (body?.action === 'mirror') {
        const state = await mirrorFreshMindMessages(env);
        return jsonResponse(state);
      }

      if (body?.action === 'update-settings') {
        const state = await updateMindSettings(env, body?.settings || {});
        return jsonResponse(state);
      }

      if (body?.action === 'delete-message') {
        const state = await deleteMindMessage(env, body?.id || '');
        return jsonResponse(state);
      }

      if (!body?.action || body?.action === 'append') {
        const state = await appendWebMindMessage(env, body?.text || '');
        return jsonResponse(state);
      }

      return jsonResponse({ error: 'Unsupported Mind action' }, { status: 400 });
    } catch (error) {
      return mindErrorResponse(error);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
}
