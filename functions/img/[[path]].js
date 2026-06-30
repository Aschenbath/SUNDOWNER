const LEGACY_IMG_PREFIX = '/static/legacy/img/';

function redirectLegacyImage(request, params = {}) {
  const path = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '');
  if (!path || path.includes('..')) {
    return new Response('Not Found', { status: 404 });
  }

  const url = new URL(request.url);
  url.pathname = `${LEGACY_IMG_PREFIX}${path}`;
  return Response.redirect(url.toString(), 302);
}

export function onRequestGet({ request, params }) {
  return redirectLegacyImage(request, params);
}

export function onRequestHead({ request, params }) {
  return redirectLegacyImage(request, params);
}

export function onRequest() {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: {
      Allow: 'GET, HEAD',
    },
  });
}
