const MOMENTS_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS moments_posts (
    id TEXT PRIMARY KEY,
    body TEXT NOT NULL DEFAULT '',
    moment_date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS moment_attachments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (post_id) REFERENCES moments_posts(id) ON DELETE CASCADE
  )`,
  'CREATE INDEX IF NOT EXISTS idx_moments_posts_created_at ON moments_posts(created_at DESC, id ASC)',
  'CREATE INDEX IF NOT EXISTS idx_moment_attachments_post ON moment_attachments(post_id, sort_order ASC, id ASC)',
  'CREATE INDEX IF NOT EXISTS idx_moment_attachments_file ON moment_attachments(file_id)',
];

const MAX_BODY_LENGTH = 2000;
const MAX_PHOTO_COUNT = 9;
const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 60;

function parseJson(rawValue, fallback) {
  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return fallback;
  }
}

function normalizeText(value, maxLength = 0) {
  const normalized = String(value ?? '').replace(/\r\n?/g, '\n').trim();
  return maxLength > 0 ? normalized.slice(0, maxLength) : normalized;
}

function normalizePage(value) {
  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
}

function normalizePageSize(value) {
  const numeric = Number.parseInt(value, 10);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.max(1, Math.min(MAX_PAGE_SIZE, numeric));
}

function normalizeFileIds(fileIds = []) {
  return [...new Set((Array.isArray(fileIds) ? fileIds : [])
    .map((fileId) => normalizeText(fileId, 500))
    .filter(Boolean))];
}

function createAttachmentId(postId, index) {
  return `${postId}-att-${String(index).padStart(2, '0')}`;
}

function assertD1(env = {}) {
  if (!env?.img_d1 || typeof env.img_d1.prepare !== 'function') {
    const error = new Error('D1 database is required for Moments');
    error.status = 503;
    error.expose = true;
    throw error;
  }
  return env.img_d1;
}

export function normalizeMomentDate(value) {
  const raw = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}

export function createMomentId(timestamp = new Date().toISOString()) {
  const safeTimestamp = String(timestamp)
    .replace(/[^0-9]/g, '')
    .slice(0, 17)
    .padEnd(17, '0');

  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return `moment-${safeTimestamp}-${globalThis.crypto.randomUUID()}`;
  }

  return `moment-${safeTimestamp}-${Math.random().toString(36).slice(2, 10)}`;
}

function mapAttachmentRow(row, metadata = {}) {
  return {
    id: row.attachment_id,
    postId: row.post_id,
    fileId: row.file_id,
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.attachment_created_at,
    metadata,
  };
}

function mapPostRow(row, attachments = []) {
  const momentDate = normalizeMomentDate(row.moment_date || row.created_at);
  return {
    id: row.id,
    body: row.body || '',
    momentDate,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    date: momentDate,
    attachments,
  };
}

function createBindPlaceholders(count) {
  return Array.from({ length: count }, () => '?').join(', ');
}

export class MomentsStore {
  constructor(env = {}) {
    this.db = assertD1(env);
    this.schemaReady = null;
    this.filesTableExists = null;
  }

  async ensureSchema() {
    if (!this.schemaReady) {
      this.schemaReady = (async () => {
        for (const sql of MOMENTS_SCHEMA) {
          await this.db.prepare(sql).run();
        }
        const columns = await this.db.prepare('PRAGMA table_info(moments_posts)').all();
        const hasMomentDate = (columns.results || []).some((column) => column.name === 'moment_date');
        if (!hasMomentDate) {
          await this.db.prepare('ALTER TABLE moments_posts ADD COLUMN moment_date TEXT').run();
        }
        await this.db.prepare(
          "UPDATE moments_posts SET moment_date = substr(created_at, 1, 10) WHERE moment_date IS NULL OR moment_date = ''",
        ).run();
        await this.db.prepare(
          'CREATE INDEX IF NOT EXISTS idx_moments_posts_moment_date ON moments_posts(moment_date DESC, created_at DESC, id ASC)',
        ).run();
      })();
    }

    return this.schemaReady;
  }

  async hasFilesTable() {
    await this.ensureSchema();

    if (this.filesTableExists === null) {
      this.filesTableExists = (async () => {
        const row = await this.db.prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'files'",
        ).first();
        return Boolean(row?.name);
      })();
    }

    return this.filesTableExists;
  }

  async getFileMetadata(fileId) {
    await this.ensureSchema();

    if (!await this.hasFilesTable()) {
      return null;
    }

    const row = await this.db.prepare('SELECT metadata FROM files WHERE id = ?').bind(fileId).first();
    return row ? parseJson(row.metadata, {}) : null;
  }

  async validateAttachments(fileIds) {
    if (fileIds.length > MAX_PHOTO_COUNT) {
      throw new Error('A Moment can include at most 9 photos');
    }

    const attachments = [];
    for (const fileId of fileIds) {
      const metadata = await this.getFileMetadata(fileId);
      if (!metadata) {
        throw new Error('Attachment file not found');
      }
      if (!String(metadata.FileType || '').toLowerCase().startsWith('image/')) {
        throw new Error('Moment attachments must be images');
      }
      attachments.push({ fileId, metadata });
    }

    return attachments;
  }

  async createPost({ id = '', body = '', fileIds = [], date = '', now = new Date().toISOString() } = {}) {
    await this.ensureSchema();

    const normalizedBody = normalizeText(body, MAX_BODY_LENGTH);
    const normalizedFileIds = normalizeFileIds(fileIds);

    if (!normalizedBody && normalizedFileIds.length === 0) {
      throw new Error('Moment body or at least one photo is required');
    }

    await this.validateAttachments(normalizedFileIds);

    const createdAt = new Date(now).toISOString();
    const momentDate = normalizeMomentDate(date) || normalizeMomentDate(createdAt);
    const postId = normalizeText(id, 240) || createMomentId(createdAt);

    await this.db.prepare(
      'INSERT INTO moments_posts (id, body, moment_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(postId, normalizedBody, momentDate, createdAt, createdAt).run();

    try {
      for (let index = 0; index < normalizedFileIds.length; index += 1) {
        await this.db.prepare(
          'INSERT INTO moment_attachments (id, post_id, file_id, sort_order, created_at) VALUES (?, ?, ?, ?, ?)',
        ).bind(
          createAttachmentId(postId, index),
          postId,
          normalizedFileIds[index],
          index,
          createdAt,
        ).run();
      }
    } catch (error) {
      await this.db.prepare('DELETE FROM moment_attachments WHERE post_id = ?').bind(postId).run();
      await this.db.prepare('DELETE FROM moments_posts WHERE id = ?').bind(postId).run();
      throw error;
    }

    return this.getPost(postId);
  }

  async updatePost(postId, { body = '', fileIds = [], date = '', now = new Date().toISOString() } = {}) {
    await this.ensureSchema();

    const normalizedId = normalizeText(postId, 240);
    if (!normalizedId) {
      throw new Error('Moment id is required');
    }

    const existingPost = await this.getPost(normalizedId);
    if (!existingPost) {
      throw new Error('Moment post not found');
    }

    const normalizedBody = normalizeText(body, MAX_BODY_LENGTH);
    const normalizedFileIds = normalizeFileIds(fileIds);
    if (!normalizedBody && normalizedFileIds.length === 0) {
      throw new Error('Moment body or at least one photo is required');
    }

    await this.validateAttachments(normalizedFileIds);
    const updatedAt = new Date(now).toISOString();
    const momentDate = normalizeMomentDate(date) || existingPost.momentDate || normalizeMomentDate(existingPost.createdAt) || normalizeMomentDate(updatedAt);

    await this.db.prepare(
      'UPDATE moments_posts SET body = ?, moment_date = ?, updated_at = ? WHERE id = ?'
    ).bind(normalizedBody, momentDate, updatedAt, normalizedId).run();

    try {
      await this.db.prepare('DELETE FROM moment_attachments WHERE post_id = ?').bind(normalizedId).run();
      for (let index = 0; index < normalizedFileIds.length; index += 1) {
        await this.db.prepare(
          'INSERT INTO moment_attachments (id, post_id, file_id, sort_order, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(
          createAttachmentId(normalizedId, index),
          normalizedId,
          normalizedFileIds[index],
          index,
          updatedAt,
        ).run();
      }
    } catch (error) {
      await this.db.prepare('DELETE FROM moment_attachments WHERE post_id = ?').bind(normalizedId).run();
      for (let index = 0; index < existingPost.attachments.length; index += 1) {
        const attachment = existingPost.attachments[index];
        await this.db.prepare(
          'INSERT INTO moment_attachments (id, post_id, file_id, sort_order, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(
          attachment.id || createAttachmentId(normalizedId, index),
          normalizedId,
          attachment.fileId,
          Number(attachment.sortOrder || index),
          attachment.createdAt || existingPost.createdAt,
        ).run();
      }
      await this.db.prepare(
        'UPDATE moments_posts SET body = ?, moment_date = ?, updated_at = ? WHERE id = ?'
      ).bind(existingPost.body || '', existingPost.momentDate || normalizeMomentDate(existingPost.createdAt), existingPost.updatedAt || existingPost.createdAt, normalizedId).run();
      throw error;
    }

    return this.getPost(normalizedId);
  }

  async loadAttachmentsByPostIds(postIds = []) {
    await this.ensureSchema();

    if (!postIds.length) {
      return new Map();
    }

    const placeholders = createBindPlaceholders(postIds.length);
    const attachmentSql = await this.hasFilesTable()
      ? `SELECT a.id AS attachment_id, a.post_id, a.file_id, a.sort_order, a.created_at AS attachment_created_at, f.metadata
         FROM moment_attachments a
         LEFT JOIN files f ON f.id = a.file_id
         WHERE a.post_id IN (${placeholders})
         ORDER BY a.post_id ASC, a.sort_order ASC, a.id ASC`
      : `SELECT id AS attachment_id, post_id, file_id, sort_order, created_at AS attachment_created_at
         FROM moment_attachments
         WHERE post_id IN (${placeholders})
         ORDER BY post_id ASC, sort_order ASC, id ASC`;

    const attachmentRows = await this.db.prepare(attachmentSql).bind(...postIds).all();
    const attachmentsByPostId = new Map(postIds.map((postId) => [postId, []]));

    for (const row of attachmentRows.results || []) {
      const attachments = attachmentsByPostId.get(row.post_id);
      if (!attachments) {
        continue;
      }
      attachments.push(mapAttachmentRow(row, parseJson(row.metadata, {})));
    }

    return attachmentsByPostId;
  }

  async getPost(postId) {
    await this.ensureSchema();

    const postRow = await this.db.prepare(
      'SELECT id, body, moment_date, created_at, updated_at FROM moments_posts WHERE id = ?',
    ).bind(postId).first();

    if (!postRow) {
      return null;
    }

    const attachmentsByPostId = await this.loadAttachmentsByPostIds([postId]);
    return mapPostRow(postRow, attachmentsByPostId.get(postId) || []);
  }

  async listPosts({ date = '', page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
    await this.ensureSchema();

    const normalizedDate = normalizeMomentDate(date);
    const normalizedPage = normalizePage(page);
    const normalizedPageSize = normalizePageSize(pageSize);
    const offset = (normalizedPage - 1) * normalizedPageSize;
    const whereClause = normalizedDate ? ' WHERE COALESCE(NULLIF(moment_date, \'\'), substr(created_at, 1, 10)) = ?' : '';
    const params = normalizedDate ? [normalizedDate] : [];

    const postRows = await this.db.prepare(
      `SELECT id, body, moment_date, created_at, updated_at
       FROM moments_posts${whereClause}
       ORDER BY COALESCE(NULLIF(moment_date, ''), substr(created_at, 1, 10)) DESC, created_at DESC, id ASC
       LIMIT ? OFFSET ?`,
    ).bind(...params, normalizedPageSize, offset).all();

    const pageRows = postRows.results || [];
    const postIds = pageRows.map((row) => row.id);
    const attachmentsByPostId = await this.loadAttachmentsByPostIds(postIds);
    const posts = pageRows.map((row) => mapPostRow(row, attachmentsByPostId.get(row.id) || []));

    const countRow = await this.db.prepare(
      `SELECT COUNT(*) AS total FROM moments_posts${whereClause}`,
    ).bind(...params).first();

    const dateRows = await this.db.prepare(
      `SELECT COALESCE(NULLIF(p.moment_date, ''), substr(p.created_at, 1, 10)) AS date, COUNT(a.id) AS photo_count
       FROM moments_posts p
       JOIN moment_attachments a ON a.post_id = p.id
       GROUP BY COALESCE(NULLIF(p.moment_date, ''), substr(p.created_at, 1, 10))`,
    ).all();

    const datesWithPhotos = {};
    for (const row of dateRows.results || []) {
      datesWithPhotos[row.date] = Number(row.photo_count || 0);
    }

    return {
      posts,
      total: Number(countRow?.total || 0),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      datesWithPhotos,
    };
  }

  async deletePost(postId) {
    await this.ensureSchema();

    const normalizedId = normalizeText(postId, 240);
    if (!normalizedId) {
      throw new Error('Moment id is required');
    }

    await this.db.prepare('DELETE FROM moment_attachments WHERE post_id = ?').bind(normalizedId).run();
    const result = await this.db.prepare('DELETE FROM moments_posts WHERE id = ?').bind(normalizedId).run();

    return {
      deleted: Number(result?.meta?.changes || 0) > 0,
    };
  }
}
