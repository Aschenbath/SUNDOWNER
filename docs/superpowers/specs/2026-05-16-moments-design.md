# Moments Design

## Goal

Add a first-class `Moments` surface to the SUNDOWNER dashboard that matches the supplied dark diary-style mockup while keeping the existing global shell intact. Moments should let Gilbert publish a post with body text, photos, and a server-side post timestamp. The right rail keeps a calendar above a photo wall that shows photos attached to posts published on the selected day.

## Scope

In scope:

- Add `Moments` to primary navigation.
- Add a D1-backed Moments API and repository/store.
- Support publishing body text plus up to 9 uploaded photos in one request.
- Store uploaded photos as normal media-library files under `Moments/YYYY-MM-DD/` and attach their `file_id`s to the post.
- Render a Moments page with publisher, post feed, calendar, and selected-day photo wall.
- Use post `created_at` as the only date source for calendar dots and the selected-day photo wall.
- Preserve draft text and local photo previews when publishing fails.

Out of scope:

- Mood and location fields.
- Comments, likes, sharing, public/social behavior, or notifications.
- Deleting underlying media-library photos when a Moment is deleted.
- Reworking the global header/sidebar shell.

## Architecture

### Backend

Add a focused Moments repository around `env.img_d1`; Moments does not fall back to KV. If D1 is not configured, the API returns a clear `503` JSON response.

D1 schema:

```sql
CREATE TABLE IF NOT EXISTS moments_posts (
  id TEXT PRIMARY KEY,
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS moment_attachments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (post_id) REFERENCES moments_posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_moments_posts_created_at ON moments_posts(created_at DESC, id ASC);
CREATE INDEX IF NOT EXISTS idx_moment_attachments_post ON moment_attachments(post_id, sort_order ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_moment_attachments_file ON moment_attachments(file_id);
```

`/api/manage/moments` supports:

- `GET`: list posts newest-first, including attachment file metadata needed for rendering. Optional `date=YYYY-MM-DD` filters posts by post timestamp date. Optional pagination can use `page` and `pageSize` with conservative defaults.
- `POST`: accepts multipart form data with `body` and `photos[]`. It rejects requests where body and photos are both empty, rejects non-image files, and caps photos at 9. It uploads each photo into the normal media-library file store using existing upload logic with `uploadFolder=Moments/YYYY-MM-DD`, then creates the D1 post and attachment rows.
- `DELETE?id=<postId>`: deletes only the post and attachment rows. It does not delete the underlying files from the media library.

### Publishing flow

Publishing is one user action and one Moments API request. The server owns the upload-plus-post sequence so the client does not have to manually retry separate upload and save steps.

If a late step fails after one or more photos were uploaded, the post is not returned as complete. Already-uploaded photos remain recoverable in the media library rather than being silently deleted. The frontend keeps the local draft body and local image previews so Gilbert can retry without rebuilding the draft.

### Frontend

Add `Moments` as a primary nav item. The route renders inside the existing dashboard shell and leaves global header/sidebar behavior untouched.

State additions:

- `momentsPosts`
- `momentsLoading`
- `momentsPublishing`
- `momentsDraftBody`
- `momentsDraftFiles`
- `momentsSelectedDate`
- `momentsCalendarMonth`
- `momentsError`

Components:

- `MomentsView`: page composition.
- `MomentsComposer`: textarea, photo picker, selected-photo preview strip, publish button.
- `MomentsFeed`: post cards with author/profile, timestamp, body, and image grid.
- `MomentsCalendar`: month navigation, selected date, and dots for dates with attached photos.
- `MomentsDayWall`: right-lower photo wall for the selected date.

## UI and interaction

Desktop layout follows the mockup:

- Main content area: `Moments` heading, short subtitle, composer, then the post feed.
- Right rail: calendar at the top, selected-day photo wall below it.
- The right-lower photo wall shows photos from posts whose `created_at` falls on the selected calendar date.
- Calendar defaults to today. If today has no photos, the wall shows an empty state and the feed still shows all posts.
- Clicking a calendar date changes only the selected-day wall. The main feed remains newest-first across all posts to avoid disorienting jumps.
- Dates that have posts with photos show a small dot.

Post cards:

- Use the current admin/profile name and avatar when available.
- Show `YYYY-MM-DD HH:mm` as the post time.
- One image displays large; two to four images use a compact grid; more than four shows a `+N` overlay on the fourth tile.
- Clicking an image opens the existing preview modal using the attached media item.

Composer:

- Body text can be empty only when at least one photo is selected.
- Up to 9 image files can be selected.
- Non-image files are blocked before submit and also rejected server-side.
- Publish button uses a clear busy state and prevents duplicate submission.
- Failed submit keeps body and local previews in place.

Mobile layout is a safe single-column version: composer, calendar, selected-day photo wall, then feed. It avoids sticky side rails or mobile shell changes.

## Data consistency and error handling

- D1 is the Moments source of truth. KV list is never used for Moments queries.
- Post timestamp is generated server-side at create time.
- The API validates all boundary inputs: body length, file type, file count, date format, page size, and post id.
- Delete removes only D1 Moments rows.
- If attachments cannot be written, the response does not claim a complete post.
- The client treats publish as a state machine: `idle -> publishing -> success | failed`.
- On failure, the composer draft remains intact and a visible error explains that the draft can be retried.
- Moments load failures show a route-level empty/error state without breaking other dashboard routes.

## Testing and verification

Backend tests:

- Schema initialization creates Moments tables and indexes.
- `POST` rejects empty body with no photos.
- `POST` rejects non-image files.
- `POST` accepts multipart body plus image files and returns a post with attachments.
- `GET date=YYYY-MM-DD` filters by post `created_at` date.
- `DELETE` removes the post and attachments without deleting file metadata.
- D1-missing environments return a clear `503` for Moments.

Frontend tests:

- `Moments` appears in primary navigation.
- Moments route renders composer, calendar, and day wall.
- Composer busy state prevents double submit.
- Failed publish preserves text and local image previews.
- Calendar dots are derived from post dates.
- Selected date changes the day wall without filtering the main feed.

Verification commands:

- Syntax-check touched JS files with the project Node binary.
- Run focused Moments tests.
- Run the full Mocha suite with Node 22 when native dependencies are involved.
- Run a local browser smoke on `/dashboard#/moments` if the local dev server can start; otherwise record the blocker explicitly.

## Implementation boundaries

- Prefer new focused files for Moments backend logic instead of growing existing media store modules.
- Keep frontend changes surgical: add one route, route state, components, CSS, and event handlers.
- Do not touch global branding, header, sidebar layout, Films, Music, Mind, or album behavior except for adding the `Moments` nav item.
- Bump static cache query versions for changed frontend assets.
