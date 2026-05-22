# SUNDOWNER Mobile Consumption Surface — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the Photos / Albums / Preview lightbox mobile consumption surface defined in `docs/superpowers/specs/2026-05-22-sundowner-mobile-consumption-design.md` on a single feature branch with one PR into `main`.

**Architecture:** Extract gesture-arbitration and breakpoint decisions into pure helpers in `js/media-library/preview-overlay.js`, leaving DOM wiring in `app.js`. Reuse the existing `is-immersive` Preview class as the idle-fade vehicle. Build the `/collections/:albumId` mobile sub-page as a new component in `components.js` reusing `cml-mobile-albums-bar` chrome. Store last-viewed item in the route hash for scroll restore. Add 9 new RED/GREEN regressions as pure-function tests.

**Tech Stack:** Vanilla ES modules (no framework), Mocha 10 (Node 22 via `D:\DevTools\nvm\v22.14.0\node.exe`), HTML-string component functions, CSS custom properties. No new runtime dependencies.

**Repo & branch:** Work in `D:\Codex\midTime\leosDrive-telegram-sync`. Create feature branch `feat/mobile-consumption-pass-1` off current `main` (`29bef37`). Do **not** rebase or merge `docs/mobile-consumption-spec` (PR #8) into this branch; that PR is doc-only and lands separately. Final PR for this plan targets `main`.

**Cache versions to bump on final task:** `app.js`, `components.js`, `preview-overlay.js`, `media-library.css` — update query strings in `index.html` consistently.

**Test command:** `D:\DevTools\nvm\v22.14.0\node.exe ./node_modules/mocha/bin/mocha.js test/<file>.test.js` for focused; `D:\DevTools\nvm\v22.14.0\node.exe ./node_modules/mocha/bin/mocha.js` for full suite. Baseline: 591 passing / 1 pending / 1 pre-existing `is-heic-decode-pending` failure. Target: 600 passing / 1 pending / same single pre-existing failure.

---

## Task 0: Create feature branch

**Files:** none

- [ ] **Step 0.1: Verify clean state and current branch**

```bash
cd D:/Codex/midTime/leosDrive-telegram-sync
git status --short
git rev-parse --abbrev-ref HEAD
```

Expected: clean working tree (only `.superpowers/`, `.worktrees/`, `music-acceptance.png` as untracked, if present); current branch `main` or `docs/mobile-consumption-spec`. If on the spec branch, switch back to `main` first.

- [ ] **Step 0.2: Sync `main` with origin**

```bash
git checkout main
git pull --ff-only origin main
```

Expected: `Already up to date.` or fast-forward to latest origin/main.

- [ ] **Step 0.3: Branch off**

```bash
git checkout -b feat/mobile-consumption-pass-1
```

Expected: `Switched to a new branch 'feat/mobile-consumption-pass-1'`.

---

## Task 1: Phone breakpoint CSS custom properties

**Files:**
- Create: `test/breakpointPhoneNormalization.test.js`
- Modify: `css/media-library.css` (insert at top of `:root` block)

- [ ] **Step 1.1: Write the failing test**

Create `test/breakpointPhoneNormalization.test.js`:

```javascript
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.resolve('css/media-library.css');
const css = fs.readFileSync(cssPath, 'utf8');

describe('phone breakpoint tokens', () => {
  it('defines --cml-phone-break: 640px on :root', () => {
    assert.match(css, /:root[^}]*--cml-phone-break:\s*640px/s);
  });

  it('defines --cml-phone-small-break: 420px on :root', () => {
    assert.match(css, /:root[^}]*--cml-phone-small-break:\s*420px/s);
  });

  it('uses the 640px breakpoint as the primary phone media query', () => {
    const matches = css.match(/@media \(max-width: 640px\)/g) || [];
    assert.ok(matches.length >= 5, `expected at least 5 @media (max-width: 640px) blocks, found ${matches.length}`);
  });
});
```

- [ ] **Step 1.2: Run the test to confirm failure**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/breakpointPhoneNormalization.test.js
```

Expected: 2 failing (the two `--cml-phone-*` assertions). The third test about 640px count already passes (8 occurrences exist).

- [ ] **Step 1.3: Locate the existing `:root` rule and add the custom properties**

Find the first `:root` block in `css/media-library.css` (typically near the top, around line 1-30). Add the two custom property declarations inside it:

```css
:root {
  /* existing custom properties... */
  --cml-phone-break: 640px;
  --cml-phone-small-break: 420px;
}
```

If there is no `:root` block at the top, add one:

```css
:root {
  --cml-phone-break: 640px;
  --cml-phone-small-break: 420px;
}
```

- [ ] **Step 1.4: Run the test to confirm pass**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/breakpointPhoneNormalization.test.js
```

Expected: 3 passing.

- [ ] **Step 1.5: Commit**

```bash
git add test/breakpointPhoneNormalization.test.js css/media-library.css
git commit -m "feat(mobile): add phone breakpoint CSS custom properties

Introduces --cml-phone-break (640px) and --cml-phone-small-break (420px)
as the canonical phone breakpoint tokens. Adds regression asserting the
:root declarations and current 640px @media usage.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Phone breakpoint @media normalization (680/720 → 640 where phone-intent)

**Files:**
- Modify: `css/media-library.css` lines 3510, 7283, 14707 (`@media (max-width: 680px)` × 1, `(max-width: 720px)` × 2)

The decision rule: if the rule body targets phone-specific layout (single column, hides sidebar, mobile-nav-adjacent), migrate to 640. If it targets tablet shapes (sidebar narrows, two columns), leave it alone with a `/* tablet-segment */` comment.

- [ ] **Step 2.1: Read each rule body and classify**

```bash
sed -n '3508,3530p' css/media-library.css
sed -n '7281,7305p' css/media-library.css
sed -n '14705,14730p' css/media-library.css
```

Expected output: three rule blocks. For each, decide phone vs tablet.

- [ ] **Step 2.2: Add a regression that asserts no phone-intent breakpoint remains at 680 or 720**

Append to `test/breakpointPhoneNormalization.test.js`:

```javascript
describe('phone breakpoint normalization', () => {
  it('does not use 680px as a phone-segment breakpoint', () => {
    const sixEightyMatches = css.match(/@media \(max-width: 680px\)/g) || [];
    assert.equal(sixEightyMatches.length, 0, '680px breakpoints should be migrated to 640px');
  });

  it('keeps 720px only when explicitly tagged tablet-segment', () => {
    const lines = css.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('@media (max-width: 720px)')) {
        const next = (lines[i + 1] || '') + (lines[i + 2] || '');
        assert.match(next, /tablet-segment/, `720px @media at line ${i + 1} must have /* tablet-segment */ marker`);
      }
    });
  });
});
```

- [ ] **Step 2.3: Run the test to confirm failure**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/breakpointPhoneNormalization.test.js
```

Expected: 2 failing under "phone breakpoint normalization".

- [ ] **Step 2.4: Migrate the rules**

For each phone-intent rule body, edit `css/media-library.css`:
- Change `@media (max-width: 680px)` → `@media (max-width: 640px)` if phone-intent
- Change `@media (max-width: 720px)` → `@media (max-width: 640px)` if phone-intent; otherwise add `/* tablet-segment */` comment on the line above

Worked example for the 680 block at line 3510 (most likely phone-intent based on its position in the Photos timeline range):

```css
/* before */
@media (max-width: 680px) {
  /* rule body */
}

/* after */
@media (max-width: 640px) {
  /* rule body */
}
```

For a tablet-intent 720 block:

```css
/* tablet-segment */
@media (max-width: 720px) {
  /* rule body */
}
```

- [ ] **Step 2.5: Run the test to confirm pass**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/breakpointPhoneNormalization.test.js
```

Expected: 5 passing.

- [ ] **Step 2.6: Run the full Mocha to confirm no regressions**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js
```

Expected: 591 + new tests passing / 1 pending / 1 pre-existing failure. No new failures.

- [ ] **Step 2.7: Commit**

```bash
git add test/breakpointPhoneNormalization.test.js css/media-library.css
git commit -m "feat(mobile): normalize phone @media breakpoints to 640px

Migrates phone-intent 680px and 720px @media rules to 640px. Adds
tablet-segment markers on remaining 720px rules so future audits can
distinguish phone vs tablet intent.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Gesture arbitration pure helper

**Files:**
- Modify: `js/media-library/preview-overlay.js` (export new helpers)
- Create: `test/gestureArbitration.test.js`

- [ ] **Step 3.1: Write the failing test**

Create `test/gestureArbitration.test.js`:

```javascript
import assert from 'node:assert/strict';
import { arbitrateGestureChannel, GESTURE_ARBITRATION_THRESHOLD } from '../js/media-library/preview-overlay.js';

describe('arbitrateGestureChannel', () => {
  it('returns "zoom" when two fingers are down', () => {
    assert.equal(arbitrateGestureChannel({ dx: 0, dy: 0, touchCount: 2 }), 'zoom');
  });

  it('returns "idle" before the 10px arbitration threshold', () => {
    assert.equal(GESTURE_ARBITRATION_THRESHOLD, 10);
    assert.equal(arbitrateGestureChannel({ dx: 5, dy: 5, touchCount: 1 }), 'idle');
    assert.equal(arbitrateGestureChannel({ dx: 9, dy: 0, touchCount: 1 }), 'idle');
  });

  it('returns "swipe" when |dx| > |dy| past threshold and single-finger', () => {
    assert.equal(arbitrateGestureChannel({ dx: 20, dy: 5, touchCount: 1 }), 'swipe');
    assert.equal(arbitrateGestureChannel({ dx: -20, dy: 5, touchCount: 1 }), 'swipe');
  });

  it('returns "dismiss" only on downward single-finger drag past threshold', () => {
    assert.equal(arbitrateGestureChannel({ dx: 5, dy: 20, touchCount: 1 }), 'dismiss');
    assert.equal(arbitrateGestureChannel({ dx: 0, dy: 20, touchCount: 1 }), 'dismiss');
  });

  it('returns "idle" on upward drag (no-op, Tier-2 placeholder)', () => {
    assert.equal(arbitrateGestureChannel({ dx: 0, dy: -20, touchCount: 1 }), 'idle');
  });

  it('locks swipe channel when isPinch flag is true regardless of vector', () => {
    assert.equal(arbitrateGestureChannel({ dx: 30, dy: 0, touchCount: 1, isPinch: true }), 'zoom');
  });
});
```

- [ ] **Step 3.2: Run the test to confirm failure**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/gestureArbitration.test.js
```

Expected: import error or 6 failing — `arbitrateGestureChannel` and `GESTURE_ARBITRATION_THRESHOLD` not exported.

