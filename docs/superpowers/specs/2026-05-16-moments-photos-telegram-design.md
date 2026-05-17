# Moments Photos + Telegram Design

## Goal

Extend Moments so a post can be created from either newly uploaded local photos or existing Photos library items, with both sources allowed in the same post. Also add Telegram-triggered Moments creation for image messages whose caption starts with `/moments`, while continuing to ingest those images into the normal Photos library.

## Accepted behavior

### Web Moments composer

- Keep the existing local upload path.
- Add a new `Choose from Photos` action beside upload.
- Allow the same draft post to contain a mix of:
  - newly uploaded images
  - existing Photos library images
- Existing Photos selections are references only:
  - no file duplication
  - no metadata duplication
  - the same `file_id` can appear in both Photos and Moments
- Removing a Moments post must not delete underlying files.
- Moments posts must become editable after creation.
- The edit surface should allow:
  - changing body text
  - reordering attachments
  - removing attachments
  - adding more attachments from either source
- Per-post attachment cap stays at 9.

### Telegram `/moments`

- Only image messages are eligible.
- Trigger condition: caption starts with `/moments`.
- Caption text after `/moments` becomes the post body.
- The attached images from that same message/media group become attachments on one Moments post.
- The same images still ingest into the normal Photos library first.
- If the caption is only `/moments`, create a photo-only post.
- If there are no images, do not create a Moments post.
- For media groups, the caption-bearing lead item controls the post body and the whole media group becomes one post.
- If more than 9 images are present, only the first 9 become attachments.
- Telegram-triggered post creation must be idempotent against message replay/retry.

## Non-goals

- No text-only `/moments` Telegram posting in this pass.
- No support for non-image Moments attachments.
- No duplication/copying of existing Photos assets into a Moments-only directory.
- No global cross-route picker refactor.
- No Telegram editing/sync-back of post edits.

## Data model

Keep the existing Moments persistence model:

- `moments_posts`
- `moment_attachments`

`moment_attachments` continues to store attachment references by `file_id`. It does not persist attachment source type. Source type is only draft-time UI state.

This keeps all final Moments rendering, preview, deletion, and hydration paths source-agnostic.

## API design

### `POST /api/manage/moments`

Continue using multipart form data and extend it with existing-library references.

Accepted fields:

- `body`
- `photos[]` for newly uploaded images
- `existingFileIds[]` for existing Photos references
- optional `postId` or dedicated edit route for updates, depending on implementation fit with current route conventions

Validation rules:

- reject if body is empty and total attachment count is 0
- reject if merged attachment count exceeds 9
- reject any `existingFileIds[]` that do not exist
- reject any `existingFileIds[]` that are not images
- reject uploaded files that are not images
- dedupe repeated `existingFileIds[]`
- dedupe final attachment ids after uploads complete

Processing order:

1. parse multipart payload
2. validate existing referenced file ids against the existing metadata store
3. upload new files through the existing upload pipeline
4. merge referenced ids + new upload ids into one ordered attachment list
5. create or update the Moments post
6. rewrite `moment_attachments` to match the final ordered list

### Edit route behavior

Moments posts must become editable. Preferred behavior:

- keep create and update under the same Moments API surface
- edits can update body and full ordered attachment list atomically
- attachment list replacement should be transactional from the Moments tables’ point of view
- underlying file records remain untouched

Recommended route shape:

- `POST /api/manage/moments` for create
- `PATCH /api/manage/moments?id=<postId>` for edit

If the existing codebase strongly prefers POST-with-action semantics, keep consistency with the codebase, but the behavior above is mandatory.

## Frontend design

### Draft attachment model

Replace the current upload-only draft file state with a unified draft attachment list.

Each draft attachment should include enough UI state for rendering and removal, with draft-only source information:

- `source: "upload" | "existing"`
- `draftId`
- `previewUrl`
- `name`
- `file` for upload items
- `fileId` for existing items
- `metadata`

The published post model remains normalized to regular attachment items hydrated from backend data.

### Moments composer UI

Keep the current Moments composer and add:

- `Choose from Photos` button
- editable existing post mode
- attachment reorder affordance if implementation cost remains reasonable within current component architecture; if not, use move-left/move-right controls instead of drag-and-drop

