import assert from 'node:assert/strict';

import { onRequest as metadataOnRequest } from '../functions/api/manage/metadata/[[path]].js';
import { onRequest as moveOnRequest } from '../functions/api/manage/move/[[path]].js';
import { onRequest as renameOnRequest } from '../functions/api/manage/rename/[[path]].js';
import { onRequest as deleteOnRequest } from '../functions/api/manage/delete/[[path]].js';
import { onRequest as restoreOnRequest } from '../functions/api/manage/restore/[[path]].js';
import { onRequest as batchTagsOnRequest } from '../functions/api/manage/tags/batch.js';
import { onRequest as albumsOnRequest } from '../functions/api/manage/albums.js';
import { onRequest as albumsFallbackOnRequest } from '../functions/api/manage/albums/[[path]].js';
import { onRequest as playlistsOnRequest } from '../functions/api/manage/playlists.js';
import { onRequest as mindOnRequest } from '../functions/api/manage/mind.js';
import { onRequest as accountOnRequest } from '../functions/api/manage/account.js';

const INTERNAL_MESSAGE = 'D1 shard failed for private_token_456';

function throwingEnv() {
  return new Proxy({}, {
    get(_target, prop) {
      if (prop === 'img_url') {
        throw new Error(INTERNAL_MESSAGE);
      }
      return undefined;
    },
  });
}

function kvThatThrowsOnFileRead() {
  return {
    async get() {
      return null;
    },
    async getWithMetadata() {
      throw new Error(INTERNAL_MESSAGE);
    },
    async put() {},
    async list() {
      return { keys: [], cursor: null, list_complete: true };
    },
  };
}

function kvThatThrowsOnPut() {
  return {
    async get() {
      return null;
    },
    async getWithMetadata() {
      return null;
    },
    async put() {
      throw new Error(INTERNAL_MESSAGE);
    },
    async delete() {},
    async list() {
      return { keys: [], cursor: null, list_complete: true };
    },
  };
}

function accountKvThatThrowsOnProfileSave() {
  return {
    async get(key) {
      if (key === 'manage@sysConfig@security') {
        return JSON.stringify({
          auth: {
            admin: {
              adminUsername: 'admin',
              adminPassword: 'old-password',
            },
          },
        });
      }
      return null;
    },
    async put() {
      throw new Error(INTERNAL_MESSAGE);
    },
  };
}

function encodedPath(fileId) {
  return fileId
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join(',');
}

