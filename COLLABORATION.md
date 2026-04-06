# Collaboration Record

| Time (Asia/Shanghai) | Task | Notes |
| --- | --- | --- |
| 2026-04-05 23:49 | Media library collections flow + live storage card | Removed duplicated `Albums` sidebar entry, changed `Collections` into an album-category view that opens a single album before showing photos, and replaced the hardcoded storage card values with live data from `/api/manage/quota` plus `/api/manage/sysConfig/upload`. |
| 2026-04-06 00:10 | Album detail add-photos flow | Added `Add photos` / `Add from library` entry points inside album detail, introduced a dedicated pick-from-uploaded-library mode for the current album, and let selection confirm directly back into that album instead of forcing a manual round-trip through the main photo stream. |