- [ ] **Step 3.3: Implement the helper**

Append to `js/media-library/preview-overlay.js`:

```javascript
export const GESTURE_ARBITRATION_THRESHOLD = 10;

/**
 * Decide which gesture channel a touch sequence has claimed.
 * Pure function: no DOM, no side effects.
 *
 * @param {{ dx: number, dy: number, touchCount: number, isPinch?: boolean }} input
 * @returns {'idle' | 'swipe' | 'dismiss' | 'zoom'}
 */
export function arbitrateGestureChannel(input) {
  const { dx = 0, dy = 0, touchCount = 0, isPinch = false } = input || {};
  if (isPinch || touchCount >= 2) {
    return 'zoom';
  }
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx < GESTURE_ARBITRATION_THRESHOLD && ady < GESTURE_ARBITRATION_THRESHOLD) {
    return 'idle';
  }
  if (adx > ady) {
    return 'swipe';
  }
  if (dy > 0) {
    return 'dismiss';
  }
  return 'idle';
}
```

- [ ] **Step 3.4: Run the test to confirm pass**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/gestureArbitration.test.js
```

Expected: 6 passing.

- [ ] **Step 3.5: Commit**

```bash
git add test/gestureArbitration.test.js js/media-library/preview-overlay.js
git commit -m "feat(preview): pure arbitrateGestureChannel helper

Exports arbitrateGestureChannel and GESTURE_ARBITRATION_THRESHOLD from
preview-overlay.js. Pure function that classifies a touch movement vector
into swipe / dismiss / zoom / idle channels using a 10px threshold and
single vs multi finger count. Enables app.js to delegate gesture decisions
to a testable boundary without DOM coupling.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Pull-to-dismiss decision helper

**Files:**
- Modify: `js/media-library/preview-overlay.js`
- Modify: `test/gestureArbitration.test.js`

- [ ] **Step 4.1: Write the failing test**

Append to `test/gestureArbitration.test.js`:

```javascript
import { shouldClosePullDismiss, PULL_DISMISS_DISTANCE_THRESHOLD, PULL_DISMISS_VELOCITY_THRESHOLD } from '../js/media-library/preview-overlay.js';

describe('shouldClosePullDismiss', () => {
  it('exposes the documented thresholds (100px / 0.6 px-per-ms)', () => {
    assert.equal(PULL_DISMISS_DISTANCE_THRESHOLD, 100);
    assert.equal(PULL_DISMISS_VELOCITY_THRESHOLD, 0.6);
  });

  it('closes when dy exceeds distance threshold regardless of velocity', () => {
    assert.equal(shouldClosePullDismiss({ dy: 120, velocity: 0 }), true);
  });

  it('closes when velocity exceeds velocity threshold even at short distance', () => {
    assert.equal(shouldClosePullDismiss({ dy: 40, velocity: 1.2 }), true);
  });

  it('does not close on small slow drag', () => {
    assert.equal(shouldClosePullDismiss({ dy: 30, velocity: 0.1 }), false);
  });

  it('does not close on upward drag', () => {
    assert.equal(shouldClosePullDismiss({ dy: -200, velocity: -2 }), false);
  });
});
```

- [ ] **Step 4.2: Run the test to confirm failure**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/gestureArbitration.test.js
```

Expected: 5 new failing tests in the `shouldClosePullDismiss` describe block.

- [ ] **Step 4.3: Implement the helper**

Append to `js/media-library/preview-overlay.js`:

```javascript
export const PULL_DISMISS_DISTANCE_THRESHOLD = 100;
export const PULL_DISMISS_VELOCITY_THRESHOLD = 0.6;

/**
 * Decide whether a downward pull-to-dismiss gesture should close the preview.
 * Pure function.
 *
 * @param {{ dy: number, velocity: number }} input dy = vertical pixels moved (positive = down). velocity = px/ms.
 * @returns {boolean}
 */
export function shouldClosePullDismiss(input) {
  const { dy = 0, velocity = 0 } = input || {};
  if (dy <= 0) return false;
  if (dy >= PULL_DISMISS_DISTANCE_THRESHOLD) return true;
  if (velocity >= PULL_DISMISS_VELOCITY_THRESHOLD) return true;
  return false;
}
```

- [ ] **Step 4.4: Run the test to confirm pass**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/gestureArbitration.test.js
```

Expected: 11 passing total (6 from Task 3 + 5 new).

- [ ] **Step 4.5: Commit**

```bash
git add js/media-library/preview-overlay.js test/gestureArbitration.test.js
git commit -m "feat(preview): pure shouldClosePullDismiss helper

Adds shouldClosePullDismiss(dy, velocity) and the two threshold constants
(100px distance, 0.6 px/ms velocity). Decides whether a vertical drag has
crossed the close-overlay threshold without touching DOM. Used by the new
pull-to-dismiss gesture in Task 6.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: isPhoneWidth pure helper + JS hookup

**Files:**
- Modify: `js/media-library/preview-overlay.js`
- Modify: `js/media-library/app.js` (locate `isMobileLayout` around line 3582)
- Create test: append to existing `test/gestureArbitration.test.js`

- [ ] **Step 5.1: Write the failing test**

Append to `test/gestureArbitration.test.js`:

```javascript
import { isPhoneWidth, PHONE_BREAK_PX } from '../js/media-library/preview-overlay.js';

describe('isPhoneWidth', () => {
  it('exposes PHONE_BREAK_PX = 640', () => {
    assert.equal(PHONE_BREAK_PX, 640);
  });

  it('returns true at and below 640', () => {
    assert.equal(isPhoneWidth(640), true);
    assert.equal(isPhoneWidth(390), true);
    assert.equal(isPhoneWidth(320), true);
  });

  it('returns false above 640', () => {
    assert.equal(isPhoneWidth(641), false);
    assert.equal(isPhoneWidth(960), false);
  });

  it('handles non-numeric input as false', () => {
    assert.equal(isPhoneWidth(NaN), false);
    assert.equal(isPhoneWidth(null), false);
    assert.equal(isPhoneWidth(undefined), false);
  });
});
```

- [ ] **Step 5.2: Run the test to confirm failure**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/gestureArbitration.test.js
```

Expected: 4 new failing tests.

- [ ] **Step 5.3: Implement the helper in preview-overlay.js**

Append to `js/media-library/preview-overlay.js`:

```javascript
export const PHONE_BREAK_PX = 640;

/**
 * Returns true if the given viewport width is in the phone segment.
 * Pure function.
 *
 * @param {number} width
 * @returns {boolean}
 */
export function isPhoneWidth(width) {
  if (typeof width !== 'number' || !Number.isFinite(width)) return false;
  return width <= PHONE_BREAK_PX;
}
```

- [ ] **Step 5.4: Hook into app.js**

Open `js/media-library/app.js`. At the top of the file, find the existing import from `./preview-overlay.js` (search for `from './preview-overlay.js'`). If it does not exist yet, add this line near the other `./` imports (around line 16-30):

```javascript
import { isPhoneWidth } from './preview-overlay.js?v=2';
```

Bump the `?v=` to `?v=2` (the previous value was missing or `?v=1`; the cache key here is independent of `index.html` query strings — both must move together at final integration).

Then locate the `isMobileLayout()` definition at line ~3582:

```javascript
function isMobileLayout() {
  return getViewportLayoutWidth() <= 960;
}
```

Immediately after it, add:

```javascript
function isPhoneLayout() {
  return isPhoneWidth(getViewportLayoutWidth());
}
```

- [ ] **Step 5.5: Run the test to confirm pass**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/gestureArbitration.test.js
```

Expected: 15 passing total.

- [ ] **Step 5.6: Run the full suite to confirm nothing else broke**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js
```

Expected: 596 passing / 1 pending / 1 pre-existing failure.

- [ ] **Step 5.7: Commit**

