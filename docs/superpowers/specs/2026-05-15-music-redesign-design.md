# SUNDOWNER Music Page Redesign

Date: 2026-05-15
Project: SUNDOWNER
Scope: Desktop Music page redesign only
Status: Draft approved for planning

## Goal

Redesign the Music page so it reads as a modern music player first and a private audio library second. The current page feels too close to an admin or media-management layout. The redesign should move it toward an Apple Music inspired dark editorial experience without changing the global shell.

## Constraints

- Do not redesign the global top header.
- Do not redesign the global left sidebar.
- Do not change route structure or core playback logic.
- Do not spill the redesign into Films, Photos, Documents, or other surfaces.
- Keep the page functional when the library is sparse, including 0-2 tracks.
- Keep existing private-library capabilities available, but visually subordinate them to playback.

## Product Positioning

This is not a pure streaming product. It is a private media-library product with music playback. The page therefore needs to balance two identities:

1. It should feel like a real desktop music player when opened.
2. It should still support library browsing, queue control, playlist entry points, and lightweight metadata management.

The redesign should prioritize listening flow over management chrome.

## Design Direction

Primary direction: Apple Music inspired dark editorial.

Keywords:
- deep charcoal
- soft glass
- album-first
- quiet luxury
- high contrast, low noise

Avoid:
- cyber / neon visual language
- audiophile instrument-panel UI
- dashboard stats-first structure
- filter-pill-heavy playlist treatment
- spreadsheet-like music table styling

## Information Architecture

The Music page should be organized into four vertical layers.

### 1. Hero Now Playing

The top of the page should become a playback stage instead of a generic summary block.

Contents:
- large artwork anchor
- current track title
- artist and album metadata
- progress bar
- primary transport controls
- lightweight context text that anchors playback inside the private library

Purpose:
- establish immediate player identity
- make the current track the first thing the eye lands on
- provide the strongest play/pause affordance on the page

### 2. Up Next Queue Rail

The queue should move into a distinct right-side rail adjacent to the hero.

Contents:
- current track card
- 3-6 upcoming tracks
- jump-to-track affordance
- remove-from-queue affordance

Purpose:
- preserve continuous playback context
- make queue behavior feel like player state, not a utility sidebar

### 3. Playlists Shelf

Playlists should become a shelf of small collection cards rather than pills.

Contents:
- stable `All tracks` anchor card
- one card per playlist
- one `Create playlist` card of equal hierarchy

Each card should show:
- playlist name
- track count
- optional lightweight mood or collection subtitle
- optional artwork or artwork-like placeholder treatment

Purpose:
- make playlists feel like part of the music product, not like filters
- preserve navigation and creation actions while improving tone

### 4. Track List

The lower section should remain a full track list, but its treatment should move closer to a player library.

Contents:
- index / play-state cell
- title + subtitle block
- artist
- album
- duration or added information
- quiet row actions

Purpose:
- keep browsing and management possible
- visually demote grid/admin energy
- keep current-track state readable at a glance

## Visual Language

### Background and Surfaces

Use a deep dark base, but not pure black. Surfaces should separate using:
- tonal elevation
- light edge definition
- restrained shadow depth
- mild blur/glass cues where appropriate

Panels should feel layered and expensive, not dense or noisy.

### Artwork Treatment

Artwork should become the strongest visual anchor on the page.

Requirements:
- hero artwork larger and more prominent than any current element
- queue current-track artwork slightly stronger than upcoming items
- playlist cards should use artwork or a musically convincing placeholder
- artwork transitions should preserve calm, not flash

### Typography

Typography should emphasize playback hierarchy.

Requirements:
- page or hero title large, tight, and editorial
- current track title visually dominant
- artist and album as lighter secondary information
- metadata and helper copy reduced in prominence
- durations and counters visually tidy and tabular where possible

### Color

Use color sparingly.

