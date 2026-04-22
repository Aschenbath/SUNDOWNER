import assert from 'node:assert/strict';

import { onRequest } from '../functions/api/manage/metadata/[[path]].js';
import { D1Database } from '../functions/utils/d1Database.js';
import { SqliteD1 } from '../server/sqliteD1.js';

function createContext(env, body, fileId = 'photos/test.jpg') {
  return {
    env,
    params: {
      path: fileId
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join(','),
    },
    request: new Request(`https://example.com/api/manage/metadata/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    waitUntil(promise) {
      return promise;
    },
  };
}

describe('metadata route', () => {
  it('accepts DateTaken updates without overwriting existing EXIF capture metadata', async () => {
    const env = {
      img_d1: new SqliteD1(':memory:'),
    };
    const db = new D1Database(env.img_d1);
    await db.put('photos/test.jpg', 'file-value', {
      metadata: {
        FileName: 'test.jpg',
        FileType: 'image/jpeg',
        TimeStamp: 1775628424666,
        Exif: {
          dateTime: '2024-02-03T04:05:06.000Z',
        },
      },
    });

    const response = await onRequest(createContext(env, {
      DateTaken: '2025-04-13T09:30:00.000Z',
    }));

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.metadata.DateTaken, '2025-04-13T09:30:00.000Z');
    assert.equal(payload.metadata.Exif.dateTime, '2024-02-03T04:05:06.000Z');

    const stored = await db.getWithMetadata('photos/test.jpg');
    assert.equal(stored.metadata.DateTaken, '2025-04-13T09:30:00.000Z');
    assert.equal(stored.metadata.Exif.dateTime, '2024-02-03T04:05:06.000Z');
  });

  it('rejects invalid DateTaken values', async () => {
    const env = {
      img_d1: new SqliteD1(':memory:'),
    };
    const db = new D1Database(env.img_d1);
    await db.put('photos/test.jpg', 'file-value', {
      metadata: {
        FileName: 'test.jpg',
        FileType: 'image/jpeg',
        TimeStamp: 1775628424666,
      },
    });

    const response = await onRequest(createContext(env, {
      DateTaken: 'not-a-real-date',
    }));

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.success, false);
    assert.equal(payload.message, 'DateTaken must be a valid date-time string.');
  });

  it('accepts VideoCategory updates and clears legacy category values', async () => {
    const env = {
      img_d1: new SqliteD1(':memory:'),
    };
    const db = new D1Database(env.img_d1);
    await db.put('videos/test.mp4', 'file-value', {
      metadata: {
        FileName: 'test.mp4',
        FileType: 'video/mp4',
        TimeStamp: 1775628424666,
        Category: 'Old bucket',
      },
    });

    const saveResponse = await onRequest(createContext(env, {
      VideoCategory: 'Travel vlog',
    }, 'videos/test.mp4'));

    assert.equal(saveResponse.status, 200);
    const savePayload = await saveResponse.json();
    assert.equal(savePayload.success, true);
    assert.equal(savePayload.metadata.VideoCategory, 'Travel vlog');
    assert.equal(savePayload.metadata.Category, undefined);

    const storedAfterSave = await db.getWithMetadata('videos/test.mp4');
    assert.equal(storedAfterSave.metadata.VideoCategory, 'Travel vlog');
    assert.equal(storedAfterSave.metadata.Category, undefined);

    const clearResponse = await onRequest(createContext(env, {
      VideoCategory: '   ',
    }, 'videos/test.mp4'));

    assert.equal(clearResponse.status, 200);
    const clearPayload = await clearResponse.json();
    assert.equal(clearPayload.success, true);
    assert.equal(clearPayload.metadata.VideoCategory, undefined);

    const storedAfterClear = await db.getWithMetadata('videos/test.mp4');
    assert.equal(storedAfterClear.metadata.VideoCategory, undefined);
  });

  it('accepts Title updates for audio files', async () => {
    const env = {
      img_d1: new SqliteD1(':memory:'),
    };
    const db = new D1Database(env.img_d1);
    await db.put('music/test.m4a', 'file-value', {
      metadata: {
        FileName: 'test.m4a',
        FileType: 'audio/mp4',
        TimeStamp: 1775628424666,
      },
    });

    const response = await onRequest(createContext(env, {
      Title: 'Moonlight Sonata',
    }, 'music/test.m4a'));

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.success, true);
    assert.equal(payload.metadata.Title, 'Moonlight Sonata');

    const stored = await db.getWithMetadata('music/test.m4a');
    assert.equal(stored.metadata.Title, 'Moonlight Sonata');
  });

  it('rejects VideoCategory updates on non-video files', async () => {
    const env = {
      img_d1: new SqliteD1(':memory:'),
    };
    const db = new D1Database(env.img_d1);
    await db.put('photos/test.jpg', 'file-value', {
      metadata: {
        FileName: 'test.jpg',
        FileType: 'image/jpeg',
        TimeStamp: 1775628424666,
      },
    });

    const response = await onRequest(createContext(env, {
      VideoCategory: 'Travel vlog',
    }, 'photos/test.jpg'));

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.success, false);
    assert.equal(payload.message, 'VideoCategory can only be set on video files.');
  });

  it('accepts PrivateAlbum updates on photo/video files and clears them when false', async () => {
    const env = {
      img_d1: new SqliteD1(':memory:'),
    };
    const db = new D1Database(env.img_d1);
    await db.put('photos/test.jpg', 'file-value', {
      metadata: {
        FileName: 'test.jpg',
        FileType: 'image/jpeg',
        TimeStamp: 1775628424666,
      },
    });

    const saveResponse = await onRequest(createContext(env, {
      PrivateAlbum: true,
    }, 'photos/test.jpg'));

    assert.equal(saveResponse.status, 200);
    const savePayload = await saveResponse.json();
    assert.equal(savePayload.success, true);
    assert.equal(savePayload.metadata.PrivateAlbum, true);

    const storedAfterSave = await db.getWithMetadata('photos/test.jpg');
    assert.equal(storedAfterSave.metadata.PrivateAlbum, true);

    const clearResponse = await onRequest(createContext(env, {
      PrivateAlbum: false,
    }, 'photos/test.jpg'));

    assert.equal(clearResponse.status, 200);
    const clearPayload = await clearResponse.json();
    assert.equal(clearPayload.success, true);
    assert.equal(clearPayload.metadata.PrivateAlbum, undefined);

    const storedAfterClear = await db.getWithMetadata('photos/test.jpg');
    assert.equal(storedAfterClear.metadata.PrivateAlbum, undefined);

    await db.put('videos/test.mp4', 'video-data', {
      metadata: {
        FileName: 'test.mp4',
        FileType: 'video/mp4',
        TimeStamp: 1775628424666,
      },
    });

    const videoResponse = await onRequest(createContext(env, {
      PrivateAlbum: true,
    }, 'videos/test.mp4'));

    assert.equal(videoResponse.status, 200);
    const videoPayload = await videoResponse.json();
    assert.equal(videoPayload.metadata.PrivateAlbum, true);

    const storedVideo = await db.getWithMetadata('videos/test.mp4');
    assert.equal(storedVideo.metadata.PrivateAlbum, true);
  });

  it('rejects PrivateAlbum updates on non-media files', async () => {
    const env = {
      img_d1: new SqliteD1(':memory:'),
    };
    const db = new D1Database(env.img_d1);
    await db.put('docs/test.pdf', 'file-value', {
      metadata: {
        FileName: 'test.pdf',
        FileType: 'application/pdf',
        TimeStamp: 1775628424666,
      },
    });

    const response = await onRequest(createContext(env, {
      PrivateAlbum: true,
    }, 'docs/test.pdf'));

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.success, false);
    assert.equal(payload.message, 'PrivateAlbum can only be set on photo or video files.');
  });
});
