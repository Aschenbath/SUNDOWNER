# SUNDOWNER History

Last compacted: 2026-05-11

This file is the working memory for the active SUNDOWNER repo. It keeps current-stage details that are too specific for `D:\Codex\CodexRules.md`, but it should stay small enough for agents to read cheaply.

## Read Protocol

- Default quick read: read the final `Tail Capsule` first, usually with `Get-Content history.md -Tail 12`.
- If the task touches current work, read the latest day section after the tail.
- If the task mentions an older feature, use `rg "<keyword>" history.md history.archive Function_History.md`.
- Full-read raw archives only when exact old evidence is needed.
- Do not treat archived diagnosis as current truth without checking the live code/state.

## Scope Map

- Long-term milestones and stable baselines: `D:\Codex\CodexRules.md`.
- Current project working memory: this file.
- Feature changelog: `Function_History.md`.
- Raw pre-compaction history: `history.archive\2026-May-raw.md`.

## Write Protocol

- Append new task results under `Active Chronicle > Year > Month > Day`.
- Keep one `Work Log` item to one compact line where possible: time, tags, files/area, result, cache, validation.
- Add a `Debug / Decision Capsule` only for reusable reasoning: `Symptom / Cause / Fix / Guard`.
- Keep `Open Loops` honest; mark partial and unverified items explicitly.
- After each meaningful task, update the final `Tail Capsule` so default tail reads stay useful.
- Move verbose runs, screenshots, full command output, and long old logs to `history.archive/`.

## Active Chronicle

### 2026

#### May

##### 11th

###### Work Log

