# Collaboration Record

| Time (Asia/Shanghai) | Task | Notes |
| --- | --- | --- |
| 2026-04-05 23:49 | Media library collections flow + live storage card | Removed duplicated `Albums` sidebar entry, changed `Collections` into an album-category view that opens a single album before showing photos, and replaced the hardcoded storage card values with live data from `/api/manage/quota` plus `/api/manage/sysConfig/upload`. |
| 2026-04-06 00:10 | Album detail add-photos flow | Added `Add photos` / `Add from library` entry points inside album detail, introduced a dedicated pick-from-uploaded-library mode for the current album, and let selection confirm directly back into that album instead of forcing a manual round-trip through the main photo stream. |
| 2026-04-06 00:16 | Repository remote switch | Updated local `origin` from `https://github.com/Aschenbath/leosDrive.git` to `https://github.com/Aschenbath/SUNDOWNER.git` so future pushes target the new repository. |
| 2026-04-06 11:13 | Telegram one-shot album command | Added Telegram sync support for `/album <path>` command messages that classify only the next single media post or the next whole `media_group_id` album into a scoped import path, while ordinary direct photo posts still fall back to the channel default import directory. |
| 2026-04-06 12:38 | Media library preview + collection visibility pass | Switched preview modals to use the full media source inside an adaptive centered stage, added a dedicated `Videos` browse filter, and hid album-classified media from non-`Collections` views so one-shot Telegram `/album` imports only surface inside album collections. |
| 2026-04-06 12:48 | Collection visibility regression fix | Corrected the collection filter to key off explicit collection assignments (`TgAlbumPath` / local album assignment) instead of the generic display `album` label, so default-root historical photos stay visible in `Photos` while only truly classified items move into `Collections`. |
