# Minimalist UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify SUNDOWNER UI by reducing font chaos (20+ weights → 2), removing redundant text, and improving typography/spacing.

**Architecture:** CSS-first refactor with component text cleanup. No structural changes, only visual/content refinement.

**Tech Stack:** CSS (media-library.css), JavaScript components (components.js, films-components.js)

---

## File Structure

**Modified Files:**
- `css/media-library.css` - Typography system, spacing, font weights
- `js/media-library/components.js` - Albums, Moments, Mind, Bin, Private album text
- `js/media-library/films-components.js` - Films empty states and card text
- `js/media-library/app.js` - Remove TODO placeholders
- `js/media-library/data.js` - Clean up filter arrays
- `functions/pages/index.html` - Add Inter font CDN link

---

## Task 1: Add Inter Font

**Files:**
- Modify: `functions/pages/index.html`

- [ ] **Step 1: Add Inter font link to HTML head**

Find the `<head>` section and add before closing `</head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Verify font loads in browser**

Open the app in browser, check Network tab for:
- `css2?family=Inter:wght@400;600` - Status 200
- Font files loaded successfully

- [ ] **Step 3: Commit**

```bash
git add functions/pages/index.html
git commit -m "feat: add Inter font from Google Fonts

- Load Inter 400 and 600 weights
- Preconnect to fonts.googleapis.com for faster load

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Create Typography CSS Variables

**Files:**
- Modify: `css/media-library.css` (add at top, after existing variables)

- [ ] **Step 1: Add typography variables**

Add after existing CSS variables (around line 50-100):

```css
/* Typography System */
:root {
  --cml-font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --cml-font-weight-regular: 400;
  --cml-font-weight-semibold: 600;
  
  /* Font Sizes */
  --cml-font-size-hero: clamp(28px, 3.5vw, 32px);
  --cml-font-size-title: clamp(16px, 2vw, 18px);
  --cml-font-size-body: 15px;
  --cml-font-size-small: 13px;
  
  /* Line Heights */
  --cml-line-height-title: 1.3;
  --cml-line-height-body: 1.7;
  --cml-line-height-small: 1.4;
  
  /* Spacing */
  --cml-spacing-section: 32px;
  --cml-spacing-component: 24px;
  --cml-spacing-card: 18px;
  --cml-spacing-text: 10px;
}
```

- [ ] **Step 2: Verify variables are defined**

Search CSS file for `:root` - should see new typography variables

- [ ] **Step 3: Commit**

```bash
git add css/media-library.css
git commit -m "feat: add typography CSS variables

- Define Inter font family
- Set font weights (400, 600)
- Define font sizes and line heights
- Add spacing system variables

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Replace All Font-Weight Declarations

**Files:**
- Modify: `css/media-library.css`

- [ ] **Step 1: Replace font-weight: 300 with 400**

Find and replace all instances:
```
font-weight: 300; → font-weight: var(--cml-font-weight-regular);
```

- [ ] **Step 2: Replace font-weight: 400-560 with 400**

Find and replace:
```
font-weight: 400; → font-weight: var(--cml-font-weight-regular);
font-weight: 450; → font-weight: var(--cml-font-weight-regular);
font-weight: 500; → font-weight: var(--cml-font-weight-regular);
font-weight: 520; → font-weight: var(--cml-font-weight-regular);
font-weight: 540; → font-weight: var(--cml-font-weight-regular);
font-weight: 560; → font-weight: var(--cml-font-weight-regular);
```

- [ ] **Step 3: Replace font-weight: 600-850 with 600**

Find and replace:
```
font-weight: 600; → font-weight: var(--cml-font-weight-semibold);
font-weight: 620; → font-weight: var(--cml-font-weight-semibold);
font-weight: 640; → font-weight: var(--cml-font-weight-semibold);
font-weight: 650; → font-weight: var(--cml-font-weight-semibold);
font-weight: 660; → font-weight: var(--cml-font-weight-semibold);
font-weight: 680; → font-weight: var(--cml-font-weight-semibold);
font-weight: 700; → font-weight: var(--cml-font-weight-semibold);
font-weight: 720; → font-weight: var(--cml-font-weight-semibold);
font-weight: 740; → font-weight: var(--cml-font-weight-semibold);
font-weight: 750; → font-weight: var(--cml-font-weight-semibold);
font-weight: 760; → font-weight: var(--cml-font-weight-semibold);
font-weight: 780; → font-weight: var(--cml-font-weight-semibold);
font-weight: 800; → font-weight: var(--cml-font-weight-semibold);
font-weight: 820; → font-weight: var(--cml-font-weight-semibold);
font-weight: 850; → font-weight: var(--cml-font-weight-semibold);
```

- [ ] **Step 4: Verify all font-weights replaced**

Run: `grep -E "font-weight: [0-9]" css/media-library.css | grep -v "var(--cml"`

Expected: No results (all font-weights now use variables)

- [ ] **Step 5: Commit**

```bash
git add css/media-library.css
git commit -m "refactor: unify font weights to 400 and 600