- 23:52 | [films][ticket-meta] Corrected Films ticket-card metadata typography after oversized values: Release keeps dot-separated emphasis, Locale/Watched stay compact and clamped, and overall ticket layout remains unchanged. Cache: `app.js?v=264`, `components.js?v=97`, `films-components.js?v=66`, `films-data.js?v=7`, `media-library.css?v=248`. Validation: syntax checks, `git diff --check`, focused Films/light CSS Mocha 31 passing, full Mocha 394 passing.
- 22:57 | [films][notes][rating][search] Fixed Film Detail notes line editing so Enter/beforeinput creates new note lines while respecting IME composition; rating keeps 0.1 score precision while star visuals quantize to half-stars and ticks are quieter; Films search label removed, native search cancel icon hidden, and custom entry now appears after the first three TMDb results. Cache: `app.js?v=261`, `components.js?v=94`, `films-components.js?v=63`, `films-data.js?v=7`, `media-library.css?v=245`. Validation: syntax checks, `git diff --check`, focused Films/light CSS Mocha 30 passing, full Mocha 393 passing.
- 22:26 | [films][search][rating] Films index entry collapsed into local-first search with TMDb/custom add results; manual custom result opens a titled draft; Remove from Films now confirms before delete; My rating control has always-visible ticks/current value and half-star slider steps with live star-fill feedback. Cache: `app.js?v=260`, `components.js?v=93`, `films-components.js?v=62`, `films-data.js?v=7`, `media-library.css?v=244`. Validation: syntax checks, `git diff --check`, targeted Films Mocha 9 passing, full Mocha 391 passing.
- 21:31 | [films][search][backdrop] Films index library search now checks saved films first and only auto-opens TMDb add search when the whole local library has no match; detail secondary tools reveal only from the top-right hover/focus zone; backdrop defaults/reset/legacy saved defaults normalize to zoom `0.5` and opacity `0.92`; image picker backdrop preview/frame layout cleaned. Cache: `app.js?v=259`, `films-components.js?v=61`, `media-library.css?v=243`. Validation: syntax checks, `git diff --check`, targeted Films Mocha 8 passing, full Mocha 391 passing.
- 20:47 | [films][detail-ux] Moved saved-film metadata and image pickers into anchored detail overlays; added poster/backdrop contextual controls, line-based hybrid Markdown notes editing, visible watch-date editing affordance, and restored real `watching` status semantics. Cache: `app.js?v=258`, `films-components.js?v=60`, `films-data.js?v=7`, `media-library.css?v=242`. Validation: syntax checks, `git diff --check`, full Mocha 390 passing.
- 19:54 | [films][detail-editing] Kept Synopsis editing in-place as a full-width detail surface; simplified Notes editing to one writing surface with no live-preview panel or instructional autosave copy. Cache: `app.js?v=257`, `films-components.js?v=59`, `media-library.css?v=241`. Validation: syntax checks, diff-check, targeted Films Mocha 149 passing.
- 19:37 | [history][memory] Compacted project `history.md` into quick-read format: read protocol, scope map, active chronicle, archive index, and bottom Tail Capsule. Raw pre-compaction table preserved at `history.archive\2026-May-raw.md`. Validation: tail check, archive size check, cached diff-check.
- 19:11 | [films][detail][surgical] Removed visible Synopsis block and redundant labels; moved synopsis under Director/Release/Runtime row; flattened image tools into quiet Poster/Backdrop controls; removed More/Open TMDb detail affordance. Cache: `app.js?v=256`, `films-components.js?v=58`, `media-library.css?v=240`. Validation: syntax checks, diff-check, targeted Films Mocha 149 passing.
- 18:34 | [films][detail][refresh] Removed redundant lower action row; shrank More to image/TMDb popover; saved TMDb details auto-refresh silently once per session; backdrop frame slider live-previews picker thumbnail and active detail backdrop. Cache: app 255, films 57, css 239. Validation: targeted Films Mocha 149 passing.
- 16:27 | [films][patching] Fixed visible detail refresh: active Film Detail patching now reuses mounted root/backdrop and patches targeted children. Removed visible `Watching` while keeping legacy values compatible as `Want`; added country/language support through normalization/search/edit fields. Cache: app 254, films 56, data 6. Validation: targeted Films Mocha 149 passing.
- 15:06 | [films][notes][backdrop] Removed notes toolbar/Preview toggle; kept live Markdown feedback; added pointer-down-origin guards so text selection does not trigger outside autosave; persisted `backdropOpacityOverride`; removed prominent Apply button for custom image URLs. Cache: app 253, films 55, css 238. Validation: targeted Films Mocha 149 passing.
- 14:25 | [films][backdrop-ui] Backdrop picker open/close now uses a short reveal/closing state; frame slider updates are requestAnimationFrame-batched with last-drag flush before save; range controls gained larger thumbs and live fill. Cache: app 252, films 54, css 237. Validation: targeted Films Mocha 149 passing.
- 14:07 | [films][backdrop-frame] Backdrop fitting moved to JS pixel positioning; zoomed-out images anchor top instead of exposing blank space; removed geometry transitions from frame positioning. Cache: app 251, css 236. Validation: targeted Films Mocha 148 passing.
- 13:48 | [films][detail-editing] Backdrop framing now computes natural image/container sizing; Synopsis editor stays in place; notes and metadata edit entry patch active detail locally; notes surface sizing is stable. Cache: app 250, films 53, css 235. Validation: targeted Films Mocha 147 passing.
- 13:23 | [films][rating][backdrop] Visible rating language is `My rating`; backdrop zoom supports 0.5-1.8; frame fields are split from metadata patches so ordinary edits cannot mutate saved frame overrides. Cache: app 249, films 52, css 234. Validation: targeted Films Mocha 147 passing.
- 12:46 | [films][layout] Restored lower diary placement after hero; removed TMDb rating copy from detail/cards; added saved backdrop zoom/move sliders with persistence through `UserMovieEntry`. Cache: app 248, films 51, css 233. Validation: targeted Films Mocha 146 passing.
- 12:13 | [films][diary] Lower body became two-column diary grid: Watch history + Private signals on left, Synopsis + larger My notes editor on right. Cache: app 247, films 50, css 232. Validation: targeted Films Mocha 146 passing.
- 10:34 | [films][notes] Rendered notes section became the editable surface; Enter/Space enters edit; rendered Markdown links still open normally. Cache: app 246, films 49, css 231. Validation: targeted Films Mocha 137 passing.
- 10:05 | [films][acceptance] Films index defaults to saved-library mental model; `Search my films` primary, `Add from TMDb` deliberate expandable flow, `Add manually` separate; Edit Details opens compact shortcut panel; status/action language normalized. Cache: app 245, films 48, data 5, css 230. Validation: targeted Films Mocha 137 passing.
- 00:52 | [films][ux-cleanup] Final Films cleanup kept layout/theme/sidebar/topbar stable; focused inline field editing; image picker autosaves pending URL before close; removed unused `mockFilmRecords`. Cache: app 244, films 47, css 229. Validation: targeted Films Mocha 137 passing.
- 00:18 | [films][manual-data] `MovieRepository.saveOrUpdateUserEntry()` now resolves `source` from existing entries for id-only patches; manual films update without `tmdbId`; explicit `source: "manual"` stays local even if stray `tmdbId` exists. Cache: app 243.

