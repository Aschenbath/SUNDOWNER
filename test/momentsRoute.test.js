import assert from 'node:assert/strict';

import { onRequest } from '../functions/api/manage/moments.js';
import { D1Database } from '../functions/utils/d1Database.js';
import { SqliteD1 } from '../server/sqliteD1.js';

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

function createContext({ request, env, uploadFile, now } = {}) {
  return {
    request: request || new Request('https://example.com/api/manage/moments'),
    env: env || { img_d1: new SqliteD1(':memory:') },
    waitUntil(promise) {
      return promise;
    },
    uploadFile,
    now,
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
});
