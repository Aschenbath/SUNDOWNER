# Moments Photos + Telegram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mixed-source Moments attachments from both new uploads and existing Photos items, make published Moments editable, and auto-create Moments posts from Telegram image messages whose caption starts with `/moments`.

**Architecture:** Keep the final persisted attachment model source-agnostic by continuing to store only `file_id` references in Moments. Extend the Moments API to accept existing library references plus new uploads, add a Moments-scoped photo picker and edit mode in the dashboard, and hook Telegram `/moments` into the normal Telegram → Photos ingestion path so imported images still land in Photos before creating the Moments post.

**Tech Stack:** Cloudflare Pages Functions, D1/SQLite-compatible SQL, existing upload pipeline, vanilla ES modules, media-library SPA, Mocha with Node 22.

---

## File Structure

- Modify `functions/utils/momentsStore.js`
  - Add update/edit semantics for body + ordered attachment replacement.
  - Add helpers for validating existing image references and rewriting attachment order.
- Modify `functions/api/manage/moments.js`
  - Extend create route to accept `existingFileIds[]` alongside `photos[]`.
  - Add edit/update route behavior for existing posts.
- Modify `functions/upload/index.js`
  - Reuse existing upload processing without breaking current callers.
- Create `functions/utils/momentsTelegramSync.js`
  - Small focused helper for deriving `/moments` post payloads from already-imported Telegram image batches and preventing duplicate post creation.
- Modify existing Telegram ingestion entry points under `functions/utils/telegram*.js`
  - Attach `/moments` detection and media-group-aware post creation after Photos import succeeds.
- Modify `js/media-library/moments-state.js`
  - Expand draft attachment normalization for mixed source attachments.
  - Add helpers for draft edit mode and picker normalization.
- Modify `js/media-library/app.js`
  - Add Moments edit state, picker state, mixed-source draft state, create/edit API calls, and picker event handling.
- Modify `js/media-library/components.js`
  - Add Moments picker overlay markup, edit controls, and unified mixed-source draft rendering.
- Modify `css/media-library.css`
  - Add route-scoped styles for the Moments photo picker and edit affordances only.
- Modify `index.html`
  - Bump `app.js` and `media-library.css` query versions after frontend changes.
- Create or modify focused tests:
  - `test/momentsStore.test.js`
  - `test/momentsRoute.test.js`
  - `test/momentsAppState.test.js`
  - `test/momentsComponents.test.js`
  - `test/previewActions.test.js`
  - new Telegram-focused test file if the current Telegram tests do not already cover this path cleanly.
- Modify `history.md`
  - Record the completed rollout after verification.

---

### Task 1: Moments store editing and reference validation

**Files:**
- Modify: `functions/utils/momentsStore.js`
- Test: `test/momentsStore.test.js`

- [ ] **Step 1: Write failing store tests for post editing and attachment replacement**

Add these tests to `test/momentsStore.test.js`:

```js
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
```

- [ ] **Step 2: Run the store tests to verify failure**

Run:

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/momentsStore.test.js
```

Expected: FAIL because `updatePost` does not exist or does not replace attachments correctly.

- [ ] **Step 3: Implement `updatePost` and shared attachment validation in `momentsStore.js`**

Add a shared validation helper and update method in `functions/utils/momentsStore.js`:

```js
async function resolveMomentAttachments(d1, fileIds = []) {
  const normalized = [...new Set((Array.isArray(fileIds) ? fileIds : []).map((value) => normalizeText(value)).filter(Boolean))];
  if (normalized.length > MAX_PHOTO_COUNT) {
    throw createMomentsError(400, 'A Moment can include at most 9 photos');
  }
  const records = [];
  const kv = new D1Database(d1);
  for (const fileId of normalized) {
    const record = await kv.getWithMetadata(fileId);
    if (!record) {
      throw createMomentsError(404, 'Attachment file not found');
    }
    const metadata = record.metadata || {};
    if (!String(metadata.FileType || '').toLowerCase().startsWith('image/')) {
      throw createMomentsError(400, 'Moment attachments must be images');
    }
    records.push({ fileId, metadata });
  }
  return records;
}