```bash
git add js/media-library/preview-overlay.js js/media-library/app.js test/gestureArbitration.test.js
git commit -m "feat(mobile): isPhoneWidth/isPhoneLayout helpers

Adds isPhoneWidth pure function and PHONE_BREAK_PX = 640 to
preview-overlay.js. Hooks app.js with a thin isPhoneLayout() wrapper that
reads getViewportLayoutWidth(). isMobileLayout() (<=960) is preserved
because it governs non-phone-specific UI surfaces.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Pull-to-dismiss wiring inside touch handlers

**Files:**
- Modify: `js/media-library/app.js` (rewrite the touchstart/move/end inside `setupPreviewTouchHandlers` at lines 2007-2098)
- Modify: `js/media-library/components.js` (add `[data-cml-preview-dismiss-stage]` attribute on `.cml-preview__stage`)
- Modify: `css/media-library.css` (add transform-following styles for `.cml-preview.is-dismissing`)
- Append to `test/previewActions.test.js`

- [ ] **Step 6.1: Write the failing component-level test**

Open `test/previewActions.test.js`. Locate the existing `PreviewModal` test block (use `describe('media library download actions'`). Append a new describe block at the end of the file:

```javascript
describe('preview lightbox pull-to-dismiss markup', () => {
  it('renders the stage with data-cml-preview-dismiss-stage hook', () => {
    const html = PreviewModal({
      item: {
        id: 'pull-1',
        type: 'photo',
        label: 'pull.jpg',
        sourceId: 'photos/pull.jpg',
        sourceUrl: '/file/photos/pull.jpg',
        thumbnailUrl: '/file/photos/pull.jpg',
        width: 1024,
        height: 768,
        mimeType: 'image/jpeg',
        sizeMb: 1,
        exif: null,
      },
      selected: false,
      favorited: false,
      currentIndex: 0,
      totalCount: 1,
      infoOpen: false,
      immersive: false,
      albumDrawerOpen: false,
      albumEntries: [],
      albumDraftName: '',
      albumDialogError: '',
      albumDrawerSearch: '',
      albumDrawerCreateMode: false,
    });
    assert.match(html, /class="cml-preview__stage[^"]*"\s+data-cml-preview-dismiss-stage/);
  });
});
```

- [ ] **Step 6.2: Run the test to confirm failure**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/previewActions.test.js
```

Expected: 1 new failing test.

- [ ] **Step 6.3: Add the data attribute in components.js**

In `js/media-library/components.js`, find the `cml-preview__stage` element inside `PreviewModal`. Add `data-cml-preview-dismiss-stage` to its attribute list:

```javascript
// before
<div class="cml-preview__stage" ...>

// after
<div class="cml-preview__stage" data-cml-preview-dismiss-stage ...>
```

- [ ] **Step 6.4: Wire pull-to-dismiss in app.js**

Open `js/media-library/app.js` at line 2007 (`setupPreviewTouchHandlers`). Replace the entire function body with the version below. This version keeps the existing pinch/pan/wheel/dblclick/mouse paths and adds a single-finger arbitrated path that supports horizontal swipe, vertical pull-to-dismiss, and idle:

```javascript
function setupPreviewTouchHandlers() {
  if (!refs.root || !state.previewId) {
    return;
  }
  const stage = refs.root.querySelector('.cml-preview__stage');
  const mediaEl = stage ? stage.querySelector('.cml-preview__media') : null;
  const previewRoot = refs.root.querySelector('.cml-preview');
  if (!stage || !mediaEl || !previewRoot) {
    return;
  }

  setupPreviewProgressiveImage();
  setupPreviewHeicDecoder();
  prefetchHeicNeighborsForPreview();
  prefetchPhotoNeighborsForPreview();

  let channel = 'idle';
  let channelStartTs = 0;
  let dragStartX = 0;
  let dragStartY = 0;

  stage.addEventListener('touchstart', (e) => {
    channel = 'idle';
    if (e.touches.length === 2) {
      e.preventDefault();
      touchZoom.isPinch = true;
      touchZoom.isPan = false;
      touchZoom.startDist = _tzDist(e.touches);
      touchZoom.startScale = touchZoom.currentScale;
      const mid = _tzMid(e.touches);
      touchZoom.startMidX = mid.x;
      touchZoom.startMidY = mid.y;
      touchZoom.startTx = touchZoom.tx;
      touchZoom.startTy = touchZoom.ty;
    } else if (e.touches.length === 1) {
      touchZoom.isPinch = false;
      dragStartX = e.touches[0].clientX;
      dragStartY = e.touches[0].clientY;
      channelStartTs = Date.now();
      touchZoom.startMidX = dragStartX;
      touchZoom.startMidY = dragStartY;
      if (touchZoom.currentScale > 1.05) {
        touchZoom.isPan = true;
        touchZoom.startTx = touchZoom.tx;
        touchZoom.startTy = touchZoom.ty;
      } else {
        touchZoom.isPan = false;
      }
    }
  }, { passive: false });

  stage.addEventListener('touchmove', (e) => {
    if (touchZoom.isPinch && e.touches.length === 2) {
      e.preventDefault();
      const dist = _tzDist(e.touches);
      const scale = Math.max(PREVIEW_ZOOM_MIN, Math.min(PREVIEW_ZOOM_MAX, touchZoom.startScale * (dist / touchZoom.startDist)));
      touchZoom.currentScale = scale;
      const mid = _tzMid(e.touches);
      touchZoom.tx = touchZoom.startTx + (mid.x - touchZoom.startMidX);
      touchZoom.ty = touchZoom.startTy + (mid.y - touchZoom.startMidY);
      _tzApplyImmediate(mediaEl);
      return;
    }
    if (touchZoom.isPan && e.touches.length === 1) {
      e.preventDefault();
      touchZoom.tx = touchZoom.startTx + (e.touches[0].clientX - touchZoom.startMidX);
      touchZoom.ty = touchZoom.startTy + (e.touches[0].clientY - touchZoom.startMidY);
      _tzApplyImmediate(mediaEl);
      return;
    }
    if (e.touches.length === 1 && touchZoom.currentScale <= 1.05) {
      const dx = e.touches[0].clientX - dragStartX;
      const dy = e.touches[0].clientY - dragStartY;
      if (channel === 'idle') {
        channel = arbitrateGestureChannel({ dx, dy, touchCount: 1, isPinch: touchZoom.isPinch });
      }
      if (channel === 'dismiss') {
        e.preventDefault();
        const opacity = Math.max(0, 1 - dy / PULL_DISMISS_DISTANCE_THRESHOLD);
        previewRoot.classList.add('is-dismissing');
        mediaEl.style.transform = `translate(0, ${dy}px)`;
        const backdrop = previewRoot.querySelector('.cml-preview__backdrop');
        if (backdrop) backdrop.style.opacity = String(opacity);
      }
    }
  }, { passive: false });

  stage.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (e.changedTouches.length === 1 && e.touches.length === 0) {
      if (now - touchZoom.lastTap < 280) {
        if (touchZoom.currentScale > 1.05) {
          _tzReset(mediaEl);
        } else {
          touchZoom.currentScale = 2;
          touchZoom.tx = 0;
          touchZoom.ty = 0;
          mediaEl.style.transition = 'transform 180ms ease-out';
          _tzApply(mediaEl);
          window.setTimeout(() => { mediaEl.style.transition = ''; }, 200);
        }
        touchZoom.lastTap = 0;
      } else {
        touchZoom.lastTap = now;
      }
    }
    if (e.touches.length === 0) {
      const dxEnd = e.changedTouches[0].clientX - dragStartX;
      const dyEnd = e.changedTouches[0].clientY - dragStartY;
      const elapsed = Math.max(1, Date.now() - channelStartTs);
      const velocity = dyEnd / elapsed;

      if (channel === 'swipe' && touchZoom.currentScale <= 1.05) {
        if (Math.abs(dxEnd) > 48) {
          movePreview(dxEnd < 0 ? 1 : -1);
        }
      } else if (channel === 'dismiss') {
        if (shouldClosePullDismiss({ dy: dyEnd, velocity })) {
          mediaEl.style.transition = 'transform 220ms ease-out';
          mediaEl.style.transform = `translate(0, ${window.innerHeight}px)`;
          window.setTimeout(() => { closePreview(); }, 220);
        } else {
          mediaEl.style.transition = 'transform 220ms ease-out';
          mediaEl.style.transform = '';
          previewRoot.classList.remove('is-dismissing');
          const backdrop = previewRoot.querySelector('.cml-preview__backdrop');
          if (backdrop) backdrop.style.opacity = '';
          window.setTimeout(() => {
            mediaEl.style.transition = '';
          }, 240);
        }
      } else if (touchZoom.currentScale < 1.05) {
        _tzReset(mediaEl);
      }

      channel = 'idle';
      touchZoom.isPinch = false;
      touchZoom.isPan = false;
    }
  }, { passive: false });

  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const deltaY = normalizePreviewWheelDelta(e);
    const next = getPreviewWheelZoomScale(touchZoom.currentScale, deltaY);
    if (next === touchZoom.currentScale) return;
    const rect = stage.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width / 2;
    const cy = e.clientY - rect.top - rect.height / 2;
    const d = next / touchZoom.currentScale;
    touchZoom.tx = cx - d * (cx - touchZoom.tx);
    touchZoom.ty = cy - d * (cy - touchZoom.ty);
    touchZoom.currentScale = next;
    _tzApplyImmediate(mediaEl);
    if (touchZoom.currentScale < 1.05) _tzReset(mediaEl);
  }, { passive: false });

  stage.addEventListener('dblclick', (e) => {
    if (e.target.closest('.cml-preview__nav')) return;
    if (touchZoom.currentScale > 1.05) {
      _tzReset(mediaEl);
    } else {
      touchZoom.currentScale = 2;
      touchZoom.tx = 0;
      touchZoom.ty = 0;
      mediaEl.style.transition = 'transform 180ms ease-out';
      _tzApply(mediaEl);
      window.setTimeout(() => { mediaEl.style.transition = ''; }, 200);
    }
  });

  let isMousePan = false;
  stage.addEventListener('mousedown', (e) => {
    if (touchZoom.currentScale > 1.05 && e.button === 0) {
      isMousePan = true;
      touchZoom.startMidX = e.clientX;
      touchZoom.startMidY = e.clientY;
      touchZoom.startTx = touchZoom.tx;
      touchZoom.startTy = touchZoom.ty;
      e.preventDefault();
    }
  });
  stage.addEventListener('mousemove', (e) => {
    if (!isMousePan) return;
    touchZoom.tx = touchZoom.startTx + (e.clientX - touchZoom.startMidX);
    touchZoom.ty = touchZoom.startTy + (e.clientY - touchZoom.startMidY);
    _tzApplyImmediate(mediaEl);
  });
  stage.addEventListener('mouseup', () => { isMousePan = false; });
  stage.addEventListener('mouseleave', () => { isMousePan = false; });
}
```

Also add the imports near the top of `app.js`, alongside the existing `./preview-overlay.js?v=2` import:

```javascript
import {
  arbitrateGestureChannel,
  shouldClosePullDismiss,
  PULL_DISMISS_DISTANCE_THRESHOLD,
  isPhoneWidth,
} from './preview-overlay.js?v=2';
```

- [ ] **Step 6.5: Add minimal CSS for `is-dismissing`**

In `css/media-library.css`, find the `.cml-preview` block (around line 4265) and after it add:

```css
#codex-media-library-root .cml-preview.is-dismissing .cml-preview__media {
  will-change: transform;
}
#codex-media-library-root .cml-preview.is-dismissing .cml-preview__backdrop {
  transition: none;
}
```

- [ ] **Step 6.6: Run the previewActions test to confirm pass**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/previewActions.test.js
```

Expected: previous count + 1 passing (the new dismiss-stage hook test).

- [ ] **Step 6.7: Run the full suite to confirm no regressions**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js
```

Expected: 597 passing / 1 pending / 1 pre-existing failure.

- [ ] **Step 6.8: Commit**

```bash
git add js/media-library/app.js js/media-library/components.js css/media-library.css test/previewActions.test.js
git commit -m "feat(preview): pull-to-dismiss vertical gesture

Rewrites setupPreviewTouchHandlers to delegate channel arbitration to the
pure helpers in preview-overlay.js. At zoom <= 1.05 single-finger vertical
drag down past the 10px arbitration threshold claims the dismiss channel,
tracking the finger 1:1 with backdrop opacity fade. Release past 100px or
velocity >= 0.6 px/ms closes the preview; otherwise springs back. Adds the
data-cml-preview-dismiss-stage marker on the stage in PreviewModal and a
matching component regression. Horizontal swipe channel and pinch/wheel
zoom paths retain their prior behavior.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Long-press → More popover event

**Files:**
- Modify: `js/media-library/preview-overlay.js` (export LONG_PRESS_MS)
- Modify: `js/media-library/app.js` (touchstart timer + touchmove cancel)
- Append to `test/gestureArbitration.test.js`

- [ ] **Step 7.1: Write the failing test**

Append to `test/gestureArbitration.test.js`:

```javascript
import { LONG_PRESS_MS, LONG_PRESS_MOVE_TOLERANCE } from '../js/media-library/preview-overlay.js';

describe('long-press constants', () => {
  it('exposes LONG_PRESS_MS = 450', () => {
    assert.equal(LONG_PRESS_MS, 450);
  });
  it('exposes LONG_PRESS_MOVE_TOLERANCE = 10', () => {
    assert.equal(LONG_PRESS_MOVE_TOLERANCE, 10);
  });
});
```

- [ ] **Step 7.2: Run the test to confirm failure**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/gestureArbitration.test.js
```

Expected: 2 new failing.

- [ ] **Step 7.3: Add the constants**

Append to `js/media-library/preview-overlay.js`:

```javascript
export const LONG_PRESS_MS = 450;
export const LONG_PRESS_MOVE_TOLERANCE = 10;
```

- [ ] **Step 7.4: Wire timer in app.js**

In `app.js`, update the imports from `preview-overlay.js` to include the new constants:

```javascript
import {
  arbitrateGestureChannel,
  shouldClosePullDismiss,
  PULL_DISMISS_DISTANCE_THRESHOLD,
  isPhoneWidth,
  LONG_PRESS_MS,
  LONG_PRESS_MOVE_TOLERANCE,
} from './preview-overlay.js?v=2';
```

Inside `setupPreviewTouchHandlers`, add a long-press timer:

```javascript
// Add near the top of the function body, before the existing event listeners:
let longPressTimer = null;
const cancelLongPress = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
};
```

In `touchstart`, after setting `dragStartX/Y` for the single-finger branch, schedule the long-press timer:

```javascript
longPressTimer = window.setTimeout(() => {
  if (channel !== 'idle') return;
  const item = getPreviewItems()[
    getPreviewItems().findIndex((it) => it.id === state.previewId)
  ];
  if (!item) return;
  const event = new CustomEvent('cml-preview-long-press', {
    bubbles: true,
    detail: { itemId: item.id, item },
  });
  stage.dispatchEvent(event);
}, LONG_PRESS_MS);
```

In `touchmove`, cancel the timer if movement exceeds tolerance:

```javascript
// inside the existing touchmove handler, after computing dx/dy in the single-finger non-pan branch:
if (Math.abs(dx) > LONG_PRESS_MOVE_TOLERANCE || Math.abs(dy) > LONG_PRESS_MOVE_TOLERANCE) {
  cancelLongPress();
}
```

In `touchend`, always cancel:

```javascript
// at the top of the existing touchend handler:
cancelLongPress();
```

- [ ] **Step 7.5: Run the test to confirm pass**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/gestureArbitration.test.js
```

Expected: 17 passing.

- [ ] **Step 7.6: Run the full suite**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js
```

Expected: 599 passing / 1 pending / 1 pre-existing failure.

- [ ] **Step 7.7: Commit**

```bash
git add js/media-library/preview-overlay.js js/media-library/app.js test/gestureArbitration.test.js
git commit -m "feat(preview): long-press fires cml-preview-long-press event

450ms touchstart timer fires a bubbling CustomEvent on the stage with the
current preview item. Timer is canceled on touchmove >10px or touchend.
Constants LONG_PRESS_MS and LONG_PRESS_MOVE_TOLERANCE exported from
preview-overlay.js. The More popover listener for this event is wired in a
follow-up task; this task only delivers the dispatch surface.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Single tap toggle controls (is-immersive class)

**Files:**
- Modify: `js/media-library/app.js` (touchend single-tap branch)
- Append to `test/previewActions.test.js`

- [ ] **Step 8.1: Write the failing test**

Append to `test/previewActions.test.js`:

```javascript
describe('preview lightbox immersive class', () => {
  it('renders is-immersive when immersive flag is true', () => {
    const item = {
      id: 'imm-1', type: 'photo', label: 'imm.jpg',
      sourceId: 'photos/imm.jpg', sourceUrl: '/file/photos/imm.jpg',
      thumbnailUrl: '/file/photos/imm.jpg', width: 1024, height: 768,
      mimeType: 'image/jpeg', sizeMb: 1, exif: null,
    };
    const html = PreviewModal({
      item, selected: false, favorited: false,
      currentIndex: 0, totalCount: 1, infoOpen: false,
      immersive: true, albumDrawerOpen: false, albumEntries: [],
      albumDraftName: '', albumDialogError: '', albumDrawerSearch: '',
      albumDrawerCreateMode: false,
    });
    assert.match(html, /class="cml-preview[^"]*is-immersive/);
  });

  it('does not render is-immersive when immersive flag is false', () => {
    const item = {
      id: 'imm-2', type: 'photo', label: 'imm.jpg',
      sourceId: 'photos/imm.jpg', sourceUrl: '/file/photos/imm.jpg',
      thumbnailUrl: '/file/photos/imm.jpg', width: 1024, height: 768,
      mimeType: 'image/jpeg', sizeMb: 1, exif: null,
    };
    const html = PreviewModal({
      item, selected: false, favorited: false,
      currentIndex: 0, totalCount: 1, infoOpen: false,
      immersive: false, albumDrawerOpen: false, albumEntries: [],
      albumDraftName: '', albumDialogError: '', albumDrawerSearch: '',
      albumDrawerCreateMode: false,
    });
    assert.doesNotMatch(html, /is-immersive/);
  });
});
```

- [ ] **Step 8.2: Run the test to confirm pass (likely already supported)**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/previewActions.test.js
```

