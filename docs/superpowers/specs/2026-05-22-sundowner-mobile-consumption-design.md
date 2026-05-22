# SUNDOWNER Mobile Consumption Surface — Design

- Date: 2026-05-22
- Owner: Aschenbath (Gilbert)
- Status: Draft (pending review)
- Scope tag: mobile, consumption, photos, albums, preview-lightbox
- Related baselines:
  - `CodexRules.md` SUNDOWNER section: media-library preview baseline, HEIC fidelity baseline, progressive swap DOM-class guard
  - `history.md` 2026-05-19 / 2026-05-20 / 2026-05-21 work logs (preview wheel zoom, HEIC blur-up → spinner, photo neighbour prefetch)

## 1. Context

Desktop SUNDOWNER is mature; mobile is partially built. Existing mobile-explicit surfaces are limited to: bottom tab bar (`cml-mobile-nav`), Mind fixed-chat shell, Albums compact page (`cml-albums--mobile-albums`), and Music mini-player (`cml-mobile-audio-player`). The rest of the consumption stack — Photos timeline, Album detail, Preview lightbox gestures, Music/Films/Videos/Search — rides on responsive defaults with no mobile-tuned behavior.

Gilbert's primary mobile use case is consumption (browsing photos / videos / music / films), with **看图 (Photos / Albums / Preview)** as the top daily flow. This spec defines a mobile consumption surface centered on that flow. Other modules are explicitly deferred to a Tier-2 iteration with placeholders here.

## 2. Scope

### In-scope (deep)

- Photos timeline (mobile): layout, year navigation, scroll restore, item tile loading
- Albums (mobile): list cover treatment, Album detail sub-page, scope-bounded Preview entry
- Preview lightbox (mobile): full gesture grammar (tap / double-tap / long-press / pinch / pan / horizontal swipe / vertical pull-to-dismiss), controls idle-fade, animation contracts
- Music mini-player avoidance and safe-area-inset handling on the above routes
- Breakpoint normalization for phone-segment CSS rules

### Out-of-scope (this iteration)

- Mind (already stabilized, no regression risk)
- Videos / Music full-screen / Films / Search / Moments / Documents / Private / Dashboard / Upload mobile redesign
- Global header / sidebar (frozen per CodexRules)
- Desktop routes (no desktop-side changes)

### Success criteria

1. Single-handed phone flow: Photos → tap → swipe between items ×2 → double-tap zoom → pull-to-dismiss → return to original scroll position. Zero control misalignment, zero mini-player occlusion.
2. Albums: list → album → Preview → close. Scroll position restored at both levels.
3. Preview gestures consistent on iOS Safari + Android Chrome (touch event handling and zoom-aware gating).
4. Existing Mocha suite remains ≥ 591 passing / 1 pending (current baseline as of 2026-05-21), with one pre-existing failing case (`is-heic-decode-pending` tile class) unchanged.
5. At least 9 new RED/GREEN regressions added (enumerated in §8).

## 3. Information architecture & routing

### Bottom tab bar (frozen)

```
[ Photos ]  [ Collections ]  [ Music ]  [ Mind ]  [ Bin ]
```

No structural changes. This iteration only adjusts safe-area inset and mini-player z-order around it.

### Photos routing (mobile)

```
/photos                       → timeline (default landing)
/photos?secondary=Videos      → video timeline
/photos?secondary=Documents   → document list
/photos?secondary=Favourites  → favourites
/photos?secondary=TODO        → TODO bucket
```

- Secondary filter renders as a light **segmented control** at the top of the timeline. No dark-pill heavy element. Reuses existing quiet-rail visual language.
- Preview is an overlay, not a separate route segment. Closing returns to the underlying list at the prior scroll position.

### Collections routing (mobile)

```
/collections              → album list (existing compact page)
/collections/:albumId     → album detail (new mobile sub-page)
```

- `/collections/:albumId` is a new mobile sub-page using `cml-mobile-albums-bar` for chrome.
- From an album detail tile, Preview opens with `previewItems` scoped to that album only.

### Preview lightbox entry points

| Entry | `previewItems` scope |
|---|---|
| Photos timeline | active secondary filter |
| Album detail | items in that album |
| Bin (folded inside Collections) | items in Bin view |
| Search results | search result set (Tier-2 placeholder) |

### Preview lightbox exit

1. Vertical pull-to-dismiss (primary, at zoom = 1×)
2. Top-bar close button (fallback when controls visible)
3. Browser back / OS gesture back (Android edge swipe, iOS left swipe)

### Scroll restore contract

- Photos timeline → Preview → close: list stays at the originating item, scrolled into center of viewport.
- Albums list → album detail → back: list scroll position preserved.
- Album detail → Preview → close: album grid stays at the originating tile.

