# SUNDOWNER Typography & Minimalism Design

**Date**: 2026-05-31  
**Status**: Approved  
**Scope**: Albums/Moments, Mind, Films UI improvements

---

## Problem Statement

Current UI issues:
- Inconsistent font usage and weights
- Excessive explanatory text ("waste words")
- Poor visual hierarchy
- Cluttered layouts with redundant information

User feedback: "字、排版、内容、无关紧要的废话多"

---

## Design Goals

1. **Clean typography** - Use Claude's font system (Tiempos Text + ABC Favorit)
2. **Minimal content** - Remove redundant explanatory text
3. **Clear hierarchy** - Use font size/weight instead of color variations
4. **Consistent spacing** - Standardized spacing system

---

## Typography System

### Font Stack

**Primary (Headings & Body)**:
```css
font-family: "Tiempos Text", "Times New Roman", Georgia, serif;
```

**Secondary (UI Elements)**:
```css
font-family: "ABC Favorit", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
```

### Font Weights

Only two weights:
- **Regular**: 400
- **Semibold**: 600

Remove all other weights (300, 500, 700, 800).

### Font Sizes

Four-tier hierarchy:
- **Small**: 12px (metadata, tags, labels)
- **Body**: 14-16px (main content)
- **Subheading**: 18-20px (section titles)
- **Heading**: 28px+ (page titles)

### Line Heights

- **Body text**: 1.6-1.7
- **Headings**: 1.2-1.3
- **Compact elements** (buttons, tags): 1.4

---

## Content Simplification

### Private Album
**Before**:
```
PRIVATE
Unlock private album
Enter your password to view hidden photos and videos.
This unlock only lasts for the current visit.
[Password input] [Unlock button]
```

**After**:
```
PRIVATE
Unlock private album
[Password input]
```

Changes:
- Remove explanatory sentences
- Remove Unlock button (Enter key submits)
- Keep only essential elements

### Bin Empty State
**Before**:
```
[Icon]
Bin is empty
Items you delete will appear here for up to 45 days before permanent removal.
```

**After**:
```
[Icon]
Bin is empty
```

Changes:
- Remove retention explanation
- User knows what a bin is

### Albums/Moments Empty States
**Before**:
```
[Icon]
No albums yet
Create your first album to organize your photos.
[Create Album button]
```

**After**:
```
[Icon]
No albums
[Create Album button]
```

Changes:
- Shorter title
- Remove instructional text
- Action button is self-explanatory

### Films Empty State
**Before**:
```
[Icon]
No films yet
Start building your collection by adding films from TMDb or manually.
[Add Film button]
```

**After**:
```
[Icon]
No films
[Add Film button]
```

Changes:
- Remove instructional text
- Button makes action clear

### Mind Messages
**Before**:
- Show timestamp on every message
- Show "Sent" / "Delivered" status

**After**:
- Show date separator only when day changes
- Hide delivery status (assume delivered)
- Show timestamp on hover only

---

## Spacing System

### Base Unit
4px grid system

### Standard Spacing Scale
- **xs**: 4px
- **sm**: 8px
- **md**: 12px
- **lg**: 16px
- **xl**: 24px
- **2xl**: 32px
- **3xl**: 48px

### Application
- Replace irregular spacing (14px, 18px, 22px) with standard scale
- Use consistent gaps in flex/grid layouts
- Maintain rhythm across components

---

## Visual Hierarchy

### Principles
1. **Size over color** - Use font size to indicate importance
2. **Weight over decoration** - Use Semibold for emphasis, not bold colors
3. **Space over lines** - Use whitespace to separate, not borders

### Hierarchy Levels
- **Primary**: Semibold, larger size (page titles, CTAs)
- **Secondary**: Regular, medium size (body text, descriptions)
- **Tertiary**: Regular, smaller size, muted color (metadata, timestamps)

---

## Implementation Plan

### Phase 1: Typography Foundation
1. Add Tiempos Text and ABC Favorit font files
2. Create CSS variables for font stacks
3. Replace all font-family declarations
4. Standardize font-weight to 400/600 only
5. Update line-height values

### Phase 2: Content Simplification
6. Remove redundant text from Private Album
7. Simplify Bin empty state
8. Simplify Albums/Moments empty states
9. Simplify Films empty state
10. Optimize Mind message timestamps

### Phase 3: Spacing Standardization
11. Apply consistent spacing scale
12. Remove irregular spacing values
13. Update component gaps

### Phase 4: Verification
14. Visual regression testing
15. Mobile responsiveness check
16. Accessibility audit (contrast, readability)

---

## Success Criteria

- [ ] All text uses Tiempos Text or ABC Favorit
- [ ] Only font-weight 400 and 600 in use
- [ ] No redundant explanatory text in empty states
- [ ] Consistent spacing throughout
- [ ] Improved readability (subjective, user feedback)
- [ ] No visual regressions

---

## Notes

- Font files need to be self-hosted or loaded from CDN
- Fallback fonts ensure graceful degradation
- Changes are reversible via git
- Focus on Albums/Moments, Mind, Films first
- Can expand to other views later

---

**Approved by**: Gilbert  
**Implementation**: Ready to proceed