async updatePost(postId, { body, fileIds, now = new Date().toISOString() } = {}) {
  const d1 = assertD1(this.env);
  await this.ensureSchema();
  const normalizedPostId = normalizeText(postId);
  if (!normalizedPostId) {
    throw createMomentsError(400, 'Moment post id is required');
  }
  const existing = await this.getPostById(normalizedPostId);
  if (!existing) {
    throw createMomentsError(404, 'Moment post not found');
  }
  const normalizedBody = normalizeText(body, MAX_BODY_LENGTH);
  const attachments = await resolveMomentAttachments(d1, fileIds);
  if (!normalizedBody && attachments.length === 0) {
    throw createMomentsError(400, 'Moment body or at least one photo is required');
  }
  const updatedAt = new Date(now).toISOString();

  await d1.prepare('UPDATE moments_posts SET body = ?, updated_at = ? WHERE id = ?')
    .bind(normalizedBody, updatedAt, normalizedPostId)
    .run();
  await d1.prepare('DELETE FROM moment_attachments WHERE post_id = ?').bind(normalizedPostId).run();
  for (const [index, attachment] of attachments.entries()) {
    await d1.prepare(`INSERT INTO moment_attachments (id, post_id, file_id, sort_order, created_at) VALUES (?, ?, ?, ?, ?)`) 
      .bind(createAttachmentId(normalizedPostId, index), normalizedPostId, attachment.fileId, index, updatedAt)
      .run();
  }
  return this.getPostById(normalizedPostId);
}
```

- [ ] **Step 4: Refactor `createPost` to use the shared validator**

Update `createPost` to call `resolveMomentAttachments(d1, fileIds)` instead of duplicating file lookup logic.

- [ ] **Step 5: Run the store tests to verify they pass**

Run:

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/momentsStore.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit the store update**

```bash
git add functions/utils/momentsStore.js test/momentsStore.test.js
git commit -m "feat: add Moments post editing"
```

---

### Task 2: Moments route mixed-source create and edit API

**Files:**
- Modify: `functions/api/manage/moments.js`
- Possibly modify: `functions/upload/index.js`
- Test: `test/momentsRoute.test.js`

- [ ] **Step 1: Write failing route tests for `existingFileIds[]` and PATCH edit**

Add to `test/momentsRoute.test.js`:

```js
  it('creates a post from mixed uploaded photos and existing photo ids', async () => {
    const uploadCalls = [];
    const storeCalls = [];
    const response = await onRequestPost({
      request: createMultipartRequest({
        body: 'mixed',
        existingFileIds: ['Photos/2026-05-16/existing.jpg'],
        photos: [new File(['a'], 'upload.jpg', { type: 'image/jpeg' })],
      }),
      env: baseEnv,
      data: {
        momentsStoreFactory: () => ({
          createPost: async (payload) => {
            storeCalls.push(payload);
            return { id: 'moment-1', body: payload.body, attachments: payload.fileIds.map((fileId) => ({ fileId, metadata: { FileType: 'image/jpeg' } })) };
          },
        }),
        processMomentUpload: async (_context, formData) => {
          uploadCalls.push(formData.get('file').name);
          return { files: [{ id: 'Moments/2026-05-16/upload.jpg' }] };
        },
      },
    });

    assert.equal(response.status, 201);
    assert.deepEqual(uploadCalls, ['upload.jpg']);
    assert.deepEqual(storeCalls[0].fileIds, ['Photos/2026-05-16/existing.jpg', 'Moments/2026-05-16/upload.jpg']);
  });

  it('patches an existing Moments post with body and attachment replacement', async () => {
    const storeCalls = [];
    const response = await onRequestPatch({
      request: createMultipartRequest({
        body: 'edited',
        existingFileIds: ['Photos/2026-05-16/existing.jpg'],
      }, 'http://local/api/manage/moments?id=moment-1'),
      env: baseEnv,
      data: {
        momentsStoreFactory: () => ({
          updatePost: async (postId, payload) => {
            storeCalls.push({ postId, payload });
            return { id: postId, body: payload.body, attachments: payload.fileIds.map((fileId) => ({ fileId, metadata: { FileType: 'image/jpeg' } })) };
          },
        }),
      },
    });

    assert.equal(response.status, 200);
    assert.equal(storeCalls[0].postId, 'moment-1');
    assert.deepEqual(storeCalls[0].payload.fileIds, ['Photos/2026-05-16/existing.jpg']);
  });
