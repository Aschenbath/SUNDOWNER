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
