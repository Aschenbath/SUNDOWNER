// HEIC client-side decoder.
//
// Telegram document-path HEIC uploads keep the full original on the backend,
// but Chrome/Edge cannot render image/heic natively, so the lightbox was
// falling back to a tiny EXIF IFD1 thumbnail extracted by exifr (~240x320).
// This helper lazy-loads the libheif WASM bundle, decodes the original HEIC
// in the browser, and yields a high-resolution JPEG blob the same <img> can
// swap to. The WASM bundle (~1.4 MB) is fetched only on first HEIC view and
// cached by the browser thereafter.

const LIBHEIF_BUNDLE_URL = new URL('../vendor/libheif/libheif-bundle.mjs?v=1', import.meta.url).toString();

let libheifModulePromise = null;
let decoderInstance = null;
let decoderInitFailed = false;

let injectedLibheifLoaderForTests = null;
let injectedCanvasFactoryForTests = null;

export function __setLibheifLoaderForTests(loader) {
  injectedLibheifLoaderForTests = typeof loader === 'function' ? loader : null;
  libheifModulePromise = null;
  decoderInstance = null;
  decoderInitFailed = false;
}

export function __setCanvasFactoryForTests(factory) {
  injectedCanvasFactoryForTests = typeof factory === 'function' ? factory : null;
}

export function __resetHeicDecoderForTests() {
  injectedLibheifLoaderForTests = null;
  injectedCanvasFactoryForTests = null;
  libheifModulePromise = null;
  decoderInstance = null;
  decoderInitFailed = false;
}

async function loadLibheifModule() {
  if (injectedLibheifLoaderForTests) {
    return injectedLibheifLoaderForTests();
  }
  return import(LIBHEIF_BUNDLE_URL);
}

async function getDecoder() {
  if (decoderInitFailed) {
    throw new Error('libheif previously failed to load');
  }
  if (decoderInstance) {
    return decoderInstance;
  }
  if (!libheifModulePromise) {
    libheifModulePromise = loadLibheifModule().catch((error) => {
      decoderInitFailed = true;
      libheifModulePromise = null;
      throw error;
    });
  }
  const moduleNamespace = await libheifModulePromise;
  const exported = moduleNamespace?.default || moduleNamespace;

  // The libheif-js wasm-bundle CJS entry (`libheif-js/wasm-bundle`) auto-invokes
  // the underlying factory, but the raw ESM `.mjs` file we vendor exports the
  // bare factory and expects the caller to invoke (and possibly await) it
  // before HeifDecoder is reachable. Cover both shapes so the helper stays
  // robust if the vendor file is later swapped for the CJS variant or a
  // pre-instantiated module.
  let libheif = exported;
  if (typeof exported === 'function') {
    libheif = await exported();
  }

  if (!libheif || typeof libheif.HeifDecoder !== 'function') {
    decoderInitFailed = true;
    throw new Error('libheif module did not expose HeifDecoder');
  }
  decoderInstance = new libheif.HeifDecoder();
  return decoderInstance;
}

function createTargetCanvas(width, height) {
  if (injectedCanvasFactoryForTests) {
    return injectedCanvasFactoryForTests(width, height);
  }
  if (typeof OffscreenCanvas === 'function') {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  return null;
}

async function canvasToBlob(canvas, mimeType, quality) {
  if (typeof canvas.convertToBlob === 'function') {
    return await canvas.convertToBlob({ type: mimeType, quality });
  }
  if (typeof canvas.toBlob === 'function') {
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('canvas.toBlob returned null'));
      }, mimeType, quality);
    });
  }
  throw new Error('canvas has no convertToBlob or toBlob method');
}

