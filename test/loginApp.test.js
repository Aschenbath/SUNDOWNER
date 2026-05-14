import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const loginAppSource = fs.readFileSync(new URL('../js/login-app.js', import.meta.url), 'utf8');

function createFakeDom() {
  const listeners = new Map();
  const styleNodes = [];

  const form = {
    addEventListener(type, handler) {
      listeners.set(`form:${type}`, handler);
    },
  };

  const usernameInput = {
    value: '',
    addEventListener(type, handler) {
      listeners.set(`username:${type}`, handler);
    },
    focusCalled: false,
    focus() {
      this.focusCalled = true;
    },
  };

  const passwordInput = {
    value: '',
    addEventListener(type, handler) {
      listeners.set(`password:${type}`, handler);
    },
  };

  const submitButton = {
    disabled: false,
  };

  const root = {
    innerHTML: '',
    querySelector(selector) {
      if (selector === '[data-login-form="1"]') return form;
      if (selector === '[data-login-field="username"]') return usernameInput;
      if (selector === '[data-login-field="password"]') return passwordInput;
      if (selector === '[data-login-submit="1"]') return submitButton;
      return null;
    },
  };

  const head = {
    appendChild(node) {
      styleNodes.push(node);
      return node;
    },
  };

  const document = {
    head,
    getElementById(id) {
      return id === 'app' ? root : null;
    },
    createElement(tagName) {
      return {
        tagName,
        textContent: '',
        attributes: new Map(),
        setAttribute(name, value) {
          this.attributes.set(name, value);
        },
      };
    },
    querySelector(selector) {
      if (selector === '[data-login-app-style="1"]') {
        return styleNodes.find((node) => node.attributes?.get('data-login-app-style') === '1') || null;
      }
      return null;
    },
  };

  return { document, root, form, usernameInput, passwordInput, submitButton, listeners, styleNodes };
}

function loadLoginApp({ fetchImpl = async () => new Response('{}'), assignImpl = () => {}, search = '' } = {}) {
  const dom = createFakeDom();
  const location = { assign: assignImpl, origin: 'http://localhost', search };
  const transformedSource = loginAppSource
    .replace(/^export\s+/gm, '')
    .concat('\nthis.__loginAppExports = { createLoginMarkup, getSafeLoginRedirect, redirectIfAlreadySignedIn, submitAdminLogin, mountLoginApp };');

  const context = vm.createContext({
    window: { document: dom.document, fetch: fetchImpl, location },
    document: dom.document,
    fetch: fetchImpl,
    location,
    console,
    Response,
    Headers,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
  });

  vm.runInContext(transformedSource, context, { filename: 'login-app.js' });

  return { namespace: context.__loginAppExports, dom, location };
}

describe('login app', () => {
  it('renders Username / Password / Login inside a form', () => {
    const { namespace } = loadLoginApp();

    const markup = namespace.createLoginMarkup({ username: '', password: '', error: '', isLoading: false });
    assert.match(markup, /<form class="sla-login__form"/);
    assert.match(markup, /Username/);
    assert.match(markup, /Password/);
    assert.match(markup, />Login</);
    assert.match(markup, /type="submit"/);
  });

  it('shows an error on invalid credentials response', async () => {
    const state = { username: 'admin', password: 'bad', error: '', isLoading: false };
    let renderCount = 0;
    const { namespace } = loadLoginApp();

    const result = await namespace.submitAdminLogin(state, {
      fetchImpl: async () => new Response(JSON.stringify({ error: 'Invalid username or password' }), { status: 401, headers: { 'Content-Type': 'application/json' } }),
      redirectImpl: () => {
        throw new Error('should not redirect');
      },
      render: () => { renderCount += 1; },
    });

    assert.equal(result.redirected, false);
    assert.equal(state.error, 'Invalid username or password');
    assert.equal(state.isLoading, false);
    assert.ok(renderCount >= 2);
  });

  it('redirects to /dashboard on successful login', async () => {
    const state = { username: 'admin', password: 'secret', error: '', isLoading: false };
    let redirectedTo = '';
    const { namespace } = loadLoginApp();

    const result = await namespace.submitAdminLogin(state, {
      fetchImpl: async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      redirectImpl: (href) => { redirectedTo = href; },
      render: () => {},
    });

    assert.equal(result.redirected, true);
    assert.equal(redirectedTo, '/dashboard');
  });

  it('redirects to a safe next path on successful login', async () => {
    const state = { username: 'admin', password: 'secret', error: '', isLoading: false };
    let redirectedTo = '';
    const { namespace } = loadLoginApp();

    const result = await namespace.submitAdminLogin(state, {
      fetchImpl: async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      redirectImpl: (href) => { redirectedTo = href; },
      getRedirectTarget: () => '/dashboard#/films',
      render: () => {},
    });

    assert.equal(result.redirected, true);
    assert.equal(redirectedTo, '/dashboard#/films');
  });

  it('rejects unsafe login next URLs', () => {
    const { namespace } = loadLoginApp();

    assert.equal(namespace.getSafeLoginRedirect({ origin: 'http://localhost', search: '?next=%2Fdashboard%23%2Ffilms' }), '/dashboard#/films');
    assert.equal(namespace.getSafeLoginRedirect({ origin: 'http://localhost', search: '?next=https%3A%2F%2Fevil.test%2Fdashboard' }), '/dashboard');
    assert.equal(namespace.getSafeLoginRedirect({ origin: 'http://localhost', search: '?next=%2Fapi%2Fmanage%2Flogin' }), '/dashboard');
    assert.equal(namespace.getSafeLoginRedirect({ origin: 'http://localhost', search: '?next=%2F%2Fevil.test%2Fdashboard' }), '/dashboard');
  });

  it('redirects away from /login when an admin session already exists', async () => {
    let redirectedTo = '';
    const { namespace } = loadLoginApp();

    const redirected = await namespace.redirectIfAlreadySignedIn({
      fetchImpl: async (url) => {
        assert.equal(url, '/api/manage/me');
        return new Response(JSON.stringify({ username: 'admin' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
      redirectImpl: (href) => { redirectedTo = href; },
      getRedirectTarget: () => '/dashboard',
    });

    assert.equal(redirected, true);
    assert.equal(redirectedTo, '/dashboard');
  });

  it('wires form submit so Enter-style form submission triggers login', async () => {
    let submitted = 0;
    let redirectedTo = '';
    const { namespace, dom } = loadLoginApp({
      fetchImpl: async (url) => {
        if (url === '/api/manage/me') {
          return new Response(JSON.stringify({ username: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        submitted += 1;
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
      assignImpl: (href) => { redirectedTo = href; },
    });

    namespace.mountLoginApp({
      document: dom.document,
      fetchImpl: async (url) => {
        if (url === '/api/manage/me') {
          return new Response(JSON.stringify({ username: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        submitted += 1;
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
      locationImpl: { assign: (href) => { redirectedTo = href; } },
    });

    dom.usernameInput.value = 'admin';
    dom.passwordInput.value = 'secret';
    const submitHandler = dom.listeners.get('form:submit');
    assert.equal(typeof submitHandler, 'function');

    await submitHandler({ preventDefault() {} });

    assert.equal(submitted, 1);
    assert.equal(redirectedTo, '/dashboard');
  });
});