###### Debug / Decision Capsules

- [films-detail-refresh] Symptom: saving in Film Detail looked like a mysterious page refresh. Cause: patch path replaced the whole `[data-film-detail-page]`. Fix: reuse mounted root/backdrop and patch targeted children/status. Guard: previewActions + lightChromeCss targeted tests.
- [films-backdrop-frame] Symptom: zoom/position sliders felt delayed and could expose blank space. Cause: CSS percentage/object-fit interactions and animated geometry. Fix: calculate fitted image dimensions in JS, position in pixels, batch slider updates, and flush before save. Guard: targeted Films Mocha plus visual/manual check when available.
- [films-notes-edit] Symptom: editing notes felt too tool-like and could exit during text drag. Cause: toolbar-heavy editor and outside-click logic without pointer origin. Fix: live rendered Markdown feedback, no visible toolbar, pointer-down-origin guards.
- [films-source-model] Manual and TMDb films must keep one detail/control experience while preserving different persistence rules: TMDb uses MovieCache + `tmdbId`; manual uses `UserMovieEntry` only.

###### Open Loops

- Browser/manual QA is not assumed unless explicitly documented.
- Keep Films follow-up work surgical unless Gilbert reopens broader visual redesign.
- For visual regression, compare against accepted Films Detail anchor `353e771` before making broad CSS changes.

##### 12th

###### Work Log

