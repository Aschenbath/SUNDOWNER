<div align="center">
  <img src="static/readme/banner.png" alt="SUNDOWNER banner" width="920" />

  <h1>SUNDOWNER / leosDrive</h1>

  <p>
    <strong>A private media library for the files, photos, films, moments, and notes that should stay yours.</strong>
  </p>

  <p>
    Cloudflare Pages Functions | D1/KV Hybrid | Telegram | Discord | R2 | S3 | Hugging Face
  </p>

  <p>
    <a href="#product-preview">Product Preview</a> |
    <a href="#what-it-does">What It Does</a> |
    <a href="#architecture">Architecture</a> |
    <a href="#quick-start">Quick Start</a> |
    <a href="#operator-notes">Operator Notes</a>
  </p>
</div>

## Product Preview

SUNDOWNER is more than an image bed. It is a compact private media cockpit: upload once, route files across storage backends, browse them as a library, recover Telegram imports, and keep metadata queryable without burning through KV list quota.

<p align="center">
  <img src="static/readme/dashboard.png" alt="Admin dashboard preview" width="920" />
</p>

<table>
  <tr>
    <td width="50%">
      <img src="static/readme/upload.png" alt="Upload screen" />
      <br />
      <strong>Upload without caring where the bytes land</strong>
      <br />
      Route files into Telegram, Discord, R2, S3-compatible buckets, or Hugging Face channels from one control surface.
    </td>
    <td width="50%">
      <img src="static/readme/public-gallery.png" alt="Public gallery screen" />
      <br />
      <strong>Library first, links second</strong>
      <br />
      Browse photos, videos, audio, files, albums, films, moments, and saved context as a real media space.
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="static/readme/customer-config.png" alt="Configuration screen" />
      <br />
      <strong>Config lives in the product</strong>
      <br />
      Manage auth, upload channels, WebDAV, public browsing, API tokens, quotas, and page behavior through system config.
    </td>
    <td width="50%">
      <img src="static/readme/status-page.png" alt="Status screen" />
      <br />
      <strong>Built for long-running libraries</strong>
      <br />
      D1-backed metadata, migration endpoints, recycle-bin flows, cache invalidation, and recovery tooling keep operations explicit.
    </td>
  </tr>
</table>

## What It Does

- Presents a private-first admin media library for images, videos, music, documents, albums, films, moments, and notes.
- Serves direct media URLs through `/file/...`, with backend-specific resolution for Telegram, Discord, R2, S3, and Hugging Face.
- Keeps metadata queryable through D1 while preserving KV compatibility for existing deployments.
- Supports global search over rich metadata such as filenames, tags, music fields, descriptions, and film records.
- Provides Telegram sync and migration helpers for imported channel media, including `file_id` recovery flows.
- Exposes optional public browsing, random media, WebDAV, API token, and dashboard surfaces when configured.
- Hardens auth and proxy boundaries with constant-time comparisons, fail-closed config handling, SSRF allowlists, referer checks, sensitive metadata stripping, and generic 5xx responses.

## Why This Fork Exists

The original Cloudflare ImgBed pattern is a useful starting point, but long-lived personal media libraries need a different center of gravity:

- KV `list()` is too expensive to be the normal listing/search path on free-tier deployments.
- Telegram imports are durable only when real `file_id` values are available, not just `file_unique_id`.
- File metadata must not become a secret store.
- Admin UX matters when the project becomes a daily media cockpit instead of a throwaway upload panel.

This fork pushes the project toward D1-backed metadata, safer credential boundaries, richer search, and a more library-shaped frontend.

## Architecture

```text
.
+-- functions/                 Cloudflare Pages Functions routes
|   +-- api/                   public and management APIs
|   +-- file/                  direct media serving
|   +-- upload/                upload and chunk-merge flows
|   +-- dav/                   WebDAV endpoint
|   +-- utils/                 database, auth, storage, sync, cache helpers
+-- js/media-library/          admin media-library frontend modules
+-- css/                       compiled and override styles
+-- database/                  local SQLite/D1 bootstrap SQL and migrations
+-- server/                    local Docker/Node runtime that emulates Pages Functions
+-- test/                      Mocha regression tests
+-- data/                      local persisted dev data
+-- static/                    static assets and README screenshots
```

Key backend files:

