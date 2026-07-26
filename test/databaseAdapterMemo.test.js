import assert from 'node:assert/strict';

import { createDatabaseAdapter, getDatabase } from '../functions/utils/databaseAdapter.js';
import { D1Database } from '../functions/utils/d1Database.js';

// 轻量 D1 binding mock：不依赖 better-sqlite3 原生绑定，专门用来数 DDL 执行次数。
class FakeD1Binding {
  constructor({ failFirstRun = false } = {}) {
    this.prepareCalls = [];
    this.failNextRun = failFirstRun;
  }

  prepare(sql) {
    this.prepareCalls.push(sql);
    const binding = this;
    const statement = {
      bind() { return statement; },
      async run() {
        if (binding.failNextRun) {
          binding.failNextRun = false;
          throw new Error('transient D1 overload');
        }
        return { success: true, results: [], meta: {} };
      },
      async all() { return { results: [] }; },
      async first() { return null; },
    };
    return statement;
  }

  ddlCallCount() {
    return this.prepareCalls.filter((sql) => /CREATE TABLE|CREATE INDEX|ALTER TABLE|PRAGMA/i.test(sql)).length;
  }
}

function createFakeKV() {
  return {
    async get() { return null; },
    async getWithMetadata() { return null; },
    async put() {},
    async delete() {},
    async list() { return { keys: [], list_complete: true, cursor: '' }; },
  };
}

describe('database adapter memoization', () => {
  it('returns the same adapter for repeat getDatabase calls on the same env', () => {
    const env = { img_url: createFakeKV() };
    assert.equal(getDatabase(env), getDatabase(env));
  });

  it('rebuilds the adapter when the env bindings change identity', () => {
    const env = { img_url: createFakeKV() };
    const first = getDatabase(env);
    env.img_d1 = new FakeD1Binding();
    const second = getDatabase(env);
    assert.notEqual(first, second, 'binding fingerprint change must invalidate the memo');
    assert.equal(getDatabase(env), second);
  });

  it('createDatabaseAdapter still returns fresh instances (cold start simulation)', () => {
    const env = { img_url: createFakeKV() };
    assert.notEqual(createDatabaseAdapter(env), createDatabaseAdapter(env));
  });

  it('does not re-run DDL when a second D1Database is created over the same binding', async () => {
    const binding = new FakeD1Binding();
    await new D1Database(binding).ensureSchema();
    const ddlAfterFirst = binding.ddlCallCount();
    assert.ok(ddlAfterFirst > 0, 'first instance runs the schema DDL');

    await new D1Database(binding).ensureSchema();
    assert.equal(binding.ddlCallCount(), ddlAfterFirst, 'second instance must reuse the per-binding schema promise');
  });

  it('repeat getDatabase calls within one isolate run the schema DDL once', async () => {
    const binding = new FakeD1Binding();
    const env = { img_d1: binding };

    const db1 = getDatabase(env);
    await db1.getWithMetadata('photos/a.jpg');
    const ddlAfterFirst = binding.ddlCallCount();
    assert.ok(ddlAfterFirst > 0);

    const db2 = getDatabase(env);
    assert.equal(db2, db1);
    await db2.getWithMetadata('photos/b.jpg');
    assert.equal(binding.ddlCallCount(), ddlAfterFirst, 'no DDL re-run for repeat calls on the same env');
  });

  it('allows a retry after a transient ensureSchema failure instead of latching it', async () => {
    const binding = new FakeD1Binding({ failFirstRun: true });
    const db = new D1Database(binding);

    await assert.rejects(db.ensureSchema(), /transient D1 overload/);

    // 同一实例与同一 binding 都必须能重试，而不是把失败钉死整个 isolate
    await db.ensureSchema();
    await new D1Database(binding).ensureSchema();
    assert.ok(binding.ddlCallCount() > 0);
  });
});
