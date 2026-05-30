// SUNDOWNER service worker — app-shell + static asset caching.
//
// Strategy:
//   navigation (HTML)        -> network-first, fall back to cached shell when offline.
//                               HTML is NEVER cache-first, so a new deploy is always
//                               picked up immediately (avoids the stale-shell black screen).
//   /js/ /css/ static assets -> stale-while-revalidate. These are content-addressed by
//                               ?v= or a webpack content hash, so cache is safe to serve
//                               instantly while refreshing in the background.
//   /api/ /file/ /dav/ /upload, cross-origin, and non-GET -> bypass (network only).
//                               /file already has a worker edge cache + ETag/immutable,
//                               and media must not bloat the SW cache.
//
// To ship a change to this file: bump CACHE_VERSION AND the sw.js?v= in index.html.
// Emergency kill-switch: deploy a sw.js whose body is just
//   self.addEventListener('install',()=>self.skipWaiting());
//   self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.map(c=>caches.delete(c)))).then(()=>self.registration.unregister())));
// which self-unregisters and clears all caches on the next load.

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `sundowner-shell-${CACHE_VERSION}`;
const SHELL_FALLBACK = '/index.html';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('sundowner-shell-') && key !== SHELL_CACHE)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') {
    return;
  }

  let url;
  try {
    url = new URL(req.url);
  } catch (err) {
    return;
  }
  if (url.origin !== self.location.origin) {
    return;
  }

  // Never intercept dynamic data, media, WebDAV, or uploads.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/file/') ||
    url.pathname.startsWith('/dav/') ||
    url.pathname.startsWith('/upload')
  ) {
    return;
  }

  // HTML navigations: network-first, cache the latest shell, fall back when offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
          const cache = await caches.open(SHELL_CACHE);
          cache.put(SHELL_FALLBACK, fresh.clone());
        }
        return fresh;
      } catch (err) {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match(SHELL_FALLBACK);
        if (cached) {
          return cached;
        }
        throw err;
      }
    })());
    return;
  }

  // Static JS/CSS: stale-while-revalidate.
  if (url.pathname.startsWith('/js/') || url.pathname.startsWith('/css/')) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(req);
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(networkFetch);
        return cached;
      }
      const res = await networkFetch;
      return res || Response.error();
    })());
  }
});
