import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { buildImageRetryUrl, canRetryImage, getNextImageSource } from '../js/media-library/image-load-state.js';

const source = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
const handlers = source.slice(source.indexOf('function markTileImageLoaded('), source.indexOf('function isSameImageSource('));

class Element {
  constructor(dataset = {}) {
    this.dataset = dataset;
    this.isConnected = true;
    this.style = {};
    this.attrs = new Map();
    const names = new Set();
    this.classList = { add: (...values) => values.forEach(x => names.add(x)), remove: (...values) => values.forEach(x => names.delete(x)), contains: x => names.has(x) };
  }
  setAttribute(k, v) { this.attrs.set(k, v); }
  removeAttribute(k) { this.attrs.delete(k); }
  querySelector() { return this.img; }
}
class ImageElement extends Element {}

function harness() {
  const state = { loadedMediaIds: new Set(), fullLoadedMediaIds: new Set(), failedMediaIds: new Set(), imageRetryAttempts: new Map() };
  const context = vm.createContext({ state, HTMLElement: Element, HTMLImageElement: ImageElement,
    normalizeText: value => String(value || '').trim(), MAX_IMAGE_RETRY_ATTEMPTS: 3,
    buildImageRetryUrl, canRetryImage, getNextImageSource,
    window: { location: { origin: 'https://example.com' } }, console: { warn() {} },
  });
  vm.runInContext(handlers, context);
  function tile() {
    const tile = new Element({ tileId: 'photo' });
    tile.img = new ImageElement({ canonicalSrc: '/file/photo.jpg?preview=1', originalSrc: '/file/photo.jpg', triedOriginal: '1', retryAttempt: '0' });
    return tile;
  }
  return { context, state, tile };
}

