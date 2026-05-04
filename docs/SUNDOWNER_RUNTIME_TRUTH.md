# SUNDOWNER Runtime Truth

This file records how the current SUNDOWNER runtime actually works in this repo.

It is intentionally code-truth oriented, not product marketing.

## 1. Runtime entrypoints

### `/dashboard`
- `index.html` always loads:
  - `/js/entry-loader.js?v=3`
  - `/js/ui-overrides.js?v=10`
  - `/js/media-library/app.js?v=193`
  - `/css/media-library.css?v=170`
- `js/entry-loader.js` immediately returns for `/dashboard` and `/dashboard/*`.
- Result: `/dashboard` does **not** load legacy `chunk-vendors.8dadfdfd.js` or `app.f0825045.js?v=2`.
- `/dashboard` is the media-library shell only.

### `/login`
- `index.html` still loads `entry-loader.js` and `ui-overrides.js`.
- `js/entry-loader.js` special-cases `/login` and loads only:
  - `/js/login-app.js?v=2` as a module.
- `js/login-app.js` mounts a standalone login shell into `#app` and redirects to `/dashboard` after successful admin login.
- `/login` does **not** load legacy `chunk-vendors.8dadfdfd.js` or `app.f0825045.js?v=2`.

### Legacy/non-dashboard/non-login paths
- For paths other than `/dashboard*` and `/login`, `js/entry-loader.js` installs the legacy locale guard and then loads:
  - `/js/chunk-vendors.8dadfdfd.js`
  - `/js/app.f0825045.js?v=2`
- These remain the legacy runtime entry for old routes.

### Bundle boundary rule
- `/dashboard`: media-library runtime only.
- `/login`: standalone login shell only.
- legacy bundle only for legacy paths.

## 2. Version and cache rules

Current repo-truth versions:
- `index.html` app query: `/js/media-library/app.js?v=193`
- `index.html` css query: `/css/media-library.css?v=170`
- `js/media-library/app.js` imports:
  - `./components.js?v=88`
  - `./admin-runtime.js?v=1`

### When to bump what
- If `js/media-library/app.js` changes:
  - bump `/js/media-library/app.js?v=...` in `index.html`
  - sync `index.html.gz`
- If `js/media-library/components.js` changes:
  - bump `./components.js?v=...` inside `js/media-library/app.js`
  - then bump `/js/media-library/app.js?v=...` in `index.html`
  - sync `index.html.gz`
- If `js/media-library/admin-runtime.js` changes:
  - bump `./admin-runtime.js?v=...` inside `js/media-library/app.js`
  - then bump `/js/media-library/app.js?v=...` in `index.html`
  - sync `index.html.gz`
- If `css/media-library.css` changes:
  - bump `/css/media-library.css?v=...` in `index.html`
  - sync `index.html.gz`
- If only tests change:
  - no app/css query bump needed

### gzip sync rule
- Any `index.html` change requires regenerating `index.html.gz`.
- Do not leave `index.html` and `index.html.gz` out of sync.

## 3. Admin runtime and render path

### Render ownership
- DOM markup is owned by `js/media-library/components.js`.
- `AdminPanel` is exported from `components.js`.
- `AdminPanel` renders account/site/cloud/telegram tab bodies as HTML strings.

### Runtime ownership
- `js/media-library/app.js` owns the main state object and event delegation.
- `patchAdminOverlays()` in `app.js` renders Admin by calling:
  - `AdminPanel({ state, storageSummary: state.storageSummary })`
- `openAdminPanel(tab)` opens the panel and triggers `loadAdminPanelData()`.
- `closeAdminPanel()` closes it.
- Action dispatch for Admin still lives in `app.js` event routing.

### Extracted Admin helper module
- `js/media-library/admin-runtime.js` currently contains pure helper logic only:
  - `createEmptyAdminProfileDraft`
  - `createEmptyAdminPageDraft`
  - `createEmptyAdminCloudDraft`
  - `createAdminPageDraft`
  - `applyAdminPageDraftToConfig`
  - `createAdminCloudDraft`
  - `applyAdminCloudDraftToSettings`
  - `parseAdminRecoveryMatches`
- `admin-runtime.js` does **not** import `app.js`.
- It is intentionally dependency-light and behavior-pure.

### DOM contract guard
- `test/adminPanelDom.test.js` is the current Admin DOM contract guard.
- It locks:
  - Account tab real inputs
  - password inputs
  - `data-admin-field` names
  - placeholder contract
  - save button contract
  - site/cloud/telegram tab markers
- Future Admin runtime extraction should keep this test green at all times.

### Current note
- Admin visual CSS cleanup is paused.
- Do not keep micro-tuning Admin visuals while runtime extraction is in flight.

