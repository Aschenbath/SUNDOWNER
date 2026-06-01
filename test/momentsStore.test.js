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

async function getSqliteObject(d1, name) {
  return d1.prepare('SELECT type, name FROM sqlite_master WHERE name = ?').bind(name).first();
}

function createAttachmentInsertFailingD1(d1) {
  return {
    prepare(sql) {
      const statement = d1.prepare(sql);
      if (!sql.includes('INSERT INTO moment_attachments')) {
        return statement;
      }

      return {
        bind(...params) {
          statement.bind(...params);
          return this;
        },
        async run() {
          throw new Error('attachment insert failed');
        },
        async first(column) {
          return statement.first(column);
        },
        async all() {
          return statement.all();
        },
      };
    },
  };
}

function createAttachmentInsertAndRollbackFailingD1() {
  return {
    prepare(sql) {
      const shouldFailAttachmentInsert = sql.includes('INSERT INTO moment_attachments');
      const shouldFailPostRollback = sql.includes('DELETE FROM moments_posts WHERE id = ?');

      return {
        bind(...params) {
          this.params = params;
          return this;
        },
        async run() {
          if (shouldFailAttachmentInsert) {
            throw new Error('attachment insert failed');
          }
          if (shouldFailPostRollback) {
            throw new Error('post rollback failed');
          }
          return { success: true };
        },
        async first() {
          if (sql.includes("sqlite_master WHERE type = 'table' AND name = 'files'")) {
            return { name: 'files' };
          }
          if (sql.includes('SELECT metadata FROM files WHERE id = ?')) {
            return {
              metadata: JSON.stringify({
                FileName: 'a.jpg',
                FileType: 'image/jpeg',
              }),
            };
          }
          return null;
        },
        async all() {
          if (sql.includes('PRAGMA table_info(moments_posts)')) {
            return { results: [{ name: 'moment_date' }] };
          }
          return { results: [] };
        },
      };
    },
  };
}

