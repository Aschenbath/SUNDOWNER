# SUNDOWNER History

Last consolidated: 2026-05-13

This is the single project-memory entrypoint for SUNDOWNER. It absorbs the older
history-like markdown files so future agents can start here, then inspect code
or git history only when exact old evidence is needed.

## Read Protocol

- First read the final `Tail Capsule`, usually with `Get-Content history.md -Tail 14`.
- If the task touches active Films work, read the latest `Active Chronicle` day.
- If the task touches an older feature, search this file and then use `git log`
  or `git show` for exact old diffs.
- Treat old diagnosis as context, not current truth; verify live code, versions,
  logs, routes, and tests before editing.
- `AGENTS.md` remains the agent instruction file. This file is project memory.

## Write Protocol

- Append new task results under `Active Chronicle > Year > Month > Day`.
- Keep one work-log item compact: date/time, tags, changed area, result, cache,
  validation, and commit/push status when relevant.
- Add `Decision Capsules` only for reusable reasoning: `Symptom / Cause / Fix / Guard`.
- Update the final `Tail Capsule` after meaningful work so tail-first reads stay useful.
- Do not recreate `COLLABORATION.md`, `Function_History.md`, runtime-truth docs,
  or archive tables as parallel history files; integrate durable facts here.

## Source Map

- Stable cross-project rules and SUNDOWNER milestones: `D:\Codex\CodexRules.md`.
- Project working memory, current stage, consolidated history: this file.
- Agent operating constraints: `AGENTS.md`.
- Exact old prose from retired history files: git history before this consolidation.

Retired into this file on 2026-05-13:

- `COLLABORATION.md`: broad collaboration log from April 2026.
- `Function_History.md`: append-only feature changelog.
- `docs\SUNDOWNER_RUNTIME_TRUTH.md`: older runtime boundary snapshot.
- `history.archive\2026-May-raw.md`: raw pre-compaction table.

## Project Truth

### Product Shape

- SUNDOWNER is a private media-library/dashboard on Cloudflare Pages + Functions.
- Primary user surfaces: Photos, Videos, Music, Documents/Files, Albums, Bin,
  Private, Mind, and Films.
- Live dashboard: `https://sundowner-1iy.pages.dev/dashboard`.
- Canonical repo/workspace: `D:\Codex\midTime\leosDrive-telegram-sync`.
- Preserve the current shell unless Gilbert explicitly asks for redesign; most
  follow-up tasks should be surgical and regression-guarded.

### Runtime Entry Points

- `/dashboard` is the media-library runtime.
- `/login` is the standalone admin login shell.
- Legacy/non-dashboard paths use the old bundle path through `entry-loader`.
- `index.html` currently loads:
  - `/js/entry-loader.js?v=4`
  - `/js/ui-overrides.js?v=10`
  - `/js/media-library/app.js?v=280`
  - `/css/media-library.css?v=256`
- `js/media-library/app.js` currently imports:
  - `./admin-runtime.js?v=2`
  - `./components.js?v=99`
  - `./films-data.js?v=7`
  - `./films-components.js?v=78`
- Query-bump rule: app/css/component source changes need matching cache bumps.
  Tests-only changes do not.
- There are no tracked `.gz` assets at consolidation time, so the old
  `index.html.gz` sync rule is retired unless `.gz` files return.

### Storage And Backend Guardrails

- KV still stores file values; D1 stores/query metadata when available.
- Hybrid KV + D1 paths must stay rollback-safe: write/delete consistency matters.
- Avoid `kv.list()` in normal request paths. Prefer chunked index reads or D1
  queries; `kv.list()` can burn free-plan quota and cascade into dashboard/bin
  failures.
- Non-`manage@` file metadata is sanitized by `stripSensitiveMetadata()`.
  Do not store `TgBotToken`, `TgProxyUrl`, Discord, S3, or HuggingFace secrets
  on per-file metadata.
- Telegram credentials belong in upload config (`manage@sysConfig@upload`) or
  env vars. Per-file records should link by safe fields such as `ChannelName`.
- Telegram `file_id` is downloadable and bot-bound; `file_unique_id` is not.
  Batch imports may need `forwardMessage` recovery to obtain real `file_id`.
- Stale metadata plus missing remote object should be a user-facing 404, not a
  server 500.
- Auth is fail-closed: missing or corrupted security config must not open
  manage/user routes.

### Frontend Guardrails

- DOM markup is mainly owned by `js/media-library/components.js`.
- Runtime state, route/event delegation, local patch paths, and API calls are
  mainly owned by `js/media-library/app.js`.
- `css/media-library.css` owns media-library component styling.
- `css/ui-overrides.css` owns shell/branding/global override behavior.
- Avoid mixing branding/theme work with media-component repairs in the same task.
- Prefer local DOM patching when a small state change does not require rebuilding
  route/content shell.
- User-facing mojibake is release-blocking.

### Validation Baseline

Known-good local test pattern:

- Syntax: `D:\DevTools\nvm\v24.11.1\node.exe --check <file>`.
- Mocha: `D:\DevTools\nvm\v22.14.0\node.exe .\node_modules\mocha\bin\mocha.js <tests>`.
- Full suite: same Node 22 direct Mocha path, or `npm test` when appropriate.
- Windows npm/Mocha wrappers can emit false trailing noise; direct Node 22 Mocha
  is the more reliable validation path here.
- At consolidation time, latest full documented suite was 399 passing with Node 22.
- Local live-app authenticated manual QA remains unassumed when Wrangler crashes
  on this machine.

## Module Baselines

### Films

- Films is a first-class private collection/diary module.
- Source model:
  - `source: "tmdb"` uses TMDb cache plus `tmdbId`.
  - `source: "manual"` requires no TMDb credentials and persists through
    `UserMovieEntry`.
- Persistence baseline:
  - TMDb cache: `manage@sysConfig@movieCache@${tmdbId}`.
  - Local entries/overrides: `manage@sysConfig@userMovieEntries`.
  - Do not introduce a dedicated SQL movies table unless Gilbert asks for a
    storage migration.
- Manual and TMDb films share the same detail/control experience while preserving
  their different persistence rules.
- Remote discovery and local search wording stay distinct: `Add from TMDb` and
  `Search my films`.
- User ratings live only on `UserMovieEntry.userRating` as nullable 5-star
  half-step values. TMDb scores remain external.
- Watch events use stable event `id`; `watchedAt` is display/sorting/legacy
  compatibility.
- TMDb path overrides and custom URL overrides are separate. Refresh from TMDb
  must preserve poster/backdrop overrides and local private fields.
- Accepted Film Detail rollback anchor: commit `353e771`.
- Current UX direction: diary surface, quiet optimistic/background persistence,
  contextual overlays, and in-flow Obsidian-like My Notes editing.

### Music

- Audio is first-class, not a document fallback.
- Music route owns track list, playlists, queue/player controls, and local audio
  title metadata.
- Non-Music routes may show a compact sidebar/mini player only when useful; avoid
  full route rerenders for play/pause/progress updates.
- Use Node 22 for Mocha when tests touch native `better-sqlite3`; Node 24 can hit
  ABI mismatch in this repo.

### Mind

- Mind is a private chat-like route backed by `manage@sysConfig@mind`.
- Keep mobile Mind fixed and isolated from document scroll; keyboard handling is
  fragile, so prefer targeted changes.
- Existing direct/session state can preserve older behavior; verify current state
  before assuming config changes are visible.

### Media Library Core

