# Music Dashboard Redesign Design

## Goal

Make the Music route visually acceptable and usable without changing the global SUNDOWNER shell, storage model, or audio behavior. The redesign should fix the current weak hierarchy, oversized empty space, and awkward queue/table balance while keeping Music as a first-class media surface.

## Approved Direction

Use an immersive Music dashboard layout:

- A stronger top hero/current-track area for the primary listening state.
- A clean tracks table underneath for the full local library.
- A compact right-side glass panel for queue, playlists, and player context.
- A darker, more deliberate music-specific surface that still fits the existing SUNDOWNER sidebar and header.

## Scope

In scope:

- Music route markup in `js/media-library/components.js`.
- Music-specific styling in `css/media-library.css`.
- Cache version bumps for changed frontend assets.
- Local syntax checks and targeted UI smoke verification where the local app can run.

Out of scope:

- Global header/sidebar redesign.
- Backend, storage, upload, search, playlist persistence, or audio playback logic changes.
- Films, Mind, Photos, Albums, Documents, Bin, or Private route redesigns.

## Layout

The Music route should read as three clear zones:

1. Hero/listening zone: current or highlighted track, playback status, library stats, and primary controls.
2. Library zone: tracks table with readable titles, artist, album, added date, and actions.
3. Context zone: queue and playlist cards that remain visible but do not compete with the library.

Desktop should use a two-column content layout after the hero. Mobile should collapse into a single column with the hero first, then queue/context, then tracks.

## Visual System

- Keep the existing dark SUNDOWNER shell.
- Use music-specific depth: soft gradients, glass cards, subtle borders, and compact spacing.
- Avoid decorative noise and huge empty panels.
- Preserve readable contrast for English and Chinese metadata.
- Make empty/low-data states look intentional, since the current screenshot shows only a few tracks.

## Behavior

Existing data flow and event actions must remain intact. Buttons should keep their current `data-action` hooks and item ids so queue, play/pause, playlist, and edit flows continue to work without runtime rewrites.

## Validation

- Run JavaScript syntax checks on changed JS files.
- Run available targeted tests that cover playlists/music state if practical.
- Start the local app and inspect the Music route in a browser if the dev server is stable on this machine; if Wrangler/local auth blocks visual QA, report that explicitly.
