const TELEGRAM_SYNC_ADMIN_PATH = '/static/tools/telegram-sync-admin.html';

function redirectToTelegramSyncAdmin(request) {
  const url = new URL(request.url);
  url.pathname = TELEGRAM_SYNC_ADMIN_PATH;
  return Response.redirect(url.toString(), 302);
}

export function onRequestGet({ request }) {
  return redirectToTelegramSyncAdmin(request);
}

export function onRequestHead({ request }) {
  return redirectToTelegramSyncAdmin(request);
}

export function onRequest() {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: {
      Allow: 'GET, HEAD',
    },
  });
}
