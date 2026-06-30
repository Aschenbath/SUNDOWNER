const LOGO_DARK_PATH = '/static/brand/logo-dark.png';

export function onRequestGet({ request }) {
  const url = new URL(request.url);
  url.pathname = LOGO_DARK_PATH;
  return Response.redirect(url.toString(), 302);
}

export function onRequestHead({ request }) {
  const url = new URL(request.url);
  url.pathname = LOGO_DARK_PATH;
  return Response.redirect(url.toString(), 302);
}

export function onRequest() {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: {
      Allow: 'GET, HEAD',
    },
  });
}
