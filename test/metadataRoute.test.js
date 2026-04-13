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
});