- Photos/Videos/Documents/Albums/Bin route changes have historically regressed
  through over-broad rerenders. Route sync should use the mounted hash-sync path
  and verify DOM/state agreement.
- Selection state should prefer local patching for tiles and document rows.
- Startup work should render the shell first, avoid mount-time fan-out rerenders,
  and lazy-load non-critical grid/card media while keeping detail hero media eager.

## Project Timeline

### 2026 April

- Early April: hardened upload/sysConfig CORS and JSON failure handling; fixed
  sidebar width and upload route edge cases.
- April 9: Telegram file recovery, D1 metadata migration, D1 query path, migration
  status, orphan scanning, and KV-list-risk mitigations landed. Important lesson:
  per-file secrets are stripped; use upload config and `ChannelName`.
- April 10: HEIC embedded previews, preview flicker reduction, album/card cleanup,
  sidebar Albums naming, inline album rename, selection patching, and album
  assignment pruning fixes landed.
- April 13: arbitrary Files upload picker, fail-closed WebDAV/auth/login, D1 album
  auto-migration, date-time fallback/repair, preview-side DateTaken editing, and
  video categories landed.
- April 14-15: video album wall, Private album flow, Private as primary nav, and
  add-to-album/video-album flows stabilized.
- April 17-20: Mind route launched and went through multiple desktop/mobile
  keyboard, composer, wallpaper, send/delete, and mirroring fixes. Mobile
  contenteditable experiments were rolled back after regressions.
- April 20-22: Music became first-class with audio classification, queue/player,
  playlists, metadata title editing, and route/player performance fixes.
- April 22-23: theme system, media-library shell polish, grouped global search,
  metadata intelligence, route sync hardening, selection smoothing, and sidebar
  rail/control-strip refinements landed.
- April 25: preview/album/selection cues were tightened and pushed in commit
  `20c7ca4`.

### 2026 May

- May 2: Add-to-album sheet typing and visual chooser interactions were polished.
- May 5: Films card readability and poster cleanliness were corrected.
- May 8-9: Cloudflare incident was isolated/closed; Films TMDb source MVP landed
  with `TMDbClient`, `MovieRepository`, `/api/manage/movies`, saved search/list,
  detail routing, and a 7-day detail cache.
- May 10: manual Films entries became first-class; empty manual drafts blocked,
  add/search wording split, watch history/rating/backdrop/detail actions matured,
  and Film Detail rollback anchor became `353e771`.
- May 11: Film Detail underwent surgical polish: active detail patching, backdrop
  frame math, notes editing simplification, local-first search, rating language,
  ticket metadata, and quick-read `history.md` compaction.
- May 12: startup performance probes and first-load reductions landed; Film Detail
  edits became quiet optimistic/background saves; Films diary language replaced
  admin/status wording; My Notes live-preview editing became an in-flow editor
  with focused regressions and browser smoke for heading cases.
- May 13: My Notes raw-line identity was corrected in commit `f52a353`; this file
  then consolidated the old project history-like markdown files into one canonical
  `history.md`.

## Active Chronicle

### 2026

#### May

##### 14th

###### Work Log