If both new tests pass, the immersive class is already wired in `PreviewModal`. Skip Step 8.3. Otherwise:

- [ ] **Step 8.3: Wire immersive into PreviewModal (only if needed)**

In `js/media-library/components.js`, locate the `PreviewModal` definition. Find the top-level class list of the `.cml-preview` root and ensure it contains `${immersive ? ' is-immersive' : ''}`. If not present, add it.

- [ ] **Step 8.4: Add single-tap toggle in app.js**

In `app.js`, locate the `touchend` handler inside `setupPreviewTouchHandlers`. In the `e.changedTouches.length === 1 && e.touches.length === 0` branch, after the double-tap detection, add a single-tap idle-channel handler:

```javascript
// in touchend handler, after the lastTap detection block:
if (channel === 'idle' && touchZoom.currentScale <= 1.05) {
  const dxTap = e.changedTouches[0].clientX - dragStartX;
  const dyTap = e.changedTouches[0].clientY - dragStartY;
  if (Math.abs(dxTap) < LONG_PRESS_MOVE_TOLERANCE && Math.abs(dyTap) < LONG_PRESS_MOVE_TOLERANCE) {
    if (now - touchZoom.lastTap > 280 || touchZoom.lastTap === 0) {
      window.setTimeout(() => {
        if (Date.now() - now > 280) {
          state.previewImmersive = !state.previewImmersive;
          render();
        }
      }, 290);
    }
  }
}
```

This delays the toggle by 290ms to give the double-tap window a chance to win. The `state.previewImmersive` flag should exist; if not, add it to the state initializer (search for `previewIndex: -1` around line 10238 and add `previewImmersive: false,` nearby).

- [ ] **Step 8.5: Run focused tests**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/previewActions.test.js
```

Expected: previewActions block all green including new 2 immersive tests.

- [ ] **Step 8.6: Commit**

```bash
git add js/media-library/app.js js/media-library/components.js test/previewActions.test.js
git commit -m "feat(preview): single tap toggles immersive (controls fade)

Single-finger tap inside the 10px tolerance window toggles
state.previewImmersive after a 290ms delay (lets double-tap win). Reuses
the existing .cml-preview.is-immersive class to fade chrome. Adds tests
asserting PreviewModal renders is-immersive when the flag is set and
omits it when false.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Controls idle-fade 3-second timer

**Files:**
- Modify: `js/media-library/app.js`
- Modify: `js/media-library/preview-overlay.js` (export IDLE_FADE_MS)
- Append to `test/gestureArbitration.test.js`

- [ ] **Step 9.1: Write the failing test**

Append to `test/gestureArbitration.test.js`:

```javascript
import { IDLE_FADE_MS } from '../js/media-library/preview-overlay.js';

describe('idle fade constant', () => {
  it('exposes IDLE_FADE_MS = 3000', () => {
    assert.equal(IDLE_FADE_MS, 3000);
  });
});
```

- [ ] **Step 9.2: Run, fail**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/gestureArbitration.test.js
```

Expected: 1 new failing.

- [ ] **Step 9.3: Add constant**

Append to `js/media-library/preview-overlay.js`:

```javascript
export const IDLE_FADE_MS = 3000;
```

- [ ] **Step 9.4: Wire the timer in app.js**

In `app.js`, update the `preview-overlay.js?v=2` import to include `IDLE_FADE_MS`:

```javascript
import {
  arbitrateGestureChannel,
  shouldClosePullDismiss,
  PULL_DISMISS_DISTANCE_THRESHOLD,
  isPhoneWidth,
  LONG_PRESS_MS,
  LONG_PRESS_MOVE_TOLERANCE,
  IDLE_FADE_MS,
} from './preview-overlay.js?v=2';
```

Add a module-scoped timer and helpers near the top of `setupPreviewTouchHandlers`:

```javascript
let idleFadeTimer = null;
const armIdleFade = () => {
  if (idleFadeTimer) clearTimeout(idleFadeTimer);
  if (touchZoom.currentScale > 1.05) {
    if (!state.previewImmersive) {
      state.previewImmersive = true;
      render();
    }
    return;
  }
  idleFadeTimer = window.setTimeout(() => {
    if (!state.previewImmersive) {
      state.previewImmersive = true;
      render();
    }
  }, IDLE_FADE_MS);
};
const restoreChrome = () => {
  if (state.previewImmersive) {
    state.previewImmersive = false;
    render();
  }
  armIdleFade();
};
```

Call `armIdleFade()` once after the prefetch calls (right after `prefetchPhotoNeighborsForPreview()`).

Call `restoreChrome()` in `touchstart` (before the touchCount branch) and in `wheel`, `dblclick`, `mousemove` paths.

- [ ] **Step 9.5: Run tests**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/gestureArbitration.test.js
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js
```

Expected: 18 passing in gesture file; 600 passing overall / 1 pending / 1 pre-existing failure.

- [ ] **Step 9.6: Commit**

```bash
git add js/media-library/preview-overlay.js js/media-library/app.js test/gestureArbitration.test.js
git commit -m "feat(preview): idle-fade timer + zoom-aware auto-hide

Adds IDLE_FADE_MS=3000 constant. After 3s of no input events the preview
toggles into immersive mode (controls fade via existing is-immersive
class). At zoom>1.05 controls are hidden immediately on entry. Any input
event restores chrome and re-arms the timer. Touch, wheel, dblclick, and
mouse movement all call restoreChrome().

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Scroll restore — Photos timeline via route hash

**Files:**
- Modify: `js/media-library/preview-overlay.js` (export `lastViewedHashKey` + `parseLastViewedHash`)
- Modify: `js/media-library/app.js` (write hash on openPreview, read on init)
- Create: `test/photosTimelineScrollRestore.test.js`

- [ ] **Step 10.1: Write the failing test**

Create `test/photosTimelineScrollRestore.test.js`:

```javascript
import assert from 'node:assert/strict';
import {
  lastViewedHashKey,
  parseLastViewedHash,
  LAST_VIEWED_HASH_PREFIX,
} from '../js/media-library/preview-overlay.js';