Implementation route: record `state.lastViewedPhotoId` / `state.lastViewedAlbumId` in the route hash on overlay open, then `scrollIntoView({ block: 'center' })` the matching tile on return. Hash storage survives forward/back and tab restoration more reliably than `sessionStorage`.

### Explicitly excluded

- Global drawer / hamburger menu
- Whole-app horizontal swipe between primary tabs (conflicts with Preview swipe and album back)
- Pull-to-refresh on timelines (conflicts with Preview pull-to-dismiss; also conflicts with pinch-zoom initial gesture)

## 4. Photos timeline (mobile)

### Layout

- ≤ 640 px: 3-column grid, 4 px gutter, aspect-respecting tiles
- ≤ 420 px: 2-column grid, 3 px gutter (preserve small-phone density)
- Top: segmented control `Photos | Videos | Documents | Favourites | TODO`, scrolls horizontally if overflowed, with overflow fade

### Year navigation

- Desktop's right-side year rail collapses on mobile to a floating year badge anchored to the right edge above the mini-player / tab bar inset.
- Tap year badge → bottom sheet listing years and months with per-bucket counts. Selecting a year scrolls the timeline to that year's header.
- Year badge updates live as the timeline scrolls (already wired via existing year-rail logic on desktop; mobile reuses the same source-of-truth).

### Scroll restore

Documented in §3. Implementation note: store the route-hash key as `lvi-<itemId>` (last-viewed-item) to keep the hash small.

### Tile loading

- Eager: tiles within current viewport ±2 screen heights.
- Below the fold: `loading="lazy"` + `content-visibility: auto` for skip hints.
- HEIC tiles: continue current spinner overlay + blob URL LRU pattern (see CodexRules SUNDOWNER baseline for `libheif-js` decoding contract). No regression vs the 2026-05-21 spinner + neighbour prefetch baseline.

### Empty / error states

- Empty: centered two-line state — "No photos yet" + a row of filter chips reflecting current selection (a hint, not marketing).
- Error: `/api/manage/list` 500 → centered "Unable to list media items" + retry icon. Honors the existing fail-closed generic-message contract (no detailed error leakage to client).

## 5. Albums (mobile)

### `/collections` list

- Each album card renders a **3-photo cover stack** (offset triple-tile) instead of a single cover, to suggest a set.
- Bin appears as a special trailing card with broom icon and count.
- Long-press on an album card enters multi-select mode (consistent with timeline multi-select). Operations: delete, merge, rename.

### `/collections/:albumId` detail

- Top: `cml-mobile-albums-bar` reused — left back chevron + centered album name + right `⋯` More (rename / delete / share / add photos).
- Body: same grid rules as §4 timeline.
- Long-press tile → multi-select inside album scope.
- Tap tile → Preview lightbox with `previewItems` scoped to the album.

### Entry / exit contracts

- List → detail: route push, no scroll reset on list.
- Detail → list: route pop, list scroll position preserved.
- Detail → Preview → close: album grid scroll preserved on the originating tile.
- Mini-player avoidance applies throughout (see §7).

## 6. Preview lightbox gestures & controls

### Gesture table

| Input | Behavior | Constraint |
|---|---|---|
| Single tap | Toggle controls visibility | Any zoom |
| Double tap | 1× ↔ 2× zoom (focal = tap point) | Any zoom |
| Long press (450 ms) | Open More popover | Any zoom; must not also fire tap |
| Pinch | Continuous zoom (existing transform path) | Any zoom |
| Pan | Pan within image | Only when zoom > 1× |
| Horizontal swipe | Switch prev/next item | Only when zoom == 1× |
| Vertical drag down | Pull-to-dismiss | Only when zoom == 1× |
| Vertical drag up | No-op (Tier-2 placeholder for metadata peek) | — |

### Mutual exclusion

- Pinch in progress → lock horizontal-swipe channel.
- Horizontal-swipe channel active → lock pull-to-dismiss channel.
- Pull-to-dismiss active → lock horizontal-swipe channel.
- Arbitration is based on the first ~10 px of movement: single-finger + `|dx| > |dy|` → swipe channel; single-finger + `dy > 0 ∧ |dy| > |dx|` → dismiss channel; two-finger → zoom channel. Once a channel is claimed for a single touch sequence, it does not switch until `touchend`.

### Controls

- **Top bar (fixed):** `×` close · centered filename or date · `⋯` More
- **Bottom bar (fixed):** `3 / 24` counter · stretch · download · star · delete

### Idle fade

