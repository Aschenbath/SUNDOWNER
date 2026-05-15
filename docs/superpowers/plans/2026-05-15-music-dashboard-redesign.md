# Music Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the SUNDOWNER Music route into an immersive, readable dashboard with a strong hero, clean library table, and compact queue/playlist context.

**Architecture:** Keep the existing Music data flow and event delegation intact. Modify only route-owned markup in `js/media-library/components.js`, route-owned styles in `css/media-library.css`, focused rendering assertions in `test/previewActions.test.js`, and static cache versions in `index.html`.

**Tech Stack:** Plain JavaScript template renderers, CSS under `#codex-media-library-root`, Mocha tests, Cloudflare Pages static assets.

---

## File Structure

- Modify `js/media-library/components.js`: update `MusicSummary()` and `MusicListView()` markup while preserving existing `data-action`, `data-id`, and playlist/queue hooks.
- Modify `css/media-library.css`: replace the current quiet native Music strip/list CSS block with a richer Music dashboard visual system, scoped to `.cml-main-content__inner.is-music-view` and Music classes.
- Modify `test/previewActions.test.js`: update Music rendering assertions so the tests protect the new hero/context/table structure and preserved action hooks.
- Modify `index.html`: bump `/js/media-library/app.js` and `/css/media-library.css` query strings because `components.js` is imported by `app.js` and Music CSS changes.
- Do not modify `css/ui-overrides.css`, global sidebar/header code, backend files, storage code, or audio event handlers.

---

### Task 1: Lock Rendering Expectations

**Files:**
- Modify: `D:/Codex/midTime/leosDrive-telegram-sync/test/previewActions.test.js:2053-2216`

- [ ] **Step 1: Update summary test assertions**

Replace the old summary test name and assertions with checks for the new dashboard hero structure:

```js
  it('renders the redesigned music summary as an immersive dashboard hero with queue and playlist context', () => {
    const html = MusicSummary({
      totalCount: 12,
      isMobile: false,
      currentItem: {
        id: 'audio-1',
        audioTitle: 'Darcy’s Letter',
        audioArtist: 'Dario Marianelli',
        audioAlbum: 'Pride & Prejudice',
        audioDuration: 274,
        thumbnailUrl: 'https://example.com/cover.jpg'
      },
      queueItems: [
        { id: 'audio-1', audioTitle: 'Darcy’s Letter', audioArtist: 'Dario Marianelli', audioAlbum: 'Pride & Prejudice', audioDuration: 274 },
        { id: 'audio-2', audioTitle: 'Arrival of the Birds', audioArtist: 'The Cinematic Orchestra', audioAlbum: 'The Crimson Wing', audioDuration: 231 }
      ],
      isPlaying: true,
      mode: 'sequence',
      playlists: [
        { name: 'Night Drive', itemCount: 5 },
        { name: 'Soft Focus', itemCount: 7 }
      ],
      activePlaylistName: ''
    });

    assert.match(html, /cml-music-summary__hero/);
    assert.match(html, /cml-music-summary__hero-main/);
    assert.match(html, /cml-music-summary__art/);
    assert.match(html, /cml-music-summary__controls/);
    assert.match(html, /cml-music-summary__context/);
    assert.match(html, /cml-music-summary__playlist-card/);
    assert.match(html, /data-action="audio-toggle-play"/);
    assert.match(html, /data-action="open-music-playlist"/);
    assert.match(html, /All tracks/);
    assert.match(html, /Night Drive/);
    assert.match(html, /Soft Focus/);
  });
```

- [ ] **Step 2: Update list layout test assertions**

Keep the existing sample data and `AudioPlayerPanel` checks, then replace only the Music list assertions with:

```js
    assert.match(listHtml, /cml-music-library__main/);
    assert.match(listHtml, /cml-music-library__aside/);
    assert.match(listHtml, /cml-music-playlist__list-shell/);
    assert.match(listHtml, /cml-music-playlist__table/);
    assert.match(listHtml, /cml-music-queue/);
    assert.match(listHtml, /cml-music-library__metric/);
    assert.match(listHtml, /data-action="rename-audio-artist"/);
    assert.match(listHtml, /data-action="rename-audio-album"/);
    assert.match(listHtml, /data-action="add-audio-to-playlist"/);
```