- Replace 20+ font weights with 2 variables
- Use --cml-font-weight-regular (400) for body text
- Use --cml-font-weight-semibold (600) for titles

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Standardize Font Family to Inter

**Files:**
- Modify: `css/media-library.css`

- [ ] **Step 1: Replace all font-family declarations**

Find and replace all instances:
```
font-family: Georgia, "Times New Roman", ui-serif, serif; → font-family: var(--cml-font-family);
font-family: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif; → font-family: var(--cml-font-family);
font-family: "Times New Roman", Times, serif; → font-family: var(--cml-font-family);
font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; → font-family: var(--cml-font-family);
```

Keep monospace fonts for code:
```
font-family: "Cascadia Code", "SFMono-Regular", Consolas, monospace; → (keep as is)
```

- [ ] **Step 2: Add base font-family to root**

Find `#codex-media-library-root` selector and add:

```css
#codex-media-library-root {
  font-family: var(--cml-font-family);
  /* existing properties */
}
```

- [ ] **Step 3: Verify font-family unified**

Run: `grep "font-family:" css/media-library.css | grep -v "var(--cml-font-family)" | grep -v "monospace"`

Expected: No results (except monospace for code)

- [ ] **Step 4: Commit**

```bash
git add css/media-library.css
git commit -m "refactor: unify font family to Inter

- Replace all serif/sans-serif fonts with Inter
- Keep monospace fonts for code blocks
- Set base font-family on root element

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Update Line Heights

**Files:**
- Modify: `css/media-library.css`

- [ ] **Step 1: Update title line heights**

Find all title selectors and update:

```css
.cml-empty-state__title,
.cml-view-summary__title,
.cml-private-access__title {
  line-height: var(--cml-line-height-title);
}
```

- [ ] **Step 2: Update body text line heights**

Find all body text selectors and update:

```css
.cml-empty-state__copy,
.cml-view-summary__copy,
.cml-private-access__copy,
.cml-message__text {
  line-height: var(--cml-line-height-body);
}
```

- [ ] **Step 3: Update small text line heights**

Find all small text selectors and update:

```css
.cml-timestamp,
.cml-metadata,
.cml-tag {
  line-height: var(--cml-line-height-small);
}
```

- [ ] **Step 4: Verify line heights improved**

Open app in browser, check:
- Titles: tighter spacing (1.3)
- Body text: more readable (1.7)
- Small text: balanced (1.4)

- [ ] **Step 5: Commit**

```bash
git add css/media-library.css
git commit -m "refactor: improve line heights for readability

- Titles: 1.3 (tighter)
- Body: 1.7 (more readable)
- Small text: 1.4 (balanced)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Remove Redundant Text from Private Album

**Files:**
- Modify: `js/media-library/components.js`

- [ ] **Step 1: Find PrivateAlbumGate component**

Search for `export function PrivateAlbumGate` (around line 3494)

- [ ] **Step 2: Remove redundant text**

Replace the component with:

```javascript
export function PrivateAlbumGate({ error = '', value = '' }) {
  return `
    <section class="cml-private-access" aria-label="Private access">
      <div class="cml-private-access__header">
        <div class="cml-private-access__icon" aria-hidden="true">${icon('lock')}</div>
        <div>
          <p class="cml-private-access__eyebrow">Private</p>
          <h2 class="cml-private-access__title">Unlock private album</h2>
        </div>
      </div>
      <form class="cml-private-access__form" data-form="private-access">
        <input
          type="text"
          name="username"
          autocomplete="username"
          value="private"
          hidden
          tabindex="-1"
        />
        <input
          type="password"
          name="password"
          class="cml-private-access__input"
          data-private-access="password"
          placeholder="Password"
          autocomplete="current-password"
          value="${escapeHtml(value)}"
        />
      </form>
      ${error ? `<p class="cml-private-access__error">${escapeHtml(error)}</p>` : ''}
    </section>
  `;
}
```