| File | Role |
| --- | --- |
| `functions/utils/databaseAdapter.js` | Selects KV, D1, or Hybrid mode and protects metadata writes. |
| `functions/utils/d1Database.js` | Owns D1 schema repair, indexed file queries, and settings operations. |
| `functions/utils/indexManager.js` | Manages legacy chunked indexes and index operation compatibility. |
| `functions/utils/mediaSecurity.js` | Resolves channel credentials and strips sensitive file metadata. |
| `functions/api/manage/sysConfig/upload.js` | Stores upload-channel configuration. |
| `functions/api/manage/migrate/kv-to-d1.js` | Migrates legacy KV metadata/settings into D1. |

## Data Model

The project uses these Cloudflare bindings by convention:

| Binding | Type | Purpose |
| --- | --- | --- |
| `img_url` | KV namespace | Legacy metadata, settings, index chunks, and fallback storage state |
| `img_d1` | D1 database | Preferred metadata/settings/query database |
| `img_r2` | R2 bucket | Cloudflare R2 file channel |

When both `img_url` and `img_d1` are present, the adapter runs in Hybrid mode. D1 handles queryable metadata, while KV remains available for compatibility and selected mirrored state.

Sensitive channel credentials must not be stored in per-file metadata. The adapter strips fields such as Telegram, Discord, S3, and Hugging Face tokens for non-`manage@` keys. Store channel credentials in system upload config (`manage@sysConfig@upload`) or environment variables, then associate files with `ChannelName`.

## Quick Start

Requirements:

- Node.js 22.x
- npm
- Cloudflare Wrangler for Pages local development
- Cloudflare resources for deployed use: KV `img_url`, D1 `img_d1`, and optionally R2 `img_r2`

Install dependencies:

```bash
npm install
```

The root install script also installs function dependencies for Cloudflare Pages builds:

```bash
npm run install
```

Run the Cloudflare Pages development server:

```bash
npm start
```

Wrangler starts on:

```text
http://localhost:8787
```

Run the local Node/Docker-compatible server:

```bash
npm run start:docker
```

Or run the container:

```bash
docker compose up -d
```

Docker maps the service to:

```text
http://localhost:7658
```

## Deployment

This repo does not depend on a checked-in `wrangler.toml`. Configure bindings in Cloudflare Pages project settings or your deployment pipeline.

Recommended production bindings:

- KV namespace: `img_url`
- D1 database: `img_d1`
- R2 bucket: `img_r2` if using Cloudflare R2

Common optional settings:

- `TG_BOT_TOKEN`: fallback Telegram bot token when upload config does not provide one.
- `FETCH_RES_ALLOWED_HOSTS`: explicit host allowlist for `/api/fetchRes`; leave unset to keep that proxy disabled.
- Admin/user auth, upload channels, WebDAV, public browsing, random API, API tokens, quotas, and page options are managed through system config APIs/UI and stored under `manage@sysConfig@...`.

After binding D1 to an existing KV-backed deployment, migrate legacy metadata in batches:

```text
POST /api/manage/migrate/kv-to-d1
```

The migration endpoint requires both `img_url` and `img_d1`. It skips internal chunk/index keys, can include settings, and records migration state under `manage@sysConfig@kvToD1Migration`.

## Testing

Run the Mocha suite:

```bash
npm test
```

Run integration-style tests with the local dev server:

```bash
npm run ci-test
```

Run Docker-style local server tests:

```bash
npm run ci-test:docker
```

For quick syntax checks on touched files:

```bash
node --check functions/utils/databaseAdapter.js
node --check js/media-library/app.js
```

Some local environments can fail the full suite because the native `better-sqlite3` binding is unavailable for the active Node runtime. Treat that as an environment baseline only after focused tests and failure titles confirm there are no new regressions.

## Operator Notes

- Avoid new code paths that depend on broad KV `list()` scans. Prefer D1 SQL queries or chunk-based `kv.get()` reads.
- Telegram `file_id` and `file_unique_id` are not interchangeable. Only the real `file_id` can be used with Telegram `getFile`.
- Keep credentials in upload config or environment variables, not in file metadata.
- If a route proxies third-party media, do not forward inbound `Authorization`, `Cookie`, or `authCode` headers.
- Keep cache-busted frontend module versions in `index.html`, `js/entry-loader.js`, and related tests synchronized.
- Existing screenshots live under `static/readme/`; replace them with current product captures when preparing a public release.

## License

This project keeps the upstream MIT license. See [LICENSE](LICENSE).
