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
- latest-state: 2026-May-11 19:54; `app.js?v=257`, `films-components.js?v=59`, `media-library.css?v=241`.
- latest-validation: syntax checks, `git diff --check`, targeted Films Mocha 149 passing.
- hot-path: Film Detail active patching should keep `[data-film-detail-page]` root/backdrop stable and patch targeted children.
- current-boundaries: do not redesign global shell/theme/sidebar/topbar; do not touch unrelated media modules for Films polish.
- open-loop: browser/manual QA is not assumed unless explicitly documented.
- archive: raw pre-rewrite table is `history.archive\2026-May-raw.md`.
- next-write-rule: append compact Work Log, add Debug Capsule only for reusable reasoning, then update this Tail Capsule.
