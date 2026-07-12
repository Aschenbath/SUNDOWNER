# Photo Loading Resilience Design

## Scope

Fix the Photos timeline failure state shown in the supplied screenshot, remove the layout instability around date groups, and use the same work to improve image-loading security, responsiveness, and retry interaction. This pass does not add a new backend thumbnail service or change storage-provider contracts.

## Current Failure Mode

Media tiles render image-specific inline `onerror` snippets in `components.js`, attach another set of load/error listeners in `app.js`, and retry failed images from the global click handler by appending another timestamp query parameter to the current URL. The split ownership creates races, stale `has-load-error` classes, repeated retry parameters, and inconsistent thumbnail-to-original fallback. The grid also relies on image dimensions arriving after render, which can leave unstable spacing around timeline headings.

## Design

Create a small pure `image-load-state.js` module that owns URL normalization and retry decisions. Render photos with declarative `data-*` attributes only; image load/error events remain delegated from `app.js`, which will clear stale failure state on success, try the original source once after a thumbnail failure, and then expose a bounded manual retry. Every manual retry starts from the canonical source URL, replaces the existing retry token, and records the attempt count.

Failed tiles remain visible and keyboard reachable. Their overlay reports the current action, and retrying changes the tile to a busy state so the user receives immediate feedback. After the retry budget is exhausted, the tile offers the existing preview/details path instead of retrying forever.

The media tile keeps a stable aspect-ratio derived from trusted width/height metadata, falling back to a neutral ratio until the browser reports intrinsic dimensions. Timeline/date headings remain outside the tile grid and must not share media-tile sizing rules.

## Security And Performance

- No new inline event-handler JavaScript is added; generic photo fallback moves into delegated code.
- Retry URL construction uses the `URL` API and only mutates a same-origin `/file/` URL or an already-approved rendered image URL.
- Automatic work is bounded: one thumbnail-to-original fallback and no retry loop. Manual retries are capped.
- Cached successful images preserve the existing no-flash behavior and progressive loading path.
- Stable tile sizing reduces layout shifts and repeated grid corrections.

## Testing

- Unit-test canonical retry URL generation, replacement of stale retry parameters, and retry limits.
- Source-contract test that photo markup no longer contains generic inline `onerror` fallback code and exposes canonical source data.
- Source/CSS contract test that success clears failure/busy state and failed tiles are keyboard actionable.
- Run the focused frontend suite, syntax checks, security regression tests relevant to file URLs, and `git diff --check`.

