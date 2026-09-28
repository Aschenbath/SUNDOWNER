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