function createQueryCountingD1(d1) {
  const counts = {
    filesTableChecks: 0,
    postLookups: 0,
    bulkAttachmentHydrations: 0,
  };

  return {
    counts,
    reset() {
      counts.filesTableChecks = 0;
      counts.postLookups = 0;
      counts.bulkAttachmentHydrations = 0;
    },
    prepare(sql) {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();

      if (normalizedSql === "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'files'") {
        counts.filesTableChecks += 1;
      }

      if (normalizedSql === 'SELECT id, body, created_at, updated_at FROM moments_posts WHERE id = ?') {
        counts.postLookups += 1;
      }

      if (
        normalizedSql.includes('FROM moment_attachments a LEFT JOIN files f ON f.id = a.file_id')
        && normalizedSql.includes('WHERE a.post_id IN (')
      ) {
        counts.bulkAttachmentHydrations += 1;
      }

      return d1.prepare(sql);
    },
  };
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

  it('creates the Moments tables and indexes during schema setup', async () => {
    const d1 = new SqliteD1(':memory:');
    const store = new MomentsStore({ img_d1: d1 });

    await store.ensureSchema();

    await assert.doesNotReject(async () => {
      assert.deepEqual(await getSqliteObject(d1, 'moments_posts'), { type: 'table', name: 'moments_posts' });
      assert.deepEqual(await getSqliteObject(d1, 'moment_attachments'), { type: 'table', name: 'moment_attachments' });
      assert.deepEqual(await getSqliteObject(d1, 'idx_moments_posts_created_at'), { type: 'index', name: 'idx_moments_posts_created_at' });
      assert.deepEqual(await getSqliteObject(d1, 'idx_moment_attachments_post'), { type: 'index', name: 'idx_moment_attachments_post' });
      assert.deepEqual(await getSqliteObject(d1, 'idx_moment_attachments_file'), { type: 'index', name: 'idx_moment_attachments_file' });
    });
  });

  it('trims post bodies to 2000 chars and returns pagination metadata', async () => {
    const d1 = new SqliteD1(':memory:');
    const store = new MomentsStore({ img_d1: d1 });

    const first = await store.createPost({
      body: `  ${'x'.repeat(2005)}  `,
      now: '2026-05-16T20:15:00.000Z',
    });
    await store.createPost({
      body: '第二天',
      now: '2026-05-17T08:00:00.000Z',
    });

    assert.equal(first.body, 'x'.repeat(2000));
    assert.equal(first.body.length, 2000);

    const secondPage = await store.listPosts({ page: 2, pageSize: 1 });
    assert.equal(secondPage.total, 2);
    assert.equal(secondPage.page, 2);
    assert.equal(secondPage.pageSize, 1);
    assert.deepEqual(secondPage.posts.map((post) => post.id), [first.id]);
  });

  it('rolls back the post and attachments when attachment insert fails', async () => {
    const d1 = new SqliteD1(':memory:');
    await seedFile(d1, 'Moments/2026-05-16/a.jpg', { FileName: 'a.jpg', FileType: 'image/jpeg' });
    const store = new MomentsStore({ img_d1: createAttachmentInsertFailingD1(d1) });

    await assert.rejects(
      () => store.createPost({
        body: '应该回滚',
        fileIds: ['Moments/2026-05-16/a.jpg'],
        now: '2026-05-16T20:15:00.000Z',
      }),
      /attachment insert failed/,
    );

    const postCount = await d1.prepare('SELECT COUNT(*) AS total FROM moments_posts').first();
    const attachmentCount = await d1.prepare('SELECT COUNT(*) AS total FROM moment_attachments').first();

    assert.equal(postCount.total, 0);
    assert.equal(attachmentCount.total, 0);
  });

  it('reports both original and rollback errors when create rollback fails', async () => {
    const store = new MomentsStore({ img_d1: createAttachmentInsertAndRollbackFailingD1() });

    await assert.rejects(
      () => store.createPost({
        body: 'rollback should report both errors',
        fileIds: ['Moments/2026-05-16/a.jpg'],
        now: '2026-05-16T20:15:00.000Z',
      }),
      (error) => {
        assert.match(error.message, /attachment insert failed/);
        assert.match(error.message, /post rollback failed/);
        assert.equal(error.cause?.message, 'attachment insert failed');
        assert.equal(error.rollbackError?.message, 'post rollback failed');
        return true;
      },
    );
  });

  it('creates, lists, filters, and deletes D1-backed posts with hydrated image attachments', async () => {
    const baseD1 = new SqliteD1(':memory:');
    await seedFile(baseD1, 'Moments/2026-05-16/a.jpg', { FileName: 'a.jpg', FileType: 'image/jpeg' });
    await seedFile(baseD1, 'Moments/2026-05-17/b.jpg', { FileName: 'b.jpg', FileType: 'image/jpeg' });
    const writeStore = new MomentsStore({ img_d1: baseD1 });

    const first = await writeStore.createPost({
      body: '今天云很好看',
      fileIds: ['Moments/2026-05-16/a.jpg'],
      now: '2026-05-16T20:15:00.000Z',
    });
    const second = await writeStore.createPost({
      body: '第二天',
      fileIds: ['Moments/2026-05-17/b.jpg'],
      now: '2026-05-17T08:00:00.000Z',
    });

    assert.equal(first.body, '今天云很好看');
    assert.equal(first.date, '2026-05-16');
    assert.equal(first.attachments.length, 1);
    assert.equal(first.attachments[0].fileId, 'Moments/2026-05-16/a.jpg');
    assert.equal(first.attachments[0].metadata.FileName, 'a.jpg');

    const countingD1 = createQueryCountingD1(baseD1);
    const readStore = new MomentsStore({ img_d1: countingD1 });
    const all = await readStore.listPosts({ pageSize: 10 });
    assert.deepEqual(all.posts.map((post) => post.id), [second.id, first.id]);
    assert.equal(all.datesWithPhotos['2026-05-16'], 1);
    assert.equal(all.datesWithPhotos['2026-05-17'], 1);
    assert.equal(countingD1.counts.postLookups, 0);
    assert.equal(countingD1.counts.bulkAttachmentHydrations, 1);
    assert.equal(countingD1.counts.filesTableChecks, 1);

    const filtered = await readStore.listPosts({ date: '2026-05-16', pageSize: 10 });
    assert.deepEqual(filtered.posts.map((post) => post.id), [first.id]);
    assert.equal(countingD1.counts.postLookups, 0);
    assert.equal(countingD1.counts.bulkAttachmentHydrations, 2);
    assert.equal(countingD1.counts.filesTableChecks, 1);

    await readStore.deletePost(first.id);
    const afterDelete = await readStore.listPosts({ pageSize: 10 });
    assert.deepEqual(afterDelete.posts.map((post) => post.id), [second.id]);
    assert.equal(countingD1.counts.postLookups, 0);
    assert.equal(countingD1.counts.bulkAttachmentHydrations, 3);
    assert.equal(countingD1.counts.filesTableChecks, 1);

    const fileRecord = await new D1Database(baseD1).getWithMetadata('Moments/2026-05-16/a.jpg');
    assert.equal(fileRecord.metadata.FileName, 'a.jpg');
  });

  it('updates post body and replaces attachment order without touching file records', async () => {
    const d1 = new SqliteD1(':memory:');
    await seedFile(d1, 'Moments/2026-05-16/a.jpg', { FileName: 'a.jpg', FileType: 'image/jpeg' });
    await seedFile(d1, 'Photos/2026-05-16/b.jpg', { FileName: 'b.jpg', FileType: 'image/jpeg' });
    await seedFile(d1, 'Photos/2026-05-16/c.jpg', { FileName: 'c.jpg', FileType: 'image/jpeg' });
    const store = new MomentsStore({ img_d1: d1 });

    const created = await store.createPost({
      body: 'before',
      fileIds: ['Moments/2026-05-16/a.jpg', 'Photos/2026-05-16/b.jpg'],
      now: '2026-05-16T20:15:00.000Z',
    });

    const updated = await store.updatePost(created.id, {
      body: 'after',
      fileIds: ['Photos/2026-05-16/c.jpg', 'Photos/2026-05-16/b.jpg'],
      now: '2026-05-16T20:30:00.000Z',
    });

    assert.equal(updated.body, 'after');
    assert.deepEqual(updated.attachments.map((attachment) => attachment.fileId), [
      'Photos/2026-05-16/c.jpg',
      'Photos/2026-05-16/b.jpg',
    ]);

    const fileRecord = await new D1Database(d1).getWithMetadata('Moments/2026-05-16/a.jpg');
    assert.equal(fileRecord.metadata.FileName, 'a.jpg');
  });

  it('rejects edits that reference missing or non-image existing files', async () => {
    const d1 = new SqliteD1(':memory:');
    await seedFile(d1, 'Photos/2026-05-16/photo.jpg', { FileType: 'image/jpeg' });
    await seedFile(d1, 'Photos/2026-05-16/doc.pdf', { FileType: 'application/pdf' });
    const store = new MomentsStore({ img_d1: d1 });
    const created = await store.createPost({
      body: 'body',
      fileIds: ['Photos/2026-05-16/photo.jpg'],
      now: '2026-05-16T20:15:00.000Z',
    });

    await assert.rejects(
      () => store.updatePost(created.id, {
        body: 'bad',
        fileIds: ['missing.jpg'],
        now: '2026-05-16T20:30:00.000Z',
      }),
      /Attachment file not found/
    );

    await assert.rejects(
      () => store.updatePost(created.id, {
        body: 'bad',
        fileIds: ['Photos/2026-05-16/doc.pdf'],
        now: '2026-05-16T20:30:00.000Z',
      }),
      /Moment attachments must be images/
    );
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