- 2026-05-18 | [photos][storage][responsiveness] Tightened the Photos Storage topbar latency path: when indexed/cached Photos enter `state.mediaItems`, the app now primes `state.storageSummary` from loaded Photos immediately and patches the topbar before waiting on `/api/manage/quota` or upload config requests; the local prime only raises count/size and never lowers already-known quota values. Cache: `entry-loader.js?v=5`, `app.js?v=304`, `components.js?v=106`, `moments-state.js?v=3`, `films-components.js?v=81`, `films-data.js?v=7`, `media-library.css?v=272`. Validation: Node syntax check for `app.js`; focused `momentsAppState.test.js` 5 passing; full Mocha 499 passing with 1 pending; `git diff --check` clean except CRLF warnings. `npm run build` is unavailable because `package.json` has no `build` script.
- 2026-05-18 | [photos][storage][latency] Corrected the post-recovery Photos loading surface: topbar Storage now falls back to already loaded Photos when `/api/manage/quota` returns empty metadata or fails, background Photos backfill re-syncs Storage after replacing `state.mediaItems`, the first timeline section prioritizes only the first 8 visible media tiles with eager/high-priority image loading, and Telegram preview images become clear as soon as the preview loads while the full photo continues swapping in the background. Cache: `entry-loader.js?v=5`, `app.js?v=303`, `components.js?v=106`, `moments-state.js?v=3`, `films-components.js?v=81`, `films-data.js?v=7`, `media-library.css?v=272`. Validation: Node syntax checks for `app.js` and `components.js`; focused `momentsAppState.test.js` 4 passing; focused `previewActions.test.js` 4 passing; full Mocha 498 passing with 1 pending; `git diff --check` clean except CRLF warnings. `npm run build` is unavailable because `package.json` has no `build` script.
- 2026-05-18 | [photos][failure-safe] Hardened Photos startup when live indexed requests fail after route/UI work: the full Photos payload is now persisted to a bounded local cache after successful hydration, `/api/manage/list` failures can fall back to cached/current media items instead of replacing the library with an empty DOM result, and library loading now stops whenever fallback items exist. Cache: `entry-loader.js?v=5`, `app.js?v=302`, `components.js?v=105`, `moments-state.js?v=3`, `films-components.js?v=81`, `films-data.js?v=7`, `media-library.css?v=272`. Validation: Node syntax check for `app.js`; focused `momentsAppState.test.js` 15 passing; focused `previewActions.test.js` 114 passing with 1 pending; full Mocha 495 passing with 1 pending; `git diff --check` clean except CRLF warnings.
- 2026-05-18 | [moments][inline-edit][date] Moved Moment editing back to the source card instead of the top composer and added editable Moment dates for historical backfill. The backend now stores `moment_date` with safe old-table migration, uploads new edited/created photos into the selected `Moments/YYYY-MM-DD/` folder, filters/calendar dots by the stored Moment date, and keeps `created_at` as the real creation timestamp. Frontend edit state renders an inline card editor with date/body/photos and saves by patching the card plus calendar/day wall when possible. Cache: `entry-loader.js?v=5`, `app.js?v=301`, `components.js?v=105`, `moments-state.js?v=3`, `films-components.js?v=81`, `films-data.js?v=7`, `media-library.css?v=272`. Validation: syntax checks for Moments frontend/backend files; focused Moments tests 36 passing; full Mocha 494 passing with 1 pending; `git diff --check` clean except CRLF warnings.
- 2026-05-18 | [moments][date-patch][responsiveness] Made Moments date/month navigation local instead of route-heavy: selected-date clicks now patch the calendar, selected-day wall, and selected-date stat in place with full `render()` only as a fallback; month arrows patch only the calendar. `renderMomentsCalendar`, `renderMomentsDayWall`, and `formatMomentSelectedDate` are now reusable component helpers, and the stats expose stable patch targets. Cache: `entry-loader.js?v=5`, `app.js?v=300`, `components.js?v=104`, `films-components.js?v=81`, `films-data.js?v=7`, `media-library.css?v=271`. Validation: syntax checks for `app.js`, `components.js`, and `momentsAppState.test.js`; focused Moments tests 22 passing; full Mocha 491 passing with 1 pending; `git diff --check` clean except CRLF warnings.
- 2026-05-17 | [moments][ui][responsiveness] Tightened Moments after Photos recovery: the closed Moments route no longer builds the Photos picker list on every render, picker candidates are signature-cached, photo selection inside the picker patches only the modal state instead of full-rendering the page, and the unused selected-day attachment derivation was removed from the main view model. The Moments UI was compacted into a lighter app surface with summary stats, lower-density composer chrome, sticky desktop rail, sticky picker header/footer, denser photo grid, and feed cards using `content-visibility`. Cache: `entry-loader.js?v=5`, `app.js?v=299`, `components.js?v=103`, `films-components.js?v=81`, `films-data.js?v=7`, `media-library.css?v=271`. Validation: Node syntax checks for `app.js`, `components.js`, `momentsAppState.test.js`, and `momentsComponents.test.js`; focused Moments tests 21 passing; full Mocha 490 passing with 1 pending; `git diff --check` clean except CRLF warnings.
- 2026-05-17 | [photos][hybrid-recovery][dedupe] Tightened the hybrid KV supplement after live Photos showed duplicate/stale tiles: supplement now prefers the legacy KV chunked index over raw KV scans when available, dedupes KV aliases against D1 by storage/provider identity (`TgFileUniqueId`, Telegram message/file ids, provider object keys, file shape), and blocks KV aliases for identities that D1 already marks as recycle-bin records. Validation: syntax checks for `manage/list.js` and `d1Metadata.test.js`; focused hybrid supplement regressions 4 passing; full `d1Metadata.test.js` 27 passing; `momentsAppState.test.js` 11 passing; full Mocha 489 passing with 1 pending; `git diff --check` clean except CRLF warnings.
- 2026-05-17 | [photos][hybrid-recovery] Added a hard recovery path for Photos when D1 migration is marked complete but older files still only exist in KV: `/api/manage/list` now supplements D1 query responses with matching KV file metadata, dedupes by file id, sorts the merged set, and paginates after merge. Photos hydration no longer sends a backend `fileType` filter and now requests 200 items in the first page, so Gilbert's current ~113-item library should arrive in the initial indexed payload. Cache: `entry-loader.js?v=5`, `app.js?v=298`, `components.js?v=100`, `films-components.js?v=81`, `films-data.js?v=7`, `media-library.css?v=270`. Validation: syntax checks for `manage/list.js`, `app.js`, `d1Metadata.test.js`, and `momentsAppState.test.js`; full Mocha 486 passing with 1 pending; `git diff --check` clean except CRLF warnings.
- 2026-05-17 | [photos][legacy-types] Restored Photos visibility for legacy rows whose `FileType` was generic or non-MIME (`image`, `video`, `audio`, `application/octet-stream`) by teaching D1 query, KV index fallback, and frontend MIME inference to trust explicit media filename extensions instead of classifying those records as documents. Cache: `entry-loader.js?v=5`, `app.js?v=297`, `components.js?v=100`, `films-components.js?v=81`, `films-data.js?v=7`, `media-library.css?v=270`. Validation: syntax checks for `app.js`, `d1Database.js`, `indexManager.js`, and `d1Metadata.test.js`; focused legacy-type D1/index tests 4 passing; full `d1Metadata.test.js` 23 passing; `momentsAppState.test.js` 11 passing; full Mocha 481 passing with 1 pending; `git diff --check` clean except CRLF warnings.
- 2026-05-17 | [photos][d1][pagination] Fixed Photos only showing the latest small slice after Moments uploads by making D1 media list queries use metadata-backed file type/name fallbacks, timestamp sorting, and absolute `start/count` offsets when no explicit page is requested. Frontend Photos hydration now requests timestamp order and dedupes backfilled pages before replacing live state, so a repeated/short page cannot lock the library to the initial slice. Cache: `entry-loader.js?v=5`, `app.js?v=296`, `components.js?v=100`, `films-components.js?v=81`, `films-data.js?v=7`, `media-library.css?v=270`. Validation: syntax checks for `app.js`, `d1Database.js`, and `manage/list.js`; focused D1/Photos hydration tests 3 passing; `d1Metadata.test.js` + `momentsAppState.test.js` 32 passing; full Mocha 479 passing with 1 pending; `git diff --check`.
- 2026-05-17 | [moments][photos][telegram] Extended Moments into a mixed-source post flow: composer can combine new uploads with referenced Photos items, existing posts can be edited in-place, and Telegram image messages captioned `/moments ...` now create one Moments post after normal Photos import. Cache: `entry-loader.js?v=5`, `app.js?v=293`, `components.js?v=100`, `films-components.js?v=81`, `films-data.js?v=7`, `media-library.css?v=269`. Validation: syntax checks for Moments store/API/Telegram/frontend files; focused Moments + Telegram + preview regressions 166 passing with 1 pending; full Mocha 463 passing with 1 pending. Commit: final branch head after history commit.
- 2026-05-16 | [moments][d1][ui] Added the D1-backed Moments surface: one-request body/photo publishing, normal media-library storage under `Moments/YYYY-MM-DD/`, post-date calendar dots, selected-day photo wall, preview integration, and route-scoped desktop/mobile UI. Cache: `entry-loader.js?v=5`, `app.js?v=293`, `components.js?v=100`, `films-components.js?v=81`, `films-data.js?v=7`, `media-library.css?v=268`. Validation: syntax checks for Moments backend/upload/frontend files; focused Moments/CSS Mocha 39 passing; full Mocha 449 passing with 1 pending; local Node server on `127.0.0.1:8787` served dashboard/app/CSS with Moments cache versions and route strings. Commit: final branch head after history commit.
- 2026-05-15 16:12 | [music][layout-fix] Fixed Music dashboard clipping and scroll lock by removing legacy CSS overrides that forced `.cml-main-content-shell--music` to `display:block`, compacting the hero/player-card/audio-panel dimensions, and deleting three generations of conflicting Music CSS. Root cause: `display:block` bypassed the grid scroll container, content extended behind the bottom panel and could not scroll. Cache: `entry-loader.js?v=5`, `app.js?v=292`, `components.js?v=100`, `films-components.js?v=81`, `films-data.js?v=7`, `media-library.css?v=267`. Validation: red-first scroll regression failed on missing grid row/min-height, then focused Music+scroll `previewActions.test.js` passed 7/7 and full Mocha passed 418/1 pending.
- 2026-05-15 15:34 | [music][scroll] Fixed the post-dashboard Music page scroll lock at the layout root: body remains intentionally locked, so `.cml-main-content-shell` now defines `grid-template-rows: minmax(0, 1fr)` and `.cml-main-content` has `min-height: 0` so the internal `overflow:auto` region can shrink and scroll instead of being clipped by `.cml-main-shell`. Cache: `entry-loader.js?v=5`, `app.js?v=292`, `components.js?v=100`, `films-components.js?v=81`, `films-data.js?v=7`, `media-library.css?v=266`. Validation: red-first scroll regression failed on missing grid row/min-height, then focused Music+scroll `previewActions.test.js` passed 7/7 and full Mocha passed 418/1 pending.
- 2026-05-15 15:05 | [music][dashboard-redesign] Rebuilt Music after Gilbert rejected the quiet reset screenshot as still unacceptable: route now uses an immersive dark dashboard hero, large current-track card, compact queue/playlist glass context, cleaner table metrics, and preserved existing audio/playlist `data-action` hooks while leaving the global shell untouched. Cache: `entry-loader.js?v=5`, `app.js?v=292`, `components.js?v=100`, `films-components.js?v=81`, `films-data.js?v=7`, `media-library.css?v=265`. Validation: red-first focused music tests failed on missing new selectors, then `components.js` syntax passed, focused `previewActions.test.js --grep "music"` passed 6/6, and full Mocha passed 417/1 pending with explicit `test/**/*.js` glob. Local UI smoke was blocked because this shell lacks `npm`/`npx` and project-local `node_modules/.bin/wrangler` is absent.
- 2026-05-15 12:01 | [music][ui-reset] Replaced the failed over-designed Music rollout with a quiet native desktop music layout: compact now-playing strip, list-dominant center, and a secondary queue/playlists column while leaving the global shell unchanged. Cache: `entry-loader.js?v=5`, `app.js?v=291`, `components.js?v=100`, `films-components.js?v=81`, `films-data.js?v=7`, `media-library.css?v=264`. Validation: focused quiet-native music `previewActions.test.js` assertions passed; full Mocha passed with the existing pending count unchanged. Browser acceptance is delegated to Gilbert.
- 2026-05-15 11:41 | [music][design-reset] Gilbert rejected the first Music redesign as directionally wrong, not merely under-polished: the page felt over-designed, overly self-conscious, and too eager to signal luxury. Approved replacement direction: quiet native desktop music view with macOS tool-like restraint, a compact top now-playing strip, list-dominant center, and a secondary right column for queue/playlists. Existing code should be treated as a rollback/reference point, not a polishing base.
- 2026-05-15 11:18 | [music][ui] Rebuilt the desktop Music page into a player-first Apple Music inspired layout: hero now-playing stage, dedicated Up Next rail, playlist shelf cards, and a calmer track ledger while keeping the global shell untouched. Cache: `entry-loader.js?v=5`, `app.js?v=290`, `components.js?v=100`, `films-components.js?v=81`, `films-data.js?v=7`, `media-library.css?v=263`. Validation: focused music `previewActions.test.js` assertions passed; full Mocha passed with the existing pending count unchanged. Browser acceptance is delegated to Gilbert.
- 23:56 | [music][design] Wrote the approved desktop Music redesign spec at `docs/superpowers/specs/2026-05-15-music-redesign-design.md`: Apple Music inspired dark editorial direction, four-layer page architecture (hero, queue rail, playlist shelf, track list), sparse-library handling, and implementation boundaries that keep the global shell untouched. This is a design handoff only; no implementation started in this pass.
- 23:34 | [films][latency] Tightened the opt-in Films latency pass without reopening old UX decisions: `?cmlPerf=1` rows now distinguish render-path/full-render/network-awaited state, watched-date open and Enter-close gained explicit perf actions, search input/load-more actions use clearer perf labels, and notes DOM-stable measurement now cancels stale rAFs so rapid typing does not stack dead callbacks. Cache: `entry-loader.js?v=5`, `app.js?v=289`, `components.js?v=100`, `films-components.js?v=81`, `films-data.js?v=7`, `media-library.css?v=262`. Validation: Node syntax checks for `app.js` and `films-components.js`; focused `previewActions.test.js` 109 passing with 1 pending; full Mocha 415 passing with 1 pending. Live browser QA remains for Gilbert acceptance.
- 22:34 | [music][ui] Reframed the desktop Music surface around a clearer listening-first hierarchy without touching the global shell: the summary now opens with a playback spotlight card and a dedicated playlist lane instead of only stat chips, playlist pills gained stronger icon/label structure with a stable `All tracks` anchor, and the track table picked up a supporting rail that explains queue/order context before the list. Cache: `entry-loader.js?v=5`, `app.js?v=288`, `components.js?v=100`, `films-components.js?v=81`, `films-data.js?v=7`, `media-library.css?v=262`. Validation: Node syntax checks for `components.js` and `app.js`; `git diff --check`; local Wrangler smoke on `http://127.0.0.1:8787`; headless Edge screenshot captured updated `#/music` hero + playlist lane state.
- 20:56 | [films][perf][responsiveness] Added opt-in Films interaction probes behind `?cmlPerf=1` and tightened the hot paths that made the module feel rebuilt: Films route/list/detail/search/rating/watch/notes/image-picker actions now report `action`, `duration`, `render count`, and `network wait`; local search uses rAF index patching while remote TMDb search debounces at 280ms with stale-response guards; card->detail prefetches film images, keeps cached poster/backdrop visible, and uses a restrained reduced-motion-safe 170ms transition; detail->list preserves scroll and highlights the returned card; rating/favourite/watch/image changes use local optimistic patching and button-local feedback instead of global saving. Cache: `entry-loader.js?v=5`, `app.js?v=287`, `components.js?v=99`, `films-components.js?v=81`, `films-data.js?v=7`, `media-library.css?v=261`. Perf smoke on local Node server + headless Chrome at `localhost:8787`: Films route enter 45.6ms, initial list render 38.9ms, film card->detail first paint 29.8ms, favourite visual update 3.5ms, mark watched visual update 17.8ms, detail back->list restored 10.4ms, scrollTop preserved at 320 with return highlight, screenshot captured nonblank. Validation: syntax checks for `app.js`, `films-components.js`, and `previewActions.test.js`; focused `previewActions.test.js` 109 passing with 1 pending; full Mocha 419 passing with 1 pending.
- 18:29 | [films][watch-date] Fixed the watched-date editor close semantics after native date input regressions: focusout/change no longer save or collapse the date editor, so month/day/year segment editing can continue uninterrupted; only clicking `Watched <date>` again or pressing Enter commits the date and closes the input. Cache: `entry-loader.js?v=5`, `app.js?v=286`, `components.js?v=99`, `films-components.js?v=80`, `films-data.js?v=7`, `media-library.css?v=260`. Validation: syntax checks for `app.js` and `films-components.js`; focused watch-date/action regressions 2 passing; full Mocha 419 passing with 1 pending. Browser/live-app manual QA was not run in this pass.
- 17:50 | [films][watch-date] Changed the single-watch date editor from focus-only reveal to an explicit watched-date toggle: clicking `Watched <date>` opens the date input, clicking it again closes it, the date picker itself stays usable without self-closing, and the action is wired through the Films action allowlist. Cache: `entry-loader.js?v=5`, `app.js?v=285`, `components.js?v=99`, `films-components.js?v=80`, `films-data.js?v=7`, `media-library.css?v=260`. Validation: syntax checks for `app.js` and `films-components.js`; focused watch-date/action regressions 2 passing; full Mocha 419 passing with 1 pending. Browser/live-app manual QA was not run in this pass.
- 17:33 | [films][rating][watch-date] Tightened Film Detail rating and watched-date affordances: single-watch date input stays hidden until the watched date control receives focus/click, rating pointer preview now uses the real star glyph bounds instead of the padded control so right-side empty space cannot preview/save 5.0, stale rating previews clear when leaving the stars, and star motion was reduced by removing drop-shadow/pill glow. Cache: `entry-loader.js?v=5`, `app.js?v=284`, `components.js?v=99`, `films-components.js?v=80`, `films-data.js?v=7`, `media-library.css?v=259`. Validation: syntax checks for `app.js` and `films-components.js`; focused rating/watch-date regressions 3 passing; full Mocha 419 passing with 1 pending. Browser/live-app manual QA was not run in this pass.
- 17:05 | [films][watch-actions] Fixed Film Detail watch-state feedback: single-watch summaries now expose an inline date input so clicking the watched date can edit it, frontend records retain `watchStatus` for correct UI branching, and films moved back to Want render as Mark watched even when previous watch history is retained. Cache: `entry-loader.js?v=5`, `app.js?v=283`, `components.js?v=99`, `films-components.js?v=80`, `films-data.js?v=7`, `media-library.css?v=258`. Validation: syntax checks for `app.js` and `films-components.js`; focused watch-action regressions 3 passing; focused `previewActions.test.js` 108 passing with 1 pending; full Mocha 418 passing with 1 pending. Browser/live-app manual QA was not run in this pass.
- 16:21 | [films][detail][contextual-controls] Restored Film Detail image/manage actions to contextual affordances: Poster, Backdrop, and Manage now stay visually hidden by default and reveal only from nearby hover/focus zones, while overview editing stays in the synopsis flow instead of opening a duplicate floating metadata panel. Cache: `entry-loader.js?v=5`, `app.js?v=282`, `components.js?v=99`, `films-components.js?v=79`, `films-data.js?v=7`, `media-library.css?v=257`. Validation: syntax checks for `app.js` and `films-components.js`; focused metadata/contextual-control regressions 2 passing; focused `previewActions.test.js` 107 passing with 1 pending; full Mocha 417 passing with 1 pending. Browser/live-app manual QA was not run in this pass.
- 02:30 | [auth][dashboard][local-port] Unified the visible admin login path around `/login -> /api/manage/auth-session -> admin_auth -> /dashboard`: root dashboard middleware redirects unauthenticated dashboard requests to `/login?next=...`, `/api/manage/me` is a public session probe that validates `admin_auth`, legacy `/api/manage/login` now redirects to `/login`, dashboard API 401s leave the old in-app login overlay path, and local SUNDOWNER dev/test defaults moved off port `8080` to `8787`. Local D1 schema repair now backfills legacy `index_operations.expires_at/updated_at` so old SQLite data does not masquerade as auth failure. Cache: `entry-loader.js?v=5`, `app.js?v=281`. Validation: focused auth/entry tests 28 passing; full Mocha 416 passing with 1 pending; headless Chrome trace on `localhost:8787` confirmed `/dashboard -> /login?next=%2Fdashboard -> POST /api/manage/auth-session -> admin_auth -> /dashboard` with no `/api/login`, no `/api/manage/login`, and no legacy login UI.