## 4. CSS ownership boundaries

### `css/media-library.css`
- Owns media-library component styling.
- This includes:
  - sidebar
  - topbar
  - preview
  - albums
  - admin panel
  - music/mind/private routes
- Component fixes should prefer landing here.

### `css/ui-overrides.css`
- Owns shell, branding, and global override behavior.
- This includes theme/page-level presentation and post-upstream overrides.
- It should **not** become the default place for media-library component repair.

### Boundary rule
- Avoid mixing branding override and component repair in one task.
- If a bug is inside AdminPanel/preview/sidebar/mobile nav component styling, prefer `media-library.css`.
- If a change is global shell/branding/theming/page-wrapper behavior, prefer `ui-overrides.css`.

## 5. Legacy boundary

- `/dashboard` must stay isolated from legacy bundles.
- `/login` is now a standalone new frontend shell.
- Legacy bundle should only serve legacy paths.

### Locale guard purpose
- `js/entry-loader.js` installs a temporary `JSON.parse` guard only on legacy paths.
- Purpose: tolerate corrupted legacy built-in locale payloads and prevent legacy startup crashes.
- This guard is **not** part of `/dashboard` runtime.

## 6. Testing and validation commands

Known-good commands used on this repo:

### Syntax checks
- `D:\DevTools\nvm\v24.11.1\node.exe --check js\media-library\app.js`
- `D:\DevTools\nvm\v24.11.1\node.exe --check js\media-library\components.js`
- `D:\DevTools\nvm\v24.11.1\node.exe --check js\media-library\admin-runtime.js`

### Focused frontend DOM tests
- `D:\DevTools\nvm\v22.14.0\node.exe .\node_modules\mocha\bin\mocha.js .\test\adminPanelDom.test.js`
- `D:\DevTools\nvm\v22.14.0\node.exe .\node_modules\mocha\bin\mocha.js .\test\adminRuntimeActions.test.js`
- `D:\DevTools\nvm\v22.14.0\node.exe .\node_modules\mocha\bin\mocha.js .\test\previewActions.test.js`

### Related tests worth running when touching runtime entry or theme wiring
- `D:\DevTools\nvm\v22.14.0\node.exe .\node_modules\mocha\bin\mocha.js .\test\entryLoader.test.js`
- `D:\DevTools\nvm\v22.14.0\node.exe .\node_modules\mocha\bin\mocha.js .\test\themeSystem.test.js`

### Full cheap suite entrypoint
- `npm test`
- Use with caution if the current task only needs targeted validation.

## 7. Deployment and sync caveats

### Manual query bump risk
- Query bumping is manual right now.
- Common failure mode: source changes land, but the live page still runs stale app/css because `index.html` query was not updated.

### `index.html.gz` sync rule
- After any `index.html` change, regenerate `index.html.gz` immediately.
- Do not assume deployment will regenerate it for you.

### Cloudflare Pages / repo sync notes visible in repo
- `.github/workflows/sync.yml` is an upstream fork sync workflow.
- It syncs from `MarSeventh/CloudFlare-ImgBed` when this repo is marked as a fork.
- Upstream workflow changes can pause automatic sync and require manual intervention.

### `wrangler.toml` status
- No `wrangler.toml` was found in the repo during recent audit.
- Do not invent one in docs or assume it exists.
- If deployment depends on external Pages settings, treat that as out-of-repo truth that should be verified separately.

## 8. Current safe next work

### Safe next work
- Continue Admin runtime extraction in small, reviewable steps.
- Keep `AdminPanel` render ownership in `components.js`.
- Keep DOM contract tests green while extracting runtime helpers/actions.

### Separate backend lane
- Chunk upload / merge reliability should be handled in a separate backend pass.
- Do not combine:
  - Admin UI/runtime work
  - upload backend work
  - route/legacy work
  - broad theme/CSS work
in one task.

### Do not mix in one task
- UI CSS tuning
- backend/API behavior changes
- route/entry changes
- upload pipeline changes

## 9. Current file/version truth snapshot

As of this document:
- `index.html`
  - `app.js?v=193`
  - `media-library.css?v=170`
- `js/media-library/app.js`
  - imports `./components.js?v=88`
  - imports `./admin-runtime.js?v=1`
- `js/entry-loader.js`
  - `/dashboard*` early return
  - `/login` loads `login-app.js?v=2`
  - legacy paths load `chunk-vendors.8dadfdfd.js` + `app.f0825045.js?v=2`
- `js/login-app.js`
  - standalone admin login shell
- `test/adminPanelDom.test.js`
  - Admin DOM contract guard
- `test/adminRuntimeActions.test.js`
  - pure Admin helper contract guard
