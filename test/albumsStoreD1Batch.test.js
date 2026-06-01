import assert from 'node:assert/strict';

import {
  replacePersistedAlbumState,
} from '../functions/utils/albumsStore.js';

class FakeD1Statement {
  constructor(d1, sql) {
    this.d1 = d1;
    this.sql = sql;
    this.params = [];
  }

  bind(...params) {
    this.params = params;
    return this;
  }

  async run() {
    this.d1.runs.push({ sql: this.sql, params: this.params });
    return { success: true, meta: { changes: 1 } };
  }

  async all() {
    this.d1.allCalls.push({ sql: this.sql, params: this.params });
    if (this.sql.includes('SELECT id, name FROM albums WHERE id !=')) {
      return {
        results: [
          { id: 'old-album-id', name: 'Old Album' },
        ],
      };
    }
    return { results: [] };
  }
}

class FakeD1 {
  constructor() {
    this.runs = [];
    this.allCalls = [];
    this.batchCalls = [];
  }

  prepare(sql) {
    return new FakeD1Statement(this, sql);
  }

  async batch(statements) {
    this.batchCalls.push(statements.map((statement) => ({
      sql: statement.sql,
      params: statement.params,
    })));
    return statements.map(() => ({ success: true }));
  }
}

describe('albumsStore D1 replacement persistence', () => {
  it('commits album state replacement mutations through one D1 batch', async () => {
    const d1 = new FakeD1();

    await replacePersistedAlbumState({ img_d1: d1 }, {
      albumNames: ['Trips'],
      albumAssignments: {
        fileA: ['Trips'],
      },
      albumCovers: {
        trips: 'fileA',
      },
      favorites: ['fileB'],
    });

    assert.equal(d1.batchCalls.length, 1);
    const batchSql = d1.batchCalls[0].map(({ sql }) => sql);
    assert.ok(batchSql.some((sql) => sql.includes('INSERT INTO albums')));
    assert.ok(batchSql.some((sql) => sql.includes('DELETE FROM album_files WHERE album_id = ?')));
    assert.ok(batchSql.some((sql) => sql.includes('INSERT OR REPLACE INTO album_files')));
    assert.ok(batchSql.some((sql) => sql.includes('DELETE FROM albums WHERE id = ?')));
    assert.ok(batchSql.some((sql) => sql.includes('UPDATE albums SET cover_file_id = ? WHERE id = ?')));
  });
});