- 3000 ms with no input events → controls fade to opacity 0 over 300 ms ease.
- Any tap / pointer move restores immediately.
- When zoom > 1×: controls are hidden by default; a single tap reveals them temporarily (auto-hide again after 3 s).

### Animation contracts

| Scenario | Curve | Duration |
|---|---|---|
| Drag-following swipe | linear, 1:1 with finger | realtime |
| Swipe release snap | cubic-bezier(0.32, 0.72, 0, 1) | 250 ms |
| Pull-to-dismiss drag | linear 1:1 + background opacity = 1 − dy / threshold | realtime |
| Pull-to-dismiss release (close) | ease-out | 220 ms |
| Double-tap zoom | ease-out | 180 ms |
| Pinch / pan continuous zoom | no CSS transition, `_tzApplyImmediate()` | realtime |

The "no transition during continuous zoom/pan" rule comes from the existing media-library preview baseline (CodexRules). Drag-release snap and pull-dismiss-release explicitly opt back into transitions.

### State guards

Inherits the 2026-05-21 lesson now in CodexRules:

- Progressive swap-complete check: `img.classList.contains('is-full-loaded')`. Do **not** compare `img.src === fullSrc` — `img.src` is browser-resolved absolute, `fullSrc` is the relative `data-full-src`.
- Stale-swap guard: capture `previewId` / `itemId` at swap start and compare in callbacks. Do **not** compare `img.dataset.fullSrc` to a previously read `fullSrc` from the same attribute.
- HEIC blob LRU: revoke neighbours' blob URLs when they leave the cap-8 window, prefetch ±1 neighbours via `prefetchPhotoNeighborsForPreview()` and `prefetchHeicNeighborsForPreview()`.

### Implementation surfaces

- New: `setupPreviewSwipeNavigation()` — horizontal item swap, drag-follows-finger, snap on release.
- New: `setupPreviewPullToDismiss()` — vertical close, background opacity tracks drag.
- New: `setupPreviewControlsIdleFade()` — 3 s idle timer, reset on input, zoom-aware behavior.
- Reuse: `_tzApplyImmediate()`, `prefetchPhotoNeighborsForPreview()`, `prefetchHeicNeighborsForPreview()`, HEIC decoder factory, blob URL LRU set.
- All gesture wiring lives on the preview overlay root, using `passive` listeners on `touchstart` / `touchmove` / `touchend` (or pointer events where preferred). `preventDefault()` only on confirmed channel claim, to avoid blocking native scroll on the underlying list before the channel resolves.

## 7. Breakpoints & Music mini-player avoidance

### Breakpoint normalization

- Introduce CSS custom properties: `--cml-phone-break: 640px`, `--cml-phone-small-break: 420px`.
- Audit existing phone-segment `@media` rules (currently scattered at 420 / 640 / 680 / 720) and migrate to `(max-width: 640px)` unless a rule truly targets only the small-phone class (Apple SE-class viewports), in which case keep `(max-width: 420px)` with an inline comment explaining why.
- `860 / 900 / 960` rules are tablet / landscape territory and are out of scope.
- JS retains `isMobileLayout()` ≤ 960 (it governs more than phone-specific UI). Add `isPhoneLayout()` ≤ 640 for the phone-specific gesture and control behavior introduced in §6.

### Music mini-player avoidance

- On Photos timeline and Album detail, when `cml-mobile-audio-player` is present, the grid container adds `padding-bottom = var(--cml-mini-player-height, 64px) + env(safe-area-inset-bottom)`.
- When Preview lightbox opens with a mini-player active: hide the mini-player while the lightbox is open. Restore on close. The lightbox owns the audio-control context while open (Tier-2 will extend with in-lightbox audio controls if needed).
- z-order: tab bar < mini-player < Preview lightbox.
- All bottom-anchored chrome uses `env(safe-area-inset-bottom)` for iOS notch / home indicator / Android gesture bar.

## 8. Testing strategy

### New RED/GREEN regressions (target: 9)

1. Photos timeline scroll restore after Preview close.
2. Albums list scroll restore after Album detail back.
3. Preview swipe-next: at zoom = 1× horizontal swipe advances `previewIndex`; at zoom > 1× it pans the image transform instead.
4. Preview pull-to-dismiss: at zoom = 1× vertical drag-down past threshold closes the overlay; at zoom > 1× it pans the image transform instead.
5. Preview controls idle fade after 3 s of no input; any input restores.
6. Breakpoint normalization: a representative phone-only CSS rule applies at 640 px viewport but not at 641 px.
7. Mini-player avoidance: Preview open while mini-player active → mini-player has `aria-hidden` or `display: none`; close → mini-player restored.
8. Long-press (450 ms) opens More popover without triggering navigation or tap toggle.
9. Safe-area-inset-bottom is read by bottom-fixed chrome under an iOS-class user agent fixture.