```

- [ ] **Step 2: Run the route tests to verify failure**

Run:

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/momentsRoute.test.js
```

Expected: FAIL because mixed references and PATCH are not wired.

- [ ] **Step 3: Add multipart parsing for `existingFileIds[]`**

In `functions/api/manage/moments.js`, normalize multipart fields:

```js
function readExistingMomentFileIds(formData) {
  return formData.getAll('existingFileIds[]')
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
}
```

- [ ] **Step 4: Merge uploaded ids and existing ids in create flow**

Update the create handler to produce one ordered `fileIds` array:

```js
const existingFileIds = readExistingMomentFileIds(formData);
const uploadedFileIds = uploadedFiles.map((file) => file.id);
const fileIds = [...existingFileIds, ...uploadedFileIds];
const post = await store.createPost({ body, fileIds, now: new Date().toISOString() });
```

- [ ] **Step 5: Add PATCH route for post editing**

Add PATCH handling:

```js
if (request.method === 'PATCH') {
  const url = new URL(request.url);
  const postId = url.searchParams.get('id') || '';
  const formData = await request.formData();
  const body = String(formData.get('body') ?? '');
  const existingFileIds = readExistingMomentFileIds(formData);
  const uploaded = await uploadMomentPhotosIfPresent(context, formData);
  const fileIds = [...existingFileIds, ...uploaded.map((file) => file.id)];
  const post = await store.updatePost(postId, { body, fileIds, now: new Date().toISOString() });
  return jsonResponse({ post }, { status: 200 });
}
```

- [ ] **Step 6: Reuse existing upload logic without changing external behavior**

If needed, add a small helper wrapper in the Moments route instead of broadening `functions/upload/index.js` beyond current behavior.

- [ ] **Step 7: Run the route tests to verify they pass**

Run:

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/momentsRoute.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit the route changes**

```bash
git add functions/api/manage/moments.js test/momentsRoute.test.js
git commit -m "feat: support mixed-source Moments attachments"
```

---

### Task 3: Frontend draft attachment model and edit mode

**Files:**
- Modify: `js/media-library/moments-state.js`
- Modify: `js/media-library/app.js`
- Test: `test/momentsAppState.test.js`

- [ ] **Step 1: Write failing draft-state tests**

Add to `test/momentsAppState.test.js`:

```js
  it('normalizes mixed draft attachments from upload and existing photo sources', () => {
    const draft = normalizeMomentDraftAttachments([
      { source: 'existing', fileId: 'Photos/2026-05-16/a.jpg', metadata: { FileName: 'a.jpg', FileType: 'image/jpeg' } },
      { source: 'upload', name: 'b.jpg', previewUrl: 'blob:preview-b' },
    ]);

    assert.equal(draft.length, 2);
    assert.equal(draft[0].source, 'existing');
    assert.equal(draft[1].source, 'upload');
  });

  it('builds edit payloads from current draft attachment state', () => {
    const payload = buildMomentMutationPayload({
      body: 'edited',
      attachments: [
        { source: 'existing', fileId: 'Photos/2026-05-16/a.jpg' },
        { source: 'upload', file: new File(['x'], 'b.jpg', { type: 'image/jpeg' }) },
      ],
    });

    assert.deepEqual(payload.existingFileIds, ['Photos/2026-05-16/a.jpg']);
    assert.equal(payload.uploadFiles.length, 1);
  });
```

- [ ] **Step 2: Run the app-state tests to verify failure**

