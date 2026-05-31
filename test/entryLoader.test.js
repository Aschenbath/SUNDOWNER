import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const entryLoaderSource = fs.readFileSync(new URL('../js/entry-loader.js', import.meta.url), 'utf8');
const indexHtmlSource = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const mediaAppSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

function createHarness(pathname = '/login', search = '', hash = '') {
  const warnings = [];
  const scripts = [];
  const links = [];
  const headChildren = [];
  const documentListeners = new Map();
  const nativeParse = JSON.parse;
  const json = {
    parse: nativeParse,
    stringify: JSON.stringify,
  };

  const document = {
    readyState: 'loading',
    head: {
      appendChild(node) {
        const currentIndex = headChildren.indexOf(node);
        if (currentIndex > -1) {
          headChildren.splice(currentIndex, 1);
        }
        headChildren.push(node);
        node.parentNode = document.head;
        if (node.tagName === 'LINK' && !links.includes(node)) {
          links.push(node);
        } else if (node.tagName !== 'LINK' && !scripts.includes(node)) {
          scripts.push(node);
        }
        return node;
      },
      get lastChild() {
        return headChildren[headChildren.length - 1] ?? null;
      },
    },
    addEventListener(name, handler) {
      const handlers = documentListeners.get(name) ?? [];
      handlers.push(handler);
      documentListeners.set(name, handlers);
    },
    createElement(tagName) {
      if (tagName === 'link') {
        return {
          tagName: 'LINK',
          rel: '',
          href: '',
        };
      }
      assert.equal(tagName, 'script');
      return {
        tagName: 'SCRIPT',
        defer: false,
        src: '',
        type: '',
        onload: null,
        onerror: null,
      };
    },
  };

  const window = {
    location: { pathname, search, hash },
    document,
    JSON: json,
  };

  const context = vm.createContext({
    window,
    document,
    console: {
      warn(...args) {
        warnings.push(args);
      },
    },
    JSON: json,
  });

  vm.runInContext(entryLoaderSource, context, { filename: 'entry-loader.js' });

  return {
    context,
    document,
    window,
    scripts,
    links,
    headChildren,
    warnings,
    nativeParse,
    get parse() {
      return json.parse;
    },
    triggerDocumentEvent(name) {
      if (name === 'DOMContentLoaded') {
        document.readyState = 'interactive';
      }
      (documentListeners.get(name) ?? []).forEach((handler) => handler());
    },
    triggerLoad(index) {
      const script = scripts[index];
      assert.ok(script, `missing script ${index}`);
      assert.equal(typeof script.onload, 'function');
      script.onload();
    },
    triggerError(index) {
      const script = scripts[index];
      assert.ok(script, `missing script ${index}`);
      assert.equal(typeof script.onerror, 'function');
      script.onerror(new Error('load failed'));
    },
  };
}

function createBrokenLegacyLocalePayload() {
  const padding = 'x'.repeat(1200);
  return `{"login":{"password":"pw","title":"Login to SUNDOWNER"},"upload":{},"padding":"${padding}"`;
}

