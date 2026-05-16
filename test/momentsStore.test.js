import assert from 'node:assert/strict';

import {
  MomentsStore,
  createMomentId,
  normalizeMomentDate,
} from '../functions/utils/momentsStore.js';
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

describe('MomentsStore', () => {
  it('requires a D1 binding', () => {
    assert.throws(() => new MomentsStore({}), /D1 database is required/);
  });

  it('normalizes ISO dates to YYYY-MM-DD', () => {
    assert.equal(normalizeMomentDate('2026-05-16T12:34:56.000Z'), '2026-05-16');
    assert.equal(normalizeMomentDate('bad-date'), '');
  });

  it('creates stable ids with the moment prefix', () => {
    assert.match(createMomentId('2026-05-16T12:34:56.789Z'), /^moment-20260516123456789-/);
  });

  it('creates, lists, filters, and deletes D1-backed posts with hydrated image attachments', async () => {
    const d1 = new SqliteD1(':memory:');
    await seedFile(d1, 'Moments/2026-05-16/a.jpg', { FileName: 'a.jpg', FileType: 'image/jpeg' });
    await seedFile(d1, 'Moments/2026-05-17/b.jpg', { FileName: 'b.jpg', FileType: 'image/jpeg' });
    const store = new MomentsStore({ img_d1: d1 });

    const first = await store.createPost({
      body: '今天云很好看',
      fileIds: ['Moments/2026-05-16/a.jpg'],
      now: '2026-05-16T20:15:00.000Z',
    });
    const second = await store.createPost({
      body: '第二天',
      fileIds: ['Moments/2026-05-17/b.jpg'],
      now: '2026-05-17T08:00:00.000Z',
    });

    assert.equal(first.body, '今天云很好看');
    assert.equal(first.date, '2026-05-16');
    assert.equal(first.attachments.length, 1);
    assert.equal(first.attachments[0].fileId, 'Moments/2026-05-16/a.jpg');
    assert.equal(first.attachments[0].metadata.FileName, 'a.jpg');

    const all = await store.listPosts({ pageSize: 10 });
    assert.deepEqual(all.posts.map((post) => post.id), [second.id, first.id]);
    assert.equal(all.datesWithPhotos['2026-05-16'], 1);
    assert.equal(all.datesWithPhotos['2026-05-17'], 1);

    const filtered = await store.listPosts({ date: '2026-05-16', pageSize: 10 });
    assert.deepEqual(filtered.posts.map((post) => post.id), [first.id]);

    await store.deletePost(first.id);
    const afterDelete = await store.listPosts({ pageSize: 10 });
    assert.deepEqual(afterDelete.posts.map((post) => post.id), [second.id]);

    const fileRecord = await new D1Database(d1).getWithMetadata('Moments/2026-05-16/a.jpg');
    assert.equal(fileRecord.metadata.FileName, 'a.jpg');
  });

  it('rejects empty posts, too many attachments, missing files, and non-image attachments', async () => {
    const d1 = new SqliteD1(':memory:');
    await seedFile(d1, 'Moments/2026-05-16/photo.jpg', { FileType: 'image/jpeg' });
    await seedFile(d1, 'Moments/2026-05-16/doc.pdf', { FileType: 'application/pdf' });
    const store = new MomentsStore({ img_d1: d1 });

    await assert.rejects(
      () => store.createPost({ body: '', fileIds: [], now: '2026-05-16T00:00:00.000Z' }),
      /Moment body or at least one photo is required/,
    );
    await assert.rejects(
      () => store.createPost({
        body: 'too many',
        fileIds: Array.from({ length: 10 }, (_, index) => `Moments/2026-05-16/${index}.jpg`),
        now: '2026-05-16T00:00:00.000Z',
      }),
      /A Moment can include at most 9 photos/,
    );
    await assert.rejects(
      () => store.createPost({ body: 'missing', fileIds: ['missing.jpg'], now: '2026-05-16T00:00:00.000Z' }),
      /Attachment file not found/,
    );
    await assert.rejects(
      () => store.createPost({ body: 'doc', fileIds: ['Moments/2026-05-16/doc.pdf'], now: '2026-05-16T00:00:00.000Z' }),
      /Moment attachments must be images/,
    );
  });
});
