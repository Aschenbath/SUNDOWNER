import assert from 'node:assert/strict';

import { onRequest } from '../functions/api/manage/moments.js';
import { D1Database } from '../functions/utils/d1Database.js';
import { SqliteD1 } from '../server/sqliteD1.js';
import { createAdminSessionToken } from '../functions/utils/adminSession.js';

class MemoryKV {
  constructor(initialEntries = {}) {
    this.store = new Map(Object.entries(initialEntries));
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async put(key, value) {
    this.store.set(key, String(value));
  }
}

function createMomentStore() {
  return {
    async createPost(mutation) {
      return {
        id: 'moment-1',
        body: mutation.body,
        attachments: mutation.fileIds.map((fileId) => ({ fileId })),
      };
    },
  };
}

async function seedFile(d1, id, metadata = {}) {
  const db = new D1Database(d1);
  await db.put(id, '', {
    metadata: {
      FileName: metadata.FileName || id.split('/').pop(),
      FileType: metadata.FileType || 'image/jpeg',
      TimeStamp: metadata.TimeStamp || Date.now(),
      Directory: metadata.Directory || 'Moments/2026-05-16/',
      ...metadata,
    },
  });
}

function createContext({ request, env, uploadFile, now, processUploadFile, store } = {}) {
  return {
    request: request || new Request('https://example.com/api/manage/moments'),
    env: env || { img_d1: new SqliteD1(':memory:') },
    waitUntil(promise) {
      return promise;
    },
    uploadFile,
    processUploadFile,
    now,
    store,
  };
}

describe('manage moments route', () => {
  it('returns 503 when D1 is missing', async () => {
    const response = await onRequest(createContext({ env: {} }));
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.equal(payload.error, 'Moments require D1 storage');
  });

  it('rejects empty multipart body/photos', async () => {
    const form = new FormData();
    form.set('body', '   ');
    const response = await onRequest(createContext({
      request: new Request('https://example.com/api/manage/moments', { method: 'POST', body: form }),
    }));
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /body or at least one photo/);
  });

  it('rejects non-image photos before upload', async () => {
    const form = new FormData();
    form.append('photos[]', new File(['hello'], 'note.txt', { type: 'text/plain' }));
    const response = await onRequest(createContext({
      request: new Request('https://example.com/api/manage/moments', { method: 'POST', body: form }),
    }));
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error, 'Moments photos must be images');
  });

  it('maps malformed multipart boundaries to 400', async () => {
    const response = await onRequest(createContext({
      request: new Request('https://example.com/api/manage/moments', {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/form-data' },
        body: 'broken-body',
      }),
    }));
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.match(payload.error, /formdata|multipart|boundary/i);
  });