###### Decision Capsules

- [dashboard-single-login] Symptom: login could feel like two authentication systems because dashboard requests and login-page session checks still touched old manage-auth paths. Fix: gate `/dashboard` before the SPA loads, make `/api/manage/me` a public session-check endpoint, keep `/api/manage/auth-session` as the only login POST, and redirect dashboard 401s to `/login?next=...`. Guard: `dashboardAuth.test.js`, `loginApp.test.js`, `entryLoader.test.js`, and browser trace on `8787`.
- [local-port-8080] Local port `8080` is not safe for SUNDOWNER dev on this machine because another local service may own it. Fix: SUNDOWNER local defaults now use `8787`; do not start or kill `8080` for SUNDOWNER validation.

##### 13th

###### Work Log

- 15:20 | [films][detail-layout][cleanup] Removed the duplicate hero `My rating` block from Film Detail so first-screen composition matches the calmer detail layout: title, original title, metadata, and synopsis stay in the hero while the editable rating remains only in the `Personal` card. Removed the stale `components.js` import of old `films-components.js?v=68`. Cleaned root clutter by deleting ignored runtime logs, empty retired `docs` / `history.archive`, and the untracked one-off `scripts` smoke directory; tracked root runtime/config files stayed in place. Cache: `app.js?v=278`, `components.js?v=99`, `films-components.js?v=76`, `films-data.js?v=7`, `media-library.css?v=255`. Validation: syntax checks for `app.js`, `components.js`, and `films-components.js`; focused `previewActions.test.js` 104 passing; full Mocha 403 passing with Node 22; headless Chrome geometry confirmed `heroRatingCount=0` and Personal rating `4.0`.
- 17:45 | [films][notes][live-preview] Re-anchored My Notes on a single editor surface after line-identity work had drifted back into per-line edit hosts: active heading lines stay source in place, rendered lines keep raw indexes and blank spacers, and Chrome smoke reconfirmed `1 / # 你好` vs `## 1 / 你好` with no duplicate heading copy. Cache: `app.js?v=279`, `components.js?v=99`, `films-components.js?v=77`, `films-data.js?v=7`, `media-library.css?v=255`. Validation: Node syntax checks for `app.js` and `films-components.js`; focused `previewActions.test.js` 105 passing with 1 pending legacy-encoding assertion; full Mocha 404 passing with 1 pending; headless Chrome DOM/screenshot smoke for both active heading cases.
- 19:58 | [films][detail][ux-audit] Tightened Films Detail around real user tasks instead of field surfaces: single-watch entries now render as a compact `Watched <date>` summary instead of a timeline card, `Your take` is a lighter inline rating/favourite area, `Private notes` is easier to discover without heavy panel chrome, and poster/backdrop tools plus `Manage` are visible without relying on hover. Cache: `app.js?v=280`, `components.js?v=99`, `films-components.js?v=78`, `films-data.js?v=7`, `media-library.css?v=256`. Validation: Node syntax checks for `app.js` and `films-components.js`; focused `previewActions.test.js` 106 passing with 1 pending legacy-encoding assertion; full Mocha 404 passing with 1 pending; headless Chrome screenshots for unwatched and single-watch detail flows.
- 13:31 | [history][consolidation] Consolidated project memory into this single `history.md`, absorbing durable content from `COLLABORATION.md`, `Function_History.md`, `docs\SUNDOWNER_RUNTIME_TRUTH.md`, and `history.archive\2026-May-raw.md`. `AGENTS.md` remains the instruction file. Current runtime versions recorded as `app.js?v=277`, `components.js?v=98`, `films-components.js?v=75`, `films-data.js?v=7`, `media-library.css?v=255`. Validation: `git diff --check` clean except CRLF warning; active non-dependency markdown inventory is now `history.md` + `AGENTS.md`.
- 2026-05-13 | [films][notes][identity] Corrected My Notes raw-line identity so the active line itself is the only editable host, rendered lines and blank spacers keep stable raw indexes, and heading source stays in-flow instead of feeling like a detached input card. Cache: `app.js?v=277`, `films-components.js?v=75`. Validation: Node syntax checks for `app.js` and `films-components.js`; `git diff --check`; focused film-notes regressions 4 passing; full Mocha 399 passing with Node 22. Local live-app manual QA remains blocked by Wrangler runtime crash on this machine. Commit: `f52a353`.

