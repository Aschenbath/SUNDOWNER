# SUNDOWNER Music Page Redesign

Date: 2026-05-15
Project: SUNDOWNER
Scope: Desktop Music page redesign only
Status: Approved for planning rewrite

## Goal

Redesign the Music page so it feels like a natural native desktop music view instead of a visibly designed showcase page. The previous redesign overshot into an over-styled, self-conscious player layout. The replacement direction should feel calm, native, restrained, and quietly premium.

## Constraints

- Do not redesign the global top header.
- Do not redesign the global left sidebar.
- Do not change route structure or core playback logic.
- Do not spill the redesign into Films, Photos, Documents, or other surfaces.
- Keep the page functional when the library is sparse, including 0-2 tracks.
- Keep existing private-library capabilities available.
- Avoid visual treatments that read as polished-for-effect, dramatic, or self-consciously premium.

## Product Positioning

This page belongs to a private media-library product, not a pure streaming product. It still needs to feel like a desktop music surface, but the right tone is closer to a native system music view than to a stylized entertainment landing page.

The page should therefore:

1. Read as a calm music player when opened.
2. Preserve library browsing and lightweight management.
3. Avoid obvious "design performance" in service of looking expensive.

## Direction Reset

The previous direction failed because the page looked too visibly designed:
- the hero was too performative
- the queue and playlist areas competed for attention
- the page felt polished in a way that read as fake rather than natural

This redesign must explicitly move away from that.

## Design Direction

Primary direction: Quiet Native Music.

Reference qualities:
- macOS native tool feeling
- restrained desktop music app hierarchy
- subtle premium quality through typography and spacing
- low-noise surfaces
- low-drama interaction states

Keywords:
- native
- quiet
- restrained
- graphite
- cool neutral
- system-like
- list-first discipline
- small artwork, not hero artwork

Avoid:
- large banner hero composition
- expressive glow or tint-heavy surfaces
- oversized artwork as the page center
- loud playlist cards
- anything that looks like a portfolio-grade redesign pass
- obvious attempts at looking luxurious

## Information Architecture

The page should be organized into three levels instead of the prior stage-like structure.

### 1. Top Now Playing Strip

The top anchor should be a horizontal now playing strip, not a dramatic hero.

Contents:
- small to medium artwork
- track title
- artist and album
- compact progress treatment
- compact transport controls
- lightweight utility controls only if they do not dominate the strip

Purpose:
- establish the page as a music surface immediately
- make playback primary without turning the top of the page into a showcase block
- feel like a desktop app header module rather than a hero section

### 2. Main Track List

The main content area should be track-list dominant.

Contents:
- play/index cell
- title and subtitle block
- artist
- album
- duration or added information
- subdued row actions

Purpose:
- make the page feel grounded and native
- keep the music library as the main visual structure
- preserve functionality without the page drifting into admin-table harshness

### 3. Auxiliary Right Column

The right column should remain, but only as supporting context.

Sections:
- Up Next queue
- Playlists

Purpose:
- preserve playback continuity and organization
- avoid competing with the main list
- read like a side utility column, not a second visual centerpiece

## Visual Hierarchy

### Primary emphasis

1. current track title in the top strip
2. current playback row in the list
3. overall list readability

### Secondary emphasis

1. queue state
2. playlist entry points
3. supporting metadata

### De-emphasized elements

1. management actions
2. decorative container treatments
3. visual separation that exists only to look designed

## Visual Language

### Background and Surface Model

Use a stable dark graphite base with restrained elevation.

Requirements:
- fewer card islands than the previous version
- weaker borders and lower-contrast separations
- reliance on spacing, typography, and density instead of effects
- shadows only where they help separation, not where they announce design intent

The page should feel composed, not staged.

### Artwork Treatment

Artwork remains important, but it must stop acting like the page's dramatic centerpiece.

Requirements:
- small or medium artwork in the now playing strip
- queue or playlist artwork only if it supports recognition without increasing visual noise
- placeholders should look like native UI, not decorative mock assets
- transitions should stay subtle and practical

### Typography

Typography is the main source of quality in this direction.

Requirements:
- track title strong, but not oversized
- supporting text visibly subordinate
- labels and counters compact and disciplined
- line lengths controlled
- row typography should feel more like a desktop app list than like a card UI

### Color

