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
- current-focus: Films detail UX polish and memory hygiene, surgical changes only.
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
