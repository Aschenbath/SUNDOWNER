# SUNDOWNER Function History

> **Rules:**
> - Record every feature improvement to this project.
> - Format: `yy-mm-dd by who(codex/claude): description`
> - Append only. Never delete existing entries.

---

26-04-11 by claude: Add photo description editing with frontend + backend persistence (PATCH metadata endpoint, inline editing UI, save via blur/Enter)
26-04-11 by claude: Fix description save flash/flicker by replacing full render() with surgical DOM patching for toast notifications
26-04-11 by claude: Hide internal file names (IMG_0626.JPEG etc.) from all user-visible UI to prevent path-based attacks
26-04-11 by claude: Fix album-add click behavior — clicking a photo in selection mode now toggles selection instead of opening preview
26-04-11 by claude: Fix Telegram photos not showing — allow manual sync even when webhook is active (temporarily removes webhook, fetches updates, restores webhook)
26-04-11 by claude: Fix KV 413 Payload Too Large on Telegram sync — add metadata whitelist trimming to prevent EXIF overflow in KV's 1024-byte metadata limit
26-04-11 by claude: Refine album title editing UX — remove grey background, auto-save on blur, remove Save/Cancel buttons for clean inline editing
26-04-11 by claude: Move Delete Album button to topbar next to Add Photos and Upload
26-04-11 by claude: Support multiple album assignments per photo — change data model from single-value to array-value so photos can belong to multiple albums simultaneously
26-04-11 by claude: Fix album title button visible border caused by global ui-overrides.css !important rules
26-04-11 by claude: Move search bar from sidebar to topbar (same row as Upload/Add Photos) with pill-shaped focus-glow styling
26-04-11 by claude: Support searching photos by description text
26-04-11 by claude: Beautify album rename input — replace ugly bordered rectangle with subtle underline + glow animation
26-04-11 by claude: Reposition search bar to topbar far-left with space-between layout, remove redundant "ALBUM" eyebrow and "Album name" placeholder
26-04-11 by claude: Add mouse wheel zoom (cursor-anchored, 1-6x), double-click toggle zoom, and click-drag pan in preview modal for desktop users
26-04-11 by claude: Fix video tile performance — use Telegram thumbnail via ?preview=1 instead of downloading full video for poster frame
26-04-11 by claude: Implement blur-up progressive image loading — tiny Telegram thumbnail loads first as blurred placeholder, then swaps to full-quality image with smooth transition
26-04-11 by claude: Add fullscreen immersive mode toggle — expand/collapse button in preview header + keyboard shortcut 'e' to toggle immersive view
26-04-11 by claude: Add photo rotation in preview — rotate button + keyboard shortcut 'r', smooth 90° CSS transitions, auto-reset on navigate/close
26-04-11 by claude: Add PWA manifest with theme color (#101113) for installable web app support
26-04-11 by claude: Build custom upload flow with XHR progress bar — floating overlay shows per-file progress, file count, animated fill bar, auto-refresh library on complete
26-04-11 by claude: Enhance empty state with mode-specific SVG illustrations (landscape/album/frame) and floating animation
26-04-11 by claude: Polish timeline scrubber — active dot glow effect, smoother badge transition, larger touch targets via padding trick
26-04-11 by claude: Fix rotation overflow — rotated landscape images now scale to fit within preview bounds instead of overflowing
26-04-11 by claude: Fix immersive mode — add max-width/max-height overrides and CSS transition animation, use lightweight DOM patching instead of full re-render
26-04-11 by claude: Fix avatar menu click causing photo grid flicker — surgical DOM toggle instead of full innerHTML rebuild
26-04-11 by claude: Simplify description editing — Enter auto-saves (blur triggers save), Escape cancels, removed Save/Cancel buttons
26-04-11 by claude: Rebuild immersive mode as PPT-style fullscreen slideshow — pure black, all chrome hidden, only image + hover nav arrows, ESC exits immersive
26-04-11 by claude: Fix avatar menu flicker completely — surgical DOM insert/remove for both open and close, zero full re-renders
26-04-11 by claude: Fix admin dashboard and storage panel open/close causing photo grid flicker — patchAdminOverlays() surgically replaces only overlay DOM nodes, zero full re-renders for all admin panel operations
26-04-11 by claude: Remove "privacy - terms of service" text from sidebar footer
26-04-12 by claude: Add mobile bottom navigation bar — 4-tab Material Design 3 pill-style bottom bar at ≤960px replacing hidden sidebar, with safe-area support and toast/upload repositioning
26-04-12 by claude: Support document file uploads and display — accept all file types in upload, fetch documents from API (fileType=other), classify non-image/video as document type, render document tiles with file icon + extension badge
26-04-12 by claude: Fix document display — add MIME inference for .pdf/.zip/.docx/.xlsx etc., clicking document tiles triggers download instead of broken preview, fix "Photo" label showing for documents
26-04-12 by claude: Redesign mobile preview to Google Photos style — full-screen black, top bar with back/date/star/menu, edge-to-edge photo, bottom action bar (Share/Edit/Add to/Bin), swipe navigation
26-04-12 by claude: Separate Documents from Photos — filter documents out of Photos view, add Files tab to mobile bottom nav, build file manager list view (Name/Modified/Size columns) for Documents section
26-04-12 by claude: Add folder creation and navigation for Documents — breadcrumb path navigation, "New Folder" button with inline input, folder rows with icons, directory metadata support in PATCH API
26-04-12 by claude: Add file-to-folder move support — moveFilesToFolder() patches Directory metadata via API, enables organizing files into user-created folders
26-04-12 by claude: Desktop sidebar pill-shaped active highlight — translucent blue capsule background matching mobile tab bar style, replacing solid dark blue
26-04-12 by claude: Timeline scrubber active dot blue glow — active dot scales up with enhanced blue box-shadow glow, separate from hover effect
26-04-12 by claude: Fix documents in storage panel — exclude document type from "Large photos and videos" category
26-04-12 by claude: Fix document click behavior — clicking file row toggles selection instead of opening broken photo preview, add per-row download button
26-04-12 by claude: Add document file manager actions — select files, Move to folder dialog, batch Download, batch Delete, clear selection, with action bar in header
26-04-12 by claude: Fix timeline scrubber label offset — suppress updateActiveYear during smooth scroll to prevent badge showing previous section's label
26-04-12 by claude: Fix album cover resetting — syncAlbumCovers no longer prunes covers for albums with no items loaded, preventing premature cover removal
26-04-12 by claude: Add URL hash navigation persistence — current view (Photos/Albums/Files/Bin/album detail) saved to URL hash, survives page refresh and supports browser back/forward
26-04-12 by claude: Fix sidebar double highlight — primary nav item no longer shows is-active when a secondary filter (Videos/Documents/Favourites) is selected
26-04-12 by claude: Fix sidebar rapid-click flickering — patchSidebarActive() surgically toggles CSS classes without innerHTML rebuild, scheduleRender() batches rapid clicks into one frame
26-04-12 by claude: Redesign Files UI — remove table border and column header, rounded row hover, chevron breadcrumbs, 3-dot context menu per file (Download/Move to/Delete), right-click support for single-file actions
26-04-12 by claude: Telegram files default to root directory — no more auto-nesting into telegram-import/channelName, files land at root for easy categorization
26-04-12 by claude: Redesign move-to-folder dialog — navigable folder tree with breadcrumb, drill into subfolders before confirming, "Move here" button at bottom, replaces flat one-click-to-move list
26-04-13 by codex: Make Files upload picker truly allow arbitrary file types by removing the `accept` filter in Documents view while keeping the media-focused picker for photo-centric views
26-04-13 by codex: Harden WebDAV auth so enabled WebDAV now fails closed when username/password are missing, and file GET proxying carries internal auth headers for future private file-route compatibility
26-04-13 by codex: Harden auth fail-closed behavior so broken or missing security config no longer opens manage/user routes; admin middleware and both login flows now return 503 when credentials are unavailable, and user/dual auth helpers reject blank auth config
26-04-13 by codex: Replace the legacy single-password `/login` UI with the admin credential flow so `/login` and `/adminLogin` now share the username/password form, homepage guards check the admin session, legacy admin API helpers no longer send `unset:unset` Basic headers by default, and legacy admin logout clears the `admin_auth` session cookie
26-04-13 by codex: Restore desktop media-library sidebar readability by increasing nav/admin/storage contrast, brightening inactive labels, and giving active pills a clearer high-contrast state
26-04-13 by codex: Auto-migrate media-library album state from KV into D1 when the new album tables are empty, and raise the D1-backed manage/list page-size ceiling to 500 with regression coverage for both paths
26-04-13 by codex: Fix photo ordering fallback for legacy media by resolving capture time from old EXIF shapes (`DateTimeOriginal` / `CreateDate` / top-level `DateTaken` / `TakenAt`) and common phone filename patterns before falling back to upload `TimeStamp`
26-04-13 by codex: Add `POST /api/manage/migrate/recover-capture-times` so old images without persisted capture time can be backfilled from source EXIF headers across supported channels (`CloudflareR2`, `Telegram/TelegramNew`, `Discord`, `S3`, `HuggingFace`) with `dryRun`, `limit`, and targeted key/channel filters
26-04-13 by codex: Preserve flattened `DateTaken` in KV-safe file metadata, enrich KV-to-D1 migration from legacy `manage@index_*` chunk metadata, and let `recover-capture-times` repair existing D1 records from legacy chunk capture fields before falling back to source EXIF scraping
26-04-13 by codex: Add preview-side photo date/time editing so admins can manually override DateTaken, persist it through PATCH metadata, and immediately re-sort the timeline
2026-04-13 by codex: Fix media-library startup stability by patching the preserved sidebar Storage card in place so quota text no longer sticks on 'Calculating...', and by downgrading delayed live-sync retries to conditional/non-forced refreshes so the photo timeline stops flashing through multiple full renders before settling
26-04-13 by codex: Add end-to-end video categories with preview-side editing, Videos-view category chips, category: search support, route persistence, backend VideoCategory validation, and regression coverage
26-04-14 by codex: Add a visual video-album wall in Videos view that groups items by VideoCategory into clickable widescreen album cards, keeps category routes/back navigation coherent, and preserves the existing timeline beneath the new visual summary
26-04-14 by codex: Finish the Videos visual-grouping closure by making the Videos root a wall-only video-album view with an ungrouped pseudo album route, and add a hidden photo album flow (#/photos/private) backed by PrivateAlbum metadata, preview/selection move actions, and a password gate
26-04-15 by codex: Promote Private into the primary media-library sidebar with the existing password gate, and wire Videos selection/preview Add to album into VideoCategory-backed video albums
26-04-15 by codex: Complete Private/video album add flows: Private now accepts photos and videos, re-locks on every entry, exposes Add photos/videos after unlock, Videos root can create a video album then pick videos into it, video album detail exposes Add videos, album cover filtering supports multi-album assignments, and selection/nav clicks avoid unnecessary full renders
26-04-15 by codex: Stop preview favourite toggles from full-rendering the Favourites page, remove the preview Info hidden-album shortcut, and keep Private add/remove flows scoped to the Private page
26-04-15 by codex: Fix Private password Enter handling so the password field unlocks Private without falling through to stale focused-tile preview shortcuts
26-04-15 by codex: Simplify the locked Private entry page into a single polished unlock panel, removing duplicate summary copy and restyling the password form
26-04-17 by codex: Stop preview DateTaken saves from forcing a full media-library render so the photo preview no longer flashes after saving date & time
26-04-17 by codex: Add a sidebar TODO filter that reuses the Photos timeline but only shows photos that are not in any album, with URL hash support at #/todo
26-04-17 by codex: Fix the green success toast dismiss button markup so saved toasts no longer show mojibake after the message text
26-04-17 by codex: Add a distinct toggle in album photo-picker mode so Add photos can instantly filter down to photos that have never been added to any album
26-04-17 by codex: Add a Mind chat page with right-now/right-next-visit bubble mirroring, persist web notes in manage@sysConfig@mind, and sync non-command Telegram channel text into the same history
26-04-17 by codex: Redesign Mind into an iMessage-inspired chat with customizable contact name/avatar/background, wallpaper upload, and per-message delete controls
26-04-17 by codex: Rework Mind layout so the whole right content area is the chat surface, tone down the palette, and turn settings into a right-side drawer instead of an inline white card
26-04-17 by codex: Restyle Mind into a higher-contrast dark chat surface with a P2-like bottom composer so typed text, placeholders, and timestamps stay readable
26-04-17 by codex: Tighten Mind again so incoming messages use avatar+bubble+time on one line and the composer becomes a compact P3-style pill with a left plus button
26-04-17 by codex: Remove Mind's leftover right-column gap, stop showing the contact name inside incoming bubbles, and only reveal message timestamps on hover/focus
26-04-17 by codex: Remove Mind's remaining bottom dead space by making the view follow the main-content height instead of hard-coded viewport math, and bump the CSS cache bust so the full-height chat surface ships immediately
26-04-17 by codex: Remove the Mind header subtitle and composer placeholder copy so the chat topbar and input stay visually quiet
26-04-17 by codex: Let Mind use existing library photos as wallpaper choices by persisting a background photo id and exposing a recent-photo picker in the settings drawer alongside upload wallpaper
26-04-17 by codex: Remove green success toasts across the media-library by making toast rendering ignore success events while keeping error toasts intact
26-04-17 by codex: Remove the Mind empty-state instructional bubble so a blank Mind view opens as a clean chat canvas with no explanatory copy
