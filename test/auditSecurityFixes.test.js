import assert from 'node:assert/strict';
import fs from 'node:fs';

import { onRequest as securityOnRequest } from '../functions/api/manage/sysConfig/security.js';
import { onRequest as publicListOnRequest } from '../functions/api/public/list.js';
import { onRequest as davOnRequest } from '../functions/dav/[[path]].js';
import { onRequest as randomOnRequest } from '../functions/random/index.js';
import { onRequest as blockOnRequest } from '../functions/api/manage/block/[[path]].js';
import { onRequest as whiteOnRequest } from '../functions/api/manage/white/[[path]].js';
import { onRequest as directoryTreeOnRequest } from '../functions/api/directoryTree.js';
import { onRequestPost as hfGetUploadUrlPost } from '../functions/upload/huggingface/getUploadUrl.js';
import {
  onRequestPost as hfCommitUploadPost,
  __resetHuggingFaceAPIFactoryForTests as resetCommitHuggingFaceAPIFactory,
  __setHuggingFaceAPIFactoryForTests as setCommitHuggingFaceAPIFactory,
} from '../functions/upload/huggingface/commitUpload.js';
import { userAuthCheck } from '../functions/utils/userAuth.js';
import { returnWithCheck } from '../functions/file/fileTools.js';
import { getAdminProfile, saveAdminProfile } from '../functions/utils/adminProfile.js';
import { mergeTags } from '../functions/utils/tagHelpers.js';

class MemoryKV {
  constructor(initialEntries = {}) {
    this.store = new Map(Object.entries(initialEntries));
    this.metadata = new Map();
    this.failPuts = new Set();
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async getWithMetadata(key) {
    if (!this.store.has(key)) {
      return null;
    }
    if (this.metadata.has(key)) {
      return {
        value: this.store.get(key),
        metadata: this.metadata.get(key) || {},
      };
    }
    return JSON.parse(this.store.get(key));
  }

  async put(key, value, options = {}) {
    if (this.failPuts.has(key)) {
      throw new Error(`KV put failed for ${key}`);
    }
    this.store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    if (options.metadata) {
      this.metadata.set(key, { ...options.metadata });
    } else {
      this.metadata.delete(key);
    }
  }

  async delete(key) {
    this.store.delete(key);
    this.metadata.delete(key);
  }

  async list(options = {}) {
    const prefix = options.prefix || '';
    const keys = [];
    for (const key of this.store.keys()) {
      if (!prefix || key.startsWith(prefix)) {
        keys.push({ name: key, metadata: {} });
      }
    }
    return {
      keys,
      cursor: null,
      list_complete: true,
    };
  }
}

function createEnv(overrides = {}) {
  return {
    img_url: new MemoryKV(),
    ...overrides,
  };
}

function createIndexChunk(files) {
  return JSON.stringify(files.map((file) => ({
    id: file.id,
    metadata: file.metadata,
  })));
}

async function seedHuggingFaceDirectUploadConfig(env) {
  await env.img_url.put('manage@sysConfig@security', JSON.stringify({
    auth: {
      user: { authCode: 'abc123' },
      admin: { adminUsername: 'admin', adminPassword: 'secret' },
    },
    upload: { moderate: { enabled: false, channel: 'default', moderateContentApiKey: '', nsfwApiPath: '' } },
    access: { allowedDomains: '', whiteListMode: false },
    apiTokens: {
      tokens: {
        uploadToken: {
          id: 'uploadToken',
          name: 'Upload token',
          token: 'upload-token',
          owner: 'test',
          permissions: ['upload'],
          createdAt: '2026-06-06T00:00:00.000Z',
          updatedAt: '2026-06-06T00:00:00.000Z',
        },
      },
    },
  }));

  await env.img_url.put('manage@sysConfig@upload', JSON.stringify({
    huggingface: {
      loadBalance: { enabled: false },
      channels: [{
        name: 'HF Direct',
        token: 'hf-secret',
        repo: 'owner/repo',
        isPrivate: true,
        enabled: true,
      }],
    },
  }));
}

function buildValidHuggingFaceDirectPath(fullId, uuid = '123e4567-e89b-42d3-a456-426614174000') {
  const lastSlashIndex = fullId.lastIndexOf('/');
  return lastSlashIndex === -1
    ? `${uuid}_${fullId}`
    : `${fullId.substring(0, lastSlashIndex + 1)}${uuid}_${fullId.substring(lastSlashIndex + 1)}`;
}

describe('audit security hardening', () => {
  afterEach(() => {
    resetCommitHuggingFaceAPIFactory();
  });

  it('does not accept cookie authCode for upload-style checks when disabled', async () => {
    const env = createEnv();
    await env.img_url.put('manage@sysConfig@security', JSON.stringify({
      auth: {
        user: { authCode: 'abc123' },
        admin: { adminUsername: 'admin', adminPassword: 'secret' }
      },
      upload: { moderate: { enabled: false, channel: 'default', moderateContentApiKey: '', nsfwApiPath: '' } },
      access: { allowedDomains: '', whiteListMode: false },
      apiTokens: { tokens: {} }
    }));

    const request = new Request('http://localhost/upload', {
      headers: {
        Cookie: 'authCode=abc123'
      }
    });

    const authorized = await userAuthCheck(env, new URL(request.url), request, 'upload', { allowCookieAuthCode: false });
    assert.equal(authorized, false);
  });

  it('rejects cookie-only auth on HuggingFace direct upload endpoints', async () => {
    const env = createEnv();
    await env.img_url.put('manage@sysConfig@security', JSON.stringify({
      auth: {
        user: { authCode: 'abc123' },
        admin: { adminUsername: 'admin', adminPassword: 'secret' }
      },
      upload: { moderate: { enabled: false, channel: 'default', moderateContentApiKey: '', nsfwApiPath: '' } },
      access: { allowedDomains: '', whiteListMode: false },
      apiTokens: { tokens: {} }
    }));

    const getUploadUrlResponse = await hfGetUploadUrlPost({
      env,
      request: new Request('http://localhost/upload/huggingface/getUploadUrl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'authCode=abc123'
        },
        body: '{}'
      }),
    });

    const commitUploadResponse = await hfCommitUploadPost({
      env,
      waitUntil: async () => {},
      request: new Request('http://localhost/upload/huggingface/commitUpload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'authCode=abc123'
        },
        body: '{}'
      }),
    });

