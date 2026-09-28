import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { annotatePhotoAvailability, isPhotoFile, photoAvailabilityKey, recordPhotoResponse, PHOTO_NOT_FOUND_GRACE_MS as GRACE } from '../functions/utils/photoAvailability.js';
import { getDatabase } from '../functions/utils/databaseAdapter.js';
import { onRequest as fileRoute } from '../functions/file/[[path]].js';
import { onRequest as listRoute } from '../functions/api/manage/list.js';
import { SqliteD1 } from '../server/sqliteD1.js';

class MemoryKV {
  constructor() { this.values = new Map(); this.metadata = new Map(); this.writes = []; this.reads = []; }
  async get(key) { this.reads.push(key); return this.values.get(key) ?? null; }
  async put(key, value, options = {}) { this.writes.push(key); this.values.set(key, value); this.metadata.set(key, options.metadata || {}); }
  async delete(key) { this.values.delete(key); this.metadata.delete(key); }
  async getWithMetadata(key) { return this.values.has(key) ? { value: this.values.get(key), metadata: this.metadata.get(key) || {} } : null; }
  async list() { return { keys: [], list_complete: true, cursor: '' }; }
}

const FIRST = Date.UTC(2025, 0, 1);
const FILE = 'photos/a?b#c.jpg';
const missing = { method: 'GET', status: 404, preview: false };
const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
const hideStart = appSource.indexOf('function isPhotoHiddenFromWall(');
const hideEnd = appSource.indexOf('function getFilteredItems(', hideStart);
const hideContext = vm.createContext({});
vm.runInContext(appSource.slice(hideStart, hideEnd), hideContext);
const hidden = (state, now) => hideContext.isPhotoHiddenFromWall({ type: 'photo', photoNotFoundSince: state?.first404At, photoNotFoundConfirmedAt: state?.confirmed404At }, now);