- [ ] **Step 3: Update empty-state summary assertions**

In `keeps the music summary renderable before any track is selected`, replace the old strip/queue copy checks with:

```js
    assert.match(summaryHtml, /cml-music-summary/);
    assert.match(summaryHtml, /<p class="cml-music-summary__eyebrow">Private music<\/p>/);
    assert.match(summaryHtml, /<h2 class="cml-view-summary__title">Library<\/h2>/);
    assert.match(summaryHtml, /0 items available in your private cloud library\./);
    assert.match(summaryHtml, /Nothing playing/);
    assert.match(summaryHtml, /Your queue will appear here once playback starts\./);
```

- [ ] **Step 4: Update CSS selector protection test**

Replace the old selector assertions with:

```js
    assert.match(cssSource, /cml-music-summary__hero/);
    assert.match(cssSource, /cml-music-summary__hero-main/);
    assert.match(cssSource, /cml-music-summary__context/);
    assert.match(cssSource, /cml-music-summary__playlist-card/);
    assert.match(cssSource, /cml-music-library__metric/);
    assert.match(cssSource, /cml-music-playlist__table/);
```

- [ ] **Step 5: Run the targeted test and expect failure**

Run:

```bash
git -C 'D:/Codex/midTime/leosDrive-telegram-sync' diff -- 'test/previewActions.test.js'
D:/DevTools/nvm/v22.14.0/node.exe D:/Codex/midTime/leosDrive-telegram-sync/node_modules/mocha/bin/mocha.js D:/Codex/midTime/leosDrive-telegram-sync/test/previewActions.test.js --grep "music"
```

Expected: Mocha fails because `components.js` and `media-library.css` do not yet define the new classes.

---

### Task 2: Rebuild Music Summary Markup

**Files:**
- Modify: `D:/Codex/midTime/leosDrive-telegram-sync/js/media-library/components.js:1484-1553`

- [ ] **Step 1: Replace `MusicSummary()` with the dashboard hero markup**

Use the existing function signature. Preserve `data-action="close-music-playlist"`, `audio-prev`, `audio-toggle-play`, `audio-next`, `open-music-playlist`, and `open-create-playlist` hooks.

