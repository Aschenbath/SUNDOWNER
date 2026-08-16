import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadHeicQueue(decodePromise, applied) {
  const source = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
  const start = source.indexOf('const heicTileDecodeQueue = {');
  const end = source.indexOf('async function decodeHeicTileToObjectUrl', start);
  assert.ok(start >= 0 && end > start, 'HEIC queue source must be present');
  const queueSource = source.slice(start, end);
  const context = {
    HEIC_TILE_DECODE_CONCURRENCY: 2,
    IMAGE_DECODE_TIMEOUT_MS: 25000,
    window: {
      setTimeout(callback, delay) {
        const timer = setTimeout(callback, delay);
        timer.unref?.();
        return timer;
      },
    },
    decodeHeicTileToObjectUrl: () => decodePromise,
    applyHeicTileObjectUrl: (img, tile, objectUrl) => applied.push({ img, tile, objectUrl }),
    markTileImageFailed: (img, tile, error) => applied.push({ img, tile, error }),
    console: { warn() {} },
    Map,
    Set,
    Promise,
    Error,
  };
  const executable = '(() => { ' + queueSource + '; return heicTileDecodeQueue; })()';
  return vm.runInNewContext(executable, context);
}

function loadDecodeQueue(decodePromise, applied) {
  const source = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
  const start = source.indexOf('const decodeQueue = {');
  const end = source.indexOf('const heicTileDecodeQueue = {', start);
  assert.ok(start >= 0 && end > start, 'generic decode queue source must be present');
  const queueSource = source.slice(start, end);
  class FakeImage {
    decode() {
      return decodePromise;
    }
  }
  const context = {
    IMAGE_DECODE_CONCURRENCY: 1,
    IMAGE_DECODE_TIMEOUT_MS: 25000,
    Image: FakeImage,
    window: {
      innerHeight: 800,
      setTimeout(callback, delay) {
        const timer = setTimeout(callback, delay);
        timer.unref?.();
        return timer;
      },
    },
    normalizeText: (value) => String(value ?? '').trim(),
    captureDimension() {},
    console: { warn() {} },
    Map,
    Promise,
    Error,
  };
  const executable = '(() => { ' + queueSource + '; return decodeQueue; })()';
  return vm.runInNewContext(executable, context);
}

describe('HEIC image decode waiter coordination', () => {
  it('broadcasts a shared decode to a fresh tile when the first tile is detached', async () => {
    let resolveDecode;
    const decodePromise = new Promise((resolve) => {
      resolveDecode = resolve;
    });
    const applied = [];
    const queue = loadHeicQueue(decodePromise, applied);
    const first = { isConnected: true };
    const firstTile = { isConnected: true };
    const second = { isConnected: true };
    const secondTile = { isConnected: true };

    queue.enqueue(first, firstTile, '/file/photos/IMG.HEIC');
    first.isConnected = false;
    firstTile.isConnected = false;
    queue.enqueue(second, secondTile, '/file/photos/IMG.HEIC');

    resolveDecode('blob:decoded-heic');
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(applied, [{
      img: second,
      tile: secondTile,
      objectUrl: 'blob:decoded-heic',
    }]);
  });

  it('updates every connected duplicate waiter from one decode', async () => {
    let resolveDecode;
    const decodePromise = new Promise((resolve) => {
      resolveDecode = resolve;
    });
    const applied = [];
    const queue = loadHeicQueue(decodePromise, applied);
    const first = { isConnected: true };
    const firstTile = { isConnected: true };
    const second = { isConnected: true };
    const secondTile = { isConnected: true };

    queue.enqueue(first, firstTile, '/file/photos/shared.HEIC');
    queue.enqueue(second, secondTile, '/file/photos/shared.HEIC');
    resolveDecode('blob:shared-heic');
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(applied.length, 2);
    assert.deepEqual(applied.map((entry) => entry.img), [first, second]);
  });
});

describe('generic image decode waiter coordination', () => {
  it('retargets an active decode to the replacement DOM tile', async () => {
    let resolveDecode;
    const decodePromise = new Promise((resolve) => {
      resolveDecode = resolve;
    });
    const applied = [];
    const queue = loadDecodeQueue(decodePromise, applied);
    const oldImg = { isConnected: true };
    const oldTile = {
      isConnected: true,
      dataset: { tileId: 'same-tile' },
      getBoundingClientRect: () => ({ top: 0, bottom: 100 }),
    };
    const freshImg = { isConnected: true };
    const freshTile = {
      isConnected: true,
      dataset: { tileId: 'same-tile' },
      getBoundingClientRect: () => ({ top: 0, bottom: 100 }),
    };

    queue.enqueue(oldImg, oldTile, '/file/full.jpg', () => applied.push('old'));
    oldImg.isConnected = false;
    oldTile.isConnected = false;
    queue.enqueue(freshImg, freshTile, '/file/full.jpg', () => applied.push('fresh'));

    resolveDecode();
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(applied, ['fresh']);
  });
});