###### Decision Capsules

- [single-history-entrypoint] Symptom: agents had to inspect several history-like markdown files and could over-read stale context. Cause: `COLLABORATION.md`, `Function_History.md`, runtime-truth docs, and raw archive tables all carried overlapping memory roles. Fix: consolidate durable facts, guardrails, timeline, runtime truth, and active tail state into `history.md`; use git history for exact old prose. Guard: do not recreate parallel history markdown files.
- [film-detail-rating-placement] Symptom: hero `My rating` competed with the movie title and made the first screen feel busy. Cause: the same local rating appeared in both the hero and the Personal card. Fix: keep the rating control only in Personal, and keep the hero focused on film identity/metadata/synopsis. Guard: future rating UI changes should not re-add a hero rating block unless the detail layout is explicitly redesigned.

##### 12th

###### Work Log

- 23:24 | [films][notes][live-preview] Tightened My Notes from line-owned edit hosts to one fixed editor canvas: the notes surface is the only `contenteditable` textbox, inactive Markdown nodes are rendered and non-editable, active heading lines render as source in-place with matching heading scale, and Chrome smoke verified the `## 1` / `# 你好` cases without duplicate content. Cache: `app.js?v=276`, `components.js?v=98`, `films-components.js?v=74`, `films-data.js?v=7`, `media-library.css?v=255`. Validation: Node syntax checks; `git diff --check`; focused `previewActions.test.js` 103 passing; full Mocha 402 passing with Node 22; headless Chrome DOM dump/screenshots.
- 21:29 | [films][notes][live-preview] Corrected the My Notes visual model from per-line widget feeling to one fixed editor canvas: the notes surface owns the textbox role, active source lines no longer carry textbox role/focus-box styling, rendered lines have transparent/no-border wrappers, and clicking blank canvas space returns focus to the last line. Cache: `app.js?v=275`, `components.js?v=98`, `films-components.js?v=73`, `films-data.js?v=7`, `media-library.css?v=254`. Validation: syntax checks; `git diff --check`; focused `previewActions.test.js` 103 passing; full Mocha 402 passing with Node 22.
- 21:09 | [films][notes][live-preview] Tightened My Notes into an in-flow Obsidian-like editor: only the active line/source block renders Markdown source in place, inactive lines render Markdown without duplicate preview, fenced code blocks stay source while active, note-save failures show local `Unsynced - Retry`, and retry preserves intentionally empty failed drafts. Cache: `app.js?v=274`, `components.js?v=98`, `films-components.js?v=72`, `films-data.js?v=7`, `media-library.css?v=253`. Validation: syntax checks; `git diff --check`; focused `previewActions.test.js` 103 passing; full Mocha 402 passing with Node 22.
- 19:10 | [films][notes][live-preview] Fixed Film Detail My Notes live-preview editing so edit drafts preserve trailing newlines, `#\n` renders as two lines, Enter splits the active contenteditable line at the caret, list/quote Enter continues or exits naturally, Backspace at line start merges upward, and inactive lines keep rendering Markdown while the active line stays source. Cache: `app.js?v=273`, `components.js?v=98`, `films-components.js?v=71`, `films-data.js?v=7`, `media-library.css?v=252`. Validation: syntax checks; `git diff --check`; focused `previewActions.test.js` 102 passing; full Mocha 401 passing with Node 22.
- 18:02 | [films][diary-ux] Removed remaining Detail/UI admin vocabulary from Films surfaces and tightened natural diary actions: rating is a direct star control with local unsynced state, Personal no longer exposes Status/Last watched, Watch owns Mark watched/Rewatch/Move to Want, cards hide empty rating/locale placeholders, search/add copy is source-neutral, and Move to Want clears `watchedAt` while preserving complex watch history conservatively. Cache: `app.js?v=272`, `components.js?v=98`, `films-components.js?v=70`, `films-data.js?v=7`, `media-library.css?v=251`. Validation: syntax checks; focused Films tests; full Mocha 399 passing with Node 22; `git diff --check`.
- 14:43 | [films][saving-ux] Converted Film Detail small mutations to quiet optimistic/background persistence: entry patches no longer show global `Saving...` by default, image picker close/Escape commits URL/frame drafts in the background, backdrop frame focus/change saves are nonblocking, rating/date/status/favourite/watch-history use the shared entry patch path, and refresh/remove/manual creation keep explicit safety commits. Cache: `app.js?v=271`, `components.js?v=98`, `films-components.js?v=69`, `films-data.js?v=7`, `media-library.css?v=250`. Validation: `app.js` syntax check; `git diff --check`; focused Films tests; full Mocha 399 passing with Node 22.
- 13:58 | [films][tests] Added focused regression coverage for explicit empty metadata overrides clearing back to TMDb fields while preserving private local state, and TMDb search cards restoring add actions after saved state is removed. Validation: focused `movieRepository.test.js` + `previewActions.test.js` 126 passing; full Mocha 399 passing with Node 22.
- 13:49 | [films][backdrop][watch-history] Hardened post-`353bd43` risks: `watchedAt` PATCH distinguishes absent/null/empty-string, backdrop frame sync observes detail/picker container resizes, rapid film patches are queued per film with stale response guards, and cache moved to `app.js?v=270`. Validation: syntax checks; `git diff --check`; focused Films/movie tests 138 passing; full Mocha 397 passing with Node 22; headless Chrome geometry QA.
- 12:38 | [films][contracts][backdrop] Stabilized Films prop contracts and rating helpers, removed dead note fallback helpers, mapped movies API errors to specific status codes, made watchedAt clearing conservative around manual watch history, and disabled backdrop Move X/Y when the current frame has no pan room. Cache: `app.js?v=268`, `components.js?v=98`, `films-components.js?v=69`, `films-data.js?v=7`, `media-library.css?v=250`. Validation: syntax checks; `git diff --check`; focused tests 137 passing.
- 10:46 | [films][picker][responsiveness] Tightened Film Detail image-picker responsiveness: close/escape/autosave paths enter closing state immediately, backdrop/poster selection and reset mark saving before async persistence, and backdrop picker close button no longer feels dead while waiting on URL/frame commits. Cache: `app.js?v=267`, `components.js?v=98`, `films-components.js?v=68`, `films-data.js?v=7`, `media-library.css?v=249`. Validation: Node syntax check; `git diff --check`; focused tests 108 passing.
- 10:18 | [perf][startup] Added opt-in `?cmlPerf=1` performance marks/table; stopped mount-time album/playlist/films/storage/live-sync tasks from each force-rendering the shell; deferred Films warmup to idle; lazy-loaded non-critical media-grid and Films index posters while keeping detail hero media eager. Cache: `app.js?v=266`, `components.js?v=98`, `films-components.js?v=68`, `films-data.js?v=7`, `media-library.css?v=249`. Validation: syntax checks; `git diff --check`; focused tests 108 passing; full Mocha 394 passing.
- 00:38 | [films][detail][overlay] Tightened Film Detail to contextual overlays only: backdrop tool is now a hero hotspot, refresh/remove moved into metadata shortcuts, private signals use calm text rows, metadata draft reuse no longer resets mid-edit, and cross-surface autosave commits before switching. Cache: `app.js?v=265`, `components.js?v=97`, `films-components.js?v=67`, `films-data.js?v=7`, `media-library.css?v=249`. Validation: syntax checks; `git diff --check`; focused `previewActions.test.js` 5 passing; `lightChromeCss.test.js` 9 passing.