    assert.equal(getUploadUrlResponse.status, 401);
    assert.equal(commitUploadResponse.status, 401);
  });

  it('does not persist HuggingFace direct upload tokens in file metadata or index operations', async () => {
    const env = createEnv({ dev_mode: 'true' });
    await seedHuggingFaceDirectUploadConfig(env);
    const originalFetch = globalThis.fetch;
    const waitUntilPromises = [];
    const commits = [];
    setCommitHuggingFaceAPIFactory(() => ({
      async commitLfsFile(filePath, sha256, fileSize, commitMessage) {
        commits.push({ filePath, sha256, fileSize, commitMessage });
        return { success: true };
      },
      async deleteFile() {
        throw new Error('deleteFile must not be called after successful metadata write');
      },
    }));
    globalThis.fetch = async () => ({
      ok: false,
      async json() {
        return {};
      },
    });

    try {
      const response = await hfCommitUploadPost({
        env,
        waitUntil(promise) {
          waitUntilPromises.push(Promise.resolve(promise));
        },
        request: new Request('http://localhost/upload/huggingface/commitUpload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer upload-token',
          },
          body: JSON.stringify({
            fullId: 'photos/direct.jpg',
            filePath: buildValidHuggingFaceDirectPath('photos/direct.jpg'),
            sha256: 'a'.repeat(64),
            fileSize: 2048,
            fileName: 'direct.jpg',
            fileType: 'image/jpeg',
          }),
        }),
      });

      assert.equal(response.status, 200);
      assert.equal(commits.length, 1);
      const stored = await env.img_url.getWithMetadata('photos/direct.jpg');
      assert.equal(stored.metadata.HfToken, undefined);
      assert.equal(stored.metadata.HfRepo, 'owner/repo');
      assert.equal(stored.metadata.HfFilePath, buildValidHuggingFaceDirectPath('photos/direct.jpg'));

      await Promise.all(waitUntilPromises);
      const indexOperationValues = [...env.img_url.store.entries()]
        .filter(([key]) => key.startsWith('manage@index@operation_'))
        .map(([, value]) => String(value));
      assert.ok(indexOperationValues.length > 0);
      assert.equal(indexOperationValues.some((value) => value.includes('HfToken')), false);
      assert.equal(indexOperationValues.some((value) => value.includes('hf-secret')), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('deletes a committed HuggingFace LFS file when direct upload metadata write fails', async () => {
    const env = createEnv({ dev_mode: 'true' });
    await seedHuggingFaceDirectUploadConfig(env);
    env.img_url.failPuts.add('photos/direct-fail.jpg');
    const originalFetch = globalThis.fetch;
    const deletedFiles = [];
    setCommitHuggingFaceAPIFactory(() => ({
      async commitLfsFile() {
        return { success: true };
      },
      async deleteFile(filePath, commitMessage) {
        deletedFiles.push({ filePath, commitMessage });
        return true;
      },
    }));
    globalThis.fetch = async () => ({
      ok: false,
      async json() {
        return {};
      },
    });

    try {
      const response = await hfCommitUploadPost({
        env,
        waitUntil() {
          throw new Error('endUpload must not be scheduled after metadata write failure');
        },
        request: new Request('http://localhost/upload/huggingface/commitUpload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer upload-token',
          },
          body: JSON.stringify({
            fullId: 'photos/direct-fail.jpg',
            filePath: buildValidHuggingFaceDirectPath('photos/direct-fail.jpg'),
            sha256: 'b'.repeat(64),
            fileSize: 4096,
            fileName: 'direct-fail.jpg',
            fileType: 'image/jpeg',
          }),
        }),
      });

      assert.equal(response.status, 500);
      assert.deepEqual(deletedFiles, [
        {
          filePath: buildValidHuggingFaceDirectPath('photos/direct-fail.jpg'),
          commitMessage: `Delete ${buildValidHuggingFaceDirectPath('photos/direct-fail.jpg')}`,
        },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects HuggingFace direct commit paths that were not generated from the file id', async () => {
    const env = createEnv({ dev_mode: 'true' });
    await seedHuggingFaceDirectUploadConfig(env);
    let commitCalled = false;
    setCommitHuggingFaceAPIFactory(() => ({
      async commitLfsFile() {
        commitCalled = true;
        return { success: true };
      },
      async deleteFile() {
        throw new Error('deleteFile must not be called before a successful commit');
      },
    }));

    const response = await hfCommitUploadPost({
      env,
      waitUntil() {
        throw new Error('endUpload must not be scheduled for rejected direct commit paths');
      },
      request: new Request('http://localhost/upload/huggingface/commitUpload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer upload-token',
        },
        body: JSON.stringify({
          fullId: 'photos/direct.jpg',
          filePath: 'README.md',
          sha256: 'c'.repeat(64),
          fileSize: 2048,
          fileName: 'direct.jpg',
          fileType: 'image/jpeg',
        }),
      }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Invalid filePath: does not match generated upload path' });
    assert.equal(commitCalled, false);
  });

  it('masks sensitive fields in security config responses', async () => {
    const env = createEnv();
    await env.img_url.put('manage@sysConfig@security', JSON.stringify({
      auth: {
        user: { authCode: 'user-secret' },
        admin: { adminUsername: 'admin', adminPassword: 'super-secret' }
      },
      upload: { moderate: { enabled: false, channel: 'default', moderateContentApiKey: 'key', nsfwApiPath: '' } },
      access: { allowedDomains: '', whiteListMode: false },
      apiTokens: { tokens: { token1: { token: 'raw-token' } } }
    }));

    const response = await securityOnRequest({
      env,
      request: new Request('http://localhost/api/manage/sysConfig/security', { method: 'GET' }),
    });

    const payload = await response.json();
    assert.equal(payload.auth.user.authCode, 'Configured');
    assert.equal(payload.auth.user.configured, true);
    assert.equal(payload.auth.admin.adminUsername, 'admin');
    assert.equal(payload.auth.admin.adminPassword, 'Configured');
    assert.equal(payload.auth.admin.configured, true);
    assert.deepEqual(payload.apiTokens, { tokens: {} });
  });

  it('does not allow same-origin referer alone to bypass file access rules', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response('blocked', { status: 403 });
    try {
      const response = await returnWithCheck({
        request: new Request('http://localhost/file/demo.jpg', {
          headers: { Referer: 'http://localhost/dashboard' }
        }),
        url: new URL('http://localhost/file/demo.jpg'),
        securityConfig: {
          access: {
            whiteListMode: true,
            allowedDomains: 'localhost'
          }
        }
      }, {
        metadata: {
          ListType: 'None',
          Label: 'None'
        }
      });

      assert.ok([302, 403].includes(response.status));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('fails closed for public browse when allowed directories are empty', async () => {
    const env = createEnv();
    await env.img_url.put('manage@sysConfig@others', JSON.stringify({
      publicBrowse: {
        enabled: true,
        allowedDir: ''
      }
    }));

    const response = await publicListOnRequest({
      env,
      waitUntil: async () => {},
      request: new Request('http://localhost/api/public/list?dir=photos', { method: 'GET' })
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'Directory not allowed' });
  });

  it('does not let negative public browse counts drop files through Array.slice semantics', async () => {
    const env = createEnv();
    const originalCaches = globalThis.caches;
    globalThis.caches = { default: { open: async () => ({}) } };
    await env.img_url.put('manage@sysConfig@others', JSON.stringify({
      publicBrowse: {
        enabled: true,
        allowedDir: '*'
      }
    }));
    await env.img_url.put('manage@index@meta', JSON.stringify({ chunkCount: 1 }));
    await env.img_url.put('manage@index_0', createIndexChunk([
      {
        id: 'photos/a.jpg',
        metadata: {
          FileName: 'a.jpg',
          FileType: 'image/jpeg',
          Directory: 'photos/',
          TimeStamp: 2,
        },
      },
      {
        id: 'photos/b.jpg',
        metadata: {
          FileName: 'b.jpg',
          FileType: 'image/jpeg',
          Directory: 'photos/',
          TimeStamp: 1,
        },
      },
    ]));

    let response;
    let payload;
    try {
      response = await publicListOnRequest({
        env,
        waitUntil: async () => {},
        request: new Request('http://localhost/api/public/list?dir=photos&count=-1', { method: 'GET' })
      });
      payload = await response.json();
    } finally {
      if (originalCaches === undefined) {
        delete globalThis.caches;
      } else {
        globalThis.caches = originalCaches;
      }
    }

    assert.equal(response.status, 200);
    assert.equal(payload.returnedCount, 2);
    assert.deepEqual(payload.files.map((file) => file.name).sort(), ['photos/a.jpg', 'photos/b.jpg']);
  });

  it('normalizes directory tree cacheTime before writing Cache-Control', async () => {
    const env = createEnv();
    await env.img_url.put('manage@sysConfig@security', JSON.stringify({
      auth: {
        user: { authCode: 'user' },
        admin: { adminUsername: 'admin', adminPassword: 'secret' }
      },
      upload: { moderate: { enabled: false, channel: 'default', moderateContentApiKey: '', nsfwApiPath: '' } },
      access: { allowedDomains: '', whiteListMode: false },
      apiTokens: { tokens: {} }
    }));
    const basic = Buffer.from('admin:secret').toString('base64');

    const response = await directoryTreeOnRequest({
      env,
      request: new Request('http://localhost/api/directoryTree?cacheTime=abc%0D%0AX-Bad:%20yes', {
        method: 'GET',
        headers: { Authorization: `Basic ${basic}` }
      }),
      waitUntil: async () => {}
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'public, max-age=60');
    assert.equal(response.headers.get('X-Bad'), null);
  });

  it('falls back to a safe admin profile when stored profile JSON is corrupt', async () => {
    const env = createEnv();
    await env.img_url.put('manage@profile@admin', '{bad');

    const profile = await getAdminProfile(env.img_url, 'admin');
    assert.deepEqual(profile, {
      username: 'admin',
      displayName: 'admin',
      avatarData: '',
      roleLabel: 'Administrator',
    });

    const saved = await saveAdminProfile(env.img_url, 'admin', { displayName: 'Gilbert' });
    assert.equal(saved.displayName, 'Gilbert');
    assert.doesNotThrow(() => JSON.parse(env.img_url.store.get('manage@profile@admin')));
  });

  it('ignores non-string existing tags when removing tags', () => {
    const result = mergeTags(['keep', 'drop', null, 42, { tag: 'x' }], ['drop'], 'remove');
    assert.deepEqual(result, ['keep']);
  });

  it('does not leak internal error details from public browse failures', async () => {
    const env = createEnv();
    await env.img_url.put('manage@sysConfig@others', JSON.stringify({
      publicBrowse: {
        enabled: true,
        allowedDir: '*'
      }
    }));
    const response = await publicListOnRequest({
      env,
      waitUntil: async () => {},
      request: new Request('http://localhost/api/public/list?dir=photos', { method: 'GET' })
    });

    assert.ok([200, 500].includes(response.status));
    if (response.status === 500) {
      assert.deepEqual(await response.json(), { error: 'Internal server error' });
    }
  });

  it('does not leak internal WebDAV directory errors', async () => {
    const env = createEnv();
    await env.img_url.put('manage@sysConfig@others', JSON.stringify({
      webDAV: {
        enabled: true,
        username: 'dav',
        password: 'pass'
      }
    }));
    await env.img_url.put('manage@sysConfig@security', JSON.stringify({
      auth: {
        user: { authCode: 'user' },
        admin: { adminUsername: 'admin', adminPassword: 'secret' }
      },
      upload: { moderate: { enabled: false, channel: 'default', moderateContentApiKey: '', nsfwApiPath: '' } },
      access: { allowedDomains: '', whiteListMode: false },
      apiTokens: { tokens: {} }
    }));

    const basic = Buffer.from('dav:pass').toString('base64');
    const response = await davOnRequest({
      env,
      request: new Request('http://localhost/dav/', {
        method: 'GET',
        headers: { Authorization: `Basic ${basic}` }
      })
    });

    if (response.status === 500) {
      const body = await response.text();
      assert.equal(body, 'Error listing directory');
    } else {
      assert.ok([200, 403, 404, 207].includes(response.status));
    }
  });

  it('fails closed instead of crashing when WebDAV falls back to default others config', async () => {
    const response = await davOnRequest({
      env: {},
      request: new Request('http://localhost/dav/private.txt', { method: 'GET' })
    });

    assert.equal(response.status, 403);
    assert.equal(await response.text(), 'WebDAV is disabled');
  });

  it('fails closed instead of crashing when random image config falls back to defaults', async () => {
    const response = await randomOnRequest({
      env: {},
      request: new Request('http://localhost/random?dir=photos', { method: 'GET' }),
      waitUntil: async () => {}
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'Random is disabled' });
  });

  it('fails closed when random image is enabled without an allowed directory', async () => {
    const env = createEnv();
    const originalCaches = globalThis.caches;
    globalThis.caches = {
      default: {
        async match() { return undefined; },
        async put() {},
      },
    };
    await env.img_url.put('manage@sysConfig@others', JSON.stringify({
      randomImageAPI: {
        enabled: true,
        allowedDir: '',
      },
    }));
    await env.img_url.put('manage@index@meta', JSON.stringify({ chunkCount: 1 }));
    await env.img_url.put('manage@index_0', createIndexChunk([
      {
        id: 'photos/open.jpg',
        metadata: {
          FileName: 'open.jpg',
          FileType: 'image/jpeg',
          Directory: 'photos/',
          TimeStamp: 1,
        },
      },
    ]));

    let response;
    try {
      response = await randomOnRequest({
        env,
        request: new Request('http://localhost/random?dir=photos', { method: 'GET' }),
        waitUntil: async () => {}
      });
    } finally {
      if (originalCaches === undefined) {
        delete globalThis.caches;
      } else {
        globalThis.caches = originalCaches;
      }
    }

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: 'Directory not allowed' });
  });

  it('does not server-follow external redirects when random image returns inline content', async () => {
    const env = createEnv();
    const originalCaches = globalThis.caches;
    const originalFetch = globalThis.fetch;
    let observedFetchOptions;
    globalThis.caches = {
      default: {
        async match() { return undefined; },
        async put() {},
      },
    };
    globalThis.fetch = async (url, options) => {
      observedFetchOptions = options || {};
      assert.equal(String(url), 'http://localhost/file/links/external.jpg');
      return Response.redirect('http://169.254.169.254/latest/meta-data', 302);
    };
    await env.img_url.put('manage@sysConfig@others', JSON.stringify({
      randomImageAPI: {
        enabled: true,
        allowedDir: 'links',
      },
    }));
    await env.img_url.put('manage@index@meta', JSON.stringify({ chunkCount: 1 }));
    await env.img_url.put('manage@index_0', createIndexChunk([
      {
        id: 'links/external.jpg',
        metadata: {
          FileName: 'external.jpg',
          FileType: 'image/jpeg',
          Directory: 'links/',
          TimeStamp: 1,
        },
      },
    ]));

    let response;
    try {
      response = await randomOnRequest({
        env,
        request: new Request('http://localhost/random?dir=links&type=img', { method: 'GET' }),
        waitUntil: async () => {}
      });
    } finally {
      if (originalCaches === undefined) {
        delete globalThis.caches;
      } else {
        globalThis.caches = originalCaches;
      }
      globalThis.fetch = originalFetch;
    }

    assert.equal(observedFetchOptions.redirect, 'manual');
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), 'http://169.254.169.254/latest/meta-data');
  });

  it('returns 404 instead of crashing when block-listing a missing file', async () => {
    const response = await blockOnRequest({
      env: createEnv(),
      request: new Request('http://localhost/api/manage/block/photos/missing.jpg', { method: 'POST' }),
      params: { path: 'photos,missing.jpg' },
      waitUntil: async () => {}
    });

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { success: false, message: 'File not found.' });
  });

  it('returns 404 instead of crashing when white-listing a missing file', async () => {
    const response = await whiteOnRequest({
      env: createEnv(),
      request: new Request('http://localhost/api/manage/white/photos/missing.jpg', { method: 'POST' }),
      params: { path: 'photos,missing.jpg' },
      waitUntil: async () => {}
    });

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { success: false, message: 'File not found.' });
  });

  it('keeps D1 queryFiles totals accurate when pagination returns no rows', () => {
    const source = fs.readFileSync(new URL('../functions/utils/d1Database.js', import.meta.url), 'utf8');
    const resultsAssignment = source.indexOf('const results = rows.results || [];');
    const emptyOffsetGuard = source.indexOf('if (results.length === 0 && offset > 0)', resultsAssignment);
    const fallbackCount = source.indexOf('SELECT COUNT(*) AS total FROM files${whereSql}', emptyOffsetGuard);
    const filteredParams = source.indexOf(').bind(...params).first();', fallbackCount);

    assert.ok(resultsAssignment >= 0, 'queryFiles should assign paginated results before computing total');
    assert.ok(emptyOffsetGuard > resultsAssignment, 'empty pages past the first offset need a total-count fallback');
    assert.ok(fallbackCount > emptyOffsetGuard, 'fallback count must reuse the same filtered WHERE clause');
    assert.ok(filteredParams > fallbackCount, 'fallback count must bind the same filter params');
  });
});