describe('legacy entry loader', () => {
  it('injects the dashboard media app on /dashboard routes without legacy scripts', () => {
    const harness = createHarness('/dashboard');

    assert.equal(harness.scripts.length, 1);
    assert.equal(harness.scripts[0].src, '/js/media-library/app.js?v=350');
    assert.equal(harness.scripts[0].type, 'module');
    assert.equal(harness.links.find((link) => link.rel === 'stylesheet')?.href, '/css/media-library.css?v=293');
    assert.deepEqual(harness.links.filter((link) => link.rel === 'modulepreload').map((link) => link.href), [
      '/js/media-library/app.js?v=350',
      '/js/media-library/components.js?v=120',
      '/js/media-library/films-components.js?v=81',
      '/js/theme-system.js?v=2'
    ]);
    assert.equal(harness.parse, harness.nativeParse);
  });

  it('injects the dashboard media app on nested /dashboard routes', () => {
    const harness = createHarness('/dashboard/stats');

    assert.equal(harness.scripts.length, 1);
    assert.equal(harness.scripts[0].src, '/js/media-library/app.js?v=350');
    assert.equal(harness.scripts[0].type, 'module');
    assert.equal(harness.parse, harness.nativeParse);
  });

  it('injects the dashboard media app on clean root visits', () => {
    const harness = createHarness('/');

    assert.equal(harness.scripts.length, 1);
    assert.equal(harness.scripts[0].src, '/js/media-library/app.js?v=350');
    assert.equal(harness.scripts[0].type, 'module');
    assert.equal(harness.parse, harness.nativeParse);
  });

  it('keeps upload and native root visits on the legacy app path', () => {
    const uploadHarness = createHarness('/', '?cmlUpload=1');
    const nativeHarness = createHarness('/', '?cmlNative=1');
    const hashUploadHarness = createHarness('/', '', '#upload');

    assert.equal(uploadHarness.scripts[0].src, '/js/chunk-vendors.8dadfdfd.js');
    assert.equal(nativeHarness.scripts[0].src, '/js/chunk-vendors.8dadfdfd.js');
    assert.equal(hashUploadHarness.scripts[0].src, '/js/chunk-vendors.8dadfdfd.js');
  });

  it('keeps malformed root query strings from crashing the loader', () => {
    const harness = createHarness('/', '?bad=%E0%A4%A&cmlNative=1');

    assert.equal(harness.scripts[0].src, '/js/chunk-vendors.8dadfdfd.js');
  });

  it('loads the new login shell on /login without injecting legacy scripts', () => {
    const harness = createHarness('/login');

    assert.equal(harness.scripts.length, 1);
    assert.equal(harness.scripts[0].src, '/js/login-app.js?v=3');
    assert.equal(harness.scripts[0].type, 'module');
    assert.equal(harness.parse, harness.nativeParse);
  });

  it('injects vendors first and legacy app only after vendors onload on /browse routes', () => {
    const harness = createHarness('/browse/foo');

    assert.equal(harness.scripts.length, 1);
    assert.equal(harness.scripts[0].src, '/js/chunk-vendors.8dadfdfd.js');
    assert.notEqual(harness.parse, harness.nativeParse);

    harness.triggerLoad(0);

    assert.equal(harness.scripts.length, 2);
    assert.equal(harness.scripts[1].src, '/js/app.f0825045.js?v=2');
    assert.notEqual(harness.parse, harness.nativeParse);
  });

  it('still injects legacy for /adminLogin', () => {
    const harness = createHarness('/adminLogin');

    assert.equal(harness.scripts.length, 1);
    assert.equal(harness.scripts[0].src, '/js/chunk-vendors.8dadfdfd.js');
    assert.notEqual(harness.parse, harness.nativeParse);
  });

  it('returns the fallback login locale for corrupted legacy locale payloads', () => {
    const harness = createHarness('/browse/foo');

    const locale = harness.context.JSON.parse(createBrokenLegacyLocalePayload());

    assert.equal(locale.login.title, 'Login to SUNDOWNER');
    assert.equal(locale.login.adminTitle, 'Admin Login');
    assert.equal(locale.login.password, 'Password');
    assert.equal(Object.keys(locale.upload).length, 0);
    assert.equal(harness.warnings.length, 0);
  });

  it('still throws for broken non-legacy JSON payloads', () => {
    const harness = createHarness('/browse/foo');

    assert.throws(() => {
      harness.context.JSON.parse('{"foo":');
    });
    assert.equal(harness.warnings.length, 0);
  });

  it('restores native JSON.parse after legacy app onload', () => {
    const harness = createHarness('/browse/foo');

    harness.triggerLoad(0);
    assert.notEqual(harness.parse, harness.nativeParse);

    harness.triggerLoad(1);

    assert.equal(harness.parse, harness.nativeParse);
  });

  it('restores native JSON.parse after legacy app onerror', () => {
    const harness = createHarness('/browse/foo');

    harness.triggerLoad(0);
    assert.notEqual(harness.parse, harness.nativeParse);

    harness.triggerError(1);

    assert.equal(harness.parse, harness.nativeParse);
  });
});

describe('app shell script loading contract', () => {
  it('does not load the media library module unconditionally from index.html', () => {
    assert.doesNotMatch(indexHtmlSource, /<script[^>]+src="\/js\/media-library\/app\.js\?v=\d+"/);
  });

  it('does not load the media library stylesheet unconditionally from index.html', () => {
    assert.doesNotMatch(indexHtmlSource, /<link[^>]+href="\/css\/media-library\.css\?v=\d+"/);
  });

  it('moves the dynamic media stylesheet after later static styles to preserve dashboard cascade', () => {
    const harness = createHarness('/dashboard');
    const mediaStyle = harness.links.find((link) => link.rel === 'stylesheet');
    const staticStyle = harness.document.createElement('link');

    staticStyle.rel = 'stylesheet';
    staticStyle.href = '/css/ui-overrides.css?v=7';
    harness.document.head.appendChild(staticStyle);

    assert.equal(harness.headChildren.at(-1), staticStyle);

    harness.triggerDocumentEvent('DOMContentLoaded');

    assert.equal(harness.headChildren.at(-1), mediaStyle);
  });

  it('keeps dashboard modulepreload URLs in sync with app.js import URLs', () => {
    const importedComponents = mediaAppSource.match(/from '\.\/components\.js\?v=(\d+)'/)?.[1];
    const importedFilms = mediaAppSource.match(/from '\.\/films-components\.js\?v=(\d+)'/)?.[1];
    const importedTheme = mediaAppSource.match(/from '\.\.\/theme-system\.js\?v=(\d+)'/)?.[1];

    assert.match(entryLoaderSource, /\/js\/media-library\/app\.js\?v=350/);
    assert.ok(entryLoaderSource.includes(`/js/media-library/components.js?v=${importedComponents}`));
    assert.ok(entryLoaderSource.includes(`/js/media-library/films-components.js?v=${importedFilms}`));
    assert.ok(entryLoaderSource.includes(`/js/theme-system.js?v=${importedTheme}`));
  });
});