###### Decision Capsules

- [startup-perf] Initial slowness is dominated by client-side parse/render and early task fan-out, not a single blocking Films call. Fix: render shell first, drop mount-time `forceRender` fan-out, move Films warmup to idle, lazy-load non-critical posters/thumbnails. Guard: `?cmlPerf=1` and Mocha suite.
- [films-detail-surface-transitions] Surface switches can leave stale edit UI if autosave/outside-click paths skip the next overlay. Fix: commit pending film edits before opening the next surface and treat metadata/image-picker overlays as multi-node surfaces.
- [films-backdrop-pan-controls] Move X/Y sliders should disable when fitted image dimensions leave no crop area to pan.

##### 11th

###### Work Log

- 23:52 | [films][ticket-meta] Corrected Films ticket-card metadata typography after oversized values: Release keeps dot-separated emphasis, Locale/Watched stay compact and clamped, and overall ticket layout remains unchanged. Cache: `app.js?v=264`, `components.js?v=97`, `films-components.js?v=66`, `films-data.js?v=7`, `media-library.css?v=248`. Validation: syntax checks; `git diff --check`; focused Films/light CSS Mocha 31 passing; full Mocha 394 passing.
- 22:57 | [films][notes][rating][search] Fixed Film Detail notes line editing so Enter/beforeinput creates new note lines while respecting IME composition; rating keeps 0.1 score precision while star visuals quantize to half-stars and ticks are quieter; Films search label removed, native search cancel icon hidden, and custom entry appears after the first three TMDb results. Cache: `app.js?v=261`, `components.js?v=94`, `films-components.js?v=63`, `films-data.js?v=7`, `media-library.css?v=245`. Validation: syntax checks; `git diff --check`; focused tests 30 passing; full Mocha 393 passing.
- 22:26 | [films][search][rating] Films index entry collapsed into local-first search with TMDb/custom add results; manual custom result opens a titled draft; Remove from Films confirms before delete; My rating control has ticks/current value and half-star slider steps with live star-fill feedback. Cache: `app.js?v=260`, `components.js?v=93`, `films-components.js?v=62`, `films-data.js?v=7`, `media-library.css?v=244`. Validation: syntax checks; `git diff --check`; targeted Films Mocha 9 passing; full Mocha 391 passing.
- 21:31 | [films][search][backdrop] Films index library search checks saved films first and only opens TMDb add search when the whole local library has no match; detail secondary tools reveal only from top-right hover/focus zone; backdrop defaults/reset/legacy defaults normalize to zoom `0.5` and opacity `0.92`. Cache: `app.js?v=259`, `films-components.js?v=61`, `media-library.css?v=243`. Validation: syntax checks; `git diff --check`; targeted tests 8 passing; full Mocha 391 passing.
- 20:47 | [films][detail-ux] Moved saved-film metadata and image pickers into anchored detail overlays; added poster/backdrop contextual controls, line-based hybrid Markdown notes editing, visible watch-date editing affordance, and restored real `watching` status semantics. Cache: `app.js?v=258`, `films-components.js?v=60`, `films-data.js?v=7`, `media-library.css?v=242`. Validation: syntax checks; `git diff --check`; full Mocha 390 passing.
- 19:54 | [films][detail-editing] Kept Synopsis editing in-place as a full-width detail surface; simplified Notes editing to one writing surface with no live-preview panel or instructional autosave copy. Cache: `app.js?v=257`, `films-components.js?v=59`, `media-library.css?v=241`. Validation: syntax checks; diff-check; targeted Films Mocha 149 passing.
- 19:37 | [history][memory] Compacted project `history.md` into quick-read format. Raw pre-compaction table was preserved at the time, then fully consolidated into this file on 2026-05-13.
- 19:11 | [films][detail][surgical] Removed visible Synopsis block and redundant labels; moved synopsis under Director/Release/Runtime row; flattened image tools into quiet Poster/Backdrop controls; removed More/Open TMDb detail affordance. Cache: `app.js?v=256`, `films-components.js?v=58`, `media-library.css?v=240`. Validation: syntax checks; diff-check; targeted Films Mocha 149 passing.

