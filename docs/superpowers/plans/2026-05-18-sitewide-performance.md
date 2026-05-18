# SUNDOWNER Sitewide Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve SUNDOWNER responsiveness across Photos, Search, Bin, Moments, Films, Music, Mind, and backend list hydration by measuring first and then reducing unnecessary full renders, scroll work, and startup/background work.

**Architecture:** Keep the current plain JavaScript module architecture. Extend the existing `?cmlPerf=1` instrumentation first, then make narrow local patch helpers for high-frequency UI surfaces before considering larger route-specific `getViewModel()` decomposition. Preserve the current shell/theme/layout; this is a responsiveness pass, not a visual redesign.

**Tech Stack:** Cloudflare Pages Functions, plain ES modules under `js/media-library`, Mocha tests on Node 22, existing `previewActions.test.js`, `momentsAppState.test.js`, and backend route tests.

---

## Current Evidence

- `js/media-library/app.js` has a central `render()` at `function render()` and still contains more than 200 direct `render()` calls.
- `getViewModel()` derives cross-route state on every full render: accessible items, filtered items, global search groups, video albums, music playlists, timeline sections, preview entries, active film record, and selection affordances.
- Music already has a recent targeted improvement: bounded queue rail, row/queue local patching, and offscreen layout hints.
- Photos ordinary timelines intentionally do not use `.cml-media-row { content-visibility }` because that caused visible placeholder regressions. Do not reintroduce that strategy.
- Existing perf reporting is gated behind `?cmlPerf=1` and session storage through `PERF_QUERY_FLAG`.
- Full-suite baseline after the Music scroll rebase was Node 22 Mocha `507 passing, 1 pending`.

## File Structure

- Modify `js/media-library/app.js`
  - Extend perf instrumentation.
  - Add patch helpers for Search, Bin, Moments picker, resize, timeline binary search, and route-specific view-model dispatch.
  - Preserve existing event delegation and state shape.
- Modify `js/media-library/components.js`
  - Add stable `data-*` anchors where a local patch helper needs a safe replacement target.
  - Keep component markup semantics stable.
- Modify `functions/api/manage/list.js`
  - Add low-cost server timing metadata to list responses after frontend perf instrumentation exists.
- Modify tests:
  - `test/previewActions.test.js`
  - `test/momentsAppState.test.js`
  - `test/d1Metadata.test.js` or a nearby manage-list route test
- Modify cache/history after code changes:
  - `index.html`
  - `history.md`

## Common Verification Commands

Run these from the active SUNDOWNER worktree.

```powershell
D:\DevTools\nvm\v22.14.0\node.exe --check js\media-library\app.js
D:\DevTools\nvm\v22.14.0\node.exe --check js\media-library\components.js
D:\DevTools\nvm\v22.14.0\node.exe ..\..\node_modules\mocha\bin\mocha.js test\previewActions.test.js --grep "performance|search|resize|Bin|Moments|timeline|Music"
D:\DevTools\nvm\v22.14.0\node.exe ..\..\node_modules\mocha\bin\mocha.js
git diff --check
```

Expected full-suite result after each finished task: all tests pass with the existing pending count unchanged unless a task explicitly adds or removes a pending test.

---

### Task 1: Extend `?cmlPerf=1` Render Instrumentation

**Files:**
- Modify: `js/media-library/app.js`
- Test: `test/previewActions.test.js`

- [ ] **Step 1: Add failing source-contract tests**

Add focused assertions near the existing perf/Music tests in `test/previewActions.test.js`.

```js
it('reports full-render phases and view-model cost behind cmlPerf', () => {
  const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /function measurePerfSpan\(/);
  assert.match(appSource, /measurePerfSpan\('getViewModel'/);
  assert.match(appSource, /measurePerfSpan\('render:apply-dom'/);
  assert.match(appSource, /pushPerfDiagnosticRow\(/);
  assert.match(appSource, /markup bytes/);
});
```

- [ ] **Step 2: Verify the test fails for the right reason**

Run:

```powershell
D:\DevTools\nvm\v22.14.0\node.exe ..\..\node_modules\mocha\bin\mocha.js test\previewActions.test.js --grep "full-render phases"
```

Expected: FAIL because `measurePerfSpan` and `pushPerfDiagnosticRow` do not exist yet.

- [ ] **Step 3: Add diagnostic helpers in `app.js`**

Place these helpers after `finishPerfActionAfterPaint()` so they reuse existing perf reporter state.

```js
function pushPerfDiagnosticRow(row = {}) {
  if (!perfReporter.enabled) {
    return;
  }
  perfReporter.actionRows.push({
    action: normalizeText(row.action) || 'diagnostic',
    duration: row.duration === undefined ? '' : roundPerfValue(row.duration),
    'render count': row.renderCount === undefined ? '' : row.renderCount,
    'network wait': row.networkWait === undefined ? '' : roundPerfValue(row.networkWait),
    'network awaited': row.networkAwaited ? 'yes' : '',
    'full render': row.fullRender ? 'yes' : '',
    'render path': normalizeText(row.renderPath || ''),
    'rendered': row.rendered ? 'yes' : '',
    'markup bytes': row.markupBytes === undefined ? '' : Math.max(0, Number(row.markupBytes) || 0),
    route: `${state.primaryFilter || 'Photos'}${state.secondaryFilter ? `/${state.secondaryFilter}` : ''}`
  });
  if (perfReporter.actionRows.length > 80) {
    perfReporter.actionRows.splice(0, perfReporter.actionRows.length - 80);
  }
  schedulePerfReport();
}

function measurePerfSpan(action, callback, extra = {}) {
  if (!perfReporter.enabled) {
    return callback();
  }
  const label = normalizeText(action) || 'perf span';
  const startedAt = performance.now();
  const startMark = `${getPerfMarkName(label)}-${Math.round(startedAt)}-start`;
  const endMark = `${getPerfMarkName(label)}-${Math.round(startedAt)}-end`;
  markPerf(startMark);
  try {
    return callback();
  } finally {
    markPerf(endMark);
    measurePerf(label, startMark, endMark);
    pushPerfDiagnosticRow({
      action: label,
      duration: performance.now() - startedAt,
      renderPath: extra.renderPath || 'diagnostic',
      markupBytes: extra.markupBytes
    });
  }
}
```