- 18:02 | [films][diary-ux] Removed remaining Detail/UI admin vocabulary from Films surfaces and tightened natural diary actions: rating is a direct star control with local unsynced state, Personal no longer exposes Status/Last watched, Watch owns Mark watched/Rewatch/Move to Want, cards hide empty rating/locale placeholders, search/add copy is source-neutral, and Move to Want clears `watchedAt` while preserving complex watch history conservatively. Cache: `app.js?v=272`, `components.js?v=98`, `films-components.js?v=70`, `films-data.js?v=7`, `media-library.css?v=251`. Validation: Node syntax checks for changed JS modules; focused `previewActions.test.js` 100 passing; focused movies/repository 40 passing; full Mocha 399 passing with Node 22; `git diff --check`.
- 14:43 | [films][saving-ux] Converted Film Detail small mutations to quiet optimistic/background persistence: entry patches no longer show global `Saving...` by default, image picker close/Escape commits URL/frame drafts in the background, backdrop frame focus/change saves are nonblocking, rating/date/status/favourite/watch-history use the shared entry patch path, and refresh/remove/manual creation keep explicit safety commits. Cache: `app.js?v=271`, `components.js?v=98`, `films-components.js?v=69`, `films-data.js?v=7`, `media-library.css?v=250`. Validation: `app.js` syntax check, `git diff --check`, focused `previewActions.test.js` 100 passing, focused movies/repository 40 passing, full Mocha 399 passing with Node 22.
- 13:58 | [films][tests] Added focused regression coverage for two post-`353bd43` UX/data contracts without changing runtime UI: explicit empty metadata overrides clear back to TMDb fields while preserving private local state, and TMDb search cards restore add actions after saved state is removed. Validation: focused `movieRepository.test.js` + `previewActions.test.js` 126 passing; full Mocha 399 passing with Node 22.
- 13:49 | [films][backdrop][watch-history] Rechecked latest `353bd43` Films breakpoints and hardened only new risks: `watchedAt` PATCH now distinguishes absent/null/empty-string, backdrop frame sync now observes detail/picker container resizes in addition to image load/slider/window resize, rapid film patches are queued per film with stale response guards, and cache moved to `app.js?v=270`. Validation: syntax checks, `git diff --check`, focused Films/movie tests 138 passing, full Mocha 397 passing with Node 22, headless Chrome geometry QA for wide/portrait-ish/square-ish backdrop images.
- 10:46 | [films][picker][responsiveness] Tightened Film Detail image-picker responsiveness: close/escape/autosave paths now enter a closing state immediately, backdrop/poster selection and reset mark saving before async persistence, and the backdrop picker close button no longer feels dead while waiting on URL/frame commits. Cache: `app.js?v=267`, `components.js?v=98`, `films-components.js?v=68`, `films-data.js?v=7`, `media-library.css?v=249`. Validation: Node syntax check for `app.js`; `git diff --check`; focused `previewActions.test.js` + `lightChromeCss.test.js` 108 passing.
- 12:38 | [films][contracts][backdrop] Stabilized Films prop contracts and rating helpers, removed dead hardcoded/generic note fallback helpers, mapped movies API errors to specific status codes, made watchedAt clearing conservative around manual watch history, and made backdrop Move X/Y disable when the current frame has no pan room instead of acting dead. Cache: `app.js?v=268`, `components.js?v=98`, `films-components.js?v=69`, `films-data.js?v=7`, `media-library.css?v=250`. Validation: Node syntax checks for changed JS modules; `git diff --check`; focused `previewActions.test.js` + `movieRepository.test.js` + `moviesRoute.test.js` 137 passing.
- 10:18 | [perf][startup] Audited media-library startup and tightened low-risk first-load behavior: added opt-in `?cmlPerf=1` performance marks/table for script, storage, route restore, first render, library sync, and Films entries fetch; stopped mount-time album/playlist/films/storage/live-sync tasks from each force-rendering the shell; deferred Films warmup to idle; changed non-critical media-grid and Films index posters to lazy/async loading while keeping detail hero media eager. Cache: `app.js?v=266`, `components.js?v=98`, `films-components.js?v=68`, `films-data.js?v=7`, `media-library.css?v=249`. Validation: Node syntax checks for `app.js`, `components.js`, and `films-components.js`; `git diff --check`; focused `previewActions.test.js` + `lightChromeCss.test.js` 108 passing; full Mocha 394 passing.
- 00:38 | [films][detail][overlay] Tightened Film Detail to contextual overlays only: backdrop tool is now a hero hotspot, refresh/remove moved into metadata shortcuts, private signals use calm text rows, metadata draft reuse no longer resets mid-edit, and cross-surface autosave now commits before switching so notes/metadata/image pickers stop getting stuck in fake-open states. Cache: `app.js?v=265`, `components.js?v=97`, `films-components.js?v=67`, `films-data.js?v=7`, `media-library.css?v=249`. Validation: Node syntax checks for `app.js` and `films-components.js`; `git diff --check`; focused `previewActions.test.js` 5 passing; `lightChromeCss.test.js` 9 passing.

###### Debug / Decision Capsules

- [startup-perf] Initial slowness is dominated by big client-side work, not a single blocking Films call: `app.js` parse/execute plus first render building the full view model, then startup async tasks (`/api/manage/albums`, `/api/manage/playlists`, `/api/manage/movies?action=entries`, storage summary, live media sync) each causing extra early renders. Fix: render shell first, drop mount-time `forceRender` fan-out, move Films warmup to idle, and lazy-load non-critical posters/thumbnails. Guard: opt-in `?cmlPerf=1` measures and existing full Mocha suite.
- [films-detail-surface-transitions] Symptom: switching from notes/metadata/image picker into another Film Detail action could leave stale edit surfaces or visible jank. Cause: outside-click autosave skipped many Film actions and the click hit-tests only checked the first matching overlay node. Fix: always commit pending film edits before surface switches and treat metadata/image picker overlays as multi-node surfaces when checking click containment. Guard: focused previewActions assertions plus syntax/diff checks.
- [films-backdrop-pan-controls] Symptom: Move X/Y sliders appeared interactive while doing nothing on some backdrop frames. Cause: the current fit math has no horizontal/vertical overflow at some zoom/aspect combinations, so there is no crop area to pan. Fix: compute `canPanX/canPanY` from fitted image dimensions and disable the corresponding slider until panning can affect the image.