Requirements:
- neutral deep background family
- soft cool-white foreground hierarchy
- one restrained accent for active playback, selection, and primary control emphasis
- active states should rely more on tint and brightness than on loud hue changes

## Component Guidance

### Hero Player

Structure:
- artwork left
- text and progress center
- supporting utility controls right

Behavior:
- play/pause button is the single strongest CTA on the page
- transport controls visually subordinate to play/pause
- utility controls such as mode or volume stay visible but quiet
- title and art should crossfade when tracks switch

### Queue Items

Behavior:
- current item clearly differentiated from the rest
- hover reveals intent without adding clutter at rest
- remove action visually quiet until needed
- transitions should feel like queue flow, not list rerendering

### Playlist Cards

Behavior:
- equal hierarchy between existing playlists and create entry
- larger click targets than the current pill model
- card treatment should feel like music collections, not filter chips

### Track Rows

Behavior:
- title column dominates
- current row gets refined playback highlight treatment
- row actions fade in on hover or focus
- metadata editing stays possible but visually quiet

## Empty and Sparse States

The page must look deliberate even with few tracks.

### Zero-track state

Requirements:
- hero scaffold still looks like a player frame
- queue rail has an elegant empty treatment
- playlist shelf still establishes structure
- lower list area uses a refined empty message instead of a dead blank panel

### Sparse library state

Requirements:
- design should not depend on having many playlist cards or long queue stacks
- spacing and composition must remain balanced with 1-2 tracks
- placeholders should feel productized, not debug-like

## Motion and Interaction

Motion should be restrained and meaningful.

Allowed motion zones:
- play/pause and transport feedback
- queue current-item state changes
- hero text/artwork transitions
- card and row hover/pressed states

Recommended timing:
- hover: 120-160ms
- press: 80-120ms
- art/text swap: 160-220ms
- queue/row state change: 140-180ms

Avoid:
- big panel choreography
- flashy glow pulses
- long easing curves
- anything that makes the page feel like a demo instead of a product

Reduced motion must remain respected.

## Search Positioning

Because the shell search remains in place, Music should not introduce another competing heavy search band.

Guidance:
- internal list filtering can remain lightweight
- treat it as a support tool for the track list
- do not let search compete with the hero playback zone

## Interaction Priority

Priority order for the page:

1. Play / Pause
2. Select track / Next / Previous / Queue jump / Open playlist
3. Rename metadata / Remove from playlist / Create playlist

Design implication:
- management actions must not compete with listening actions
- playback affordances need the strongest visual and spatial priority

## Accessibility

Requirements:
- all major controls retain visible labels or aria-labels
- current track state must not rely on color only
- queue and row focus states must remain visible
- contrast must stay strong in dark mode
- hover-only affordances must still be keyboard reachable

## Implementation Boundaries

### Files likely to change

- `js/media-library/components.js`
- `css/media-library.css`
- `js/media-library/app.js` only if lightweight view wiring is required
- cache version in `index.html`

### Files not intended to change

- global shell structure
- non-Music modules
- playback engine behavior
- route model

## Delivery Strategy

Recommended implementation order:

1. Rebuild hero + queue + playlist shelf structure
2. Rework the track list visual hierarchy
3. Refine player-control visuals and row/card states
4. Finish sparse/empty states and responsive cleanup

## Testing Expectations

Before claiming completion, implementation should verify:
- desktop Music page visual hierarchy matches the redesign intent
- sparse library state still looks intentional
- current playback state is obvious in hero, queue, and list row
- keyboard and hover states remain accessible
- the redesign does not disturb the global shell

## Out of Scope

- redesigning Photos / Films / Documents
- altering the global header or sidebar
- adding new playback features
- changing route semantics
- redesigning mobile-first navigation in this pass

## Recommendation

Proceed with implementation using the approved Apple Music inspired dark editorial direction, preserving SUNDOWNER's private-library role while making playback the primary story of the page.