- [ ] **Step 4: Wrap high-value render phases**

In `render()`:

```js
const viewModel = measurePerfSpan('getViewModel', () => getViewModel(), { renderPath: 'full-render' });
```

After `const fullHtml = ...` is built and before/after DOM write operations, record apply cost:

```js
const fullHtmlByteLength = fullHtml.length;
pushPerfDiagnosticRow({
  action: 'render:markup-size',
  renderPath: 'full-render',
  markupBytes: fullHtmlByteLength
});
measurePerfSpan('render:apply-dom', () => {
  refs.root.innerHTML = fullHtml;
}, { renderPath: 'full-render', markupBytes: fullHtmlByteLength });
```

If `refs.root.innerHTML = fullHtml` currently appears inside an existing branch with sidebar preservation, wrap the actual final DOM application there rather than adding a second DOM write.

- [ ] **Step 5: Run verification**

Run:

```powershell
D:\DevTools\nvm\v22.14.0\node.exe --check js\media-library\app.js
D:\DevTools\nvm\v22.14.0\node.exe ..\..\node_modules\mocha\bin\mocha.js test\previewActions.test.js --grep "full-render phases"
git diff --check
```

Expected: syntax check passes, focused test passes, diff check reports no errors.

- [ ] **Step 6: Commit**

```powershell
git add -- js/media-library/app.js test/previewActions.test.js
git commit -m "perf: measure media library render phases"
```

---

### Task 2: Add Action Labels for Sitewide Hot Paths

**Files:**
- Modify: `js/media-library/app.js`
- Test: `test/previewActions.test.js`

- [ ] **Step 1: Add failing tests for action labels**

```js
it('labels sitewide perf actions for search resize sync bin and moments picker', () => {
  const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /startPerfAction\('search query apply'\)/);
  assert.match(appSource, /startPerfAction\('window resize'\)/);
  assert.match(appSource, /startPerfAction\('bin load'\)/);
  assert.match(appSource, /startPerfAction\('moments picker open'\)/);
  assert.match(appSource, /startPerfAction\('library sync'\)/);
});
```

- [ ] **Step 2: Verify red**

Run:

```powershell
D:\DevTools\nvm\v22.14.0\node.exe ..\..\node_modules\mocha\bin\mocha.js test\previewActions.test.js --grep "labels sitewide perf actions"
```

Expected: FAIL because these exact labels are missing.

- [ ] **Step 3: Instrument action boundaries**

Add a perf token at the start of each target function and finish it after the visible UI update:

```js
function applySearchQuery(nextQuery, options = {}) {
  const perfToken = startPerfAction('search query apply');
  // existing state changes stay here
  render();
  finishPerfActionAfterPaint(perfToken);
}

function handleWindowResize() {
  const perfToken = startPerfAction('window resize');
  // existing resize logic stays here
  render();
  finishPerfActionAfterPaint(perfToken);
}

async function fetchBinItems() {
  const perfToken = startPerfAction('bin load');
  // existing fetch logic stays here
  finishPerfActionAfterPaint(perfToken);
}

function openMomentsPhotoPicker() {
  const perfToken = startPerfAction('moments picker open');
  state.momentsPickerOpen = true;
  state.momentsPickerSelection = new Set();
  render();
  finishPerfActionAfterPaint(perfToken);
}
```

For library sync, start the action at the top of `performSyncLiveMedia()` and finish it after the render/patch decision:

```js
const perfToken = startPerfAction('library sync');
markPerfNetworkAwait(perfToken, true);
// existing sync logic
finishPerfActionAfterPaint(perfToken);
```

If an action has an early return, call `finishPerfAction(perfToken)` before returning.

- [ ] **Step 4: Replace direct Moments picker state branches**

In `handleAction()`, replace the body of `open-moments-photo-picker` with:

```js
openMomentsPhotoPicker();
return true;
```

Keep `close-moments-photo-picker` direct for now; Task 5 will local-patch both open and close.

- [ ] **Step 5: Run verification and commit**

```powershell
D:\DevTools\nvm\v22.14.0\node.exe --check js\media-library\app.js
D:\DevTools\nvm\v22.14.0\node.exe ..\..\node_modules\mocha\bin\mocha.js test\previewActions.test.js --grep "labels sitewide perf actions"
git diff --check
git add -- js/media-library/app.js test/previewActions.test.js
git commit -m "perf: label media library hot actions"
```

---

### Task 3: Guard Resize Against Unchanged Layout Buckets

**Files:**
- Modify: `js/media-library/app.js`
- Test: `test/previewActions.test.js`

- [ ] **Step 1: Add failing source test**

```js
it('does not full-render on resize when the media layout bucket is unchanged', () => {
  const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
  const resizeStart = appSource.indexOf('function handleWindowResize');
  const resizeEnd = appSource.indexOf('function handleVisualViewportResize', resizeStart);
  assert.ok(resizeStart >= 0 && resizeEnd > resizeStart);
  const resizeSource = appSource.slice(resizeStart, resizeEnd);

  assert.match(appSource, /function getLayoutBucket\(/);
  assert.match(appSource, /function syncLayoutWidth\(\)[\s\S]*return \{/);
  assert.match(resizeSource, /const layoutSync = syncLayoutWidth\(\);/);
  assert.match(resizeSource, /if \(!layoutSync\.bucketChanged/);
  assert.match(resizeSource, /scheduleTimelineRender\(\);/);
});
```