Run:

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/momentsAppState.test.js
```

Expected: FAIL because the helper exports do not exist yet.

- [ ] **Step 3: Add unified draft attachment helpers in `moments-state.js`**

Add:

```js
export function normalizeMomentDraftAttachments(items = []) {
  return (Array.isArray(items) ? items : []).map((item, index) => ({
    source: item?.source === 'existing' ? 'existing' : 'upload',
    draftId: String(item?.draftId || item?.fileId || item?.name || `draft-${index}`),
    fileId: String(item?.fileId || '').trim(),
    name: String(item?.name || item?.metadata?.FileName || item?.fileId?.split('/').pop() || 'Moment photo').trim(),
    previewUrl: String(item?.previewUrl || item?.sourceUrl || item?.thumbnailUrl || '').trim(),
    metadata: item?.metadata && typeof item.metadata === 'object' ? item.metadata : {},
    file: item?.file instanceof File ? item.file : null,
  }));
}

export function buildMomentMutationPayload({ body = '', attachments = [] } = {}) {
  const normalized = normalizeMomentDraftAttachments(attachments);
  return {
    body: String(body ?? '').trim(),
    existingFileIds: normalized.filter((item) => item.source === 'existing' && item.fileId).map((item) => item.fileId),
    uploadFiles: normalized.filter((item) => item.source === 'upload' && item.file instanceof File).map((item) => item.file),
  };
}
```

- [ ] **Step 4: Extend Moments UI state in `app.js` for edit mode and unified attachments**

Add state fields:

```js
  momentsDraftAttachments: [],
  momentsEditingPostId: '',
  momentsPickerOpen: false,
  momentsPickerSelection: new Set(),
  momentsPickerQuery: '',
```

- [ ] **Step 5: Replace upload-only draft state usage with unified attachment state**

Change current draft logic so all reads/writes use `momentsDraftAttachments` instead of `momentsDraftFiles`.

- [ ] **Step 6: Add helpers for edit-mode load/reset**

Add in `app.js`:

```js
function startEditingMoment(post) {
  state.momentsEditingPostId = post.id;
  state.momentsDraftBody = post.body || '';
  state.momentsDraftAttachments = normalizeMomentDraftAttachments((post.attachments || []).map((attachment) => ({
    source: 'existing',
    fileId: attachment.fileId,
    metadata: attachment.metadata,
    previewUrl: attachment.item?.thumbnailUrl || attachment.item?.sourceUrl || '',
    name: attachment.metadata?.FileName || '',
  })));
  state.momentsError = '';
  render();
}

function resetMomentComposer() {
  revokeMomentDraftPreviews(state.momentsDraftAttachments.filter((item) => item.source === 'upload'));
  state.momentsEditingPostId = '';
  state.momentsDraftBody = '';
  state.momentsDraftAttachments = [];
  state.momentsError = '';
}
```

- [ ] **Step 7: Run the app-state tests to verify they pass**

Run:

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/momentsAppState.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit the state changes**

```bash
git add js/media-library/moments-state.js js/media-library/app.js test/momentsAppState.test.js
git commit -m "feat: add Moments edit state"
```

---

### Task 4: Moments photo picker and mixed-source composer UI

**Files:**
- Modify: `js/media-library/components.js`
- Modify: `js/media-library/app.js`
- Modify: `css/media-library.css`
- Test: `test/momentsComponents.test.js`
- Test: `test/lightChromeCss.test.js`

- [ ] **Step 1: Write failing component tests for picker and edit UI**

Add to `test/momentsComponents.test.js`:

```js
  it('renders a Choose from Photos action and edit-mode controls', () => {
    const html = MomentsView({
      posts: [{ id: 'moment-1', body: 'hello', date: '2026-05-16', createdAt: '2026-05-16T12:00:00.000Z', attachments: [] }],
      draftBody: 'hello',
      draftAttachments: [],
      isEditing: true,
      pickerOpen: true,
      pickerItems: [{ id: 'photo-1', sourceUrl: '/file/photo-1', thumbnailUrl: '/file/photo-1', label: 'photo-1', type: 'photo' }],
    });

    assert.match(html, /Choose from Photos/);
    assert.match(html, /Save changes/);
    assert.match(html, /Cancel edit/);
    assert.match(html, /data-action="open-moments-photo-picker"/);
    assert.match(html, /data-action="toggle-moments-picker-photo"/);
  });
