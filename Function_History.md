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