- [ ] **Step 2: Verify red**

Run:

```powershell
D:\DevTools\nvm\v22.14.0\node.exe ..\..\node_modules\mocha\bin\mocha.js test\previewActions.test.js --grep "layout bucket"
```

Expected: FAIL because `syncLayoutWidth()` currently does not return bucket metadata.

- [ ] **Step 3: Move bucket logic to module scope**

Add near layout state helpers:

```js
function getLayoutBucket(width = 0) {
  const normalizedWidth = Math.max(0, Number(width) || 0);
  if (normalizedWidth <= 640) return 'phone';
  if (normalizedWidth <= 960) return 'mobile';
  if (normalizedWidth <= 1180) return 'compact-desktop';
  if (normalizedWidth <= 1380) return 'desktop';
  return 'wide';
}
```

Change `syncLayoutWidth()` so it returns:

```js
return {
  changed: nextWidth !== previousWidth,
  bucketChanged: nextBucket !== previousBucket,
  previousWidth,
  nextWidth,
  previousBucket,
  nextBucket
};
```

When `refs.contentInner` is missing, return:

```js
return {
  changed: false,
  bucketChanged: false,
  previousWidth: state.layoutWidth,
  nextWidth: state.layoutWidth,
  previousBucket: getLayoutBucket(state.layoutWidth),
  nextBucket: getLayoutBucket(state.layoutWidth)
};
```

- [ ] **Step 4: Short-circuit `handleWindowResize()`**

Use this structure:

```js
const layoutSync = syncLayoutWidth();
if (isMobileMindComposerFocused()) {
  window.requestAnimationFrame(() => {
    scrollMindToBottom({ force: true });
  });
  finishPerfActionAfterPaint(perfToken);
  return;
}
if (!layoutSync.bucketChanged && !state.filmDetailOpen && state.filmImagePickerMode !== 'backdrop') {
  scheduleTimelineRender();
  finishPerfActionAfterPaint(perfToken);
  return;
}
render();
finishPerfActionAfterPaint(perfToken);
```

Keep the existing Film backdrop frame sync before the final render.

- [ ] **Step 5: Run verification and commit**

```powershell
D:\DevTools\nvm\v22.14.0\node.exe --check js\media-library\app.js
D:\DevTools\nvm\v22.14.0\node.exe ..\..\node_modules\mocha\bin\mocha.js test\previewActions.test.js --grep "layout bucket"
git diff --check
git add -- js/media-library/app.js test/previewActions.test.js
git commit -m "perf: skip resize renders when layout bucket is stable"
```

---

### Task 4: Local-Patch Global Search Results

**Files:**
- Modify: `js/media-library/app.js`
- Modify: `js/media-library/components.js`
- Test: `test/previewActions.test.js`

- [ ] **Step 1: Add stable markup anchor test**

```js
it('renders global search with a stable patch root', () => {
  const html = SearchResultsView({
    query: 'sunset',
    totalCount: 0,
    filterParts: [],
    hasActiveFilters: false,
    photoSections: [],
    photoCount: 0,
    videoSections: [],
    videoCount: 0,
    audioItems: [],
    audioCount: 0,
    fileItems: [],
    fileCount: 0,
    albumCards: [],
    albumCount: 0,
    state: { selectedIds: new Set(), loadedMediaIds: new Set(), fullLoadedMediaIds: new Set() },
    layoutWidth: 1440
  });

  assert.match(html, /data-search-results-root/);
});
```

- [ ] **Step 2: Add app-source test for local search patch**

```js
it('patches global search results without replacing the full shell when possible', () => {
  const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
  const applyStart = appSource.indexOf('function applySearchQuery');
  const applyEnd = appSource.indexOf('function scheduleSearchQueryApply', applyStart);
  assert.ok(applyStart >= 0 && applyEnd > applyStart);
  const applySource = appSource.slice(applyStart, applyEnd);

  assert.match(appSource, /function patchGlobalSearchResultsView\(/);
  assert.match(appSource, /function renderSearchResultsViewHtml\(/);
  assert.match(applySource, /if \(!patchGlobalSearchResultsView/);
});
```

- [ ] **Step 3: Verify red**

Run:

```powershell
D:\DevTools\nvm\v22.14.0\node.exe ..\..\node_modules\mocha\bin\mocha.js test\previewActions.test.js --grep "global search"
```

Expected: FAIL on missing stable root and missing helper names.

- [ ] **Step 4: Add `data-search-results-root` to `SearchResultsView()`**

In `js/media-library/components.js`, add the attribute to the top-level search results section:

```js
<section class="cml-search-results" data-search-results-root>
```

Use the actual existing root class if it differs; keep the attribute name exactly `data-search-results-root`.

- [ ] **Step 5: Add render helper in `app.js`**

Add a helper that mirrors the existing `SearchResultsView({...})` call inside `render()`:

```js
function renderSearchResultsViewHtml(viewModel = getViewModel()) {
  const parsedSearch = parseMediaSearchQuery(state.searchQuery);
  const searchFilterParts = summarizeMediaSearch(parsedSearch.filters);
  return SearchResultsView({
    query: parsedSearch.textQuery,
    totalCount: viewModel.globalSearchResultCount,
    filterParts: searchFilterParts,
    hasActiveFilters: Boolean(searchFilterParts.length),
    photoSections: viewModel.searchPhotoSections,
    photoCount: viewModel.searchPhotoItems.length,
    videoSections: viewModel.searchVideoSections,
    videoCount: viewModel.searchVideoItems.length,
    audioItems: viewModel.searchAudioItems,
    audioCount: viewModel.searchAudioItems.length,
    fileItems: viewModel.searchFileItems,
    fileCount: viewModel.searchFileItems.length,
    albumCards: viewModel.searchAlbumCards,
    albumCount: viewModel.searchAlbumCards.length,
    state,
    layoutWidth: state.layoutWidth,
    audioState: {
      currentId: state.audioCurrentId,
      isPlaying: state.audioPlaying
    },
    playlists: viewModel.musicPlaylists,
    activePlaylistName: viewModel.activePlaylistName,
    contextLabel: getSearchContextLabel(),
    resultsLimited: Boolean(state.librarySyncMeta?.isTruncated || state.librarySyncMeta?.source === 'dom'),
    resultSource: state.librarySyncMeta?.source || 'indexed',
    loadedCount: state.librarySyncMeta?.loadedCount || 0
  });
}
```

