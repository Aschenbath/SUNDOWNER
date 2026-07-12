# Photo Loading Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Photos timeline images recover predictably from thumbnail and file-route failures while preserving stable layout and safe URLs.

**Architecture:** Add a pure image retry-state helper and keep DOM event ownership in `app.js`. `components.js` emits declarative canonical-source metadata, while CSS provides stable, accessible loading/error states without changing storage-provider APIs.

**Tech Stack:** Browser ES modules, DOM event delegation, Node.js, Mocha, CSS.

---

### Task 1: Retry URL State

**Files:**
- Create: `js/media-library/image-load-state.js`
- Create: `test/imageLoadState.test.js`

- [ ] **Step 1: Write failing tests** for removing stale `retry` parameters, preserving unrelated query parameters, rejecting unsupported protocols, and enforcing the manual retry cap.
- [ ] **Step 2: Run `node --test` is not used here; run `.\\node_modules\\.bin\\mocha.cmd test/imageLoadState.test.js` and confirm failures are caused by the missing module.**
- [ ] **Step 3: Implement** `buildImageRetryUrl(source, attempt, baseUrl)`, `getNextImageSource(dataset)`, and `canRetryImage(attempt, maxAttempts)` with the `URL` API and explicit protocol checks.
- [ ] **Step 4: Re-run the focused test and confirm all cases pass.**

### Task 2: Declarative Photo Markup

**Files:**
- Modify: `js/media-library/components.js`
- Modify: `test/previewActions.test.js`

- [ ] **Step 1: Add failing assertions** that normal photo markup has `data-original-src` / canonical retry metadata but no generic inline `onerror` JavaScript.
- [ ] **Step 2: Run `.\\node_modules\\.bin\\mocha.cmd test/previewActions.test.js --grep "image loading"` and confirm the new contract fails.**
- [ ] **Step 3: Remove the generic inline handler** and emit only escaped declarative attributes needed by the delegated controller. Preserve the specialized HEIC fallback until its separate decoder path is active.
- [ ] **Step 4: Re-run the focused test and confirm it passes.**

### Task 3: Unified DOM State Machine

**Files:**
- Modify: `js/media-library/app.js`
- Modify: `test/previewActions.test.js`

- [ ] **Step 1: Add failing source-contract assertions** for clearing `has-load-error` and `is-retrying` on load, bounded original-source fallback, canonical manual retry URLs, and keyboard retry handling.
- [ ] **Step 2: Run the focused test and verify RED.**
- [ ] **Step 3: Import the helper module** and consolidate photo load/error handling in `setupImageLoadAnimations()` plus the delegated click/keyboard handlers. Do not append retry parameters to an already-mutated URL.
- [ ] **Step 4: Re-run focused tests and verify GREEN.**

### Task 4: Stable And Accessible Tile Presentation

**Files:**
- Modify: `css/media-library.css`
- Modify: `js/media-library/components.js`
- Modify: `test/previewActions.test.js`

- [ ] **Step 1: Add failing assertions** for a stable tile aspect ratio, visible retry busy state, keyboard focus styling, and timeline headings remaining outside media-tile rules.
- [ ] **Step 2: Run the focused test and verify RED.**
- [ ] **Step 3: Add CSS and markup** for stable aspect ratio, `aria-busy`, retry label state, and focus-visible treatment without nesting cards or changing the timeline hierarchy.
- [ ] **Step 4: Re-run focused tests and verify GREEN.**

### Task 5: Regression And Delivery

**Files:**
- Modify: `js/media-library/app.js` cache-bust imports if required
- Modify: `index.html` or loader version contract only if the existing entry loader requires it
- Modify: `history.md`

- [ ] **Step 1: Run syntax checks** for every changed JavaScript file with `node --check`.
- [ ] **Step 2: Run focused frontend tests**, file-route/media-security tests, and the entry-loader version contract.
- [ ] **Step 3: Run `npm audit --omit=dev`, `git diff --check`, and inspect `git diff --stat`.**
- [ ] **Step 4: Start the local dev server and verify the Photos timeline at desktop and mobile widths, including a forced failed image and manual retry.**
- [ ] **Step 5: Append an absolute-time completion entry and refresh the Tail Capsule in `history.md`.**
- [ ] **Step 6: Commit only the files from this work, leaving pre-existing test changes untouched, then push `main` if the branch remains synchronized with `origin/main`.**