Removed:
- "Enter your password to view hidden photos and videos."
- "This unlock only lasts for the current visit."
- Status dot and text

- [ ] **Step 3: Verify component renders correctly**

Open app, navigate to Private album:
- Should see: Icon + "PRIVATE" + "Unlock private album" + Password input
- Should NOT see: Long descriptions, status text

- [ ] **Step 4: Commit**

```bash
git add js/media-library/components.js
git commit -m "refactor: simplify private album gate text

- Remove redundant instructions
- Remove status message
- Keep only: icon, title, password input

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Simplify Bin Empty State

**Files:**
- Modify: `js/media-library/components.js`

- [ ] **Step 1: Find Bin empty state**

Search for `Bin is empty` (around line 4200)

- [ ] **Step 2: Simplify empty state text**

Find the empty state section and replace with:

```javascript
? `
  <section class="cml-empty-state">
    <div class="cml-empty-state__icon">${icon('trash')}</div>
    <h2 class="cml-empty-state__title">Bin is empty</h2>
  </section>
`
```

Removed:
- "Items you delete will appear here for up to 45 days before permanent removal."

- [ ] **Step 3: Verify empty state renders**

Open app, navigate to Bin (empty):
- Should see: Trash icon + "Bin is empty"
- Should NOT see: Long description

- [ ] **Step 4: Commit**

```bash
git add js/media-library/components.js
git commit -m "refactor: simplify bin empty state

- Remove redundant description
- Keep only: icon + title

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Simplify Albums/Moments Empty States

**Files:**
- Modify: `js/media-library/components.js`

- [ ] **Step 1: Find MomentsView empty state**

Search for `export function MomentsView` (around line 1370)

- [ ] **Step 2: Simplify empty state**

Find the empty state section and simplify:

```javascript
? `
  <section class="cml-empty-state">
    <div class="cml-empty-state__icon">${icon('calendar')}</div>
    <h2 class="cml-empty-state__title">No moments yet</h2>
  </section>
`
```

- [ ] **Step 3: Find Albums empty state**

Search for album-related empty states and apply same pattern

- [ ] **Step 4: Verify empty states render**

Open app, check:
- Moments (empty): Icon + "No moments yet"
- Albums (empty): Icon + title only

- [ ] **Step 5: Commit**

```bash
git add js/media-library/components.js
git commit -m "refactor: simplify albums and moments empty states

- Remove verbose descriptions
- Keep only: icon + title

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Simplify Films Empty State

**Files:**
- Modify: `js/media-library/films-components.js`

- [ ] **Step 1: Find Films empty state**

Search for films empty state component

- [ ] **Step 2: Simplify empty state text**

Replace with minimal version:

```javascript
<section class="cml-empty-state">
  <div class="cml-empty-state__icon">${icon('film')}</div>
  <h2 class="cml-empty-state__title">No films yet</h2>
</section>
```

- [ ] **Step 3: Verify empty state renders**

Open app, navigate to Films (empty):
- Should see: Film icon + "No films yet"
- Should NOT see: Long instructions about TMDb

- [ ] **Step 4: Commit**

```bash
git add js/media-library/films-components.js
git commit -m "refactor: simplify films empty state

- Remove TMDb instructions
- Keep only: icon + title

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Remove TODO Placeholders

**Files:**
- Modify: `js/media-library/app.js`
- Modify: `js/media-library/data.js`
- Modify: `js/media-library/components.js`

- [ ] **Step 1: Find all TODO references in app.js**

Run: `grep -n "TODO" js/media-library/app.js`

Expected: Multiple lines with 'TODO' string

- [ ] **Step 2: Remove TODO from filter arrays**

In `app.js`, find and remove 'TODO' from arrays:

```javascript
// Before
return ['', 'Videos', 'Documents', 'Favourites', 'TODO'].includes(normalized)

// After
return ['', 'Videos', 'Documents', 'Favourites'].includes(normalized)
```