##### 10th

###### Work Log

- [films][manual] Manual entries landed as first-class saved films: optimistic create, per-entry request queue, Remove with Undo, local saved-library search, and no TMDb credential requirement.
- [films][acceptance] Empty manual drafts were blocked/discarded; Add from TMDb vs Search my films split; TMDb Load More appends; refresh preserves private fields and local overrides.
- [films][detail-actions] Detail More actions covered edit metadata, poster/backdrop picker, force refresh, Open TMDb, and optimistic Remove with Undo.
- [films][watch-history] Watch events gained stable ids and multiple private watch dates; user ratings stayed local-only 5-star half-step values.
- [films][backdrop] TMDb backdrops auto-rotate from MovieCache; local backdrop override remains highest priority and disables rotation.
- [films][rollback] Accepted Film Detail rollback anchor became commit `353e771` after failed full-panel backdrop experiments.
- [codex-cli] Launcher-backed Codex CLI verified as `0.130.0`; global npm alone is not enough on this machine.

###### Debug / Decision Capsules

- [manual-create-race] Symptom: first edit after manual create could race the create request. Fix: await per-entry create promise before first patch.
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

###### Debug / Decision Capsules

- [tmdb-credentials] Missing TMDb credentials should surface as clear env-var guidance near the Films search controls, not as generic `/api/manage/movies` 503 feedback below the fold.
- [file-stale-metadata] Stale metadata plus missing remote object is a user-facing 404, not a server 500.

##### 8th

###### Work Log

- [cloudflare][incident] Homepage/document 500s were isolated through Pages Functions packaging, static artifact, exifr, Sentry, and `.gz` layers.
- [films][visual] Films grid card moved toward an editorial movie-diary card before later TMDb/MovieRepository work.

##### 5th

###### Work Log

- [films][card] Films card readability and poster cleanliness were corrected: status badge and unrated `0.0` placeholders removed from grid-card poster area.

## Archive Index

- `history.archive\2026-May-raw.md`: raw pre-compaction collaboration table from the old `history.md`; preserves verbose work traces from May 2026 before this compact format.

## Tail Capsule

- read-protocol: start with `Get-Content history.md -Tail 12`; then read latest day if the task touches current work.
- current-focus: Films detail UX polish, surgical changes only.
- latest-state: 2026-May-12 10:18; `app.js?v=266`, `components.js?v=98`, `films-components.js?v=68`, `films-data.js?v=7`, `media-library.css?v=249`.
- latest-state: 2026-May-12 12:38; `app.js?v=268`, `components.js?v=98`, `films-components.js?v=69`, `films-data.js?v=7`, `media-library.css?v=250`.
- latest-state: 2026-May-12 14:43; `app.js?v=271`, `components.js?v=98`, `films-components.js?v=69`, `films-data.js?v=7`, `media-library.css?v=250`.
- latest-state: 2026-May-12 18:02; `app.js?v=272`, `components.js?v=98`, `films-components.js?v=70`, `films-data.js?v=7`, `media-library.css?v=251`.
- latest-validation: Node syntax checks for changed JS modules; `git diff --check`; focused `previewActions.test.js` 100 passing; focused `movieRepository.test.js` + `moviesRoute.test.js` 40 passing; full Mocha 399 passing with Node 22; bad-copy grep only leaves internal/backend TMDb matching and unrelated non-Films Saving strings.
- hot-path: Film Detail active patching should keep `[data-film-detail-page]` root/backdrop stable, and cross-surface switches must commit pending notes/metadata/image edits before opening the next overlay.
- current-boundaries: do not redesign global shell/theme/sidebar/topbar; do not touch unrelated media modules for Films polish.
- open-loop: browser/manual QA is not assumed unless explicitly documented.
- archive: raw pre-rewrite table is `history.archive\2026-May-raw.md`.
- next-write-rule: append compact Work Log, add Debug Capsule only for reusable reasoning, then update this Tail Capsule.