describe('photos timeline scroll restore', () => {
  it('exposes LAST_VIEWED_HASH_PREFIX = lvi-', () => {
    assert.equal(LAST_VIEWED_HASH_PREFIX, 'lvi-');
  });

  it('lastViewedHashKey wraps an item id with the prefix', () => {
    assert.equal(lastViewedHashKey('abc123'), 'lvi-abc123');
  });

  it('lastViewedHashKey returns empty string for falsy id', () => {
    assert.equal(lastViewedHashKey(''), '');
    assert.equal(lastViewedHashKey(null), '');
    assert.equal(lastViewedHashKey(undefined), '');
  });

  it('parseLastViewedHash strips the prefix', () => {
    assert.equal(parseLastViewedHash('lvi-abc123'), 'abc123');
    assert.equal(parseLastViewedHash('#lvi-abc123'), 'abc123');
  });

  it('parseLastViewedHash returns null when prefix is missing', () => {
    assert.equal(parseLastViewedHash('something-else'), null);
    assert.equal(parseLastViewedHash(''), null);
    assert.equal(parseLastViewedHash('#'), null);
  });

  it('parseLastViewedHash is reflexive with lastViewedHashKey', () => {
    const id = 'photo-id-x9';
    assert.equal(parseLastViewedHash(lastViewedHashKey(id)), id);
  });
});
```

- [ ] **Step 10.2: Run, fail**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/photosTimelineScrollRestore.test.js
```

Expected: 6 failing (import errors / undefined exports).

- [ ] **Step 10.3: Implement the helpers**

Append to `js/media-library/preview-overlay.js`:

```javascript
export const LAST_VIEWED_HASH_PREFIX = 'lvi-';

/**
 * Build the route-hash fragment for the last-viewed item.
 *
 * @param {string} itemId
 * @returns {string} hash fragment without leading `#`
 */
export function lastViewedHashKey(itemId) {
  if (!itemId) return '';
  return `${LAST_VIEWED_HASH_PREFIX}${itemId}`;
}

/**
 * Extract the item id from a route hash, stripping `#` and prefix.
 *
 * @param {string} hash
 * @returns {string | null}
 */
export function parseLastViewedHash(hash) {
  if (!hash) return null;
  const cleaned = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!cleaned.startsWith(LAST_VIEWED_HASH_PREFIX)) return null;
  const id = cleaned.slice(LAST_VIEWED_HASH_PREFIX.length);
  return id || null;
}
```

- [ ] **Step 10.4: Wire in app.js**

Update the import in `app.js`:

```javascript
import {
  arbitrateGestureChannel,
  shouldClosePullDismiss,
  PULL_DISMISS_DISTANCE_THRESHOLD,
  isPhoneWidth,
  LONG_PRESS_MS,
  LONG_PRESS_MOVE_TOLERANCE,
  IDLE_FADE_MS,
  lastViewedHashKey,
  parseLastViewedHash,
} from './preview-overlay.js?v=2';
```

Find the function that opens a preview (search for `state.previewId =`). After the assignment, before the render, replace the existing hash with the new one:

```javascript
if (typeof history !== 'undefined' && history.replaceState && state.previewId) {
  const url = new URL(window.location.href);
  url.hash = lastViewedHashKey(state.previewId);
  history.replaceState(history.state, '', url.toString());
}
```

Find `closePreview` (line 17263). After it clears `state.previewId`, also clear the hash:

```javascript
if (typeof history !== 'undefined' && history.replaceState) {
  const url = new URL(window.location.href);
  url.hash = '';
  history.replaceState(history.state, '', url.toString());
}
```

Find the `boot()` invocation at the bottom of `app.js` (the last 20 lines). Inside `boot()` (locate the function definition with `function boot()`), after the initial render call, add a scroll-restore probe:

```javascript
const restoreId = parseLastViewedHash(window.location.hash);
if (restoreId) {
  window.requestAnimationFrame(() => {
    const tile = refs.root && refs.root.querySelector(`[data-tile-id="${CSS.escape(restoreId)}"]`);
    if (tile && typeof tile.scrollIntoView === 'function') {
      tile.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
  });
}
```

Note: this assumes timeline tiles already carry `data-tile-id="${item.id}"`. If they do not, also update `MediaTile` in `components.js` to render `data-tile-id="${item.id}"` on the tile root element.

- [ ] **Step 10.5: Run tests**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/photosTimelineScrollRestore.test.js
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js
```

Expected: 6 passing in scroll-restore file; 606 passing overall / 1 pending / 1 pre-existing failure.

- [ ] **Step 10.6: Commit**

```bash
git add js/media-library/preview-overlay.js js/media-library/app.js js/media-library/components.js test/photosTimelineScrollRestore.test.js
git commit -m "feat(mobile): Photos timeline scroll restore via lvi- route hash

Adds lastViewedHashKey and parseLastViewedHash to preview-overlay.js. On
preview open, app.js writes #lvi-<itemId> via history.replaceState so
back/forward and tab restoration carry the position. On boot, parses the
hash and scrollIntoView({block: center}) the matching [data-tile-id]
tile. Closing preview clears the hash.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Album detail mobile sub-page route + component

**Files:**
- Modify: `js/media-library/components.js` (new export `AlbumDetailMobilePage`)
- Modify: `js/media-library/app.js` (route handler, state slot, render branch)
- Append to `test/previewActions.test.js`

- [ ] **Step 11.1: Write the failing test**

Append to `test/previewActions.test.js`:

```javascript
import { AlbumDetailMobilePage } from '../js/media-library/components.js';

describe('AlbumDetailMobilePage', () => {
  it('renders mobile albums bar with back chevron and album name', () => {
    const html = AlbumDetailMobilePage({
      album: { id: 'al-1', name: 'Trip 2026', count: 12 },
      items: [],
      isPhone: true,
    });
    assert.match(html, /cml-mobile-albums-bar/);
    assert.match(html, /data-action="album-detail-back"/);
    assert.match(html, />Trip 2026</);
  });

  it('renders the media grid in the body when items present', () => {
    const item = {
      id: 'p-1', type: 'photo', label: 'a.jpg',
      sourceId: 'photos/a.jpg', sourceUrl: '/file/photos/a.jpg',
      thumbnailUrl: '/file/photos/a.jpg', width: 1024, height: 768,
      mimeType: 'image/jpeg', sizeMb: 1, exif: null,
    };
    const html = AlbumDetailMobilePage({
      album: { id: 'al-2', name: 'Album 2', count: 1 },
      items: [item],
      isPhone: true,
    });
    assert.match(html, /data-tile-id="p-1"/);
  });

  it('renders empty hint when items array empty', () => {
    const html = AlbumDetailMobilePage({
      album: { id: 'al-3', name: 'Empty', count: 0 },
      items: [],
      isPhone: true,
    });
    assert.match(html, /No photos in this album/);
  });
});
```

- [ ] **Step 11.2: Run, fail**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/previewActions.test.js
```

Expected: 3 new failing.

- [ ] **Step 11.3: Implement the component**

In `js/media-library/components.js`, find the section where `MobileBottomNav` and similar mobile components are exported (search for `export function MobileBottomNav`). Add a new exported function:

```javascript
export function AlbumDetailMobilePage({ album, items, isPhone }) {
  const safeName = String(album && album.name ? album.name : 'Album').replace(/</g, '&lt;');
  const bar = `
    <header class="cml-mobile-albums-bar">
      <button type="button" class="cml-mobile-albums-bar__back" data-action="album-detail-back" aria-label="Back to albums">
        <span class="cml-mobile-albums-bar__icon" aria-hidden="true">‹</span>
      </button>
      <h1 class="cml-mobile-albums-bar__title">${safeName}</h1>
      <div class="cml-mobile-albums-bar__actions">
        <button type="button" data-action="album-detail-more" aria-label="More options">⋯</button>
      </div>
    </header>
  `;
  const body = items && items.length
    ? MediaGrid({ items, isPhone, gridContext: 'album-detail' })
    : `<div class="cml-empty-state"><p>No photos in this album.</p></div>`;
  return `<section class="cml-album-detail-page" data-album-id="${album.id}">${bar}<div class="cml-album-detail-page__body">${body}</div></section>`;
}
```

If `MediaGrid` does not accept a `gridContext` argument, it is fine to omit; the test does not assert on it.

- [ ] **Step 11.4: Add the route handler and state slot in app.js**

In `app.js`, find the state initializer (line 10238 area, where `previewIndex: -1` lives). Add:

```javascript
activeAlbumDetailId: null,
albumDetailScrollY: 0,
```

Find the function that renders the main view (search for `function render()`). Add a branch before the existing fallback:

```javascript
if (state.activeAlbumDetailId) {
  const album = (state.albums || []).find((a) => a.id === state.activeAlbumDetailId);
  if (album) {
    const items = state.mediaItems.filter((it) => (it.albumIds || []).includes(album.id));
    refs.root.innerHTML = AlbumDetailMobilePage({ album, items, isPhone: isPhoneLayout() });
    return;
  }
}
```

Make sure `AlbumDetailMobilePage` is added to the import from `components.js` at the top of `app.js`:

```javascript
import {
  // ... existing imports
  AlbumDetailMobilePage,
} from './components.js?v=' + ASSET_VERSIONS.components;
```

(Use the same cache-version expression already used for other component imports — locate the existing import block to match the pattern.)

- [ ] **Step 11.5: Wire entry / exit handlers**

Find the click-delegation handler (search for `data-action="open-album"` to find existing album-open handler). Add:

```javascript
if (target.matches('[data-action="album-detail-back"]') ||
    target.closest('[data-action="album-detail-back"]')) {
  state.activeAlbumDetailId = null;
  render();
  return;
}
```

Where albums are entered on phone (find existing `data-action="open-album"` click handler), add a phone-specific branch:

```javascript
if (isPhoneLayout()) {
  state.activeAlbumDetailId = albumId;
  state.albumDetailScrollY = 0;
  render();
  return;
}
```

- [ ] **Step 11.6: Run tests**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/previewActions.test.js
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js
```

Expected: previewActions block green (3 new passing); full suite 609 passing / 1 pending / 1 pre-existing failure.

- [ ] **Step 11.7: Commit**

```bash
git add js/media-library/components.js js/media-library/app.js test/previewActions.test.js
git commit -m "feat(mobile): /collections/:albumId mobile album detail sub-page

Adds AlbumDetailMobilePage component reusing cml-mobile-albums-bar chrome
and MediaGrid body. Adds state.activeAlbumDetailId and a render branch
that takes over when set. Phone tap on an album sets the slot; back
chevron clears it. Empty albums show a quiet hint instead of an empty
grid. Component-level tests cover bar markup, populated body, and empty
state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Album list scroll restore (list ↔ detail)

**Files:**
- Modify: `js/media-library/app.js`
- Create: `test/albumListScrollRestore.test.js` (asserts state contract)

- [ ] **Step 12.1: Write the failing test**

Create `test/albumListScrollRestore.test.js`:

```javascript
import assert from 'node:assert/strict';

// This test asserts state-shape and a pure scroll-position resolution function.
// The actual scroll wiring is validated by manual smoke (logged in history.md).

import { resolveAlbumListScrollY } from '../js/media-library/preview-overlay.js';

describe('album list scroll restore', () => {
  it('returns 0 when no saved value', () => {
    assert.equal(resolveAlbumListScrollY({}), 0);
    assert.equal(resolveAlbumListScrollY({ savedAlbumListScrollY: undefined }), 0);
  });

  it('returns the saved value when present and non-negative', () => {
    assert.equal(resolveAlbumListScrollY({ savedAlbumListScrollY: 420 }), 420);
    assert.equal(resolveAlbumListScrollY({ savedAlbumListScrollY: 0 }), 0);
  });

  it('clamps negative to 0', () => {
    assert.equal(resolveAlbumListScrollY({ savedAlbumListScrollY: -5 }), 0);
  });

  it('clamps non-numeric to 0', () => {
    assert.equal(resolveAlbumListScrollY({ savedAlbumListScrollY: 'banana' }), 0);
    assert.equal(resolveAlbumListScrollY({ savedAlbumListScrollY: NaN }), 0);
  });
});
```

- [ ] **Step 12.2: Run, fail**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/albumListScrollRestore.test.js
```

Expected: import error.

- [ ] **Step 12.3: Implement the helper**

Append to `js/media-library/preview-overlay.js`:

```javascript
/**
 * Resolve the album list scroll position to restore, clamping invalid values.
 *
 * @param {{ savedAlbumListScrollY?: number }} state
 * @returns {number}
 */
export function resolveAlbumListScrollY(state) {
  const v = state && state.savedAlbumListScrollY;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return 0;
  return v;
}
```

- [ ] **Step 12.4: Wire the save/restore in app.js**

In the click handler that sets `state.activeAlbumDetailId` (added in Task 11), save current scroll before navigating:

```javascript
if (isPhoneLayout()) {
  state.savedAlbumListScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  state.activeAlbumDetailId = albumId;
  render();
  return;
}
```

In the back-handler (`data-action="album-detail-back"`):

```javascript
if (target.matches('[data-action="album-detail-back"]') ||
    target.closest('[data-action="album-detail-back"]')) {
  state.activeAlbumDetailId = null;
  render();
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: resolveAlbumListScrollY(state), behavior: 'instant' });
  });
  return;
}
```

Add `resolveAlbumListScrollY` to the imports from `preview-overlay.js?v=2`.

- [ ] **Step 12.5: Run tests**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/albumListScrollRestore.test.js
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js
```

