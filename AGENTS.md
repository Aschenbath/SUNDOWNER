# AGENTS.md - SUNDOWNER Agent Notes

## Documentation Map

- `AGENTS.md`: active agent instructions, current architecture guardrails, and repo navigation notes. Keep it concise and current; do not use it as a work log.
- `history.md`: the single project-memory file and task completion log. It absorbed the old `COLLABORATION.md`, `Function_History.md`, runtime-truth docs, and raw archive tables.
- `README.md` and `README_zh.md`: public product/operator documentation. Keep public-facing text privacy-safe and product-focused.
- `docs/`: durable standalone specs, audits, and plans only. Do not add parallel history files here.
- Git history: source for exact retired prose when old `COLLABORATION.md` or changelog wording is needed.

Do not recreate `COLLABORATION.md`, `Function_History.md`, runtime-truth docs, or archive tables as active documentation. Durable project memory belongs in `history.md`.

## Start Protocol

- Read `D:\Codex\codexRules.md` before project work, then read the tail of `history.md`.
- Treat older notes as context, not truth. Verify live code, routes, tests, and current config before editing.
- Keep the repository root limited to canonical entrypoints. `test/publicDocsContract.test.js` guards the root allowlist.
- For meaningful work, append a compact result entry to `history.md` and update its final Tail Capsule when useful.

## Completion Protocol

- Do not leave project state in chat only. For meaningful work, write a timestamped completion/result entry to `history.md` before the final user report.
- When the user provides stable project instructions or durable context, update the right source document directly (`AGENTS.md`, `history.md`, README/docs, or `D:\Codex\codexRules.md` for cross-project facts) instead of treating chat as the source of truth.
- Update the final Tail Capsule when the current state, validation baseline, or next follow-up changes.
- Check `D:\Codex\codexRules.md` after completion only for durable cross-project facts or user preferences; avoid duplicating one-off project logs there.

## Project Overview

SUNDOWNER is a Cloudflare Pages + Functions media library/dashboard. It supports Telegram, Discord, S3, R2, and HuggingFace-backed storage. KV stores file values/settings; D1 stores/query metadata when available; index chunks remain part of the rollback-compatible KV path.

## Critical Architecture Constraints

### 1. KV Metadata Sanitization

`functions/utils/databaseAdapter.js` sanitizes non-`manage@` writes through `stripSensitiveMetadata()`. These fields are stripped from per-file metadata:

```text
TgBotToken, TgProxyUrl, DiscordBotToken, DiscordProxyUrl,
S3AccessKeyId, S3SecretAccessKey, HfToken
```

Never store sensitive credentials in per-file metadata. Store upload credentials in `manage@sysConfig@upload`, or use environment variables. File records should link to channel config through safe fields such as `ChannelName`.

### 2. KV List Quota Risk

Cloudflare KV `list()` calls are quota-sensitive and can cascade into dashboard/bin/batch failures. Prefer D1 queries or chunk-based index reads such as `kv.get('manage@index_0')`. Avoid introducing `kv.list()` into normal request paths.

### 3. Telegram File Identifiers

- `file_id`: long, bot-bound, downloadable through Telegram `getFile`.
- `file_unique_id`: shorter, cross-bot identifier, not downloadable.
- `looksLikeTelegramFileId()` uses length >= 40 to separate the two.
- Batch sync imports can store `file_unique_id`; recovery may need `forwardMessage` to obtain a real `file_id`.

### 4. Telegram Credential Resolution

`functions/utils/mediaSecurity.js#resolveTelegramAccess(env, metadata)` resolves access in this order:

1. `metadata.TgBotToken` (usually stripped from file metadata).
2. `loadUploadConfig(env)` plus `findChannelByName(config.telegram, metadata.ChannelName)`.
3. `env.TG_BOT_TOKEN`.

Ensure at least one supported path exists before adding Telegram download or migration behavior.

### 5. API Token Storage

`manage@sysConfig@security.apiTokens.tokens` must not store raw API token strings. New records store `tokenHash`, `tokenSalt`, and `tokenHashAlgorithm: sha256-salted-v1`; token creation may return the raw token once for operator copy. Legacy records with a `token` field are read-compatible and migrate lazily on successful validation, management listing, or token metadata update. Do not reintroduce plaintext token persistence.