### Headless smoke (Chrome)

- iPhone 13 viewport (390 × 844) device emulation.
- Flow: timeline → tap tile → swipe next ×2 → double-tap zoom → pull-to-dismiss.
- Capture 4 screenshots to `tmp_toDel/sundowner-mobile-acceptance-2026-05-22/`:
  - `01-timeline.png`
  - `02-preview-1x.png`
  - `03-preview-2x.png`
  - `04-pull-dismiss-mid.png`

### Existing Mocha suite

- Baseline as of 2026-05-21: 591 passing / 1 pending / 1 pre-existing failure (HEIC tile decode class assertion in `previewActions.test.js`).
- Post-landing target: 600 passing / 1 pending / same single pre-existing failure. No new regressions.
- Continue running full Mocha under Node 22 (`D:\DevTools\nvm\v22.14.0\node.exe`) because the system Node 24 fails the suite on `better-sqlite3` NODE_MODULE_VERSION mismatch.

## 9. Implementation notes & risks

### Risks

1. **Gesture interference with native scroll.** The underlying list must remain natively scrollable until a Preview gesture channel claims the touch. Mitigation: passive listeners on `touchstart`/`touchmove`, `preventDefault()` only on confirmed channel claim past the 10 px arbitration threshold.
2. **iOS Safari `touch-action` quirks.** iOS interprets `touch-action: pan-x pan-y` differently from Android; Preview overlay needs `touch-action: none` on the image stage while a gesture is active, and `touch-action: manipulation` on the timeline body. Validate in headless and live.
3. **Long-press vs tap race.** Long-press must not also fire tap; mitigation is to start a 450 ms timer on `touchstart` that is canceled on any `touchmove` past 10 px or on `touchend` before the timer fires.
4. **HEIC decode during swipe.** Swiping while a neighbour is mid-decode: the swipe must complete and arrive at a `is-decode-pending` state cleanly (spinner overlay), not at a torn frame. Existing blur-up → spinner contract already covers this; the new swipe path must thread it correctly.
5. **Scroll restore via route hash.** Hash mutations from internal navigation can collide with browser history; mitigation is to use `history.replaceState` for hash updates rather than `pushState` while the overlay is open.

### Files likely touched

- `js/media-library/app.js` — gesture wiring, route-hash scroll restore, mini-player avoidance hooks.
- `js/media-library/components.js` — Preview overlay markup, segmented control, album detail sub-page.
- `js/media-library/preview-overlay.js` / `preview-resolution.js` — new gesture handlers.
- `css/media-library.css` — phone breakpoint normalization, segmented control, album detail bar reuse, mini-player avoidance padding.
- `test/previewActions.test.js` — gesture regressions.
- New test files as needed for scroll-restore and breakpoint normalization (e.g. `test/photosTimelineScrollRestore.test.js`, `test/breakpointPhoneNormalization.test.js`).

### Cache version bumps (expected)

- `app.js`, `components.js`, `media-library.css` will all need version bumps in `index.html` query strings on landing. Coordinate so versions move together.

## 10. Tier-2 placeholders (next iteration)

The following surfaces are deferred and will get their own spec:

- Videos mobile (player overlay over Photos grid)
- Music mobile full-screen now-playing screen (lift from mini-player)
- Films mobile detail page (reuse §6 gesture skeleton)
- Global Search mobile result page (group cards, jump-to-module shortcuts)
- Moments mobile feed (timeline + reply chrome)
- Documents / Private / Dashboard / Upload mobile passes
- Metadata peek sheet via vertical drag-up in Preview (placeholder hook is in §6)

## 11. Acceptance checklist (for PR description)

- [ ] Single-handed Photos flow validated on real device: timeline → tap → swipe ×2 → double-tap → pull-dismiss → original scroll preserved.
- [ ] Albums two-level flow validated: list → album → Preview → close → scroll preserved at both levels.
- [ ] iOS Safari + Android Chrome gesture parity verified.
- [ ] Mini-player hidden during Preview, restored on close.
- [ ] Bottom chrome respects `env(safe-area-inset-bottom)`.
- [ ] 9 new RED/GREEN regressions all green.
- [ ] Full Mocha under Node 22: 600 passing / 1 pending / same single pre-existing failure. No new regressions.
- [ ] `git diff --check` clean (CRLF warning allowed).
- [ ] Cache versions in `index.html` bumped consistently.
- [ ] Headless smoke screenshots captured in `tmp_toDel/sundowner-mobile-acceptance-2026-05-22/`.