  it('creates a post from multipart photos through the injected upload function', async () => {
    const d1 = new SqliteD1(':memory:');
    let receivedFolder = '';
    const form = new FormData();
    form.set('body', '今天云很好看');
    form.append('photos[]', new File(['fake image'], 'cloud.jpg', { type: 'image/jpeg' }));

    const response = await onRequest(createContext({
      env: { img_d1: d1 },
      now: '2026-05-16T20:15:00.000Z',
      request: new Request('https://example.com/api/manage/moments', { method: 'POST', body: form }),
      uploadFile: async ({ file, uploadFolder }) => {
        receivedFolder = uploadFolder;
        assert.equal(file.name, 'cloud.jpg');
        await seedFile(d1, `${uploadFolder}/cloud.jpg`, { FileName: 'cloud.jpg', FileType: 'image/jpeg' });
        return { fileId: `${uploadFolder}/cloud.jpg`, src: `/file/${uploadFolder}/cloud.jpg` };
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(receivedFolder, 'Moments/2026-05-16');
    assert.equal(payload.post.body, '今天云很好看');
    assert.equal(payload.post.attachments[0].fileId, 'Moments/2026-05-16/cloud.jpg');
  });

  it('authorizes default internal upload path via outer admin session cookie', async () => {
    const d1 = new SqliteD1(':memory:');
    const db = new D1Database(d1);
    await db.put('manage@sysConfig@security', JSON.stringify({
      auth: {
        user: { authCode: '' },
        admin: { adminUsername: 'admin', adminPassword: 'secret' },
      },
      upload: { moderate: { enabled: false, channel: 'default', moderateContentApiKey: '', nsfwApiPath: '' } },
      access: { allowedDomains: '', whiteListMode: false },
      apiTokens: { tokens: {} },
    }));

    const token = await createAdminSessionToken('admin', 'secret');
    const form = new FormData();
    form.set('body', 'session upload');
    form.append('photos[]', new File(['fake image'], 'session.jpg', { type: 'image/jpeg' }));

    let processCalled = false;
    const response = await onRequest(createContext({
      env: { img_d1: d1 },
      now: '2026-05-21T20:15:00.000Z',
      request: new Request('https://example.com/api/manage/moments', {
        method: 'POST',
        headers: { Cookie: `admin_auth=${token}` },
        body: form,
      }),
      processUploadFile: async (_ctx, uploadForm) => {
        processCalled = true;
        await seedFile(d1, 'Moments/2026-05-21/session.jpg', { FileName: 'session.jpg', FileType: 'image/jpeg' });
        assert.equal(uploadForm.get('file').name, 'session.jpg');
        return new Response(JSON.stringify([{ src: '/file/Moments/2026-05-21/session.jpg' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    }));
    const payload = await response.json();

    assert.equal(processCalled, true, 'admin session should reach the upload processor');
    assert.equal(response.status, 200);
    assert.equal(payload.post.attachments[0].fileId, 'Moments/2026-05-21/session.jpg');
  });

  it('requires upload credentials on the default internal upload path', async () => {
    const d1 = new SqliteD1(':memory:');
    const form = new FormData();
    form.set('body', 'auth required');
    form.append('photos[]', new File(['fake image'], 'auth.jpg', { type: 'image/jpeg' }));

    let processCalled = false;
    const response = await onRequest(createContext({
      env: { img_d1: d1 },
      now: '2026-05-16T20:15:00.000Z',
      request: new Request('https://example.com/api/manage/moments', {
        method: 'POST',
        body: form,
      }),
      processUploadFile: async () => {
        processCalled = true;
        throw new Error('should not reach upload processor without credentials');
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.error, 'Unauthorized');
    assert.equal(processCalled, false);
  });

  it('does not forward outer multipart content-type or cookies to the default internal upload path', async () => {
    const kv = new MemoryKV({
      'manage@sysConfig@security': JSON.stringify({
        auth: {
          user: { authCode: 'moments-secret' },
          admin: { adminUsername: '', adminPassword: '' },
        },
        upload: { moderate: { enabled: false, channel: 'default', moderateContentApiKey: '', nsfwApiPath: '' } },
        access: { allowedDomains: '', whiteListMode: false },
        apiTokens: { tokens: {} },
      }),
    });

    const form = new FormData();
    form.set('body', 'header sanitation');
    form.append('photos[]', new File(['fake image'], 'header.jpg', { type: 'image/jpeg' }));
    const outerRequest = new Request('https://example.com/api/manage/moments', {
      method: 'POST',
      headers: {
        authCode: 'moments-secret',
        Cookie: 'authCode=moments-secret',
        'cf-connecting-ip': '203.0.113.9',
        'x-forwarded-for': '198.51.100.8, 198.51.100.9',
        'x-unrelated-header': 'ignore-me',
      },
      body: form,
    });
    const outerContentType = outerRequest.headers.get('Content-Type');

    let observedContentType = null;
    let observedCookie = null;
    let observedAuthCode = null;
    let observedForwardedFor = null;
    let observedCfConnectingIp = null;

    const response = await onRequest(createContext({
      env: {
        img_url: kv,
        TG_BOT_TOKEN: 'bot-token',
        TG_CHAT_ID: '123456',
      },
      now: '2026-05-16T20:15:00.000Z',
      request: outerRequest,
      store: createMomentStore(),
      processUploadFile: async ({ request: uploadRequest }, uploadForm) => {
        observedContentType = uploadRequest.headers.get('Content-Type');
        observedCookie = uploadRequest.headers.get('Cookie');
        observedAuthCode = uploadRequest.headers.get('authCode');
        observedForwardedFor = uploadRequest.headers.get('x-forwarded-for');
        observedCfConnectingIp = uploadRequest.headers.get('cf-connecting-ip');
        assert.equal(uploadRequest.headers.get('x-unrelated-header'), null);
        assert.equal(uploadRequest.headers.get('Authorization'), null);
        assert.equal(uploadForm.get('file').name, 'header.jpg');
        return new Response(JSON.stringify([{ src: '/file/Moments/2026-05-16/header.jpg' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.match(observedContentType || '', /^multipart\/form-data; boundary=/i);
    assert.notEqual(observedContentType, outerContentType);
    assert.equal(observedCookie, null);
    assert.equal(observedAuthCode, 'moments-secret');
    assert.equal(observedForwardedFor, null);
    assert.equal(observedCfConnectingIp, '203.0.113.9');
    assert.equal(payload.post.attachments[0].fileId, 'Moments/2026-05-16/header.jpg');
  });

  it('blocks the default internal upload path for blocked upload IPs', async () => {
    const kv = new MemoryKV({
      'manage@sysConfig@security': JSON.stringify({
        auth: {
          user: { authCode: 'moments-secret' },
          admin: { adminUsername: '', adminPassword: '' },
        },
        upload: { moderate: { enabled: false, channel: 'default', moderateContentApiKey: '', nsfwApiPath: '' } },
        access: { allowedDomains: '', whiteListMode: false },
        apiTokens: { tokens: {} },
      }),
      'manage@blockipList': '203.0.113.77',
    });

    const form = new FormData();
    form.set('body', 'blocked ip');
    form.append('photos[]', new File(['fake image'], 'blocked.jpg', { type: 'image/jpeg' }));

    let processCalled = false;
    const response = await onRequest(createContext({
      env: {
        img_url: kv,
        TG_BOT_TOKEN: 'bot-token',
        TG_CHAT_ID: '123456',
      },
      now: '2026-05-16T20:15:00.000Z',
      store: createMomentStore(),
      request: new Request('https://example.com/api/manage/moments', {
        method: 'POST',
        headers: {
          authCode: 'moments-secret',
          'cf-connecting-ip': '203.0.113.77',
          'x-forwarded-for': '198.51.100.8',
        },
        body: form,
      }),
      processUploadFile: async () => {
        processCalled = true;
        throw new Error('should not reach upload processor when IP is blocked');
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.equal(payload.error, 'Upload IP is blocked');
    assert.equal(processCalled, false);
  });

  it('filters posts by date and deletes only Moment rows, preserving underlying file metadata', async () => {
    const d1 = new SqliteD1(':memory:');
    await seedFile(d1, 'Moments/2026-05-16/a.jpg', { FileName: 'a.jpg' });
    const form = new FormData();
    form.append('photos[]', new File(['fake image'], 'a.jpg', { type: 'image/jpeg' }));
    const createResponse = await onRequest(createContext({
      env: { img_d1: d1 },
      now: '2026-05-16T20:15:00.000Z',
      request: new Request('https://example.com/api/manage/moments', { method: 'POST', body: form }),
      uploadFile: async () => ({ fileId: 'Moments/2026-05-16/a.jpg', src: '/file/Moments/2026-05-16/a.jpg' }),
    }));
    const created = await createResponse.json();

    const listResponse = await onRequest(createContext({
      env: { img_d1: d1 },
      request: new Request('https://example.com/api/manage/moments?date=2026-05-16'),
    }));
    const listPayload = await listResponse.json();
    assert.equal(listResponse.status, 200);
    assert.equal(listPayload.posts.length, 1);

    const deleteResponse = await onRequest(createContext({
      env: { img_d1: d1 },
      request: new Request(`https://example.com/api/manage/moments?id=${encodeURIComponent(created.post.id)}`, { method: 'DELETE' }),
    }));
    assert.equal(deleteResponse.status, 200);

    const afterDeleteResponse = await onRequest(createContext({
      env: { img_d1: d1 },
      request: new Request('https://example.com/api/manage/moments?date=2026-05-16'),
    }));
    const afterDeletePayload = await afterDeleteResponse.json();
    assert.equal(afterDeletePayload.posts.length, 0);

    const fileRecord = await new D1Database(d1).getWithMetadata('Moments/2026-05-16/a.jpg');
    assert.equal(fileRecord.metadata.FileName, 'a.jpg');
  });

  it('creates a post from mixed existing photo ids and uploaded photos', async () => {
    const d1 = new SqliteD1(':memory:');
    await seedFile(d1, 'Photos/2026-05-16/existing.jpg', { FileName: 'existing.jpg', FileType: 'image/jpeg' });
    const form = new FormData();
    form.set('body', 'mixed');
    form.append('existingFileIds[]', 'Photos/2026-05-16/existing.jpg');
    form.append('photos[]', new File(['fake image'], 'upload.jpg', { type: 'image/jpeg' }));

    const response = await onRequest(createContext({
      env: { img_d1: d1 },
      now: '2026-05-16T20:15:00.000Z',
      request: new Request('https://example.com/api/manage/moments', { method: 'POST', body: form }),
      uploadFile: async ({ uploadFolder }) => {
        await seedFile(d1, `${uploadFolder}/upload.jpg`, { FileName: 'upload.jpg', FileType: 'image/jpeg' });
        return { fileId: `${uploadFolder}/upload.jpg`, src: `/file/${uploadFolder}/upload.jpg` };
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.post.body, 'mixed');
    assert.deepEqual(payload.post.attachments.map((attachment) => attachment.fileId), [
      'Photos/2026-05-16/existing.jpg',
      'Moments/2026-05-16/upload.jpg',
    ]);
  });

  it('creates uploaded photos under the selected Moment date', async () => {
    const d1 = new SqliteD1(':memory:');
    const form = new FormData();
    form.set('body', 'historic');
    form.set('date', '2026-04-30');
    form.append('photos[]', new File(['fake image'], 'historic.jpg', { type: 'image/jpeg' }));

    let receivedFolder = '';
    const response = await onRequest(createContext({
      env: { img_d1: d1 },
      now: '2026-05-16T20:15:00.000Z',
      request: new Request('https://example.com/api/manage/moments', { method: 'POST', body: form }),
      uploadFile: async ({ uploadFolder }) => {
        receivedFolder = uploadFolder;
        await seedFile(d1, `${uploadFolder}/historic.jpg`, { FileName: 'historic.jpg', FileType: 'image/jpeg' });
        return { fileId: `${uploadFolder}/historic.jpg`, src: `/file/${uploadFolder}/historic.jpg` };
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(receivedFolder, 'Moments/2026-04-30');
    assert.equal(payload.post.date, '2026-04-30');
    assert.equal(payload.post.attachments[0].fileId, 'Moments/2026-04-30/historic.jpg');
  });

  it('lists posts by the stored Moment date instead of creation time when available', async () => {
    const d1 = new SqliteD1(':memory:');
    await seedFile(d1, 'Moments/2026-04-30/old.jpg', { FileName: 'old.jpg', FileType: 'image/jpeg' });
    await seedFile(d1, 'Moments/2026-05-16/new.jpg', { FileName: 'new.jpg', FileType: 'image/jpeg' });

    const createOldForm = new FormData();
    createOldForm.set('body', 'old');
    createOldForm.set('date', '2026-04-30');
    createOldForm.append('photos[]', new File(['fake image'], 'old.jpg', { type: 'image/jpeg' }));
    const createOldResponse = await onRequest(createContext({
      env: { img_d1: d1 },
      now: '2026-05-16T20:15:00.000Z',
      request: new Request('https://example.com/api/manage/moments', { method: 'POST', body: createOldForm }),
      uploadFile: async () => ({ fileId: 'Moments/2026-04-30/old.jpg', src: '/file/Moments/2026-04-30/old.jpg' }),
    }));
    const oldPayload = await createOldResponse.json();

    const createNewForm = new FormData();
    createNewForm.set('body', 'new');
    createNewForm.append('photos[]', new File(['fake image'], 'new.jpg', { type: 'image/jpeg' }));
    await onRequest(createContext({
      env: { img_d1: d1 },
      now: '2026-05-16T20:20:00.000Z',
      request: new Request('https://example.com/api/manage/moments', { method: 'POST', body: createNewForm }),
      uploadFile: async () => ({ fileId: 'Moments/2026-05-16/new.jpg', src: '/file/Moments/2026-05-16/new.jpg' }),
    }));

    const listOldResponse = await onRequest(createContext({
      env: { img_d1: d1 },
      request: new Request('https://example.com/api/manage/moments?date=2026-04-30'),
    }));
    const listOldPayload = await listOldResponse.json();
    const listNewResponse = await onRequest(createContext({
      env: { img_d1: d1 },
      request: new Request('https://example.com/api/manage/moments?date=2026-05-16'),
    }));
    const listNewPayload = await listNewResponse.json();

    assert.equal(oldPayload.post.date, '2026-04-30');
    assert.equal(listOldPayload.posts.length, 1);
    assert.equal(listOldPayload.posts[0].date, '2026-04-30');
    assert.equal(listNewPayload.posts.length, 1);
    assert.equal(listNewPayload.posts[0].date, '2026-05-16');
  });

  it('patches an existing Moments post with mixed existing and uploaded attachments', async () => {
    const d1 = new SqliteD1(':memory:');
    await seedFile(d1, 'Photos/2026-05-16/existing.jpg', { FileName: 'existing.jpg', FileType: 'image/jpeg' });
    await seedFile(d1, 'Moments/2026-05-16/original.jpg', { FileName: 'original.jpg', FileType: 'image/jpeg' });

    const createForm = new FormData();
    createForm.set('body', 'before');
    createForm.append('photos[]', new File(['fake image'], 'original.jpg', { type: 'image/jpeg' }));
    const createResponse = await onRequest(createContext({
      env: { img_d1: d1 },
      now: '2026-05-16T20:15:00.000Z',
      request: new Request('https://example.com/api/manage/moments', { method: 'POST', body: createForm }),
      uploadFile: async () => ({ fileId: 'Moments/2026-05-16/original.jpg', src: '/file/Moments/2026-05-16/original.jpg' }),
    }));
    const created = await createResponse.json();

    const patchForm = new FormData();
    patchForm.set('body', 'after');
    patchForm.set('date', '2026-04-30');
    patchForm.append('existingFileIds[]', 'Photos/2026-05-16/existing.jpg');
    patchForm.append('photos[]', new File(['fake image'], 'replacement.jpg', { type: 'image/jpeg' }));
    const patchResponse = await onRequest(createContext({
      env: { img_d1: d1 },
      now: '2026-05-16T20:30:00.000Z',
      request: new Request(`https://example.com/api/manage/moments?id=${encodeURIComponent(created.post.id)}`, { method: 'PATCH', body: patchForm }),
      uploadFile: async ({ uploadFolder }) => {
        await seedFile(d1, `${uploadFolder}/replacement.jpg`, { FileName: 'replacement.jpg', FileType: 'image/jpeg' });
        return { fileId: `${uploadFolder}/replacement.jpg`, src: `/file/${uploadFolder}/replacement.jpg` };
      },
    }));
    const patched = await patchResponse.json();

    assert.equal(patchResponse.status, 200);
    assert.equal(patched.post.body, 'after');
    assert.equal(patched.post.date, '2026-04-30');
    assert.deepEqual(patched.post.attachments.map((attachment) => attachment.fileId), [
      'Photos/2026-05-16/existing.jpg',
      'Moments/2026-04-30/replacement.jpg',
    ]);

    const oldDateResponse = await onRequest(createContext({
      env: { img_d1: d1 },
      request: new Request('https://example.com/api/manage/moments?date=2026-05-16'),
    }));
    const oldDatePayload = await oldDateResponse.json();
    assert.equal(oldDatePayload.posts.length, 0);

    const newDateResponse = await onRequest(createContext({
      env: { img_d1: d1 },
      request: new Request('https://example.com/api/manage/moments?date=2026-04-30'),
    }));
    const newDatePayload = await newDateResponse.json();
    assert.equal(newDatePayload.posts.length, 1);
    assert.equal(newDatePayload.posts[0].id, created.post.id);
  });

  it('rejects PATCH without an id before uploading replacement photos', async () => {
    const patchForm = new FormData();
    patchForm.set('body', 'no id');
    patchForm.append('photos[]', new File(['fake image'], 'orphan.jpg', { type: 'image/jpeg' }));

    let uploadCalled = false;
    const response = await onRequest(createContext({
      env: {},
      now: '2026-05-16T20:30:00.000Z',
      request: new Request('https://example.com/api/manage/moments', { method: 'PATCH', body: patchForm }),
      store: {
        updatePost() {
          throw new Error('store.updatePost should not run when PATCH id is missing');
        },
      },
      uploadFile: async () => {
        uploadCalled = true;
        throw new Error('should not upload photos when PATCH id is missing');
      },
    }));
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.error, 'Moment id is required');
    assert.equal(uploadCalled, false);
  });
});