```js
export function MusicSummary({ totalCount = 0, isMobile = false, currentItem = null, queueItems = [], isPlaying = false, mode = 'sequence', playlists = [], activePlaylistName = '' }) {
  const countLabel = formatItemCount(totalCount);
  const modeLabel = mode === 'repeat-one' ? 'Repeat one' : (mode === 'shuffle' ? 'Shuffle' : 'Sequence');
  const focusItem = currentItem || queueItems[0] || null;
  const coverUrl = String(focusItem?.thumbnailUrl || focusItem?.posterUrl || '').trim();
  const subtitle = focusItem
    ? (formatAudioSubtitle(focusItem) || 'Unknown artist · Unknown album')
    : 'Select a track to begin playback.';
  const queuePreview = queueItems.slice(0, 4);
  const playlistPreview = playlists.slice(0, 4);

  return `
    <section class="cml-view-summary cml-view-summary--music cml-music-summary">
      <div class="cml-music-summary__hero">
        <div class="cml-music-summary__hero-main">
          <div class="cml-music-summary__titles">
            <p class="cml-music-summary__eyebrow">Private music</p>
            <div class="cml-music-summary__title-row">
              ${activePlaylistName ? `<button type="button" class="cml-topbar__secondary-button cml-view-summary__back" data-action="close-music-playlist" aria-label="Back to all tracks">${icon('previous')}</button>` : ''}
              <div class="cml-music-summary__title-copy">
                <h2 class="cml-view-summary__title">${activePlaylistName ? escapeHtml(activePlaylistName) : 'Library'}</h2>
                <p class="cml-view-summary__copy cml-view-summary__copy--albums">${escapeHtml(activePlaylistName ? `${countLabel} saved inside this playlist.` : `${countLabel} available in your private cloud library.`)}</p>
              </div>
            </div>
          </div>

          <div class="cml-music-summary__player-card" aria-label="Now playing">
            <div class="cml-music-summary__art ${coverUrl ? '' : 'is-fallback'}">
              ${coverUrl ? `<img src="${escapeHtml(coverUrl)}" alt="${focusItem ? getAudioDisplayTitle(focusItem) : 'Music'}" class="cml-music-summary__cover-image">` : `<span class="cml-music-summary__cover-icon">${icon('music')}</span>`}
            </div>
            <div class="cml-music-summary__now-copy">
              <span class="cml-music-summary__kicker">${currentItem ? (isPlaying ? 'Playing now' : 'Paused') : 'Ready when you are'}</span>
              <strong class="cml-music-summary__track-title">${focusItem ? getAudioDisplayTitle(focusItem) : 'Nothing playing'}</strong>
              <span class="cml-music-summary__track-subtitle">${escapeHtml(subtitle)}</span>
            </div>
            <div class="cml-music-summary__controls">
              <button type="button" class="cml-music-summary__transport-button" data-action="audio-prev" aria-label="Previous">${icon('previous')}</button>
              <button type="button" class="cml-music-summary__transport-button cml-music-summary__transport-button--primary" data-action="audio-toggle-play" ${focusItem ? '' : 'disabled'}>${currentItem && isPlaying ? icon('pause') : icon('play')}</button>
              <button type="button" class="cml-music-summary__transport-button" data-action="audio-next" aria-label="Next">${icon('next')}</button>
            </div>
          </div>

          <div class="cml-music-summary__stats" aria-label="Music stats">
            <span class="cml-music-summary__stat"><strong>${countLabel}</strong><span>${activePlaylistName ? 'in playlist' : 'in library'}</span></span>
            <span class="cml-music-summary__stat"><strong>${queueItems.length}</strong><span>${queueItems.length === 1 ? 'queued track' : 'queued tracks'}</span></span>
            <span class="cml-music-summary__stat"><strong>${escapeHtml(modeLabel)}</strong><span>play mode</span></span>
          </div>
        </div>

        <aside class="cml-music-summary__context" aria-label="Queue and playlist context">
          <section class="cml-music-summary__context-card">
            <div class="cml-music-summary__context-head">
              <span>Up next</span>
              <strong>${queueItems.length === 1 ? '1 track' : `${queueItems.length} tracks`}</strong>
            </div>
            ${queuePreview.length
              ? `<div class="cml-music-summary__queue-stack">${queuePreview.map((item, index) => `
                <button type="button" class="cml-music-summary__queue-entry ${currentItem && normalizeText(currentItem.id) === normalizeText(item.id) ? 'is-current' : ''}" data-action="play-audio-item" data-id="${escapeHtml(item.id)}">
                  <span class="cml-music-summary__queue-index">${index + 1}</span>
                  <span class="cml-music-summary__queue-copy">
                    <strong>${getAudioDisplayTitle(item)}</strong>
                    <small>${formatAudioSubtitle(item) || (index === 0 ? 'Ready to resume' : 'Queued')}</small>
                  </span>
                </button>
              `).join('')}</div>`
              : `<div class="cml-music-summary__queue-empty">Your queue will appear here once playback starts.</div>`}
          </section>

          <section class="cml-music-summary__playlist-card">
            <div class="cml-music-summary__context-head">
              <span>Playlists</span>
              <strong>${playlists.length}</strong>
            </div>
            <div class="cml-music-summary__playlist-stack">
              ${activePlaylistName
                ? `<button type="button" class="cml-music-playlist-entry" data-action="close-music-playlist"><span class="cml-music-playlist-entry__label">All tracks</span><span class="cml-music-playlist-entry__meta">Return to the full library</span></button>`
                : `<div class="cml-music-playlist-entry is-active" aria-current="true"><span class="cml-music-playlist-entry__label">All tracks</span><span class="cml-music-playlist-entry__meta">Full local library</span></div>`}
              ${playlistPreview.map((playlist) => `
                <button type="button" class="cml-music-playlist-entry ${normalizeText(playlist.name).toLowerCase() === normalizeText(activePlaylistName).toLowerCase() ? 'is-active' : ''}" data-action="open-music-playlist" data-playlist-name="${escapeHtml(playlist.name)}">
                  <span class="cml-music-playlist-entry__label">${escapeHtml(playlist.name)}</span>
                  <span class="cml-music-playlist-entry__meta">${playlist.itemCount === 1 ? '1 track' : `${playlist.itemCount} tracks`}</span>
                </button>
              `).join('')}
              <button type="button" class="cml-music-playlist-entry cml-music-playlist-entry--create" data-action="open-create-playlist">
                <span class="cml-music-playlist-entry__label">Create playlist</span>
                <span class="cml-music-playlist-entry__meta">Save a listening flow</span>
              </button>
            </div>
          </section>
        </aside>
      </div>
    </section>
  `;
}
```