- [ ] **Step 6: Add local patch helper**

```js
function patchGlobalSearchResultsView({ preserveFocus = false, selectionStart = null, selectionEnd = null, perfToken = null } = {}) {
  if (!refs.root) {
    finishPerfAction(perfToken);
    return false;
  }
  const parsedSearch = parseMediaSearchQuery(state.searchQuery);
  const isGlobalSearch = Boolean(parsedSearch.textQuery || countActiveMediaSearchFilters(parsedSearch.filters) > 0)
    && state.primaryFilter !== 'Mind'
    && state.primaryFilter !== 'Bin'
    && !getActiveAlbumName()
    && !state.videoCategoryFilter
    && !state.privateViewOpen
    && !hasAnyPickerTarget(state)
    && !state.privateSelectionMode;
  if (!isGlobalSearch) {
    finishPerfAction(perfToken);
    return false;
  }
  const current = refs.root.querySelector('[data-search-results-root]');
  if (!(current instanceof HTMLElement)) {
    finishPerfAction(perfToken);
    return false;
  }
  const viewModel = getViewModel();
  const template = document.createElement('template');
  template.innerHTML = renderSearchResultsViewHtml(viewModel).trim();
  const next = template.content.querySelector('[data-search-results-root]');
  if (!(next instanceof HTMLElement)) {
    finishPerfAction(perfToken);
    return false;
  }
  current.replaceWith(next);
  countPerfRender('search-results-patch');
  setupImageLoadAnimations();
  if (preserveFocus) {
    window.requestAnimationFrame(() => restoreSearchInputFocus(selectionStart, selectionEnd));
  }
  finishPerfActionAfterPaint(perfToken);
  return true;
}
```

- [ ] **Step 7: Use the patch in `applySearchQuery()`**

After state changes and before fallback render:

```js
if (!patchGlobalSearchResultsView({
  preserveFocus,
  selectionStart,
  selectionEnd,
  perfToken
})) {
  render();
  if (preserveFocus) {
    window.requestAnimationFrame(() => restoreSearchInputFocus(selectionStart, selectionEnd));
  }
  finishPerfActionAfterPaint(perfToken);
}
```

- [ ] **Step 8: Run verification and commit**

```powershell
D:\DevTools\nvm\v22.14.0\node.exe --check js\media-library\app.js
D:\DevTools\nvm\v22.14.0\node.exe --check js\media-library\components.js
D:\DevTools\nvm\v22.14.0\node.exe ..\..\node_modules\mocha\bin\mocha.js test\previewActions.test.js --grep "global search"
git diff --check
git add -- js/media-library/app.js js/media-library/components.js test/previewActions.test.js
git commit -m "perf: patch global search results locally"
```

---

### Task 5: Local-Patch Bin Loading Surface

**Files:**
- Modify: `js/media-library/app.js`
- Test: `test/previewActions.test.js`

- [ ] **Step 1: Add failing source test**

```js
it('patches Bin loading and list updates without forcing the full shell path', () => {
  const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
  const fetchStart = appSource.indexOf('async function fetchBinItems');
  const fetchEnd = appSource.indexOf('function snapshotBinMutationState', fetchStart);
  assert.ok(fetchStart >= 0 && fetchEnd > fetchStart);
  const fetchSource = appSource.slice(fetchStart, fetchEnd);

  assert.match(appSource, /function patchBinGridView\(/);
  assert.match(fetchSource, /patchBinGridView\(\)/);
});
```

- [ ] **Step 2: Verify red**

Run:

```powershell
D:\DevTools\nvm\v22.14.0\node.exe ..\..\node_modules\mocha\bin\mocha.js test\previewActions.test.js --grep "Bin loading"
```

Expected: FAIL because `patchBinGridView()` is missing.

- [ ] **Step 3: Add `patchBinGridView()`**

```js
function patchBinGridView({ perfToken = null } = {}) {
  if (!refs.root || state.primaryFilter !== 'Bin') {
    finishPerfAction(perfToken);
    return false;
  }
  const current = refs.root.querySelector('.cml-bin-grid, [data-bin-grid-root]');
  if (!(current instanceof HTMLElement)) {
    finishPerfAction(perfToken);
    return false;
  }
  const viewModel = getViewModel();
  const template = document.createElement('template');
  template.innerHTML = BinGrid({
    items: viewModel.binItems,
    sections: viewModel.sections,
    binSelectedIds: viewModel.binSelectedIds,
    isBinLoading: viewModel.isBinLoading,
    layoutWidth: state.layoutWidth,
    activeSectionAnchor: state.activeSectionAnchor
  }).trim();
  const next = template.content.firstElementChild;
  if (!(next instanceof HTMLElement)) {
    finishPerfAction(perfToken);
    return false;
  }
  current.replaceWith(next);
  countPerfRender('bin-grid-patch');
  setupImageLoadAnimations();
  finishPerfActionAfterPaint(perfToken);
  return true;
}
```

If `BinGrid` top-level class is not `.cml-bin-grid`, add `data-bin-grid-root` to the component output in `components.js` and update the test to assert that attribute.