### 6. S3 CDN URL Trust

`functions/file/[[path]].js` must not blindly fetch per-file `metadata.S3CdnFileUrl`. Use `resolveS3CdnFileUrl(metadata, s3Access, fileId)` so S3 CDN reads stay under the current channel `cdnDomain`; untrusted or malformed metadata URLs must fall back to the channel-derived CDN path or S3 API.

### 7. Cloudflare Catch-All Params

Cloudflare Pages catch-all route params can appear as either a string or an array in tests/runtime adapters. Normalize `params.path` before indexing, decoding, or joining it; do not use `params.path[0]` unless the array shape has been verified.

### 8. Internal Proxy URL Construction

When a route proxies to another same-origin route with a user-derived path, encode each path segment before constructing the `URL`. Do not interpolate decoded paths containing `?`, `#`, or `&` into path/query strings. Existing regression anchors: folder delete/move list requests and WebDAV GET/DELETE internal proxies.

### 9. HuggingFace Direct Upload Commit Paths

`functions/upload/huggingface/getUploadUrl.js` generates direct-upload `filePath` values as `<directory>/<uuid>_<basename>`. `commitUpload.js` must reject client-supplied paths that do not match that generated path for the submitted `fullId`; otherwise an upload-capable client could commit LFS pointers to arbitrary HuggingFace repo paths.

### 10. Frontend CSS URL Contexts

Do not build CSS `url(...)` values with plain `escapeHtml()` or string interpolation. CSS string context is separate from HTML attribute context. Mind wallpaper rendering and live preview must use `renderCssImageUrl()` from `js/media-library/components.js`, which only emits safe `/file/`, `http(s)`, or strict base64 `data:image` URLs.

### 11. Direct File Access Policy

`/file/*` direct requests must not be bearerless by default. No-`Referer` requests are allowed only with a valid configured `authCode` header/cookie or the explicit legacy opt-out `access.allowBearerlessFileAccess: true` / `ALLOW_BEARERLESS_FILE_ACCESS=true`. Same-origin and allowed-domain `Referer` requests remain supported. Keep the fallback default `false`, and preserve stored opt-out state during partial security-config POSTs.

## Key Files

```text
functions/file/[[path]].js
  Direct file access endpoint: GET /file/...

functions/utils/databaseAdapter.js
  KV abstraction and sensitive metadata stripping.

functions/utils/indexManager.js
  Chunk-based file index management; avoid quota-heavy scans.

functions/utils/mediaSecurity.js
  Credential resolution helpers, including Telegram access.

functions/utils/telegramAPI.js
functions/utils/telegramFileId.js
  Telegram Bot API wrappers and file_id recovery helpers.

functions/api/manage/sysConfig/upload.js
  Upload config CRUD and runtime upload-config loading.

functions/api/manage/migrate/recover-tg-file-ids.js
  Telegram file_id migration/recovery endpoint.
```

## Known Project Risks

- Timestamp-named files such as `1775628424666_*.jpg` are not `tg_` keys, so message IDs cannot always be extracted automatically. `GET /api/manage/migrate/scan-orphan-files` can locate candidates, but automatic recovery is not guaranteed.
- `/file/*` direct URLs are no longer bearerless by default. Treat `ALLOW_BEARERLESS_FILE_ACCESS=true` / `access.allowBearerlessFileAccess: true` as a deliberate legacy compatibility opt-out.
- Raw secret exposure on upload/others config GET routes was fixed on 2026-07-07; preserve masked-placeholder round trips so admin edits do not clobber stored credentials.
- Upload IP attribution should trust only Cloudflare `CF-Connecting-IP`; do not reintroduce `X-Forwarded-For`, `X-Real-IP`, or caller-supplied proxy headers into blocklist or metadata decisions.
- API token plaintext-at-rest was fixed on 2026-07-07; preserve salted-hash storage and legacy lazy migration.
- Chunk upload status raw-error exposure was fixed on 2026-07-07; keep status responses and failure metadata generic while preserving internal server logs.
- `fetchRes` SSRF filtering blocks private/local IPv4, IPv6, bracketed IPv6, and IPv4-mapped IPv6 literals before any outbound fetch. Keep redirect re-validation in place for every hop.