Color should do less.

Requirements:
- cool neutral foreground hierarchy
- restrained accent only for active playback or selected state
- active state should rely on clarity, not visual drama
- reduce heavy tint fills and decorative gradients

## Layout Guidance

### Now Playing Strip

The strip should be horizontally compact.

Suggested layout:
- artwork on the left
- playback text in the center-left
- compact controls in the center-right
- optional queue/mode/volume utilities at the right edge if they remain visually quiet

This strip should feel like the natural top module of a desktop player, not a feature banner.

### Main List

The list should feel like the center of gravity.

Requirements:
- enough row height to breathe
- enough density to feel useful
- current row must be obvious, but elegantly so
- actions should not constantly compete with row text
- title block should dominate row hierarchy

### Right Column

The right column should be visibly secondary.

Requirements:
- narrower than the previous redesign's queue emphasis
- low visual noise
- queue and playlist sections visually related, not separately dramatized
- supporting role in the overall composition

## Component Guidance

### Now Playing Strip

Behavior:
- should always feel present, even when no track is playing
- should not collapse into a generic empty rectangle
- should support quick playback context rather than immersive storytelling

### Queue

Behavior:
- current item easy to identify
- upcoming items simple and scannable
- remove/jump affordances available but quiet
- does not visually overpower the page

### Playlists

Behavior:
- closer to native collection entries than expressive cards
- enough structure to distinguish them from text links
- not so much structure that they become decorative showcases

### Track Rows

Behavior:
- current track row gets the cleanest state signal on the page after the top strip
- row actions only become strong when needed
- metadata editing remains available but stays visually recessed

## Empty and Sparse States

The sparse-library case matters more in this direction because the design cannot rely on dramatic structure to fill space.

### Zero-track state

Requirements:
- now playing strip still looks complete
- list empty state feels native and calm
- auxiliary column remains useful but understated
- no huge empty theatrical surfaces

### Sparse state

Requirements:
- 1-2 tracks should still look intentional
- no oversized visual containers that become awkward when content is scarce
- spacing should feel quiet, not hollow

## Motion and Interaction

Motion should be nearly invisible.

Use motion only for:
- hover and pressed state clarity
- compact playback state changes
- subtle content replacement in the now playing strip

Timing guidance:
- hover: 120-150ms
- press: 80-110ms
- content replacement: 140-180ms

Avoid:
- animated panel choreography
- expressive transitions
- noticeable hero-style crossfades
- anything that calls attention to itself as animation

Reduced motion must be respected.

## Search Positioning

The shell-level search remains the main search surface.

Guidance for Music:
- if an internal list filter exists, it should be extremely quiet
- it must not compete with the top strip
- it should read as a practical list control, not a featured UI element

## Interaction Priority

Priority order:

1. play / pause
2. choosing and resuming tracks
3. queue awareness
4. playlist switching
5. metadata and management actions

This means the page should feel like a listening tool first, while still being a private library underneath.

## Accessibility

Requirements:
- maintain readable contrast in dark mode
- current playback state must not rely on color only
- focus states remain visible but quiet
- all icon-only controls need labels
- hover-only affordances must remain keyboard reachable

## Implementation Boundaries

### Files likely to change

- `js/media-library/components.js`
- `css/media-library.css`
- `js/media-library/app.js` only if minimal Music wiring is required
- `index.html` cache versions

### Files not intended to change

- global shell structure
- non-Music modules
- route model
- playback engine logic

## Delivery Strategy

Recommended implementation order:

1. remove the over-designed hero structure and replace it with a restrained now playing strip
2. make the main track list the dominant content area again
3. reduce the right column so queue and playlists become supporting context
4. refine sparse and empty states so the quieter layout still feels complete

## Testing Expectations

Before claiming completion, implementation should verify:
- the top strip feels native and compact rather than theatrical
- the main list is clearly the primary content area
- the right column is secondary in visual weight
- sparse and empty cases remain intentional
- global shell remains unchanged

## Out of Scope

- redesigning other media surfaces
- changing shell navigation
- altering playback logic
- adding new player features
- mobile-first redesign in this pass

## Recommendation

Proceed by explicitly undoing the previous over-styled structure and rebuilding the Music page around a quiet native desktop music model: restrained now playing strip, strong list center, supporting right column, and almost no visual self-consciousness.