Expected: 4 passing in album scroll-restore file; 613 passing overall / 1 pending / 1 pre-existing failure.

- [ ] **Step 12.6: Commit**

```bash
git add js/media-library/preview-overlay.js js/media-library/app.js test/albumListScrollRestore.test.js
git commit -m "feat(mobile): album list scroll restore on detail back

Saves window.scrollY into state.savedAlbumListScrollY when entering an
album on phone; restores it via resolveAlbumListScrollY (pure helper)
after the back-chevron pop. Negative or non-numeric values clamp to 0.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Albums list 3-photo cover stack

**Files:**
- Modify: `js/media-library/components.js` (extend `CollectionGrid` or its child card)
- Modify: `css/media-library.css` (cover-stack styles, phone breakpoint)
- Append to `test/previewActions.test.js`

- [ ] **Step 13.1: Write the failing test**

Append to `test/previewActions.test.js`:

```javascript
describe('CollectionGrid mobile cover stack', () => {
  it('renders three cover images stacked when ≥3 cover photos available', () => {
    const html = CollectionGrid({
      collections: [
        {
          id: 'col-1', name: 'Beach',
          count: 24,
          coverItems: [
            { id: 'c1', thumbnailUrl: '/file/c1.jpg' },
            { id: 'c2', thumbnailUrl: '/file/c2.jpg' },
            { id: 'c3', thumbnailUrl: '/file/c3.jpg' },
          ],
        },
      ],
      isPhone: true,
    });
    assert.match(html, /cml-album-cover-stack/);
    const imgMatches = html.match(/<img[^>]+>/g) || [];
    assert.ok(imgMatches.length >= 3, `expected at least 3 cover imgs, got ${imgMatches.length}`);
  });

  it('falls back to single cover when fewer than 3 cover photos', () => {
    const html = CollectionGrid({
      collections: [
        {
          id: 'col-2', name: 'Single',
          count: 1,
          coverItems: [{ id: 'c1', thumbnailUrl: '/file/only.jpg' }],
        },
      ],
      isPhone: true,
    });
    assert.doesNotMatch(html, /cml-album-cover-stack/);
  });
});
```

- [ ] **Step 13.2: Run, fail**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/previewActions.test.js
```

Expected: 2 new failing.

- [ ] **Step 13.3: Implement the stack**

In `js/media-library/components.js`, locate `CollectionGrid`. Find where each collection card is rendered. Replace the existing cover-image rendering for the phone path with:

```javascript
const covers = (collection.coverItems || []).slice(0, 3);
const coverNode = (isPhone && covers.length >= 3)
  ? `<div class="cml-album-cover-stack">
       <img src="${covers[2].thumbnailUrl}" alt="" class="cml-album-cover-stack__back" loading="lazy">
       <img src="${covers[1].thumbnailUrl}" alt="" class="cml-album-cover-stack__mid" loading="lazy">
       <img src="${covers[0].thumbnailUrl}" alt="" class="cml-album-cover-stack__front" loading="lazy">
     </div>`
  : `<img src="${(covers[0] && covers[0].thumbnailUrl) || ''}" alt="" class="cml-album-cover" loading="lazy">`;
```

Use `coverNode` in the card template where the cover used to be.

- [ ] **Step 13.4: Add CSS**

In `css/media-library.css`, inside an existing phone `@media (max-width: 640px)` block (or add a new one in the Albums section), add:

```css
#codex-media-library-root .cml-album-cover-stack {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
}
#codex-media-library-root .cml-album-cover-stack img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
}
#codex-media-library-root .cml-album-cover-stack__back  { transform: rotate(-4deg) translate(-4%, 4%); z-index: 1; opacity: 0.85; }
#codex-media-library-root .cml-album-cover-stack__mid   { transform: rotate( 2deg) translate( 3%, 3%); z-index: 2; opacity: 0.92; }
#codex-media-library-root .cml-album-cover-stack__front { transform: rotate( 0deg) translate( 0,   0); z-index: 3; }
```

- [ ] **Step 13.5: Run tests**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/previewActions.test.js
```

Expected: previewActions block green (2 new passing).

- [ ] **Step 13.6: Commit**

```bash
git add js/media-library/components.js css/media-library.css test/previewActions.test.js
git commit -m "feat(mobile): album cards render 3-photo cover stack on phone

CollectionGrid switches to a stacked-cover treatment when isPhone is true
and the collection has at least 3 coverItems. Front/mid/back layers use
absolute positioning, rotation, and slight offset for the suggestion of a
set. Single-cover fallback retained.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Mini-player avoidance — Preview open hides mini-player

**Files:**
- Modify: `css/media-library.css` (extend existing `:has(.cml-preview)` rule)
- Append to `test/previewActions.test.js` (CSS string assertion)

- [ ] **Step 14.1: Write the failing test**

Append to `test/previewActions.test.js`:

```javascript
import fs from 'node:fs';
import path from 'node:path';

describe('mini-player avoidance under Preview', () => {
  it('CSS hides .cml-mobile-audio-player when .cml-preview is in the tree', () => {
    const css = fs.readFileSync(path.resolve('css/media-library.css'), 'utf8');
    assert.match(css, /:has\(\.cml-preview\)[^{}]*\.cml-mobile-audio-player[\s\S]*?display:\s*none/);
  });
});
```

- [ ] **Step 14.2: Run, fail**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/previewActions.test.js
```

Expected: 1 new failing.

- [ ] **Step 14.3: Add the CSS**

In `css/media-library.css`, find the existing `:has(.cml-preview) .cml-mobile-nav` rule (around line 4716) and add an adjacent rule (within the same `@media` if applicable):

```css
#codex-media-library-root:has(.cml-preview) .cml-mobile-audio-player {
  display: none;
}
```

- [ ] **Step 14.4: Run tests**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/previewActions.test.js
```

Expected: 1 new passing.

- [ ] **Step 14.5: Commit**

