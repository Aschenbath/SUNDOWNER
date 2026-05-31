# SUNDOWNER Minimalist UI Redesign

**Date**: 2026-05-31  
**Status**: Approved  
**Approach**: Minimalism - Information Density Priority

---

## Problem Statement

Current UI suffers from:
1. **Font chaos**: 20+ font weights (400-850), multiple font families
2. **Content bloat**: Redundant explanatory text, repeated instructions
3. **Poor typography**: Inconsistent line heights, unclear hierarchy
4. **Visual noise**: Too many font variations distract from content

User feedback: "字体、排版、内容冗余 - 无关紧要的废话多"

---

## Design Goals

1. **Simplify typography**: 2 font weights, 1 font family, clear hierarchy
2. **Remove redundancy**: Delete all non-essential text
3. **Improve readability**: Consistent spacing, better line heights
4. **Focus on content**: Let media and data speak, minimize chrome

---

## Typography System

### Font Stack
```css
font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

**Rationale**: Inter is a modern, highly readable typeface similar to Claude.ai's ABC Favorit. Open source, optimized for screens, excellent at small sizes.

### Font Weights
- **Regular (400)**: Body text, descriptions, metadata
- **Semibold (600)**: Titles, emphasis, buttons

**Remove**: 300, 450, 500, 520, 540, 560, 620, 640, 650, 660, 680, 700, 720, 740, 750, 760, 780, 800, 820, 850

### Font Sizes
```
- Hero titles: 28-32px (Albums, Mind, Films main titles)
- Card titles: 16-18px (List items, card headers)
- Body text: 14-15px (Descriptions, metadata)
- Small text: 12-13px (Timestamps, tags)
```

### Line Heights
```
- Titles: 1.3
- Body: 1.6-1.8 (improved readability)
- Small: 1.4
```

---

## Content Simplification

### Albums/Moments

**Remove**:
- ❌ "Items you delete will appear here for up to 45 days before permanent removal." (appears in multiple places)
- ❌ Empty state long descriptions
- ❌ Redundant instructions

**Keep**:
- ✅ Icon + Title
- ✅ Core action buttons
- ✅ Essential metadata only

### Mind (Private Chat)

**Remove**:
- ❌ Redundant timestamps (only show date separators on day change)
- ❌ Verbose status messages
- ❌ Explanatory tooltips for obvious actions

**Keep**:
- ✅ Message content
- ✅ Date separators
- ✅ Essential status icons

### Films

**Remove**:
- ❌ Empty state paragraphs
- ❌ Card metadata overflow (director, year, runtime on card)
- ❌ Redundant "Add from TMDb" instructions

**Keep**:
- ✅ Poster + Title + Rating (on card)
- ✅ Full metadata (in detail view only)
- ✅ Core actions

### Private Album

**Remove**:
- ❌ "Enter your password to view hidden photos and videos."
- ❌ "This unlock only lasts for the current visit."
- ❌ "Unlock" button (Enter key submits)

**Keep**:
- ✅ Icon + "PRIVATE" + "Unlock private album"
- ✅ Password input
- ✅ Error messages (when needed)

### Bin

**Remove**:
- ❌ Duplicate "Items you delete will appear here..." text
- ❌ Verbose empty state

**Keep**:
- ✅ Icon + "Bin is empty"
- ✅ One-line description (max)

---

## Spacing System

### Vertical Rhythm
```
- Section gaps: 32px
- Component gaps: 24px
- Card padding: 16-20px
- Text spacing: 8-12px
```

### Horizontal Spacing
```
- Container max-width: 1200px (content)
- Side padding: 20-40px (responsive)
- Grid gaps: 16-24px
```

---

## Implementation Plan

### Phase 1: Typography Cleanup
1. Add Inter font from Google Fonts CDN
2. Create CSS variables for font system
3. Replace all font-weight declarations
4. Standardize font-family to Inter
5. Update line-heights

### Phase 2: Content Removal
1. Remove redundant text from components
2. Simplify empty states
3. Clean up error messages
4. Remove verbose instructions

### Phase 3: Spacing Refinement
1. Apply consistent spacing system
2. Increase line-heights for readability
3. Add breathing room between sections

### Phase 4: Bug Fixes
1. Remove 'TODO' placeholders from code
2. Clean up console.error statements
3. Verify all changes across views

---

## Success Criteria

- [ ] Font weights reduced from 20+ to 2
- [ ] Font families unified to system stack
- [ ] All redundant text removed
- [ ] Line heights improved (1.6-1.8 for body)
- [ ] Spacing system applied consistently
- [ ] No 'TODO' placeholders in production code
- [ ] Visual hierarchy clear and consistent

---

## Files to Modify

### CSS
- `css/media-library.css` - Main stylesheet

### Components
- `js/media-library/components.js` - All view components
- `js/media-library/films-components.js` - Films-specific components

### Code Cleanup
- `js/media-library/app.js` - Remove TODO placeholders
- `js/media-library/data.js` - Clean up filter arrays

---

## Trade-offs

**Pros**:
- Cleaner, faster, more focused
- Better readability
- Reduced cognitive load
- Easier maintenance

**Cons**:
- Less guidance for new users
- May need to add contextual help later
- Some users prefer verbose UI

**Decision**: Proceed with minimalism. SUNDOWNER is a personal media library tool, not a consumer product. Power users prefer efficiency over hand-holding.

---

## Notes

- System fonts ensure instant load and native feel
- Two font weights create clear hierarchy without complexity
- Removing redundant text respects user's time and intelligence
- Increased line-height improves readability significantly
- Consistent spacing creates visual rhythm

---

**Next Step**: Create implementation plan with writing-plans skill
