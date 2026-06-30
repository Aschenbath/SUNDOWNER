function healthResponse() {
  return new Response('OK', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export function onRequestGet() {
  return healthResponse();
}

export function onRequestHead() {
  return healthResponse();
}

export function onRequest() {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: {
      Allow: 'GET, HEAD',
    },
  });
}
