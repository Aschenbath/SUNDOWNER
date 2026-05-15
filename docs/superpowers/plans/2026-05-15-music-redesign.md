# Music Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the failed over-designed Music page with a quiet native desktop music view that feels system-like, list-dominant, and restrained while preserving the existing global shell and playback behavior.

**Architecture:** Rework the Music page by removing the theatrical hero-and-shelf emphasis and replacing it with a compact now-playing strip, a primary track list, and a secondary right column for queue and playlists. Keep all work inside the existing Music view files so the redesign is a scoped view-layer reset rather than a product-wide refactor.

**Tech Stack:** Vanilla JS view functions, app-local state in `js/media-library/app.js`, CSS in `css/media-library.css`, Mocha tests in `test/previewActions.test.js`, cache-busted static entry in `index.html`.

---

## File Structure

- `js/media-library/components.js`
  - Owns `MusicSummary`, `MusicListView`, queue markup, and playlist markup.
  - This is where the visual hierarchy reset happens.

- `css/media-library.css`
  - Owns all Music-specific visual treatment under `.cml-main-content__inner.is-music-view ...`.
  - This is where the quiet native styling replaces the current expressive treatment.

- `test/previewActions.test.js`
  - Owns Music markup contract assertions for summary, queue, player, and related desktop/mobile entry points.
  - Update only Music-specific expectations affected by the direction reset.

- `index.html`
  - Owns cache-busted `app.js` and `media-library.css` versions.
  - Update only after the redesign is complete.

- `history.md`
  - Project progress and latest-state capsule.
  - Append only after implementation and verification are complete.

---

### Task 1: Reset the Music summary into a native now-playing strip

**Files:**
- Modify: `js/media-library/components.js:1447-1605`
- Test: `test/previewActions.test.js:2053-2165`

- [ ] **Step 1: Rewrite the summary test to assert a compact now-playing strip instead of a dramatic hero**

```js
it('renders the redesigned music summary as a compact native now-playing strip with secondary queue and playlist context', () => {
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

  assert.match(html, /cml-music-summary__strip/);
  assert.match(html, /cml-music-summary__now-playing-strip/);
  assert.match(html, /cml-music-summary__transport/);
  assert.match(html, /cml-music-summary__progress/);
  assert.match(html, /cml-music-summary__side-column/);
  assert.match(html, /cml-music-summary__playlists/);
  assert.match(html, /All tracks/);
  assert.match(html, /Night Drive/);
  assert.match(html, /Soft Focus/);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:
```powershell
& "D:/DevTools/nvm/v22.14.0/node.exe" "D:\Codex\midTime\leosDrive-telegram-sync\node_modules\mocha\bin\mocha.js" "D:\Codex\midTime\leosDrive-telegram-sync\test\previewActions.test.js" --grep "compact native now-playing strip"
```

Expected: FAIL because the new strip-specific selectors do not exist yet.

- [ ] **Step 3: Replace `renderMusicPlaylistPills` with quieter collection entries**
- [ ] **Step 4: Replace `MusicSummary` with a horizontal native strip and secondary side column**
- [ ] **Step 5: Run the focused test to verify it passes**
- [ ] **Step 6: Commit**

---

### Task 2: Make the track list the primary content area again

**Files:**
- Modify: `js/media-library/components.js:1606-1718`
- Test: `test/previewActions.test.js:2053-2112`

- [ ] **Step 1: Replace the list layout test with one that asserts list-dominant structure**
- [ ] **Step 2: Run the focused test to verify it fails**
- [ ] **Step 3: Replace the Music list markup with a simple list-first shell**
- [ ] **Step 4: Run the focused test to verify it passes**
- [ ] **Step 5: Commit**

---

### Task 3: Replace expressive Music styling with quiet native desktop styling

**Files:**
- Modify: `css/media-library.css:9523-10520`
- Test: `test/previewActions.test.js:2139-2205`

- [ ] **Step 1: Replace the CSS selector test with quiet native selectors**
- [ ] **Step 2: Run the focused test to verify it fails**
- [ ] **Step 3: Replace the Music summary styling with a compact strip layout**
- [ ] **Step 4: Replace playlist and list/queue styling with subdued native treatments**
- [ ] **Step 5: Add responsive collapse rules for the strip/list-first structure**
- [ ] **Step 6: Run the focused test to verify it passes**
- [ ] **Step 7: Commit**

---

### Task 4: Final verification, cache bump, and history update

**Files:**
- Modify: `index.html:1`
- Modify: `history.md:231-240, 356-364`
- Test: `test/previewActions.test.js`

- [ ] **Step 1: Update cache versions and record the new direction reset rollout**
- [ ] **Step 2: Run focused music tests**
- [ ] **Step 3: Run the full Mocha suite**
- [ ] **Step 4: Commit**

---

## Self-Review

### Spec coverage
- quiet native direction: covered by Tasks 1 and 3
- compact top strip instead of theatrical hero: covered by Task 1
- list-dominant hierarchy: covered by Task 2
- secondary right column: covered by Tasks 1, 2, and 3
- reduced visual drama and native density: covered by Task 3
- shell boundary unchanged: preserved through file scope and verification in Task 4

### Placeholder scan
- no TBD or TODO placeholders remain
- each run step includes exact commands
- each implementation section maps to a concrete file scope

### Type consistency
- uses `MusicSummary`, `MusicListView`, and `renderMusicPlaylistPills` consistently
- selector names match the rewritten summary/list structure
- cache version changes stay confined to `index.html`

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-15-music-redesign.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?