- [ ] **Step 4: Use patch in `fetchBinItems()`**

Replace the loading-start and loading-finish `render()` calls with:

```js
if (!patchBinGridView({ perfToken })) {
  render();
}
```

Only finish the perf token once, after the final loaded/error UI is visible.

- [ ] **Step 5: Run verification and commit**

```powershell
D:\DevTools\nvm\v22.14.0\node.exe --check js\media-library\app.js
D:\DevTools\nvm\v22.14.0\node.exe ..\..\node_modules\mocha\bin\mocha.js test\previewActions.test.js --grep "Bin loading"
git diff --check
git add -- js/media-library/app.js js/media-library/components.js test/previewActions.test.js
git commit -m "perf: patch bin list loading locally"
```

---

### Task 6: Local-Patch Moments Photo Picker Open and Close

**Files:**
- Modify: `js/media-library/app.js`
- Modify: `js/media-library/components.js`
- Test: `test/momentsAppState.test.js`
- Test: `test/previewActions.test.js`

- [ ] **Step 1: Add source tests**

In `test/previewActions.test.js`:

```js
it('renders Moments picker with a stable patch root', () => {
  const html = MomentsView({
    posts: [],
    pickerOpen: true,
    pickerItems: [],
    pickerSelectedIds: [],
    selectedDate: '2026-05-18',
    calendarMonth: '2026-05',
    datesWithPhotos: {},
    authorName: 'Aschenbath'
  });

  assert.match(html, /data-moments-picker-root/);
});
```

In `test/momentsAppState.test.js` or `test/previewActions.test.js`:

```js
it('uses a local Moments picker patch helper for picker visibility changes', () => {
  const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
  assert.match(appSource, /function patchMomentsPickerLayer\(/);
  assert.match(appSource, /openMomentsPhotoPicker\(\)/);
  assert.match(appSource, /closeMomentsPhotoPicker\(\)/);
});
```

- [ ] **Step 2: Verify red**

Run:

```powershell
D:\DevTools\nvm\v22.14.0\node.exe ..\..\node_modules\mocha\bin\mocha.js test\previewActions.test.js --grep "Moments picker"
```

Expected: FAIL on missing picker root/helper.

- [ ] **Step 3: Add `data-moments-picker-root`**

In `MomentsView()` inside `js/media-library/components.js`, put `data-moments-picker-root` on the picker container when it is rendered.

If no picker DOM is rendered when closed, add a stable empty host:

```js
<div data-moments-picker-root>
  ${pickerOpen ? renderMomentsPicker(...) : ''}
</div>
```

- [ ] **Step 4: Add patch helpers**

```js
function patchMomentsPickerLayer({ perfToken = null } = {}) {
  if (!refs.root || state.primaryFilter !== 'Moments') {
    finishPerfAction(perfToken);
    return false;
  }
  const current = refs.root.querySelector('[data-moments-picker-root]');
  if (!(current instanceof HTMLElement)) {
    finishPerfAction(perfToken);
    return false;
  }
  const template = document.createElement('template');
  template.innerHTML = MomentsView({
    posts: state.momentsPosts,
    isLoading: state.momentsLoading && !state.momentsHydrated,
    isPublishing: state.momentsPublishing,
    draftBody: state.momentsDraftBody,
    draftDate: state.momentsDraftDate,
    draftAttachments: state.momentsDraftAttachments,
    editingPostId: state.momentsEditingPostId,
    pickerOpen: state.momentsPickerOpen,
    pickerItems: state.momentsPickerOpen ? getMomentPickerItems() : [],
    pickerSelectedIds: [...state.momentsPickerSelection],
    selectedDate: state.momentsSelectedDate,
    calendarMonth: state.momentsCalendarMonth,
    datesWithPhotos: state.momentsDatesWithPhotos,
    authorName: state.adminDisplayName || state.adminUsername || 'Aschenbath',
    authorAvatarData: state.adminAvatarData,
    error: state.momentsError
  }).trim();
  const next = template.content.querySelector('[data-moments-picker-root]');
  if (!(next instanceof HTMLElement)) {
    finishPerfAction(perfToken);
    return false;
  }
  current.replaceWith(next);
  countPerfRender('moments-picker-patch');
  setupImageLoadAnimations();
  finishPerfActionAfterPaint(perfToken);
  return true;
}

function openMomentsPhotoPicker() {
  const perfToken = startPerfAction('moments picker open');
  state.momentsPickerOpen = true;
  state.momentsPickerSelection = new Set();
  if (!patchMomentsPickerLayer({ perfToken })) {
    render();
    finishPerfActionAfterPaint(perfToken);
  }
}

function closeMomentsPhotoPicker() {
  const perfToken = startPerfAction('moments picker close');
  state.momentsPickerOpen = false;
  state.momentsPickerSelection = new Set();
  if (!patchMomentsPickerLayer({ perfToken })) {
    render();
    finishPerfActionAfterPaint(perfToken);
  }
}
```

- [ ] **Step 5: Wire actions**

In `handleAction()`:

```js
case 'open-moments-photo-picker':
  openMomentsPhotoPicker();
  return true;
case 'close-moments-photo-picker':
  closeMomentsPhotoPicker();
  return true;
```

- [ ] **Step 6: Run verification and commit**

```powershell
D:\DevTools\nvm\v22.14.0\node.exe --check js\media-library\app.js
D:\DevTools\nvm\v22.14.0\node.exe --check js\media-library\components.js
D:\DevTools\nvm\v22.14.0\node.exe ..\..\node_modules\mocha\bin\mocha.js test\previewActions.test.js --grep "Moments picker"
git diff --check
git add -- js/media-library/app.js js/media-library/components.js test/previewActions.test.js test/momentsAppState.test.js
git commit -m "perf: patch moments picker locally"
```