function patchRequest(url, body) {
  return new Request(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function postRequest(url, body) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function assertGenericInternalError(response, field = 'message') {
  assert.equal(response.status, 500);
  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload[field], 'Internal server error.');
  assert.ok(!JSON.stringify(payload).includes(INTERNAL_MESSAGE));
}

async function assertGenericErrorOnly(response) {
  assert.equal(response.status, 500);
  const payload = await response.json();
  assert.equal(payload.error, 'Internal server error.');
  assert.ok(!JSON.stringify(payload).includes(INTERNAL_MESSAGE));
}

describe('manage API generic 500 errors', () => {
  let originalConsoleError;

  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = () => {};
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it('hides raw database errors from metadata update responses', async () => {
    const fileId = 'photos/private.jpg';
    const response = await metadataOnRequest({
      env: throwingEnv(),
      params: { path: encodedPath(fileId) },
      request: patchRequest(`https://example.com/api/manage/metadata/${fileId}`, {
        Title: 'Private title',
      }),
      waitUntil() {},
    });

    await assertGenericInternalError(response);
  });

  it('rejects malformed metadata paths as client errors', async () => {
    const response = await metadataOnRequest({
      env: { img_url: kvThatThrowsOnFileRead() },
      params: { path: 'photos%bad.jpg' },
      request: patchRequest('https://example.com/api/manage/metadata/photos%bad.jpg', {
        Title: 'Private title',
      }),
      waitUntil() {},
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.success, false);
    assert.equal(payload.message, 'Invalid file path');
  });

  it('hides raw database errors from rename responses', async () => {
    const fileId = 'photos/private.jpg';
    const response = await renameOnRequest({
      env: throwingEnv(),
      params: { path: encodedPath(fileId) },
      request: postRequest(`https://example.com/api/manage/rename/${fileId}`, {
        newFileId: 'photos/renamed.jpg',
      }),
      waitUntil() {},
    });

    await assertGenericInternalError(response);
  });

  it('rejects malformed rename paths as client errors', async () => {
    const response = await renameOnRequest({
      env: { img_url: kvThatThrowsOnFileRead() },
      params: { path: 'photos%bad.jpg' },
      request: postRequest('https://example.com/api/manage/rename/photos%bad.jpg', {
        newFileId: 'photos/renamed.jpg',
      }),
      waitUntil() {},
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.success, false);
    assert.equal(payload.message, 'Invalid file path');
  });

  it('hides raw database errors from move responses', async () => {
    const fileId = 'photos/private.jpg';
    const response = await moveOnRequest({
      env: throwingEnv(),
      params: { path: encodedPath(fileId) },
      request: new Request(`https://example.com/api/manage/move/${fileId}?dist=archive`),
      waitUntil() {},
    });

    await assertGenericInternalError(response, 'error');
  });

  it('rejects malformed move paths as client errors', async () => {
    const response = await moveOnRequest({
      env: { img_url: kvThatThrowsOnFileRead() },
      params: { path: 'photos%bad.jpg' },
      request: new Request('https://example.com/api/manage/move/photos%bad.jpg?dist=archive'),
      waitUntil() {},
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.success, false);
    assert.equal(payload.error, 'Invalid path');
  });

  it('hides raw folder delete traversal errors from responses', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error(INTERNAL_MESSAGE);
    };

    try {
      const response = await deleteOnRequest({
        env: { img_url: kvThatThrowsOnFileRead() },
        params: { path: 'photos' },
        request: new Request('https://example.com/api/manage/delete/photos?folder=true'),
        waitUntil() {},
      });

      await assertGenericInternalError(response, 'error');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('hides raw database errors from restore responses', async () => {
    const response = await restoreOnRequest({
      env: { img_url: kvThatThrowsOnFileRead() },
      params: { path: encodedPath('photos/private.jpg') },
      request: postRequest('https://example.com/api/manage/restore/photos/private.jpg', {}),
      waitUntil() {},
    });

    await assertGenericInternalError(response, 'error');
  });

  it('hides raw per-file tag update errors from batch tag responses', async () => {
    const response = await batchTagsOnRequest({
      env: { img_url: kvThatThrowsOnFileRead() },
      waitUntil() {},
      request: postRequest('https://example.com/api/manage/tags/batch', {
        fileIds: ['photos/private.jpg'],
        action: 'add',
        tags: ['private'],
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 207);
    assert.equal(payload.success, false);
    assert.equal(payload.errors[0].fileId, 'photos/private.jpg');
    assert.equal(payload.errors[0].error, 'Failed to update tags');
    assert.ok(!JSON.stringify(payload).includes(INTERNAL_MESSAGE));
  });

  it('hides raw storage errors from albums root responses', async () => {
    const response = await albumsOnRequest({
      env: { img_url: kvThatThrowsOnPut() },
      request: postRequest('https://example.com/api/manage/albums', {
        name: 'Private',
      }),
    });

    await assertGenericErrorOnly(response);
  });

  it('hides raw storage errors from albums fallback responses', async () => {
    const response = await albumsFallbackOnRequest({
      env: { img_url: kvThatThrowsOnPut() },
      params: {},
      request: postRequest('https://example.com/api/manage/albums', {
        name: 'Private',
      }),
    });

    await assertGenericErrorOnly(response);
  });

  it('hides raw storage errors from playlists responses', async () => {
    const response = await playlistsOnRequest({
      env: { img_url: kvThatThrowsOnPut() },
      request: postRequest('https://example.com/api/manage/playlists', {
        name: 'Private',
      }),
    });

    await assertGenericErrorOnly(response);
  });

  it('hides raw storage errors from Mind responses', async () => {
    const response = await mindOnRequest({
      env: { img_url: kvThatThrowsOnPut() },
      request: postRequest('https://example.com/api/manage/mind', {
        text: 'private note',
      }),
    });

    await assertGenericErrorOnly(response);
  });

  it('hides raw storage errors from account update responses', async () => {
    const response = await accountOnRequest({
      env: { img_url: accountKvThatThrowsOnProfileSave() },
      request: postRequest('https://example.com/api/manage/account', {
        displayName: 'Private Admin',
      }),
    });

    await assertGenericErrorOnly(response);
  });
});