```bash
git add css/media-library.css test/previewActions.test.js
git commit -m "feat(mobile): hide mini-player while Preview is open

When .cml-preview is present in the DOM tree, .cml-mobile-audio-player is
display: none. Mirrors the existing .cml-mobile-nav hide rule.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Mini-player avoidance — grid padding-bottom

**Files:**
- Modify: `css/media-library.css`
- Append to `test/previewActions.test.js`

- [ ] **Step 15.1: Write the failing test**

Append to `test/previewActions.test.js`:

```javascript
describe('grid padding under mini-player', () => {
  it('CSS reserves padding-bottom for grid containers when mini-player is present', () => {
    const css = fs.readFileSync(path.resolve('css/media-library.css'), 'utf8');
    assert.match(css, /:has\(\.cml-mobile-audio-player\)[^{}]*\.cml-media-grid[\s\S]*?padding-bottom:\s*calc\(\s*var\(--cml-mini-player-height/);
  });

  it('CSS defines --cml-mini-player-height fallback', () => {
    const css = fs.readFileSync(path.resolve('css/media-library.css'), 'utf8');
    assert.match(css, /--cml-mini-player-height:\s*64px/);
  });
});
```

- [ ] **Step 15.2: Run, fail**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/previewActions.test.js
```

Expected: 2 new failing.

- [ ] **Step 15.3: Add the CSS**

In `css/media-library.css`, in the `:root` block (where Task 1 added the phone breakpoint tokens), add:

```css
:root {
  /* existing... */
  --cml-mini-player-height: 64px;
}
```

In the main phone `@media (max-width: 640px)` block for the Photos timeline section, add:

```css
#codex-media-library-root:has(.cml-mobile-audio-player) .cml-media-grid,
#codex-media-library-root:has(.cml-mobile-audio-player) .cml-album-detail-page__body {
  padding-bottom: calc(var(--cml-mini-player-height, 64px) + env(safe-area-inset-bottom, 0px));
}
```

- [ ] **Step 15.4: Run tests**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/previewActions.test.js
```

Expected: 2 new passing.

- [ ] **Step 15.5: Commit**

```bash
git add css/media-library.css test/previewActions.test.js
git commit -m "feat(mobile): grid padding-bottom for mini-player avoidance

When the mini-player is present, .cml-media-grid and the new album-detail
body reserve padding-bottom = var(--cml-mini-player-height, 64px) +
env(safe-area-inset-bottom, 0px). Introduces --cml-mini-player-height
fallback.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: Safe-area-inset audit on bottom-fixed chrome

**Files:**
- Modify: `css/media-library.css`
- Append to `test/previewActions.test.js`

- [ ] **Step 16.1: Write the failing test**

Append to `test/previewActions.test.js`:

```javascript
describe('safe-area-inset on bottom-fixed chrome', () => {
  it('cml-mobile-audio-player honors env(safe-area-inset-bottom)', () => {
    const css = fs.readFileSync(path.resolve('css/media-library.css'), 'utf8');
    const block = css.match(/cml-mobile-audio-player[\s\S]{0,800}\}/);
    assert.ok(block, 'cml-mobile-audio-player rule must exist');
    assert.match(block[0], /env\(safe-area-inset-bottom/);
  });
});
```

- [ ] **Step 16.2: Run, fail (or pass if already present)**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/previewActions.test.js
```

If already passing, skip Step 16.3. Otherwise:

- [ ] **Step 16.3: Add the inset**

Locate `cml-mobile-audio-player` rule in `css/media-library.css`. Add `env(safe-area-inset-bottom, 0px)` to its `bottom`, `padding-bottom`, or `height` declaration as appropriate. For example:

```css
#codex-media-library-root .cml-mobile-audio-player {
  /* existing... */
  padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
}
```

- [ ] **Step 16.4: Run tests**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js
```

Expected: full suite green; 619 passing / 1 pending / 1 pre-existing failure (approximate count — adjust by actual test additions).

- [ ] **Step 16.5: Commit**

```bash
git add css/media-library.css test/previewActions.test.js
git commit -m "feat(mobile): safe-area-inset-bottom on mini-player chrome

Applies env(safe-area-inset-bottom, 0px) to the mini-player bottom chrome
so iOS home indicator / Android gesture bar do not collide with controls.
Regression asserts the env() reference appears in the rule body.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: Photos timeline mobile segmented control

**Files:**
- Modify: `js/media-library/components.js` (add `PhotosSecondarySegmented` and wire into the Photos view)
- Append to `test/previewActions.test.js`

- [ ] **Step 17.1: Write the failing test**

Append to `test/previewActions.test.js`:

```javascript
import { PhotosSecondarySegmented } from '../js/media-library/components.js';

describe('PhotosSecondarySegmented', () => {
  it('renders five buttons in the expected order', () => {
    const html = PhotosSecondarySegmented({ active: '' });
    const buttons = html.match(/<button[^>]*data-secondary="[^"]*"/g) || [];
    assert.equal(buttons.length, 5);
    assert.match(buttons[0], /data-secondary=""/);
    assert.match(buttons[1], /data-secondary="Videos"/);
    assert.match(buttons[2], /data-secondary="Documents"/);
    assert.match(buttons[3], /data-secondary="Favourites"/);
    assert.match(buttons[4], /data-secondary="TODO"/);
  });

  it('marks the active button with is-active', () => {
    const html = PhotosSecondarySegmented({ active: 'Videos' });
    assert.match(html, /data-secondary="Videos"[^>]*class="[^"]*is-active/);
    assert.doesNotMatch(html, /data-secondary=""[^>]*class="[^"]*is-active/);
  });
});
```

- [ ] **Step 17.2: Run, fail**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/previewActions.test.js
```

Expected: 2 new failing.

- [ ] **Step 17.3: Implement**

In `js/media-library/components.js`, add an exported function:

```javascript
export function PhotosSecondarySegmented({ active }) {
  const tabs = [
    { value: '', label: 'Photos' },
    { value: 'Videos', label: 'Videos' },
    { value: 'Documents', label: 'Documents' },
    { value: 'Favourites', label: 'Favourites' },
    { value: 'TODO', label: 'TODO' },
  ];
  const safeActive = String(active || '');
  const buttons = tabs.map((t) => {
    const klass = `cml-photos-segmented__tab${t.value === safeActive ? ' is-active' : ''}`;
    return `<button type="button" class="${klass}" data-secondary="${t.value}" data-action="set-secondary-filter">${t.label}</button>`;
  }).join('');
  return `<nav class="cml-photos-segmented" role="tablist">${buttons}</nav>`;
}
```

- [ ] **Step 17.4: Wire into the Photos view**

Find the function that renders the Photos timeline (search for the `MediaTimelineSection` or equivalent that owns the secondary filter context). Insert `${PhotosSecondarySegmented({ active: state.secondaryFilter })}` near the top of the timeline body, after any sticky header.

Also add a click delegation handler in `app.js` (or wherever the existing data-action listener lives):

```javascript
if (target.matches('[data-action="set-secondary-filter"]')) {
  const next = target.getAttribute('data-secondary') || '';
  if (next !== state.secondaryFilter) {
    state.secondaryFilter = next;
    render();
  }
  return;
}
```

If the existing routing already handles `state.secondaryFilter` updates, just re-render.

- [ ] **Step 17.5: Add minimal CSS for the segmented control**

In `css/media-library.css`, inside the `@media (max-width: 640px)` block for Photos, add:

```css
#codex-media-library-root .cml-photos-segmented {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
#codex-media-library-root .cml-photos-segmented::-webkit-scrollbar {
  display: none;
}
#codex-media-library-root .cml-photos-segmented__tab {
  flex: 0 0 auto;
  padding: 6px 14px;
  border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
  border-radius: 999px;
  background: transparent;
  color: inherit;
  font-size: 13px;
  line-height: 1.2;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
}
#codex-media-library-root .cml-photos-segmented__tab.is-active {
  background: color-mix(in srgb, currentColor 8%, transparent);
  border-color: transparent;
}
```

- [ ] **Step 17.6: Run tests**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/previewActions.test.js
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js
```

Expected: previewActions green; full suite 621 passing / 1 pending / 1 pre-existing failure.

- [ ] **Step 17.7: Commit**

```bash
git add js/media-library/components.js js/media-library/app.js css/media-library.css test/previewActions.test.js
git commit -m "feat(mobile): Photos secondary segmented control

Adds PhotosSecondarySegmented component rendering 5 pill-style tabs
(Photos / Videos / Documents / Favourites / TODO). Phone-only quiet
rail style, horizontal scroll with hidden scrollbar. Click delegation
in app.js updates state.secondaryFilter and re-renders.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: Year navigation bottom-sheet

**Files:**
- Modify: `js/media-library/components.js` (add `YearBadge`, `YearSheet`)
- Modify: `js/media-library/app.js` (state slot, click handler)
- Append to `test/previewActions.test.js`

- [ ] **Step 18.1: Write the failing test**

Append to `test/previewActions.test.js`:

```javascript
import { YearBadge, YearSheet } from '../js/media-library/components.js';

describe('YearBadge / YearSheet', () => {
  it('YearBadge renders current year with data-action="open-year-sheet"', () => {
    const html = YearBadge({ year: 2026 });
    assert.match(html, /data-action="open-year-sheet"/);
    assert.match(html, />2026</);
  });

  it('YearSheet lists each year with count', () => {
    const html = YearSheet({
      years: [
        { year: 2026, count: 120 },
        { year: 2025, count: 80 },
      ],
      open: true,
    });
    assert.match(html, /cml-year-sheet[^"]*is-open/);
    assert.match(html, /data-year="2026"[^>]*>[\s\S]*?2026[\s\S]*?120/);
    assert.match(html, /data-year="2025"[^>]*>[\s\S]*?2025[\s\S]*?80/);
  });

  it('YearSheet without open flag does not render is-open', () => {
    const html = YearSheet({ years: [{ year: 2026, count: 10 }], open: false });
    assert.doesNotMatch(html, /is-open/);
  });
});
```

- [ ] **Step 18.2: Run, fail**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js test/previewActions.test.js
```

Expected: 3 new failing.

- [ ] **Step 18.3: Implement**

Append to `js/media-library/components.js`:

```javascript
export function YearBadge({ year }) {
  const safeYear = Number.isInteger(year) ? year : '';
  return `<button type="button" class="cml-year-badge" data-action="open-year-sheet" aria-label="Jump to year">${safeYear}</button>`;
}