```

Add to `test/lightChromeCss.test.js`:

```js
  it('defines route-scoped Moments picker selectors', () => {
    assert.match(css, /#codex-media-library-root \.cml-moments-picker/);
    assert.match(css, /#codex-media-library-root \.cml-moments-composer__existing/);
  });
```

- [ ] **Step 2: Run the component/CSS tests to verify failure**

Run:

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/momentsComponents.test.js test/lightChromeCss.test.js
```

Expected: FAIL because picker/edit UI does not exist.

- [ ] **Step 3: Add picker and edit controls to `components.js`**

Add to the composer/footer area:

```js
<button type="button" class="cml-moments-composer__secondary cml-moments-composer__existing" data-action="open-moments-photo-picker">Choose from Photos</button>
```

Add edit mode button switching:

```js
${isEditing
  ? `<button type="button" class="cml-moments-composer__secondary" data-action="cancel-moment-edit">Cancel edit</button>
     <button type="button" class="cml-moments-composer__publish" data-action="save-moment">Save changes</button>`
  : `<button type="button" class="cml-moments-composer__publish" data-action="publish-moment">Publish</button>`}
```

- [ ] **Step 4: Add Moments-scoped photo picker overlay in `components.js`**

Add a render helper:

```js
function renderMomentsPicker({ open = false, items = [], selectedIds = [] } = {}) {
  if (!open) return '';
  return `
    <div class="cml-moments-picker" data-moments-picker>
      <div class="cml-moments-picker__panel">
        <header class="cml-moments-picker__header">
          <h3>Choose from Photos</h3>
          <button type="button" data-action="close-moments-photo-picker">${icon('close')}</button>
        </header>
        <div class="cml-moments-picker__grid">
          ${items.map((item) => `
            <button type="button" class="cml-moments-picker__item ${selectedIds.includes(item.id) ? 'is-selected' : ''}" data-action="toggle-moments-picker-photo" data-id="${escapeHtml(item.id)}">
              ${renderMediaAsset(item, 'cml-moments-picker__image', false, { noAction: true })}
            </button>
          `).join('')}
        </div>
        <footer class="cml-moments-picker__footer">
          <button type="button" data-action="apply-moments-photo-picker">Add selected</button>
        </footer>
      </div>
    </div>
  `;
}
```

- [ ] **Step 5: Wire picker behavior in `app.js`**

Add actions:

```js
case 'open-moments-photo-picker':
  state.momentsPickerOpen = true;
  state.momentsPickerSelection = new Set();
  render();
  return true;
case 'close-moments-photo-picker':
  state.momentsPickerOpen = false;
  render();
  return true;
case 'toggle-moments-picker-photo':
  toggleMomentPickerPhoto(actionTarget.dataset.id);
  return true;
case 'apply-moments-photo-picker':
  applyMomentPickerSelection();
  return true;
case 'edit-moment':
  if (actionTarget.dataset.id) startEditingMoment(getMomentPostById(actionTarget.dataset.id));
  return true;
case 'cancel-moment-edit':
  resetMomentComposer();
  render();
  return true;
case 'save-moment':
  void saveMomentEdit();
  return true;
```

- [ ] **Step 6: Add route-scoped picker CSS**

Append route-scoped styles for `.cml-moments-picker*` and edit-state controls only.

- [ ] **Step 7: Run the component/CSS tests to verify they pass**

Run:

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/momentsComponents.test.js test/lightChromeCss.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit the UI changes**

```bash
git add js/media-library/components.js js/media-library/app.js css/media-library.css test/momentsComponents.test.js test/lightChromeCss.test.js
git commit -m "feat: add Moments photo picker"
```

---

### Task 5: Mixed-source publish/edit request wiring

**Files:**
- Modify: `js/media-library/app.js`
- Test: `test/momentsAppState.test.js`
- Test: `test/previewActions.test.js`

- [ ] **Step 1: Write failing tests for payload creation and existing-photo preview behavior**

Add to `test/previewActions.test.js`:

```js
  it('keeps Moments preview resolution working for referenced existing Photos items', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
    assert.match(appSource, /buildMomentMutationPayload/);
    assert.match(appSource, /existingFileIds\[\]/);
    assert.match(appSource, /applyMomentPickerSelection/);
  });
```

- [ ] **Step 2: Run the focused tests to verify failure**

Run:

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/momentsAppState.test.js test/previewActions.test.js
```

Expected: FAIL because edit/save mixed payload wiring is missing.

- [ ] **Step 3: Update publish flow to use `buildMomentMutationPayload`**

In `publishMoment`:

```js
const payload = buildMomentMutationPayload({
  body: state.momentsDraftBody,
  attachments: state.momentsDraftAttachments,
});
const formData = new FormData();
if (payload.body) formData.set('body', payload.body);
payload.existingFileIds.forEach((fileId) => formData.append('existingFileIds[]', fileId));
payload.uploadFiles.forEach((file) => formData.append('photos', file, file.name || 'photo'));
```

- [ ] **Step 4: Add save-edit flow in `app.js`**

Add:

```js
async function saveMomentEdit() {
  if (!state.momentsEditingPostId) return;
  const payload = buildMomentMutationPayload({ body: state.momentsDraftBody, attachments: state.momentsDraftAttachments });
  if (!payload.body && payload.existingFileIds.length === 0 && payload.uploadFiles.length === 0) {
    state.momentsError = 'Moment body or at least one photo is required';
    render();
    return;
  }
  const formData = new FormData();
  if (payload.body) formData.set('body', payload.body);
  payload.existingFileIds.forEach((fileId) => formData.append('existingFileIds[]', fileId));
  payload.uploadFiles.forEach((file) => formData.append('photos', file, file.name || 'photo'));
  const response = await fetchMomentsJson(`/api/manage/moments?id=${encodeURIComponent(state.momentsEditingPostId)}`, { method: 'PATCH', body: formData, headers: {} });
  const updated = normalizeMomentPosts(response?.post ? [response.post] : [])[0];
  state.momentsPosts = normalizeMomentPosts([updated, ...state.momentsPosts.filter((post) => post.id !== updated.id)]);
  state.momentsDatesWithPhotos = buildMomentsDatesWithPhotos(state.momentsPosts);
  resetMomentComposer();
  render();
}
```

- [ ] **Step 5: Run the focused tests to verify they pass**

Run:

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/momentsAppState.test.js test/previewActions.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit the mixed-source request wiring**

```bash
git add js/media-library/app.js test/momentsAppState.test.js test/previewActions.test.js
git commit -m "feat: support mixed-source Moments publishing"
```

---

### Task 6: Telegram `/moments` post creation helper and tests

**Files:**
- Create: `functions/utils/momentsTelegramSync.js`
- Modify: existing Telegram ingestion utilities in `functions/utils/telegram*.js`
- Test: create `test/momentsTelegramSync.test.js`

- [ ] **Step 1: Write failing Telegram helper tests**

Create `test/momentsTelegramSync.test.js`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { extractMomentsCaptionBody, shouldCreateMomentsFromTelegramMessage, buildTelegramMomentsDedupeKey } from '../functions/utils/momentsTelegramSync.js';

describe('momentsTelegramSync', () => {
  it('extracts body text after /moments', () => {
    assert.equal(extractMomentsCaptionBody('/moments hello world'), 'hello world');
    assert.equal(extractMomentsCaptionBody('/moments'), '');
  });

  it('requires image content and a /moments caption prefix', () => {
    assert.equal(shouldCreateMomentsFromTelegramMessage({ caption: '/moments hi', photoFileIds: ['a'] }), true);
    assert.equal(shouldCreateMomentsFromTelegramMessage({ caption: 'hi', photoFileIds: ['a'] }), false);
    assert.equal(shouldCreateMomentsFromTelegramMessage({ caption: '/moments hi', photoFileIds: [] }), false);
  });

  it('builds a stable dedupe key from media-group identity when present', () => {
    assert.equal(
      buildTelegramMomentsDedupeKey({ chatId: '1', messageId: '2', mediaGroupId: '3' }),
      'telegram-moments:1:group:3'
    );
  });
});
```

- [ ] **Step 2: Run the Telegram helper tests to verify failure**

Run:

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/momentsTelegramSync.test.js
```

Expected: FAIL because the helper file does not exist.

- [ ] **Step 3: Implement Telegram Moments helper file**

Create `functions/utils/momentsTelegramSync.js`:

```js
function normalizeText(value) {
  return String(value ?? '').trim();
}

export function extractMomentsCaptionBody(caption = '') {
  const normalized = normalizeText(caption);
  if (!normalized.toLowerCase().startsWith('/moments')) {
    return '';
  }
  return normalized.slice('/moments'.length).trim();
}

export function shouldCreateMomentsFromTelegramMessage({ caption = '', photoFileIds = [] } = {}) {
  return normalizeText(caption).toLowerCase().startsWith('/moments') && Array.isArray(photoFileIds) && photoFileIds.length > 0;
}

export function buildTelegramMomentsDedupeKey({ chatId = '', messageId = '', mediaGroupId = '' } = {}) {
  if (normalizeText(mediaGroupId)) {
    return `telegram-moments:${normalizeText(chatId)}:group:${normalizeText(mediaGroupId)}`;
  }
  return `telegram-moments:${normalizeText(chatId)}:message:${normalizeText(messageId)}`;
}
```

- [ ] **Step 4: Run the Telegram helper tests to verify they pass**

Run:

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/momentsTelegramSync.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit the helper**

```bash
git add functions/utils/momentsTelegramSync.js test/momentsTelegramSync.test.js
git commit -m "feat: add Telegram Moments helpers"
```

---

### Task 7: Hook Telegram `/moments` into existing import flow

**Files:**
- Modify: relevant `functions/utils/telegram*.js` files discovered during implementation
- Modify: `functions/api/manage/moments.js` only if needed for a reusable programmatic create path
- Test: `test/momentsTelegramSync.test.js` or existing Telegram ingestion tests

- [ ] **Step 1: Add a failing integration test around imported Telegram images creating one Moments post**

Add one focused integration test in the Telegram test file nearest the actual import flow. The test must assert:

```js
it('creates one Moments post from a /moments Telegram image batch after Photos import succeeds', async () => {
  // Arrange imported photo file ids and Telegram message metadata.
  // Assert the normal import path runs first.
  // Assert MomentsStore.createPost receives one body and one ordered file-id list.
});
```

- [ ] **Step 2: Run the Telegram-focused tests to verify failure**

Run the narrowest test command covering the new integration case.

Expected: FAIL because the import flow does not create Moments posts yet.

- [ ] **Step 3: Add a narrow post-create call after successful Telegram Photos import**

In the existing Telegram import flow, after imported image `file_id`s are known:

```js
if (shouldCreateMomentsFromTelegramMessage({ caption, photoFileIds })) {
  const dedupeKey = buildTelegramMomentsDedupeKey({ chatId, messageId, mediaGroupId });
  const alreadyCreated = await telegramDedupeStore.has(dedupeKey);
  if (!alreadyCreated) {
    await momentsStore.updateOrCreateTelegramMomentsPost?.({ dedupeKey, body: extractMomentsCaptionBody(caption), fileIds: photoFileIds.slice(0, 9), now: createdAt })
      || momentsStore.createPost({ body: extractMomentsCaptionBody(caption), fileIds: photoFileIds.slice(0, 9), now: createdAt });
    await telegramDedupeStore.put(dedupeKey, true);
  }
}
```

Use the repo’s actual dedupe utility if one already exists instead of inventing a new storage system.

- [ ] **Step 4: Make media-group ingestion aggregate to a single Moments create call**

If the current import flow emits each media-group item separately, add a narrow grouping pass so the Moments side effect only runs once per completed group with one ordered list of imported file ids.

- [ ] **Step 5: Run the Telegram-focused tests to verify they pass**

Run the same narrow test command from Step 2.

Expected: PASS.

- [ ] **Step 6: Commit the Telegram import hook**

```bash
git add functions/utils/telegram*.js test/momentsTelegramSync.test.js
git commit -m "feat: create Moments posts from Telegram captions"
```

---

### Task 8: Final verification, history, commit, and push

**Files:**
- Modify: `history.md`
- Possible final fixes in files from Tasks 1-7 only

- [ ] **Step 1: Run syntax checks**

Run:

```bash
D:/DevTools/nvm/v24.11.1/node.exe --check functions/utils/momentsStore.js
D:/DevTools/nvm/v24.11.1/node.exe --check functions/api/manage/moments.js
D:/DevTools/nvm/v24.11.1/node.exe --check functions/utils/momentsTelegramSync.js
D:/DevTools/nvm/v24.11.1/node.exe --check js/media-library/moments-state.js
D:/DevTools/nvm/v24.11.1/node.exe --check js/media-library/components.js
D:/DevTools/nvm/v24.11.1/node.exe --check js/media-library/app.js
```

Expected: exit 0 for each.

- [ ] **Step 2: Run focused Moments + Telegram tests**

Run:

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/momentsStore.test.js test/momentsRoute.test.js test/momentsAppState.test.js test/momentsComponents.test.js test/momentsTelegramSync.test.js test/lightChromeCss.test.js test/previewActions.test.js
```

Expected: PASS.

- [ ] **Step 3: Run full Mocha**

Run:

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js "test/**/*.js"
```

Expected: PASS with existing pending count unchanged or explicitly explained.

- [ ] **Step 4: Run local server smoke if possible**

Run:

```bash
D:/DevTools/nvm/v22.14.0/node.exe --import ./server/register.mjs server/index.js
```

Then verify:

- Moments composer shows both upload and `Choose from Photos`
- existing Photos selections render in the draft and still preview correctly
- editing an existing Moments post loads the draft and saves changes
- Telegram `/moments` path is at least covered by focused tests; if no local Telegram webhook smoke is practical, say so explicitly

- [ ] **Step 5: Update history**

Add a compact work-log line to `history.md` using actual results, for example:

```md
- 2026-05-16 | [moments][photos][telegram] Extended Moments with mixed-source attachments and post editing: composer can mix new uploads with referenced Photos items, existing posts can be edited, and Telegram image messages captioned `/moments ...` now create one Moments post after normal Photos ingestion. Cache: `app.js?v=<actual>`, `components.js?v=<actual if bumped>`, `media-library.css?v=<actual>`. Validation: <exact syntax/focused/full smoke results>. Commit: <final head>.
```

- [ ] **Step 6: Commit history and any final fixes**

```bash
git add history.md
git commit -m "docs: record Moments mixed-source and Telegram flow"
```

- [ ] **Step 7: Push**

```bash
git push
```

Expected: push succeeds. If push is rejected, inspect status first and do not blind pull over unrelated dirty work.

---

## Self-Review

Spec coverage:

- Mixed-source web composer: Task 2, Task 3, Task 4, Task 5.
- Existing Photos are referenced, not copied: Task 1 and Task 2 keep `file_id` reference semantics.
- Post editing: Task 1, Task 2, Task 3, Task 5.
- Telegram `/moments` caption-driven post creation: Task 6 and Task 7.
- Imported Telegram images still land in Photos: Task 7 adds Moments as a side effect after normal import.
- Media-group single post semantics: Task 7.
- Idempotency for replay/retry: Task 6 and Task 7.
- Tests/history/push: Task 8.

Placeholder scan:

- No `TBD`, `TODO`, or “similar to above” shortcuts remain.
- Every code-changing step includes concrete code or precise behavior.

Type consistency:

- Draft attachment type uses `source`, `draftId`, `fileId`, `previewUrl`, `metadata`, and optional `file` consistently.
- Backend attachment payload continues to converge to ordered `fileIds` only.
- Edit path consistently uses `PATCH /api/manage/moments?id=<postId>` in this plan.