describe('two-week server-observed photo 404 policy', () => {
  for (const storage of ['kv', 'd1', 'hybrid']) {
    it(`persists the grace period, hides only after reconfirmation, and restores without altering file records (${storage})`, async () => {
      const env = { ...(storage !== 'd1' && { img_url: new MemoryKV() }), ...(storage !== 'kv' && { img_d1: new SqliteD1(':memory:') }) };
      try {
        const db = getDatabase(env);
        await db.put(FILE, 'original-bytes', { metadata: { FileName: 'a?b#c.jpg', FileType: 'image/jpeg', Tags: ['keep'] } });
        const before = await db.getWithMetadata(FILE);
        await recordPhotoResponse(env, FILE, missing, FIRST);
        const readState = async () => JSON.parse(await db.get(photoAvailabilityKey(FILE)));
        assert.equal(hidden(await readState(), FIRST + GRACE * 2), false, 'one old 404 is insufficient');
        await recordPhotoResponse({ ...env }, FILE, missing, FIRST + GRACE - 1);
        assert.equal(hidden(await readState(), FIRST + GRACE), false);
        await recordPhotoResponse({ ...env }, FILE, missing, FIRST + GRACE);
        assert.equal(hidden(await readState(), FIRST + GRACE), true);
        assert.deepEqual(await db.getWithMetadata(FILE), before, 'never modify file metadata or bytes');
        for (const status of [304, 403, 415, 429, 500, 503]) {
          await recordPhotoResponse(env, FILE, { ...missing, status }, FIRST + GRACE + 1);
          assert.equal(hidden(await readState(), FIRST + GRACE + 1), true, `${status} is not proof of recovery`);
        }
        await recordPhotoResponse(env, FILE, { ...missing, status: 200, preview: true }, FIRST + GRACE + 2);
        assert.equal(await db.get(photoAvailabilityKey(FILE)), null);
        await recordPhotoResponse(env, FILE, missing, FIRST + GRACE + 3);
        assert.equal((await readState()).first404At, FIRST + GRACE + 3, 'fresh grace period after recovery');
      } finally { env.img_d1?.db.close(); }
    });
  }

  it('ignores thumbnail-only 404s, HEAD checks, other status codes and internal keys', async () => {
    const env = { img_url: new MemoryKV() };
    for (const event of [{ ...missing, preview: true }, { ...missing, method: 'HEAD' }, ...[304, 403, 415, 429, 500, 503].map(status => ({ ...missing, status }))]) {
      await recordPhotoResponse(env, FILE, event, FIRST);
    }
    await recordPhotoResponse(env, 'manage@sysConfig@security', missing, FIRST);
    assert.equal(env.img_url.writes.length, 0);
  });

  it('writes only the first and aged confirmation, not every failed request', async () => {
    const env = { img_url: new MemoryKV() };
    for (const now of [FIRST, FIRST + 1, FIRST + 2, FIRST + GRACE, FIRST + GRACE + 1]) await recordPhotoResponse(env, FILE, missing, now);
    assert.equal(env.img_url.writes.length, 2);
    await recordPhotoResponse(env, FILE, { ...missing, status: 206 }, FIRST + GRACE + 2);
    assert.equal(env.img_url.values.size, 0);
  });

  it('fails visible on invalid/future timestamps and distinguishes photos from video', () => {
    for (const [first404At, confirmed404At] of [[0, FIRST], [-1, FIRST], ['broken', FIRST], [FIRST, FIRST - 1], [FIRST, Infinity]]) {
      assert.equal(hidden({ first404At, confirmed404At }, FIRST + GRACE), false);
    }
    assert.equal(hidden({ first404At: FIRST, confirmed404At: FIRST + GRACE }, FIRST + GRACE - 1), false);
    assert.equal(isPhotoFile('a.HEIC'), true);
    assert.equal(isPhotoFile('opaque', { FileType: 'image/jpeg' }), true);
    assert.equal(isPhotoFile('a.jpg', { FileType: 'video/mp4' }), false);
    assert.equal(hideContext.isPhotoHiddenFromWall({ type: 'video', photoNotFoundSince: FIRST, photoNotFoundConfirmedAt: FIRST + GRACE }, FIRST + GRACE), false);
  });

  it('annotates pages without dropping records, mutating metadata, or trusting imported flags', async () => {
    const env = { img_url: new MemoryKV() };
    await recordPhotoResponse(env, FILE, missing, FIRST);
    await recordPhotoResponse(env, FILE, missing, FIRST + GRACE);
    const files = [{ name: FILE, metadata: { FileType: 'image/jpeg' } }, { name: 'good.jpg', metadata: { PhotoNotFoundSince: FIRST, PhotoNotFoundConfirmedAt: FIRST + GRACE } }, { name: 'video.mp4', metadata: {} }];
    const annotated = await annotatePhotoAvailability(env, files);
    assert.equal(annotated.length, 3);
    assert.equal(annotated[0].metadata.PhotoNotFoundSince, FIRST);
    assert.equal(annotated[1].metadata.PhotoNotFoundSince, undefined);
    assert.equal(files[0].metadata.PhotoNotFoundSince, undefined);
    env.img_url.get = async () => { throw new Error('synthetic storage outage'); };
    const visible = await annotatePhotoAvailability(env, files);
    assert.equal(visible[0].metadata.PhotoNotFoundSince, undefined);
    await assert.doesNotReject(() => recordPhotoResponse(env, FILE, missing, FIRST));
  });

  it('bounds page annotation concurrency and never scans KV', async () => {
    let active = 0, peak = 0;
    const kv = new MemoryKV();
    kv.get = async () => { active++; peak = Math.max(peak, active); await new Promise(resolve => setImmediate(resolve)); active--; return null; };
    kv.list = () => { throw new Error('must not scan'); };
    const files = Array.from({ length: 31 }, (_, i) => ({ name: `photo-${i}.jpg` }));
    assert.equal((await annotatePhotoAvailability({ img_url: kv }, files)).length, files.length);
    assert.ok(peak <= 8);
  });
});