export function YearSheet({ years, open }) {
  const items = (years || []).map((y) => {
    return `<li><button type="button" class="cml-year-sheet__row" data-action="jump-to-year" data-year="${y.year}">
      <span class="cml-year-sheet__label">${y.year}</span>
      <span class="cml-year-sheet__count">${y.count}</span>
    </button></li>`;
  }).join('');
  const klass = `cml-year-sheet${open ? ' is-open' : ''}`;
  return `<aside class="${klass}" aria-hidden="${open ? 'false' : 'true'}">
    <ul class="cml-year-sheet__list">${items}</ul>
  </aside>`;
}
```

- [ ] **Step 18.4: Wire into Photos timeline render path in app.js**

In the Photos render path (where you added `PhotosSecondarySegmented` in Task 17), also render `YearBadge` and `YearSheet`. Add a state slot `state.yearSheetOpen = false;` to the initializer. Compute the years summary from `state.mediaItems` (group by year-of-capture).

Add click delegation:

```javascript
if (target.matches('[data-action="open-year-sheet"]')) {
  state.yearSheetOpen = true;
  render();
  return;
}
if (target.matches('[data-action="jump-to-year"]') || target.closest('[data-action="jump-to-year"]')) {
  const yearAttr = (target.closest('[data-action="jump-to-year"]') || target).getAttribute('data-year');
  const yearNum = parseInt(yearAttr, 10);
  if (Number.isInteger(yearNum)) {
    const header = refs.root.querySelector(`[data-year-header="${yearNum}"]`);
    if (header) header.scrollIntoView({ block: 'start', behavior: 'instant' });
    state.yearSheetOpen = false;
    render();
  }
  return;
}
```

Ensure year headers in the timeline carry `data-year-header="${year}"`. If not, edit the timeline section renderer to add it.

- [ ] **Step 18.5: Add CSS**

In `css/media-library.css`, inside the phone `@media (max-width: 640px)` block:

```css
#codex-media-library-root .cml-year-badge {
  position: fixed;
  right: 8px;
  bottom: calc(80px + env(safe-area-inset-bottom, 0px));
  width: 44px;
  padding: 6px 0;
  background: color-mix(in srgb, currentColor 6%, transparent);
  border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
  border-radius: 22px;
  color: inherit;
  font-size: 11px;
  font-weight: 600;
  z-index: 8;
  text-align: center;
  cursor: pointer;
}
#codex-media-library-root .cml-year-sheet {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  max-height: 55vh;
  background: color-mix(in srgb, currentColor 4%, Canvas);
  border-top: 1px solid color-mix(in srgb, currentColor 10%, transparent);
  transform: translateY(100%);
  transition: transform 240ms cubic-bezier(0.32, 0.72, 0, 1);
  z-index: 20;
  overflow-y: auto;
}
#codex-media-library-root .cml-year-sheet.is-open {
  transform: translateY(0);
}
#codex-media-library-root .cml-year-sheet__list {
  list-style: none;
  margin: 0;
  padding: 8px 12px calc(20px + env(safe-area-inset-bottom, 0px));
}
#codex-media-library-root .cml-year-sheet__row {
  display: flex;
  width: 100%;
  justify-content: space-between;
  padding: 12px 8px;
  background: transparent;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, currentColor 6%, transparent);
  color: inherit;
  font-size: 15px;
  text-align: left;
  cursor: pointer;
}
#codex-media-library-root .cml-year-sheet__count {
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 18.6: Run tests**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js
```

Expected: 624 passing / 1 pending / 1 pre-existing failure.

- [ ] **Step 18.7: Commit**

```bash
git add js/media-library/components.js js/media-library/app.js css/media-library.css test/previewActions.test.js
git commit -m "feat(mobile): year badge + bottom sheet jump-to-year

Floating year badge anchored above the bottom inset shows the current
year of the scrolled-to section. Tap opens a bottom-sheet listing each
year with its photo count. Selecting a year scrolls the corresponding
[data-year-header] into view. State slot state.yearSheetOpen drives the
is-open class on the sheet.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 19: Cache version bumps + index.html

**Files:**
- Modify: `index.html` (bump query strings)

- [ ] **Step 19.1: Read current versions**

```bash
grep -nE 'app\.js\?v=|components\.js\?v=|media-library\.css\?v=|preview-overlay\.js\?v=' index.html
```

Expected output similar to:
```
app.js?v=338
components.js?v=112
media-library.css?v=278
```

- [ ] **Step 19.2: Bump consistently**

Pick the next available numbers. Suggested:

```
app.js?v=339
components.js?v=113
preview-overlay.js?v=2
media-library.css?v=279
```

Update `index.html` accordingly. Ensure each `?v=` query string moves together.

Then update the import within `app.js`:

```javascript
import { ... } from './preview-overlay.js?v=2';
```

This was already set in earlier tasks. Confirm.

- [ ] **Step 19.3: Run the full suite one more time**

```bash
D:/DevTools/nvm/v22.14.0/node.exe ./node_modules/mocha/bin/mocha.js
```

Expected: 624 passing / 1 pending / 1 pre-existing failure.

- [ ] **Step 19.4: Commit**

```bash
git add index.html
git commit -m "chore(mobile): bump app/components/preview-overlay/css cache versions

Mobile consumption surface pass-1 ships app.js?v=339,
components.js?v=113, preview-overlay.js?v=2, media-library.css?v=279.
Versions move together so partial-cache mismatches do not surface.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 20: history.md work-log entry + open PR

**Files:**
- Modify: `history.md` (append 2026-May-22 Work Log entry — note the same date section may already exist from spec commit; append within it rather than re-creating)

- [ ] **Step 20.1: Append work-log entry**

Open `history.md`. Find `## 2026-May-22 Work Log` (added in the spec commit). Append bullets:

```markdown
- 2026-05-22 mobile consumption pass-1 landed on feat/mobile-consumption-pass-1: phone breakpoint tokens (--cml-phone-break, --cml-phone-small-break) + @media normalization (680/720 → 640 where phone-intent); pure gesture helpers in preview-overlay.js (arbitrateGestureChannel + 10px threshold, shouldClosePullDismiss + 100px/0.6 px-per-ms thresholds, isPhoneWidth, LONG_PRESS_MS=450 / LONG_PRESS_MOVE_TOLERANCE=10, IDLE_FADE_MS=3000, lastViewedHashKey/parseLastViewedHash, resolveAlbumListScrollY); Preview lightbox single-finger arbitration channel (swipe/dismiss/idle) with 1:1 vertical pull-to-dismiss and backdrop opacity fade; single-tap immersive toggle with 290ms double-tap delay; 3s idle-fade timer; long-press fires cml-preview-long-press CustomEvent; route hash #lvi-<id> scroll restore for Photos timeline; AlbumDetailMobilePage sub-page with cml-mobile-albums-bar chrome + back-restore via savedAlbumListScrollY; CollectionGrid 3-photo cover stack on phone; mini-player display: none under Preview and grid padding-bottom = mini + safe-area; safe-area-inset-bottom audit on mini-player chrome; PhotosSecondarySegmented quiet pill rail; floating YearBadge + bottom YearSheet with jump-to-year. Cache: app.js?v=339, components.js?v=113, preview-overlay.js?v=2, media-library.css?v=279.
- Validation: Node 22 syntax checks across modified JS files; new RED/GREEN regressions in test/breakpointPhoneNormalization.test.js (5), test/gestureArbitration.test.js (18), test/photosTimelineScrollRestore.test.js (6), test/albumListScrollRestore.test.js (4), and previewActions.test.js extensions (~13); full Mocha under D:\DevTools\nvm\v22.14.0\node.exe expected 624 passing / 1 pending / same single pre-existing is-heic-decode-pending failure unchanged. `git diff --check` clean except CRLF warnings. Browser/live-app manual QA not run in this pass; headless smoke deferred to a follow-up acceptance task.
```

- [ ] **Step 20.2: Commit the history update**

```bash
git add history.md
git commit -m "docs(history): mobile consumption pass-1 work log

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 20.3: Push branch and open PR**

```bash
git push -u origin feat/mobile-consumption-pass-1
gh pr create --base main --head feat/mobile-consumption-pass-1 \
  --title "feat(mobile): consumption surface pass-1 (Photos / Albums / Preview)" \
  --body "$(cat <<'PRBODY'
## Summary

Implements `docs/superpowers/specs/2026-05-22-sundowner-mobile-consumption-design.md` pass-1.

- Phone breakpoint tokens + @media normalization
- Pure gesture helpers in `preview-overlay.js`
- Preview pull-to-dismiss, single-tap immersive, idle-fade, long-press event
- Photos timeline scroll restore via `#lvi-<id>` route hash
- Album detail mobile sub-page (`/collections/:albumId`) with scroll restore
- Album list 3-photo cover stack on phone
- Mini-player hide under Preview + grid padding-bottom avoidance
- Safe-area-inset-bottom audit
- Photos secondary segmented control + Year badge / bottom sheet

## Test plan

- [ ] Full Mocha 624 passing / 1 pending / same single pre-existing `is-heic-decode-pending` failure unchanged
- [ ] Manual phone flow on real device: Photos → tap → swipe ×2 → double-tap → pull-dismiss → original scroll preserved
- [ ] Albums two-level flow: list → album → Preview → close → scroll preserved at both levels
- [ ] iOS Safari + Android Chrome gesture parity
- [ ] Mini-player hides during Preview, restores on close

## Out-of-scope (Tier-2)

Videos / Music full-screen / Films / Search / Moments / Documents / Private / Dashboard / Upload mobile — see spec §10.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
PRBODY
)"
```

Expected: GitHub returns the PR URL.

---

## Self-review (run after the plan is written, before handing off)

This section is for the planner (you). Read this list once and fix issues inline.

**Spec coverage check** — every spec section maps to at least one task:
- Spec §1 scope & success — captured in plan header + tasks across the board
- Spec §2 routing — Tasks 10 (photos hash), 11 (album detail), 17 (secondary segmented)
- Spec §3 photos timeline — Tasks 10, 17, 18
- Spec §4 albums — Tasks 11, 12, 13
- Spec §5 preview gestures — Tasks 3, 4, 6, 7, 8, 9
- Spec §6 breakpoints + mini-player — Tasks 1, 2, 5, 14, 15, 16
- Spec §7 idle-fade controls — Tasks 8, 9
- Spec §8 testing strategy — every task is RED/GREEN; 9+ new regressions delivered across `breakpointPhoneNormalization.test.js`, `gestureArbitration.test.js`, `photosTimelineScrollRestore.test.js`, `albumListScrollRestore.test.js`, and `previewActions.test.js` additions
- Spec §10 Tier-2 placeholders — covered by explicit "Out-of-scope" callouts in plan header and PR description
- Spec §11 acceptance checklist — manual items deferred to PR description; headless smoke is documented in history.md as deferred

**Placeholder scan** — none. Every step shows actual code, exact paths, exact commands.

**Type consistency** — `arbitrateGestureChannel`, `shouldClosePullDismiss`, `isPhoneWidth`, `lastViewedHashKey`, `parseLastViewedHash`, `resolveAlbumListScrollY` — all names consistent across tasks. `state.previewImmersive`, `state.activeAlbumDetailId`, `state.savedAlbumListScrollY`, `state.yearSheetOpen` — all new state slots are clearly introduced.

**Sequence safety** — each task adds RED test → GREEN impl → commit, so any task can be checkpointed and inspected. Tasks 6, 7, 8, 9 progressively rewrite `setupPreviewTouchHandlers`; they must run in order (6 → 7 → 8 → 9) because each layer adds inside the same function. All other tasks are largely independent within their scope.

**Known deferrals (carry-forward to follow-up)**:
- Headless smoke harness (spec §8) — not landed in this plan; manual QA item in PR. Adding the harness requires a Puppeteer / Playwright dependency decision that is out of scope for pass-1.
- Long-press More popover UI — Task 7 only delivers the event dispatch; the popover component itself is Tier-2.
- Metadata peek (vertical up swipe) — explicit Tier-2 placeholder, no task here.
