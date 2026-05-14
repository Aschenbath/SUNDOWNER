import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const entryLoaderSource = fs.readFileSync(new URL('../js/entry-loader.js', import.meta.url), 'utf8');

function createHarness(pathname = '/login') {
  const warnings = [];
  const scripts = [];
  const nativeParse = JSON.parse;
  const json = {
    parse: nativeParse,
    stringify: JSON.stringify,
  };

  const document = {
    head: {
      appendChild(node) {
        scripts.push(node);
        return node;
      },
    },
    createElement(tagName) {
      assert.equal(tagName, 'script');
      return {
        defer: false,
        src: '',
        type: '',
        onload: null,
        onerror: null,
      };
    },
  };

  const window = {
    location: { pathname },
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
    warnings,
    nativeParse,
    get parse() {
      return json.parse;
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
  it('does not inject legacy scripts on /dashboard routes', () => {
    const harness = createHarness('/dashboard');

    assert.equal(harness.scripts.length, 0);
    assert.equal(harness.parse, harness.nativeParse);
  });

  it('does not inject legacy scripts on nested /dashboard routes', () => {
    const harness = createHarness('/dashboard/stats');

    assert.equal(harness.scripts.length, 0);
    assert.equal(harness.parse, harness.nativeParse);
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