- [ ] **Step 3: Remove TODO case statements**

Find and remove:

```javascript
// Remove these
if (label === 'TODO') {
  // ...
}

case 'TODO':
  // ...
```

- [ ] **Step 4: Clean up data.js**

In `data.js`, remove 'TODO' from secondary filter array:

```javascript
// Before
secondary: ['TODO', 'Videos', 'Documents', 'Favourites']

// After
secondary: ['Videos', 'Documents', 'Favourites']
```

- [ ] **Step 5: Clean up components.js**

Remove TODO from icon and label mappings:

```javascript
// Remove
TODO: 'updates',
TODO: 'Unsorted'
```

- [ ] **Step 6: Verify no TODO placeholders remain**

Run: `grep -r "TODO" js/media-library/*.js | grep -v "node_modules" | grep -v "// TODO:"`

Expected: No results (except legitimate code comments)

- [ ] **Step 7: Commit**

```bash
git add js/media-library/app.js js/media-library/data.js js/media-library/components.js
git commit -m "refactor: remove TODO placeholders

- Remove TODO from filter arrays
- Remove TODO case statements
- Remove TODO icon/label mappings

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Apply Consistent Spacing

**Files:**
- Modify: `css/media-library.css`

- [ ] **Step 1: Update section gaps**

Find section containers and update:

```css
.cml-view-summary,
.cml-bin-view,
.cml-moments-view {
  gap: var(--cml-spacing-section);
}
```

- [ ] **Step 2: Update component gaps**

Find component containers and update:

```css
.cml-empty-state,
.cml-private-access {
  gap: var(--cml-spacing-component);
}
```

- [ ] **Step 3: Update card padding**

Find card elements and update:

```css
.cml-collection-card,
.cml-film-card {
  padding: var(--cml-spacing-card);
}
```

- [ ] **Step 4: Verify spacing consistency**

Open app in browser, check:
- Sections have 32px gaps
- Components have 24px gaps
- Cards have 18px padding

- [ ] **Step 5: Commit**

```bash
git add css/media-library.css
git commit -m "refactor: apply consistent spacing system

- Section gaps: 32px
- Component gaps: 24px
- Card padding: 18px

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Final Verification and Testing

**Files:**
- Test: All views in browser

- [ ] **Step 1: Test Albums view**

Open Albums:
- Font: Inter
- Weights: Only 400 and 600
- Empty state: Icon + title only
- Spacing: Consistent

- [ ] **Step 2: Test Moments view**

Open Moments:
- Font: Inter
- Empty state: Simplified
- Line heights: Readable (1.7)

- [ ] **Step 3: Test Mind view**

Open Mind:
- Font: Inter
- Messages: Clean typography
- No redundant timestamps

- [ ] **Step 4: Test Films view**

Open Films:
- Font: Inter
- Empty state: Icon + title only
- Cards: Clean layout

- [ ] **Step 5: Test Bin view**

Open Bin:
- Font: Inter
- Empty state: Icon + "Bin is empty" only
- Centered layout

- [ ] **Step 6: Test Private album**

Open Private:
- Font: Inter
- No redundant text
- Clean, centered layout

- [ ] **Step 7: Verify no console errors**

Open DevTools Console:
- No errors related to missing fonts
- No CSS warnings

- [ ] **Step 8: Verify font loading**

Check Network tab:
- Inter font loaded (200 status)
- Font weights: 400 and 600 only

- [ ] **Step 9: Push all changes**

```bash
git push origin main
```

Expected: All commits pushed successfully

- [ ] **Step 10: Final commit (if needed)**

If any final tweaks needed:

```bash
git add -A
git commit -m "chore: final UI polish

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

## Success Criteria Checklist

- [ ] Font weights reduced from 20+ to 2 (400, 600)
- [ ] Font family unified to Inter
- [ ] All redundant text removed from components
- [ ] Line heights improved (1.7 for body text)
- [ ] Spacing system applied consistently
- [ ] No 'TODO' placeholders in production code
- [ ] Visual hierarchy clear and consistent
- [ ] All views tested and verified

---

## Rollback Plan

If issues arise:

```bash
# Revert all changes
git log --oneline -15
git revert <commit-hash>..HEAD
git push origin main
```

Or revert specific commits:

```bash
git revert <commit-hash>
git push origin main
```