describe('photo availability route integration', () => {
  it('reconfirms an aged storage 404 and clears it only after actual recovered bytes are served', async () => {
    let exists = false;
    const bytes = new Uint8Array([255, 216, 255, 217]);
    const env = { img_url: new MemoryKV(), img_r2: { async get() {
      return exists ? { writeHttpMetadata() {}, size: bytes.length, body: new Response(bytes).body } : null;
    } } };
    const db = getDatabase(env);
    await db.put('recover.jpg', 'retained', { metadata: { Channel: 'CloudflareR2', FileName: 'recover.jpg', FileType: 'image/jpeg', Label: 'safe', ListType: 'None' } });
    await recordPhotoResponse(env, 'recover.jpg', missing, Date.now() - GRACE - 1000);
    async function read(headers = {}) {
      const pending = [];
      const response = await fileRoute({ env, params: { path: 'recover.jpg' }, data: {},
        waitUntil: task => pending.push(task), request: new Request('https://example.com/file/recover.jpg', { headers: { Referer: 'https://example.com/dashboard', ...headers } }),
      });
      await Promise.all(pending);
      return response;
    }
    assert.equal((await read()).status, 404);
    assert.equal(hidden(JSON.parse(await db.get(photoAvailabilityKey('recover.jpg'))), Date.now()), true);
    exists = true;
    const response = await read();
    assert.equal(response.status, 200);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
    assert.equal(await db.get(photoAvailabilityKey('recover.jpg')), null);
    assert.equal(await db.get('recover.jpg'), 'retained');
  });

  it('records an index-only missing original, but not preview-only errors or denied access', async () => {
    const env = { img_url: new MemoryKV() };
    async function request(path, { preview = false, method = 'GET', allowed = true } = {}) {
      const pending = [];
      const response = await fileRoute({
        env, params: { path }, data: {}, next() {}, waitUntil: task => pending.push(task),
        request: new Request(`https://example.com/file/${path}${preview ? '?preview=1' : ''}`, { method, headers: allowed ? { Referer: 'https://example.com/dashboard' } : {} }),
      });
      await Promise.all(pending);
      return response;
    }
    assert.equal((await request('missing.jpg')).status, 404);
    assert.ok(await env.img_url.get(photoAvailabilityKey('missing.jpg')));
    assert.equal((await request('preview.jpg', { preview: true })).status, 404);
    assert.equal(await env.img_url.get(photoAvailabilityKey('preview.jpg')), null);
    assert.equal((await request('head.jpg', { method: 'HEAD' })).status, 404);
    assert.equal(await env.img_url.get(photoAvailabilityKey('head.jpg')), null);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(null, { status: 404 });
    try {
      assert.notEqual((await request('denied.jpg', { allowed: false })).status, 404);
      assert.equal(await env.img_url.get(photoAvailabilityKey('denied.jpg')), null);
    } finally { globalThis.fetch = originalFetch; }
  });

  for (const storage of ['kv', 'd1']) {
    it(`keeps list pagination and administrative visibility intact (${storage})`, async () => {
      const env = storage === 'kv' ? { img_url: new MemoryKV() } : { img_d1: new SqliteD1(':memory:') };
      try {
        const db = getDatabase(env);
        const metadata = { FileName: 'a?b#c.jpg', FileType: 'image/jpeg', Directory: 'photos/', TimeStamp: FIRST };
        if (storage === 'kv') {
          await db.put('manage@index@meta', JSON.stringify({ chunkCount: 1 }));
          await db.put('manage@index_0', JSON.stringify([{ id: FILE, metadata }]));
        } else await db.put(FILE, '', { metadata });
        await recordPhotoResponse(env, FILE, missing, FIRST);
        await recordPhotoResponse(env, FILE, missing, FIRST + GRACE);
        const url = 'https://example.com/api/manage/list?recursive=true&count=20';
        const before = await (await listRoute({ env, waitUntil() {}, request: new Request(url) })).json();
        const response = await listRoute({ env, waitUntil() {}, request: new Request(url + '&photoAvailability=true') });
        assert.equal(response.status, 200);
        const after = await response.json();
        assert.equal(after.totalCount, before.totalCount);
        assert.equal(after.returnedCount, before.returnedCount);
        assert.equal(after.files[0].name, FILE);
        assert.equal(after.files[0].metadata.PhotoNotFoundSince, FIRST);
        assert.equal(before.files[0].metadata.PhotoNotFoundSince, undefined);
      } finally { env.img_d1?.db.close(); }
    });
  }

  it('wires health into the indexed/cached source signature and keeps search as a recovery route', () => {
    assert.match(appSource, /photoAvailability: 'true'/);
    assert.match(appSource, /photoNotFoundSince: Number\(metadata.PhotoNotFoundSince\)/);
    const signature = appSource.slice(appSource.indexOf('function buildMediaSourceSignature('), appSource.indexOf('function resetMediaLoadStateForSourceChanges('));
    assert.match(signature, /photoNotFoundSince/);
    assert.match(signature, /photoNotFoundConfirmedAt/);
    const filter = appSource.slice(hideEnd, appSource.indexOf('\nfunction ', hideEnd + 1));
    assert.match(filter, /!hasGlobalSearch && state.primaryFilter !== 'Bin' && isPhotoHiddenFromWall\(item\)/);
  });
});