---

### Task 7: Optimize Photos Timeline Row and Active-Year Lookup

**Files:**
- Modify: `js/media-library/app.js`
- Test: `test/previewActions.test.js`

- [ ] **Step 1: Add failing source test for binary row lookup**

```js
it('uses binary lookup for virtual timeline row ranges and active section updates', () => {
  const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');
  const rowRangeStart = appSource.indexOf('function getVisibleRowRange');
  const rowRangeEnd = appSource.indexOf('function applyTimelineVirtualWindow', rowRangeStart);
  assert.ok(rowRangeStart >= 0 && rowRangeEnd > rowRangeStart);
  const rowRangeSource = appSource.slice(rowRangeStart, rowRangeEnd);
  const activeYearStart = appSource.indexOf('function updateActiveYear');
  const activeYearEnd = appSource.indexOf('function getScrollableResultCount', activeYearStart);
  assert.ok(activeYearStart >= 0 && activeYearEnd > activeYearStart);
  const activeYearSource = appSource.slice(activeYearStart, activeYearEnd);

  assert.match(appSource, /function findTimelineRowStartIndex\(/);
  assert.match(appSource, /function findTimelineRowEndIndex\(/);
  assert.match(appSource, /function findActiveSectionByScrollTop\(/);
  assert.doesNotMatch(rowRangeSource, /while \(startIndex < rows\.length\)/);
  assert.doesNotMatch(activeYearSource, /refs\.sectionAnchors\.forEach/);
});
```

- [ ] **Step 2: Verify red**

Run:

```powershell
D:\DevTools\nvm\v22.14.0\node.exe ..\..\node_modules\mocha\bin\mocha.js test\previewActions.test.js --grep "binary lookup"
```

Expected: FAIL because the current implementation uses linear scans.

- [ ] **Step 3: Add binary lookup helpers**

```js
function getTimelineRowHeight(section, index) {
  const row = section?.rows?.[index];
  return Number(row?.height || row?.items?.[0]?.height || 0);
}

function findTimelineRowStartIndex(section, bodyStart) {
  const rows = section.rows || [];
  let lo = 0;
  let hi = rows.length - 1;
  let answer = rows.length;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const rowTop = section.rowOffsets[mid] || 0;
    const rowBottom = rowTop + getTimelineRowHeight(section, mid);
    if (rowBottom >= bodyStart) {
      answer = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return answer;
}

function findTimelineRowEndIndex(section, startIndex, bodyEnd) {
  const rows = section.rows || [];
  let lo = Math.max(0, startIndex);
  let hi = rows.length - 1;
  let answer = startIndex - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const rowTop = section.rowOffsets[mid] || 0;
    if (rowTop <= bodyEnd) {
      answer = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return answer;
}
```

- [ ] **Step 4: Replace linear row scans**

Inside `getVisibleRowRange()`:

```js
const startIndex = findTimelineRowStartIndex(section, bodyStart);
const endIndex = findTimelineRowEndIndex(section, startIndex, bodyEnd);
```

Keep the existing empty-range guards.

- [ ] **Step 5: Add active section lookup**

```js
function findActiveSectionByScrollTop(scrollTop = 0) {
  const anchors = refs.sectionAnchors || [];
  if (!anchors.length) {
    return null;
  }
  let lo = 0;
  let hi = anchors.length - 1;
  let answer = anchors[0];
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const section = anchors[mid];
    const top = section instanceof HTMLElement ? section.offsetTop : 0;
    if (top - 40 <= scrollTop) {
      answer = section;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return answer;
}
```

Use it inside `updateActiveYear()`:

```js
const activeSection = findActiveSectionByScrollTop(scrollTop);
```

- [ ] **Step 6: Run verification and commit**

```powershell
D:\DevTools\nvm\v22.14.0\node.exe --check js\media-library\app.js
D:\DevTools\nvm\v22.14.0\node.exe ..\..\node_modules\mocha\bin\mocha.js test\previewActions.test.js --grep "binary lookup|normal Photos timelines"
git diff --check
git add -- js/media-library/app.js test/previewActions.test.js
git commit -m "perf: speed up timeline range lookup"
```

---

### Task 8: Route-Specific ViewModel Dispatch

**Files:**
- Modify: `js/media-library/app.js`
- Test: `test/previewActions.test.js`

- [ ] **Step 1: Add source test for route-specific builders**

```js
it('dispatches view-model construction through route-specific builders', () => {
  const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /function getBaseViewModelContext\(/);
  assert.match(appSource, /function getPhotosViewModel\(/);
  assert.match(appSource, /function getMusicViewModel\(/);
  assert.match(appSource, /function getFilmsViewModel\(/);
  assert.match(appSource, /function getMomentsViewModel\(/);
  assert.match(appSource, /function getSearchViewModel\(/);
  assert.match(appSource, /switch \(true\)/);
});
```

- [ ] **Step 2: Verify red**

Run:

```powershell
D:\DevTools\nvm\v22.14.0\node.exe ..\..\node_modules\mocha\bin\mocha.js test\previewActions.test.js --grep "view-model construction"
```

Expected: FAIL because `getViewModel()` is still monolithic.

- [ ] **Step 3: Extract base context**

Add:

```js
function getBaseViewModelContext() {
  const accessibleItems = getAccessibleItems();
  const visibleSecondaryFilters = getVisibleSecondaryFilters(accessibleItems);
  if (state.secondaryFilter && !visibleSecondaryFilters.includes(state.secondaryFilter)) {
    state.secondaryFilter = '';
  }
  const parsedSearch = parseMediaSearchQuery(state.searchQuery);
  const globalSearchActive = Boolean(
    parsedSearch.textQuery || countActiveMediaSearchFilters(parsedSearch.filters) > 0
  );
  return { accessibleItems, visibleSecondaryFilters, parsedSearch, globalSearchActive };
}
```