###### Decision Capsules

- [films-detail-refresh] Saving in Film Detail looked like a page refresh because the patch path replaced the whole `[data-film-detail-page]`. Fix: reuse mounted root/backdrop and patch targeted children/status.
- [films-backdrop-frame] CSS percentage/object-fit interactions made sliders delayed and exposed blank space. Fix: calculate fitted image dimensions in JS, position in pixels, batch slider updates, and flush before save.
- [films-notes-edit] Toolbar-heavy notes editing felt too tool-like and could exit during text drag. Fix: live rendered Markdown feedback, no visible toolbar, pointer-down-origin guards.

##### 10th

###### Work Log

- [films][manual] Manual entries landed as first-class saved films: optimistic create, per-entry request queue, Remove with Undo, local saved-library search, and no TMDb credential requirement.
- [films][acceptance] Empty manual drafts were blocked/discarded; `Add from TMDb` vs `Search my films` split; TMDb Load More appends; refresh preserves private fields and local overrides.
- [films][detail-actions] Detail More actions covered edit metadata, poster/backdrop picker, force refresh, Open TMDb, and optimistic Remove with Undo.
- [films][watch-history] Watch events gained stable ids and multiple private watch dates; user ratings stayed local-only 5-star half-step values.
- [films][backdrop] TMDb backdrops auto-rotate from MovieCache; local backdrop override remains highest priority and disables rotation.
- [films][rollback] Accepted Film Detail rollback anchor became commit `353e771` after failed full-panel backdrop experiments.

###### Decision Capsules

- [manual-create-race] First edit after manual create could race the create request. Fix: await per-entry create promise before first patch.
- [image-overrides] TMDb path overrides and custom URL overrides are separate fields; Reset TMDb clears both; Refresh from TMDb preserves both.
- [unsaved-detail] Unsaved TMDb detail previews should withhold local-only controls until explicit save to avoid accidental local entry creation.

##### 9th

###### Work Log

- [films][mvp] TMDb data-source MVP landed: `TMDbClient`, `MovieRepository`, `/api/manage/movies`, search/detail/list/save/delete, and 7-day detail cache.
- [films][cards] Saved Films card design iterated through ticket-stub styling and poster cleanliness; mock/sample cards were removed from live diary path.
- [films][routing] Films route model stabilized around `#/films` index and `#/films/:id` detail; search-result save stays mutation-only unless explicitly opening detail.
- [file-route] Missing R2/Discord/S3/External objects now consistently return `404 Error: Image Not Found`; malformed External upload URLs are rejected before metadata write.
- [heic] HEIC/HEIF preview extraction returned to lazy loading of `exifr/dist/full.esm.mjs`.
- [cloudflare] Pages incident closed by removing tracked `.gz` artifacts, installing Functions deps correctly, removing runtime exifr/Sentry trouble spots, and verifying `/`, `/health`, and CSS returned 200.

###### Decision Capsules

- [tmdb-credentials] Missing TMDb credentials should surface as clear env-var guidance near Films search controls, not generic `/api/manage/movies` 503 feedback below the fold.
- [file-stale-metadata] Stale metadata plus missing remote object is a user-facing 404, not a server 500.

##### 8th

- [cloudflare][incident] Homepage/document 500s were isolated through Pages Functions packaging, static artifact, exifr, Sentry, and `.gz` layers.
- [films][visual] Films grid card moved toward an editorial movie-diary card before later TMDb/MovieRepository work.

##### 5th

- [films][card] Films card readability and poster cleanliness were corrected: status badge and unrated `0.0` placeholders removed from grid-card poster area.

## Open Loops

- Browser/manual QA is not assumed unless explicitly documented.
- Full authenticated live-app hand test for current Films work remains unverified locally because Wrangler crashes on this machine.
- Keep Films follow-up surgical unless Gilbert reopens broader visual redesign.
- For visual regression, compare against accepted Films Detail anchor `353e771` before broad CSS changes.
- Runtime/version truth in this file must be refreshed after app/css/module cache bumps.

## Tail Capsule