// Decode a HEIC ArrayBuffer / Uint8Array to a JPEG Blob suitable for <img src>.
// Throws if libheif fails to load, the buffer is not HEIC, or no decodable
// image is found inside the container.
export async function decodeHeicBufferToBlob(buffer, { mimeType = 'image/jpeg', quality = 0.92 } = {}) {
  if (!buffer || (buffer.byteLength ?? buffer.length ?? 0) === 0) {
    throw new Error('empty heic buffer');
  }
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  const decoder = await getDecoder();
  const images = decoder.decode(bytes);
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error('libheif decode returned no images');
  }

  const image = images[0];
  const width = typeof image.get_width === 'function' ? image.get_width() : 0;
  const height = typeof image.get_height === 'function' ? image.get_height() : 0;
  if (width <= 0 || height <= 0) {
    throw new Error(`invalid heic dimensions ${width}x${height}`);
  }

  const rgbaBuffer = new Uint8ClampedArray(width * height * 4);
  await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      if (err) reject(err); else resolve();
    };
    try {
      const displayResult = image.display({ data: rgbaBuffer, width, height }, (result) => {
        if (result === false || result == null) {
          finish(new Error('libheif image.display callback reported failure'));
        } else {
          finish(null);
        }
      });
      // Some libheif callback signatures resolve synchronously by returning a value
      // instead of invoking the callback. Cover that path so we do not deadlock.
      if (displayResult && typeof displayResult.then === 'function') {
        displayResult.then(() => finish(null), finish);
      }
    } catch (error) {
      finish(error);
    }
  });

  const canvas = createTargetCanvas(width, height);
  if (!canvas) {
    throw new Error('no canvas implementation available for HEIC decode');
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('canvas 2d context unavailable');
  }

  const imageData = typeof ImageData === 'function'
    ? new ImageData(rgbaBuffer, width, height)
    : { data: rgbaBuffer, width, height };
  ctx.putImageData(imageData, 0, 0);

  return await canvasToBlob(canvas, mimeType, quality);
}

// Convenience: fetch a HEIC URL and decode it. Caller owns the returned blob
// URL via URL.createObjectURL and should revoke it when done.
export async function decodeHeicUrlToObjectUrl(url, options) {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error(`HEIC fetch failed: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  const blob = await decodeHeicBufferToBlob(buffer, options);
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('URL.createObjectURL not available');
  }
  return URL.createObjectURL(blob);
}

// LRU cache of decoded HEIC blob URLs keyed by source URL. Prefetching the
// neighbours of the active lightbox photo lets sideways navigation feel
// instant once the bundle has been fetched once. Cache size is intentionally
// small so total in-memory blob bytes stay bounded — a 12 MP HEIC decodes to a
// ~5-8 MB JPEG blob, so 8 entries keep us under ~64 MB worst case.
const HEIC_PREFETCH_CACHE_MAX_ENTRIES = 8;
const heicPrefetchCache = new Map();
const heicPrefetchInflight = new Map();

function revokePrefetchEntry(url) {
  const objectUrl = heicPrefetchCache.get(url);
  if (objectUrl) {
    try { URL.revokeObjectURL(objectUrl); } catch { /* ignore */ }
  }
  heicPrefetchCache.delete(url);
}

function trimPrefetchCacheTo(limit) {
  while (heicPrefetchCache.size > limit) {
    const oldestKey = heicPrefetchCache.keys().next().value;
    if (oldestKey === undefined) break;
    revokePrefetchEntry(oldestKey);
  }
}

export function getCachedHeicObjectUrl(url) {
  if (!url) return null;
  const objectUrl = heicPrefetchCache.get(url);
  if (!objectUrl) return null;
  heicPrefetchCache.delete(url);
  heicPrefetchCache.set(url, objectUrl);
  return objectUrl;
}

export function takeCachedHeicObjectUrl(url) {
  if (!url) return null;
  const objectUrl = heicPrefetchCache.get(url);
  if (!objectUrl) return null;
  heicPrefetchCache.delete(url);
  return objectUrl;
}

export async function prefetchHeicObjectUrl(url, options) {
  if (!url) return null;
  if (heicPrefetchCache.has(url)) {
    return getCachedHeicObjectUrl(url);
  }
  if (heicPrefetchInflight.has(url)) {
    return heicPrefetchInflight.get(url);
  }
  const inflight = (async () => {
    try {
      const objectUrl = await decodeHeicUrlToObjectUrl(url, options);
      heicPrefetchCache.set(url, objectUrl);
      trimPrefetchCacheTo(HEIC_PREFETCH_CACHE_MAX_ENTRIES);
      return objectUrl;
    } finally {
      heicPrefetchInflight.delete(url);
    }
  })();
  heicPrefetchInflight.set(url, inflight);
  return inflight;
}

export function clearHeicPrefetchCache() {
  for (const key of Array.from(heicPrefetchCache.keys())) {
    revokePrefetchEntry(key);
  }
  heicPrefetchInflight.clear();
}

export function __getHeicPrefetchCacheSnapshotForTests() {
  return new Map(heicPrefetchCache);
}