- [ ] **Step 4: Extract route builders one at a time**

Start with `getMusicViewModel(context)` because Music now has clear perf tests. It should return the same property names currently returned by `getViewModel()`:

```js
function getMusicViewModel(context) {
  const { accessibleItems, visibleSecondaryFilters } = context;
  const musicPlaylists = buildMusicPlaylistSummaries(accessibleItems);
  const musicItems = getMusicContextItems(accessibleItems);
  const audioQueueItems = getAudioQueueItems(accessibleItems);
  const currentAudioItem = getAudioItemById(state.audioCurrentId, accessibleItems)
    || getAudioItemById(state.audioCurrentId, getAllItems());
  return buildViewModelResult({
    navigationModel: { primary: navigationModel.primary, secondary: visibleSecondaryFilters },
    isMusicView: true,
    musicPlaylists,
    musicItems,
    audioQueueItems,
    currentAudioItem,
    activePlaylistName: getActivePlaylistName()
  });
}
```

Create `buildViewModelResult(overrides)` to fill stable defaults:

```js
function buildViewModelResult(overrides = {}) {
  return {
    navigationModel: { primary: navigationModel.primary, secondary: [] },
    activeAlbumName: '',
    activeAlbumCoverId: '',
    activeAlbumCoverLabel: '',
    hasCustomAlbumCover: false,
    albumSelectionTarget: null,
    videoAlbumSelectionTarget: null,
    isAlbumPickerMode: false,
    isFilmsView: false,
    isMindView: false,
    isMomentsView: false,
    isGlobalSearchView: false,
    globalSearchResultCount: 0,
    isMusicView: false,
    activePlaylistName: '',
    isCollectionRoot: false,
    musicPlaylists: [],
    collectionCards: [],
    totalCollectionCount: 0,
    filteredItems: [],
    searchPhotoItems: [],
    searchVideoItems: [],
    searchAudioItems: [],
    searchFileItems: [],
    searchAlbumCards: [],
    searchPhotoSections: [],
    searchVideoSections: [],
    musicItems: [],
    currentAudioItem: null,
    audioQueueItems: [],
    momentsPosts: state.momentsPosts,
    momentsDatesWithPhotos: state.momentsDatesWithPhotos,
    isVideoAlbumRoot: false,
    videoAlbumCards: [],
    videoAlbumCount: 0,
    videoAlbumGroupedItemCount: 0,
    videoAlbumUngroupedCount: 0,
    activeVideoAlbumItemCount: 0,
    videoCategoryOptions: [],
    videoCategoryScopeCount: 0,
    sections: [],
    timelineLayoutSections: [],
    timelineVirtualSignature: '',
    timelineVirtualEnabled: false,
    years: [],
    scrubberSections: [],
    previewItems: [],
    previewIndex: -1,
    previewItem: null,
    availableAlbums: [],
    previewAlbumEntries: [],
    filmRecord: null,
    canSetAlbumCover: false,
    canDownloadSelection: false,
    canDeleteSelection: false,
    binItems: state.binItems,
    isBinLoading: state.isBinLoading,
    binSelectedIds: state.binSelectedIds,
    ...overrides
  };
}
```

- [ ] **Step 5: Dispatch with parity**

Change `getViewModel()` to:

```js
function getViewModel() {
  const context = getBaseViewModelContext();
  switch (true) {
    case context.globalSearchActive:
      return getSearchViewModel(context);
    case state.primaryFilter === 'Music':
      return getMusicViewModel(context);
    case state.primaryFilter === 'Films':
      return getFilmsViewModel(context);
    case state.primaryFilter === 'Moments':
      return getMomentsViewModel(context);
    default:
      return getPhotosViewModel(context);
  }
}
```

During this task, each route-specific builder may initially call a shared internal function for parity. The final state of this task must at least isolate Music and Search from unnecessary timeline section work.

- [ ] **Step 6: Run broad verification**

```powershell
D:\DevTools\nvm\v22.14.0\node.exe --check js\media-library\app.js
D:\DevTools\nvm\v22.14.0\node.exe ..\..\node_modules\mocha\bin\mocha.js test\previewActions.test.js --grep "music|global search|normal Photos timelines|view-model"
D:\DevTools\nvm\v22.14.0\node.exe ..\..\node_modules\mocha\bin\mocha.js
git diff --check
```

Expected: full suite passes with existing pending count.

- [ ] **Step 7: Commit**

```powershell
git add -- js/media-library/app.js test/previewActions.test.js
git commit -m "perf: split media library view-model builders"
```

---

### Task 9: Add Backend List Timing Metadata

**Files:**
- Modify: `functions/api/manage/list.js`
- Test: `test/d1Metadata.test.js`

- [ ] **Step 1: Add backend response test**

In the D1 list response test area of `test/d1Metadata.test.js`, add an assertion that an indexed list response includes a timing/meta object.

```js
assert.equal(payload.isD1QueryResponse, true);
assert.ok(payload.listTiming);
assert.equal(typeof payload.listTiming.durationMs, 'number');
assert.match(payload.listTiming.queryPath, /d1/);
```

- [ ] **Step 2: Verify red**

Run:

```powershell
D:\DevTools\nvm\v22.14.0\node.exe ..\..\node_modules\mocha\bin\mocha.js test\d1Metadata.test.js --grep "list route returns D1-backed paginated responses"
```

Expected: FAIL because `listTiming` is absent.

- [ ] **Step 3: Add timing to `onRequest()`**

At the start of the normal request path:

```js
const listStartedAt = Date.now();
```

In D1 response payloads:

```js
listTiming: {
  queryPath: queryResult.supplementedCount > 0 ? 'd1-hybrid-supplement' : 'd1',
  durationMs: Math.max(0, Date.now() - listStartedAt),
  pageSize,
  returnedCount: compatibleFiles.length,
  kvSupplementSource: queryResult.kvSupplementSource || 'none'
}
```

For legacy `readIndex()` responses, add:

```js
listTiming: {
  queryPath: 'index',
  durationMs: Math.max(0, Date.now() - listStartedAt),
  pageSize: count,
  returnedCount: files.length,
  kvSupplementSource: 'none'
}
```

- [ ] **Step 4: Surface list timing in frontend perf rows**

In `fetchListPage()`, after JSON parsing in callers, record timing when available:

```js
if (payload?.listTiming) {
  pushPerfDiagnosticRow({
    action: `list:${payload.listTiming.queryPath}`,
    duration: payload.listTiming.durationMs,
    networkAwaited: true,
    renderPath: 'network'
  });
}
```

Keep this gated by `pushPerfDiagnosticRow()` so no normal user output changes.

- [ ] **Step 5: Run verification and commit**

```powershell
D:\DevTools\nvm\v22.14.0\node.exe --check functions\api\manage\list.js
D:\DevTools\nvm\v22.14.0\node.exe --check js\media-library\app.js
D:\DevTools\nvm\v22.14.0\node.exe ..\..\node_modules\mocha\bin\mocha.js test\d1Metadata.test.js --grep "list route returns D1-backed paginated responses"
D:\DevTools\nvm\v22.14.0\node.exe ..\..\node_modules\mocha\bin\mocha.js
git diff --check
git add -- functions/api/manage/list.js js/media-library/app.js test/d1Metadata.test.js
git commit -m "perf: expose media list timing"
```

---

### Task 10: Cache Bump, History Update, and Final Validation

**Files:**
- Modify: `index.html`
- Modify: `history.md`
- Possibly modify: `js/media-library/app.js` import cache versions if `components.js` changed

- [ ] **Step 1: Bump frontend cache versions**

If `js/media-library/app.js` changed, increment the `app.js?v=` value in `index.html`.

If `js/media-library/components.js` changed, increment the `components.js?v=` import value inside `app.js`.

If `css/media-library.css` changed in a future extension of this plan, increment `media-library.css?v=` in `index.html`.

- [ ] **Step 2: Update `history.md`**

Add a compact Work Log entry under `2026 > May > 18th` or the current date if executing later:

```md
- 2026-05-18 | [sitewide][perf][responsiveness] Extended `?cmlPerf=1` beyond Films/Music, added local patches for Search/Bin/Moments picker, guarded resize renders, optimized Photos timeline lookup, and exposed list timing metadata so future smoothness work can be measured instead of guessed. Cache: `entry-loader.js?v=5`, `app.js?v=<new>`, `components.js?v=<new>`, `moments-state.js?v=3`, `media-cache-merge.js?v=2`, `films-components.js?v=81`, `films-data.js?v=7`, `media-library.css?v=<current>`. Validation: Node 22 syntax checks; focused sitewide perf tests; full Mocha `<count> passing with <pending> pending`; browser/live-app manual QA status recorded explicitly.
```

Update the Tail Capsule `latest-state` and `latest-validation` lines with the same cache and verification truth.

- [ ] **Step 3: Run final verification**

```powershell
D:\DevTools\nvm\v22.14.0\node.exe --check js\media-library\app.js
D:\DevTools\nvm\v22.14.0\node.exe --check js\media-library\components.js
D:\DevTools\nvm\v22.14.0\node.exe --check functions\api\manage\list.js
D:\DevTools\nvm\v22.14.0\node.exe ..\..\node_modules\mocha\bin\mocha.js
git diff --check
```

Expected: syntax checks pass, full Mocha passes, diff check is clean except acceptable CRLF warnings if Windows reports them.

- [ ] **Step 4: Commit final docs/cache state**

```powershell
git add -- index.html history.md js/media-library/app.js js/media-library/components.js functions/api/manage/list.js test/previewActions.test.js test/momentsAppState.test.js test/d1Metadata.test.js
git commit -m "perf: complete sitewide responsiveness pass"
```

- [ ] **Step 5: Push**

```powershell
git push origin HEAD:main
```

Expected: push succeeds. If rejected because remote moved, create or use an isolated worktree from latest `origin/main`, cherry-pick the task commits, resolve conflicts, rerun full verification, then push.

---

## Execution Notes

- Use Node 22: `D:\DevTools\nvm\v22.14.0\node.exe`.
- In project-local worktrees without `node_modules`, use the parent repo Mocha path: `..\..\node_modules\mocha\bin\mocha.js`.
- Do not use web search.
- Do not touch the dirty main checkout unless Gilbert explicitly asks. Use a clean worktree based on current `origin/main`.
- Do not reintroduce Photos `.cml-media-row { content-visibility: auto }`.
- Do not redesign the shell, sidebar, theme, Music layout, Films layout, or Moments visual language.
- Keep ordinary mutations optimistic/local-first and quiet by default.
- Prefer local DOM patching for high-frequency input/scroll/open-close paths; keep full `render()` as fallback.

## Self-Review

- Spec coverage: The plan covers instrumentation, hot action labeling, resize, Search, Bin, Moments picker, Photos timeline, view-model decomposition, backend list timing, cache/history, and final validation.
- Placeholder scan: No placeholder steps are left; each task has files, tests, expected red state, implementation shape, verification, and commit.
- Type consistency: Helper names are stable across tasks: `measurePerfSpan`, `pushPerfDiagnosticRow`, `patchGlobalSearchResultsView`, `patchBinGridView`, `patchMomentsPickerLayer`, `findTimelineRowStartIndex`, `findTimelineRowEndIndex`, `findActiveSectionByScrollTop`, and route-specific view-model builders.