describe('photo retry state across DOM replacement', () => {
  it('does not let a second activation bypass an in-flight retry through the preview', () => {
    const start = source.indexOf('function openPreview(');
    const end = source.indexOf('function openPreviewFromEvent(', start);
    const state = { failedMediaIds: new Set(['photo']), previewId: null };
    const tile = new Element();
    tile.classList.add('is-retrying');
    const context = vm.createContext({
      state, refs: { root: { querySelector: () => tile } },
      retryFailedImageTile() { throw new Error('duplicate manual retry'); },
      normalizeText() { throw new Error('preview bypassed the retry gate'); },
    });
    vm.runInContext(source.slice(start, end), context);
    context.openPreview('photo');
    assert.equal(state.previewId, null);
  });

  function resetHarness() {
    const state = {
      loadedMediaIds: new Set(['photo', 'removed']), fullLoadedMediaIds: new Set(),
      failedMediaIds: new Set(['photo', 'removed']), imageRetryAttempts: new Map([['photo', 3], ['removed', 2]]),
    };
    const start = source.indexOf('function buildMediaSourceSignature(');
    const end = source.indexOf('function normalizeMultilineText(', start);
    const context = vm.createContext({ state, safeArray: value => Array.isArray(value) ? value : [], normalizeText: value => String(value || '').trim() });
    vm.runInContext(source.slice(start, end), context);
    return { state, reset: context.resetMediaLoadStateForSourceChanges };
  }

  it('resets exhausted retries when the same file gets a repaired source', () => {
    const { state, reset } = resetHarness();
    reset([{ id: 'photo', sourceUrl: '/file/old.jpg' }], [{ id: 'photo', sourceUrl: '/file/repaired.jpg' }]);
    assert.equal(state.failedMediaIds.has('photo'), false);
    assert.equal(state.imageRetryAttempts.has('photo'), false);
  });

  it('prunes retry records for removed files without refreshing an unchanged budget', () => {
    const { state, reset } = resetHarness();
    const item = { id: 'photo', sourceUrl: '/file/photo.jpg' };
    reset([item], [item]);
    assert.equal(state.imageRetryAttempts.has('removed'), false);
    assert.equal(state.imageRetryAttempts.get('photo'), 3);
    assert.equal(state.failedMediaIds.has('photo'), true);
  });

  it('passes the manual attempt to HEIC downloads while retaining the canonical cache key', () => {
    const requests = [];
    const cache = new Map();
    const context = vm.createContext({
      heicTileObjectUrls: cache, MAX_IMAGE_RETRY_ATTEMPTS: 3, buildImageRetryUrl,
      window: { location: { origin: 'https://example.com' } },
      heicTileDecodeQueue: { enqueue: (...args) => requests.push(args) },
      applyHeicTileObjectUrl: () => requests.push('cached'),
    });
    const start = source.indexOf('function scheduleHeicTileDecode(');
    vm.runInContext(source.slice(start, source.indexOf('function swapTileToFullImage(', start)), context);
    const img = new ImageElement({ heicTileDecodeSrc: '/file/photo.heic', retryAttempt: '2' });
    const tile = new Element();
    context.scheduleHeicTileDecode(img, tile);
    assert.equal(requests[0][2], '/file/photo.heic');
    assert.equal(requests[0][3], 'https://example.com/file/photo.heic?retry=2');
    cache.set('/file/photo.heic', 'blob:decoded');
    context.scheduleHeicTileDecode(img, tile);
    assert.equal(requests[1], 'cached');
  });

  it('lets selection buttons activate natively instead of retrying or using a stale tile focus', () => {
    const start = source.indexOf('function handleKeyDown(');
    const end = source.indexOf('  // Film cards and music rows', start);
    const prefix = source.slice(start, end) + '\n throw new Error("fell through to grid shortcuts");\n}';
    class Button extends Element {
      closest(selector) { return selector === 'button[data-action="toggle-select"]' ? this : null; }
    }
    const context = vm.createContext({ Element, HTMLElement: Element,
      document: { body: { classList: { contains: () => true } } },
      retryFailedImageTile() { throw new Error('selection triggered retry'); },
    });
    vm.runInContext(prefix, context);
    for (const key of ['Enter', ' ']) {
      context.handleKeyDown({ key, target: new Button(), preventDefault() { throw new Error('native button suppressed'); } });
    }
  });

  it('fetches the HEIC retry URL and caches decoded output under its stable source', async () => {
    const start = source.indexOf('async function decodeHeicTileToObjectUrl(');
    const decodeSource = source.slice(start, source.indexOf('async function downscaleImageBlob(', start))
      .replace("await import('./heic-decoder.js?v=3')", 'decoder');
    const requests = [];
    const cache = new Map();
    const context = vm.createContext({
      heicTileObjectUrls: cache, HEIC_TILE_DECODE_MAX_EDGE: 640,
      decoder: { decodeHeicBufferToBlob: async () => 'decoded' },
      fetch: async (url, options) => {
        requests.push({ url, credentials: options.credentials });
        return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
      },
      downscaleImageBlob: async blob => blob,
      URL: { createObjectURL: () => 'blob:retry-success' },
    });
    vm.runInContext(decodeSource, context);
    assert.equal(await context.decodeHeicTileToObjectUrl('/file/a.heic', '/file/a.heic?retry=1'), 'blob:retry-success');
    assert.deepEqual(requests, [{ url: '/file/a.heic?retry=1', credentials: 'same-origin' }]);
    assert.equal(cache.get('/file/a.heic'), 'blob:retry-success');
    assert.equal(await context.decodeHeicTileToObjectUrl('/file/a.heic'), 'blob:retry-success');
    assert.equal(requests.length, 1);
  });

  it('does not reset the three-attempt budget on a new tile node', () => {
    const { context, state, tile } = harness();
    for (let n = 1; n <= 3; n++) {
      const current = tile();
      assert.equal(context.retryFailedImageTile(current), true);
      assert.equal(state.imageRetryAttempts.get('photo'), n);
      assert.equal(new URL(current.img.src).searchParams.get('retry'), String(n));
      context.markTileImageFailed(current.img, current);
    }
    const replacement = tile();
    assert.equal(context.retryFailedImageTile(replacement), false);
    assert.equal(replacement.img.src, undefined);
    assert.equal(replacement.classList.contains('is-retry-exhausted'), true);
  });

  it('clears remembered loaded flags when a new load fails', () => {
    const { context, state, tile } = harness();
    const current = tile();
    state.loadedMediaIds.add('photo'); state.fullLoadedMediaIds.add('photo');
    context.markTileImageFailed(current.img, current);
    assert.equal(state.failedMediaIds.has('photo'), true);
    assert.equal(state.loadedMediaIds.has('photo'), false);
    assert.equal(state.fullLoadedMediaIds.has('photo'), false);
  });

  it('ignores stale callbacks, but clears failure and retry state after a connected success', () => {
    const { context, state, tile } = harness();
    state.failedMediaIds.add('photo'); state.imageRetryAttempts.set('photo', 2);
    const stale = tile(); stale.isConnected = stale.img.isConnected = false;
    context.markTileImageLoaded(stale.img, stale);
    assert.equal(state.failedMediaIds.has('photo'), true);
    assert.equal(state.imageRetryAttempts.get('photo'), 2);
    const current = tile();
    context.markTileImageLoaded(current.img, current, { fullLoaded: true });
    context.markTileImageFailed(stale.img, stale);
    assert.equal(state.failedMediaIds.has('photo'), false);
    assert.equal(state.imageRetryAttempts.has('photo'), false);
    assert.equal(state.loadedMediaIds.has('photo'), true);
  });
});
