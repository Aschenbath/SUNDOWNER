import {
  appendWebMindMessage,
  getMindState,
  mirrorFreshMindMessages,
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

      const state = await appendWebMindMessage(env, body?.text || '');
      return jsonResponse(state);
    } catch (error) {
      return jsonResponse({ error: error.message || 'Failed to update Mind' }, { status: 400 });
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
}