- [ ] **Step 2: Run syntax check**

Run:

```bash
D:/DevTools/nvm/v24.11.1/node.exe --check D:/Codex/midTime/leosDrive-telegram-sync/js/media-library/components.js
```

Expected: `components.js` syntax is valid.

---

### Task 3: Strengthen Music List Markup

**Files:**
- Modify: `D:/Codex/midTime/leosDrive-telegram-sync/js/media-library/components.js:1555-1632`

- [ ] **Step 1: Add a compact metric strip to `MusicListView()`**

Inside `MusicListView()`, after `queueHtml`, add:

```js
  const playlistLabel = activePlaylistName || 'All tracks';
```

Then replace the `cml-music-playlist__head-actions` block with:

```html
            <div class="cml-music-playlist__head-actions" aria-label="Library metrics">
              <span class="cml-music-library__metric"><strong>${formatItemCount(items.length)}</strong><span>${activePlaylistName ? 'saved' : 'tracks'}</span></span>
              <span class="cml-music-library__metric"><strong>${queueSource.length}</strong><span>${queueSource.length === 1 ? 'in queue' : 'queued'}</span></span>
              <span class="cml-music-library__metric"><strong>${escapeHtml(playlistLabel)}</strong><span>view</span></span>
            </div>
```

- [ ] **Step 2: Run syntax check**

Run:

```bash
D:/DevTools/nvm/v24.11.1/node.exe --check D:/Codex/midTime/leosDrive-telegram-sync/js/media-library/components.js
```

Expected: `components.js` syntax is valid.

---

### Task 4: Replace Music Route Styling

**Files:**
- Modify: `D:/Codex/midTime/leosDrive-telegram-sync/css/media-library.css:8683-9250`

- [ ] **Step 1: Replace the Music-specific CSS block**

Replace the selectors from `#codex-media-library-root .cml-view-summary--music` through the end of the existing Music responsive block with a scoped CSS block that defines:

```css
#codex-media-library-root .cml-view-summary--music {
  margin-bottom: 10px;
}

#codex-media-library-root .cml-music-summary {
  position: relative;
  overflow: hidden;
  padding: 28px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 30px;
  background:
    radial-gradient(circle at 18% 15%, rgba(118, 108, 255, 0.32), transparent 34%),
    radial-gradient(circle at 82% 12%, rgba(70, 160, 255, 0.18), transparent 30%),
    linear-gradient(145deg, rgba(18, 22, 38, 0.98), rgba(12, 14, 20, 0.98));
  box-shadow: 0 28px 70px rgba(0, 0, 0, 0.32);
}

#codex-media-library-root .cml-music-summary__hero {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(300px, 0.75fr);
  gap: 22px;
  align-items: stretch;
}
```