- read-protocol: start with `Get-Content history.md -Tail 14`; then read latest day if the task touches active work.
- canonical-history: `history.md` is now the single project-memory file; retired duplicates are recoverable from git history, not active docs.
- current-focus: Moments UI/responsiveness after Photos recovery; preserve the Photos D1/KV hybrid supplement, provider-identity dedupe, recycle-bin alias blocking, metadata fallback, timestamp sorting, absolute pagination, and legacy/generic `FileType` extension inference.
- latest-state: 2026-May-18; Photos startup has a failure-safe cache fallback for indexed-list failures, Storage topbar primes immediately from loaded Photos while quota sync runs, Telegram previews clear before full photo swap, and Moments editing remains in-place with editable `moment_date`; cache `entry-loader.js?v=5`, `app.js?v=304`, `components.js?v=106`, `moments-state.js?v=3`, `films-components.js?v=81`, `films-data.js?v=7`, `media-library.css?v=272`; SUNDOWNER local dev/test default port remains `8787`, not `8080`.
- latest-validation: 2026-May-18; syntax check for `app.js`; focused `momentsAppState.test.js` 5 passing; full Mocha 499 passing with 1 pending; `git diff --check` clean except CRLF warnings. `npm run build` is unavailable in this repo because `package.json` has no `build` script.
- latest-state: 2026-May-14 23:34; Films latency perf-label pass cache `entry-loader.js?v=5`, `app.js?v=289`, `components.js?v=100`, `films-components.js?v=81`, `films-data.js?v=7`, `media-library.css?v=262`; SUNDOWNER local dev/test default port remains `8787`, not `8080`.
- latest-validation: 2026-May-14 23:34; Node syntax checks for `app.js` and `films-components.js`; focused `previewActions.test.js` 109 passing with 1 pending; full Mocha 415 passing with 1 pending. Live browser QA was partially blocked by local mixed-runtime/API state, so final acceptance is delegated to Gilbert.
- latest-state: 2026-May-14 22:34; Music desktop redesign cache `entry-loader.js?v=5`, `app.js?v=288`, `components.js?v=100`, `films-components.js?v=81`, `films-data.js?v=7`, `media-library.css?v=262`; SUNDOWNER local dev/test default port remains `8787`, not `8080`.
- latest-validation: 2026-May-14 22:34; Node syntax checks for `components.js` and `app.js`; `git diff --check`; local Wrangler smoke on `localhost:8787`; headless Edge screenshot confirmed updated `#/music` hero and playlist lane render. Full Mocha was not rerun in this pass.
- latest-state: 2026-May-14 20:56; Films responsiveness pass cache `entry-loader.js?v=5`, `app.js?v=287`, `components.js?v=99`, `films-components.js?v=81`, `films-data.js?v=7`, `media-library.css?v=261`; SUNDOWNER local dev/test default port remains `8787`, not `8080`.
- latest-validation: 2026-May-14 20:56; syntax checks for `app.js`, `films-components.js`, and `previewActions.test.js`; focused `previewActions.test.js` 109 passing with 1 pending; full Mocha 419 passing with 1 pending; local Node server + headless Chrome perf smoke on `localhost:8787` measured Films route enter 45.6ms, card->detail 29.8ms, favourite 3.5ms, mark watched 17.8ms, detail back->list 10.4ms, preserved list scrollTop 320, and captured a nonblank screenshot.
- latest-state: 2026-May-14 18:29; Film Detail watched-date editor cache `entry-loader.js?v=5`, `app.js?v=286`, `components.js?v=99`, `films-components.js?v=80`, `films-data.js?v=7`, `media-library.css?v=260`; SUNDOWNER local dev/test default port remains `8787`, not `8080`.
- latest-validation: 2026-May-14 18:29; syntax checks for `app.js` and `films-components.js`; focused watch-date/action regressions 2 passing; full Mocha 419 passing with 1 pending. Browser/live-app manual QA not run in this pass.
- latest-state: 2026-May-14 17:50; Film Detail watched-date toggle cache `entry-loader.js?v=5`, `app.js?v=285`, `components.js?v=99`, `films-components.js?v=80`, `films-data.js?v=7`, `media-library.css?v=260`; SUNDOWNER local dev/test default port remains `8787`, not `8080`.
- latest-validation: 2026-May-14 17:50; syntax checks for `app.js` and `films-components.js`; focused watch-date/action regressions 2 passing; full Mocha 419 passing with 1 pending. Browser/live-app manual QA not run in this pass.
- latest-state: 2026-May-14 17:33; Film Detail rating/watch-date cache `entry-loader.js?v=5`, `app.js?v=284`, `components.js?v=99`, `films-components.js?v=80`, `films-data.js?v=7`, `media-library.css?v=259`; SUNDOWNER local dev/test default port remains `8787`, not `8080`.
- latest-validation: 2026-May-14 17:33; syntax checks for `app.js` and `films-components.js`; focused rating/watch-date regressions 3 passing; full Mocha 419 passing with 1 pending. Browser/live-app manual QA not run in this pass.
- latest-state: 2026-May-14 17:05; Film Detail watch actions cache `entry-loader.js?v=5`, `app.js?v=283`, `components.js?v=99`, `films-components.js?v=80`, `films-data.js?v=7`, `media-library.css?v=258`; SUNDOWNER local dev/test default port remains `8787`, not `8080`.
- latest-validation: 2026-May-14 17:05; syntax checks for `app.js` and `films-components.js`; focused watch-action regressions 3 passing; focused `previewActions.test.js` 108 passing with 1 pending; full Mocha 418 passing with 1 pending. Browser/live-app manual QA not run in this pass.
- latest-state: 2026-May-14 16:21; Film Detail contextual controls/overview edit cache `entry-loader.js?v=5`, `app.js?v=282`, `components.js?v=99`, `films-components.js?v=79`, `films-data.js?v=7`, `media-library.css?v=257`; SUNDOWNER local dev/test default port remains `8787`, not `8080`.
- latest-validation: 2026-May-14 16:21; syntax checks for `app.js` and `films-components.js`; focused metadata/contextual-control regressions 2 passing; focused `previewActions.test.js` 107 passing with 1 pending; full Mocha 417 passing with 1 pending. Browser/live-app manual QA not run in this pass.
- latest-state: 2026-May-14 02:30; auth route cache `entry-loader.js?v=5`, `app.js?v=281`; SUNDOWNER local dev/test default port is `8787`, not `8080`.
- latest-validation: 2026-May-14 02:30; focused auth/entry Mocha 28 passing; full Mocha 416 passing with 1 pending; headless Chrome auth trace on `localhost:8787` confirmed only `/api/manage/auth-session` login POST and no `/api/login` or `/api/manage/login`.
- latest-state: 2026-May-13 19:58; `app.js?v=280`, `components.js?v=99`, `films-components.js?v=78`, `films-data.js?v=7`, `media-library.css?v=256`.
- latest-validation: 2026-May-13 19:58; syntax checks for `app.js` and `films-components.js`; focused `previewActions.test.js` 106 passing with 1 pending legacy-encoding assertion; full Mocha 404 passing with 1 pending; headless Chrome screenshots confirmed unwatched and single-watch detail flows.
- latest-state: 2026-May-13 17:45; `app.js?v=279`, `components.js?v=99`, `films-components.js?v=77`, `films-data.js?v=7`, `media-library.css?v=255`.
- latest-state: 2026-May-13 15:20; `app.js?v=278`, `components.js?v=99`, `films-components.js?v=76`, `films-data.js?v=7`, `media-library.css?v=255`.
- latest-validation: latest Films validation was syntax checks for `app.js` and `films-components.js`; focused `previewActions.test.js` 105 passing with 1 pending legacy-encoding assertion; full Mocha 404 passing with 1 pending; headless Chrome smoke confirmed `## 1 / # 你好` switches with no duplicate rendered/source heading.
- hot-path: Film Detail active patching should keep `[data-film-detail-page]` root/backdrop stable; cross-surface switches must commit pending notes/metadata/image edits before opening the next overlay.
- current-boundaries: do not redesign global shell/theme/sidebar/topbar; do not touch unrelated media modules for Films polish; do not recreate parallel history markdown files.
- open-loop: full authenticated live-app hand test is still not assumed; component-level browser smoke is documented for My Notes active heading cases.
- source-truth: exact retired history prose is in git history; current operational truth should be updated here after meaningful tasks.
- next-write-rule: append compact Work Log, add Decision Capsule only for reusable reasoning, then update this Tail Capsule.