The composer should support two states:

- create mode
- edit mode for an existing post

Recommended minimal UX:

- click `Edit` on a Moments post to load its body and attachments into the composer
- composer header/status shows whether user is creating or editing
- `Save changes` replaces `Publish` in edit mode
- `Cancel edit` restores clean create mode without mutating the live post

### Photos picker UI

Do not reuse the global album/add-to-album picker flow.

Add a Moments-scoped overlay/sheet picker that:

- opens over the Moments route
- queries current accessible photo items from the existing media-library state model
- only lists photo items
- supports multi-select up to the remaining attachment capacity
- returns selected `file_id`s into the Moments composer draft
- does not change route hash
- does not reuse `albumSelectionTarget` / add-to-album workflow

Reason: the existing picker flow is route-coupled and built around album assignment, not post-draft composition. Reusing it would increase integration risk and create state collisions.

### Preview and rendering

Moments rendering remains attachment-based. Existing-library images referenced by Moments must continue to work with:

- image grid thumbnails
- preview open
- selected-day photo wall
- feed rendering

Because the final persisted attachment is still just `file_id`, existing preview/hydration mechanisms remain compatible once draft creation is normalized correctly.

## Telegram ingestion design

### Processing model

Telegram image ingestion remains the primary pipeline. Moments creation is an additional side effect.

Flow:

1. receive Telegram image message or media group
2. ingest images through the normal Telegram → Photos import path
3. if caption starts with `/moments`, derive Moments post payload from the same imported image ids
4. create one Moments post referencing those imported `file_id`s

This guarantees the requirement that Telegram `/moments` photos still appear in Photos.

### Media-group handling

If the current Telegram ingestion already aggregates media groups, attach Moments creation there.

If not, add a narrow grouping layer for `/moments` media groups only. The grouping key should use Telegram media group identity plus chat/message context.

The merged group should produce:

- one body string from the lead caption item
- one ordered list of image file ids
- one Moments post

### Idempotency

Telegram-triggered Moments creation must store or derive a stable dedupe key. Acceptable source identifiers include:

- chat id + message id
- media group id when present
- imported file ids plus lead message identity as a fallback

The dedupe marker should prevent duplicate post creation on webhook retries, polling replays, or partial ingestion retries.

## Error handling

### Web create/edit

- validation failures return user-facing errors and preserve draft state
- failed existing-file validation does not publish partial posts
- failed upload in create path does not create the post
- failed edit does not partially rewrite the post attachment order

### Telegram auto-posting

- if image import fails, do not create the Moments post
- if Photos import succeeds but Moments creation fails, keep the Photos import and log/report the Moments failure for retry or diagnosis
- duplicate replay should no-op, not error loudly

## Testing requirements

### Backend

Add focused tests for:

- mixed `existingFileIds[]` + `photos[]`
- referenced existing image validation
- reject referenced non-image files
- reject missing referenced files
- dedupe repeated references
- edit existing post body + attachments
- removing all attachments while keeping non-empty body
- Telegram-triggered create from single image message
- Telegram-triggered create from media group
- Telegram-triggered photo-only post
- Telegram replay/idempotency

### Frontend

Add focused tests for:

- unified draft attachment state
- adding existing Photos items into draft
- mixed-source draft rendering
- edit existing post into composer
- save edited post payload shape
- cancel edit restoring create mode
- picker capacity limit behavior

### Regression expectations

Full Mocha must continue to pass with the existing pending count unchanged unless explicitly explained.

## Implementation boundaries

Files likely involved:

- `functions/api/manage/moments.js`
- `functions/utils/momentsStore.js`
- Telegram import / ingestion entry points in `functions/**`
- `js/media-library/app.js`
- `js/media-library/components.js`
- `js/media-library/moments-state.js`
- `css/media-library.css`
- Moments route tests and any Telegram ingestion tests required by the current architecture

Avoid broad refactors outside these areas unless a small extraction is required to keep responsibilities clear.

## Recommendation

Implement this as one coherent Moments enhancement with two substreams:

1. Web mixed-source composer + post editing
2. Telegram `/moments` auto-posting on top of normal Photos ingestion

Build them on the same final attachment model so both paths converge to the same persisted post representation.