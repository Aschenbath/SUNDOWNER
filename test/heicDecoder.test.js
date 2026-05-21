import assert from 'node:assert/strict';

import {
  decodeHeicBufferToBlob,
  decodeHeicUrlToObjectUrl,
  __setLibheifLoaderForTests,
  __setCanvasFactoryForTests,
  __resetHeicDecoderForTests,
} from '../js/media-library/heic-decoder.js';

// Build a fake libheif module whose HeifDecoder returns a stub image.
function buildLibheifStub({ width = 800, height = 600, callbackArg = 1, displayThrows = false, displayReject = false } = {}) {
  let lastDecodedBytes = null;
  const stubImage = {
    get_width: () => width,
    get_height: () => height,
    display: ({ data, width: dW, height: dH }, cb) => {
      if (displayThrows) {
        throw new Error('libheif boom');
      }
      // Touch the buffer so we know the call was wired correctly.
      if (data && data.length) {
        data[0] = 0xAB;
        data[Math.min(3, data.length - 1)] = 0xCD;
      }
      assert.equal(dW, width);
      assert.equal(dH, height);
      if (displayReject) {
        cb(false);
        return;
      }
      cb(callbackArg);
    },
  };
  return {
    default: {
      HeifDecoder: class {
        decode(bytes) {
          lastDecodedBytes = bytes;
          return [stubImage];
        }
      },
    },
    __getLastDecoded: () => lastDecodedBytes,
  };
}

class FakeCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this._imageData = null;
    this._calls = { putImageData: 0, convertToBlob: 0 };
  }
  getContext(type) {
    assert.equal(type, '2d');
    return {
      putImageData: (imageData) => {
        this._calls.putImageData += 1;
        this._imageData = imageData;
      },
    };
  }
  async convertToBlob({ type, quality } = {}) {
    this._calls.convertToBlob += 1;
    return {
      type: type || 'image/jpeg',
      size: this.width * this.height * 3,
      quality: typeof quality === 'number' ? quality : null,
      width: this.width,
      height: this.height,
    };
  }
}

