import assert from 'node:assert/strict';

import { onRequest as rootMiddleware } from '../functions/_middleware.js';
import { buildLoginRedirect, buildSafeLoginNext, hasValidAdminSession } from '../functions/utils/dashboardAuth.js';
import { createAdminSessionToken } from '../functions/utils/adminSession.js';
import { onRequest as manageMe } from '../functions/api/manage/me.js';
import { onRequest as manageLogin } from '../functions/api/manage/login.js';
import { onRequest as manageMiddleware } from '../functions/api/manage/_middleware.js';
import { SqliteD1 } from '../server/sqliteD1.js';

class MemoryKV {
  constructor(initialEntries = {}) {
    this.store = new Map(Object.entries(initialEntries));
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
}

function createEnv({ username = 'admin', password = 'secret' } = {}) {
  return {
    img_url: new MemoryKV({
      'manage@sysConfig@security': JSON.stringify({
        auth: {
          user: { authCode: '' },
          admin: { adminUsername: username, adminPassword: password },
        },
        upload: { moderate: { enabled: false, channel: 'default', moderateContentApiKey: '', nsfwApiPath: '' } },
        access: { allowedDomains: '', whiteListMode: false },
        apiTokens: { tokens: {} },
      }),
    }),
    BASIC_USER: '',
    BASIC_PASS: '',
  };
}

async function runRootMiddleware({ request, env = createEnv(), finalHandler = async () => new Response('index') } = {}) {
  return rootMiddleware({
    request,
    env,
    next: finalHandler,
  });
}

async function runManageMiddleware({
  request,
  env = createEnv(),
  finalHandler = async (context) => manageLogin(context),
} = {}) {
  async function dispatch(index) {
    const middleware = manageMiddleware[index];
    if (!middleware) {
      return finalHandler({ request, env });
    }

    return middleware({
      request,
      env,
      data: {},
      next: () => dispatch(index + 1),
    });
  }

  return dispatch(0);
}

describe('dashboard auth gate', () => {
  it('builds a same-origin dashboard next path', () => {
    const request = new Request('http://localhost/dashboard?foo=1');

    assert.equal(buildSafeLoginNext(request), '/dashboard?foo=1');
    assert.equal(buildLoginRedirect(request).headers.get('Location'), 'http://localhost/login?next=%2Fdashboard%3Ffoo%3D1');
  });

  it('redirects unauthenticated dashboard requests before the app loads', async () => {
    const response = await runRootMiddleware({
      request: new Request('http://localhost/dashboard', {
        headers: { Accept: 'text/html' },
      }),
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), 'http://localhost/login?next=%2Fdashboard');
  });

  it('passes authenticated dashboard requests through to the static app', async () => {
    const env = createEnv();
    const token = await createAdminSessionToken('admin', 'secret');
    const response = await runRootMiddleware({
      env,
      request: new Request('http://localhost/dashboard', {
        headers: { Cookie: `admin_auth=${token}` },
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'index');
    assert.equal(await hasValidAdminSession(new Request('http://localhost/dashboard', {
      headers: { Cookie: `admin_auth=${token}` },
    }), env), true);
  });

  it('reports /api/manage/me only when admin_auth is valid', async () => {
    const env = createEnv();
    const missingCookie = await manageMe({
      env,
      request: new Request('http://localhost/api/manage/me'),
    });

    assert.deepEqual(await missingCookie.json(), { username: null });

    const token = await createAdminSessionToken('admin', 'secret');
    const withCookie = await manageMe({
      env,
      request: new Request('http://localhost/api/manage/me', {
        headers: { Cookie: `admin_auth=${token}` },
      }),
    });

    assert.deepEqual(await withCookie.json(), { username: 'admin' });
  });

  it('does not intercept non-dashboard routes', async () => {
    const response = await runRootMiddleware({
      request: new Request('http://localhost/login'),
      finalHandler: async () => new Response('login shell'),
    });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'login shell');
  });

  it('keeps the obsolete manage login endpoint out of the dashboard chain', async () => {
    const response = await runManageMiddleware({
      request: new Request('http://localhost/api/manage/login', {
        headers: { Accept: 'text/html' },
      }),
    });

    assert.equal(response.status, 308);
    assert.equal(response.headers.get('Location'), 'http://localhost/login');
  });

  it('keeps the login page session probe public', async () => {
    const response = await runManageMiddleware({
      request: new Request('http://localhost/api/manage/me', {
        headers: { Accept: 'application/json' },
      }),
      finalHandler: async (context) => manageMe(context),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { username: null });
  });

  it('repairs legacy local index operation schema before session checks', async () => {
    const db = new SqliteD1(':memory:');
    db.exec(`
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        category TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE index_operations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        data TEXT NOT NULL,
        processed BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.db.prepare('INSERT INTO settings (key, value, category) VALUES (?, ?, ?)').run(
      'manage@sysConfig@security',
      JSON.stringify({
        auth: {
          user: { authCode: '' },
          admin: { adminUsername: 'admin', adminPassword: 'secret' },
        },
        upload: { moderate: { enabled: false, channel: 'default', moderateContentApiKey: '', nsfwApiPath: '' } },
        access: { allowedDomains: '', whiteListMode: false },
        apiTokens: { tokens: {} },
      }),
      'security',
    );

    const response = await manageMe({
      env: { img_d1: db, BASIC_USER: '', BASIC_PASS: '' },
      request: new Request('http://localhost/api/manage/me'),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { username: null });

    const columns = db.db.prepare('PRAGMA table_info(index_operations)').all().map((column) => column.name);
    assert.ok(columns.includes('expires_at'));
    assert.ok(columns.includes('updated_at'));
  });
});
