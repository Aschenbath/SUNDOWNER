const LEGACY_FONT_PREFIX = '/static/fonts/';

function redirectLegacyFont(request, params = {}) {
  const path = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '');
  if (!path || path.includes('..')) {
    return new Response('Not Found', { status: 404 });
  }

  const url = new URL(request.url);
  url.pathname = `${LEGACY_FONT_PREFIX}${path}`;
  return Response.redirect(url.toString(), 302);
}

export function onRequestGet({ request, params }) {
  return redirectLegacyFont(request, params);
}

export function onRequestHead({ request, params }) {
  return redirectLegacyFont(request, params);
}

export function onRequest() {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: {
      Allow: 'GET, HEAD',
    },
  });
}