Continue the block with styles for all new selectors used in Tasks 2 and 3: `__hero-main`, `__player-card`, `__art`, `__now-copy`, `__kicker`, `__controls`, `__stats`, `__stat`, `__context`, `__context-card`, `__playlist-card`, `__queue-stack`, `__queue-entry`, `__queue-index`, `__queue-copy`, `__playlist-stack`, `cml-music-library__metric`, the table/row styles, and responsive breakpoints at `max-width: 1180px`, `900px`, and `640px`.

- [ ] **Step 2: Keep CSS scoped**

Verify all new selectors begin with `#codex-media-library-root` and route-specific classes. Do not add selectors for `.cml-sidebar`, `.cml-topbar`, `body`, `html`, or `:root`.

- [ ] **Step 3: Run rendering tests**

Run:

```bash
D:/DevTools/nvm/v22.14.0/node.exe D:/Codex/midTime/leosDrive-telegram-sync/node_modules/mocha/bin/mocha.js D:/Codex/midTime/leosDrive-telegram-sync/test/previewActions.test.js --grep "music"
```

Expected: targeted Music rendering tests pass.

---

### Task 5: Bump Cache Versions

**Files:**
- Modify: `D:/Codex/midTime/leosDrive-telegram-sync/index.html:1`

- [ ] **Step 1: Bump frontend query strings**

Change:

```html
<script type="module" src="/js/media-library/app.js?v=291"></script>
<link href="/css/media-library.css?v=264" rel="stylesheet">
```

to:

```html
<script type="module" src="/js/media-library/app.js?v=292"></script>
<link href="/css/media-library.css?v=265" rel="stylesheet">
```

- [ ] **Step 2: Run syntax and targeted tests**

Run:

```bash
D:/DevTools/nvm/v24.11.1/node.exe --check D:/Codex/midTime/leosDrive-telegram-sync/js/media-library/components.js
D:/DevTools/nvm/v22.14.0/node.exe D:/Codex/midTime/leosDrive-telegram-sync/node_modules/mocha/bin/mocha.js D:/Codex/midTime/leosDrive-telegram-sync/test/previewActions.test.js --grep "music"
```

Expected: syntax check passes and targeted Music tests pass.

---

### Task 6: Manual UI Verification, History, Commit, Push

**Files:**
- Modify: `D:/Codex/midTime/leosDrive-telegram-sync/history.md`

- [ ] **Step 1: Start local app if possible**

Run:

```bash
npm --prefix 'D:/Codex/midTime/leosDrive-telegram-sync' start
```

Expected: local dev server starts on port 8787. If Wrangler/auth fails, record the blocker and continue with automated verification evidence.

- [ ] **Step 2: Inspect Music route manually if server starts**

Open `http://localhost:8787/dashboard#Music` and verify:

- The hero/current-track area is visually dominant.
- Tracks are readable in the main table.
- Queue and playlists are visible in compact context cards.
- Header/sidebar remain unchanged.
- Play/pause, queue, rename, and playlist buttons still have working targets or at least preserved `data-action` hooks.

- [ ] **Step 3: Append project history**

Append a compact entry under `Active Chronicle > 2026 > May > 15th` or the current active day. Include changed area, validation commands, and commit/push status.

- [ ] **Step 4: Commit only owned files**

Stage only:

```bash
git -C 'D:/Codex/midTime/leosDrive-telegram-sync' add \
  'js/media-library/components.js' \
  'css/media-library.css' \
  'test/previewActions.test.js' \
  'index.html' \
  'history.md' \
  'docs/superpowers/plans/2026-05-15-music-dashboard-redesign.md'
```

Commit:

```bash
git -C 'D:/Codex/midTime/leosDrive-telegram-sync' commit -m "$(cat <<'EOF'
feat: rebuild music dashboard surface

Make the Music route read as a focused dashboard with a stronger now-playing hero, cleaner library table, and compact queue and playlist context while preserving existing audio actions.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Push**

Run:

```bash
git -C 'D:/Codex/midTime/leosDrive-telegram-sync' push
```

Expected: push succeeds. If push is blocked by credentials/network, report the commit hash and blocker.