describe('heic-decoder', () => {
  afterEach(() => {
    __resetHeicDecoderForTests();
  });

  it('decodes a HEIC buffer to a JPEG blob using the injected libheif module', async () => {
    const stub = buildLibheifStub({ width: 4032, height: 3024 });
    __setLibheifLoaderForTests(async () => stub);
    let createdCanvas = null;
    __setCanvasFactoryForTests((w, h) => {
      createdCanvas = new FakeCanvas(w, h);
      return createdCanvas;
    });

    const heicBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);
    const blob = await decodeHeicBufferToBlob(heicBytes.buffer, { quality: 0.8 });

    assert.equal(blob.type, 'image/jpeg');
    assert.equal(blob.quality, 0.8);
    assert.equal(blob.width, 4032);
    assert.equal(blob.height, 3024);
    assert.equal(createdCanvas._calls.putImageData, 1);
    assert.equal(createdCanvas._calls.convertToBlob, 1);
    assert.ok(stub.__getLastDecoded(), 'libheif decode should be called with the raw bytes');
  });

  it('rejects an empty buffer without invoking the decoder', async () => {
    let loaderCalled = false;
    __setLibheifLoaderForTests(async () => {
      loaderCalled = true;
      return buildLibheifStub();
    });

    await assert.rejects(
      decodeHeicBufferToBlob(new Uint8Array(0)),
      /empty heic buffer/,
    );
    assert.equal(loaderCalled, false, 'libheif module must not load for empty buffers');
  });

  it('surfaces libheif loader failures and stays in the failed state on retry', async () => {
    let loaderCalls = 0;
    __setLibheifLoaderForTests(async () => {
      loaderCalls += 1;
      throw new Error('network offline');
    });
    __setCanvasFactoryForTests((w, h) => new FakeCanvas(w, h));

    await assert.rejects(
      decodeHeicBufferToBlob(new Uint8Array([1, 2, 3])),
      /network offline/,
    );

    await assert.rejects(
      decodeHeicBufferToBlob(new Uint8Array([1, 2, 3])),
      /libheif previously failed to load/,
    );
    assert.equal(loaderCalls, 1, 'loader should not be retried after first failure within the session');
  });

  it('rejects when image.display callback reports failure', async () => {
    __setLibheifLoaderForTests(async () => buildLibheifStub({ displayReject: true }));
    __setCanvasFactoryForTests((w, h) => new FakeCanvas(w, h));

    await assert.rejects(
      decodeHeicBufferToBlob(new Uint8Array([1, 2, 3])),
      /libheif image.display callback reported failure/,
    );
  });

  it('decodeHeicUrlToObjectUrl fetches and returns an object URL', async () => {
    __setLibheifLoaderForTests(async () => buildLibheifStub({ width: 100, height: 100 }));
    __setCanvasFactoryForTests((w, h) => new FakeCanvas(w, h));

    const originalFetch = globalThis.fetch;
    const originalCreate = globalThis.URL.createObjectURL;
    const originalRevoke = globalThis.URL.revokeObjectURL;
    let createdFor = null;

    globalThis.fetch = async (url, init) => {
      assert.equal(url, 'https://example.com/file/IMG.HEIC');
      assert.deepEqual(init, { credentials: 'same-origin' });
      return new Response(new Uint8Array([0x00, 0x01, 0x02, 0x03]).buffer, { status: 200 });
    };
    globalThis.URL.createObjectURL = (blob) => {
      createdFor = blob;
      return 'blob:fake-object-url';
    };
    globalThis.URL.revokeObjectURL = () => {};

    try {
      const objectUrl = await decodeHeicUrlToObjectUrl('https://example.com/file/IMG.HEIC');
      assert.equal(objectUrl, 'blob:fake-object-url');
      assert.equal(createdFor.type, 'image/jpeg');
      assert.equal(createdFor.width, 100);
    } finally {
      globalThis.fetch = originalFetch;
      globalThis.URL.createObjectURL = originalCreate;
      globalThis.URL.revokeObjectURL = originalRevoke;
    }
  });

  it('decodeHeicUrlToObjectUrl rejects on non-OK responses without loading libheif', async () => {
    let loaderCalled = false;
    __setLibheifLoaderForTests(async () => {
      loaderCalled = true;
      return buildLibheifStub();
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response('not found', { status: 404 });
    try {
      await assert.rejects(
        decodeHeicUrlToObjectUrl('https://example.com/missing.heic'),
        /HEIC fetch failed: 404/,
      );
      assert.equal(loaderCalled, false, 'libheif loader must not run on 404');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('awaits a factory-shaped default export (raw ESM bundle) before reaching HeifDecoder', async () => {
    // Raw libheif-bundle.mjs (which we vendor) exports a factory function as
    // default, not a ready module with HeifDecoder. The helper must invoke and
    // await that factory before reading HeifDecoder, otherwise it crashes with
    // "libheif module did not expose HeifDecoder" — which is the production
    // bug observed in commit b607fdb that this test pins down.
    let factoryCalls = 0;
    const readyModule = buildLibheifStub({ width: 4032, height: 3024 }).default;
    __setLibheifLoaderForTests(async () => ({
      default: async () => {
        factoryCalls += 1;
        return readyModule;
      },
    }));
    __setCanvasFactoryForTests((w, h) => new FakeCanvas(w, h));

    const blob = await decodeHeicBufferToBlob(new Uint8Array([1, 2, 3]));
    assert.equal(factoryCalls, 1, 'factory must be invoked once to reach HeifDecoder');
    assert.equal(blob.width, 4032);
    assert.equal(blob.height, 3024);

    // A second decode reuses the cached decoder without re-invoking the factory.
    const blob2 = await decodeHeicBufferToBlob(new Uint8Array([4, 5, 6]));
    assert.equal(factoryCalls, 1, 'factory must not be invoked again after the decoder is cached');
    assert.equal(blob2.width, 4032);
  });

  it('still accepts a pre-instantiated module shape (CJS wasm-bundle style)', async () => {
    const stub = buildLibheifStub({ width: 800, height: 600 });
    __setLibheifLoaderForTests(async () => stub);
    __setCanvasFactoryForTests((w, h) => new FakeCanvas(w, h));

    const blob = await decodeHeicBufferToBlob(new Uint8Array([1, 2, 3]));
    assert.equal(blob.width, 800);
    assert.equal(blob.height, 600);
  });
});
