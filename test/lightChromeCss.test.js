import assert from 'node:assert/strict';
import fs from 'node:fs';

describe('light chrome CSS', () => {
  const css = fs.readFileSync(new URL('../css/media-library.css', import.meta.url), 'utf8');

  it('defines dedicated light-mode tokens for topbar, search, dialog, and preview chrome', () => {
    assert.match(css, /--cml-theme-topbar-bg:/);
    assert.match(css, /--cml-theme-search-bg:/);
    assert.match(css, /--cml-theme-dialog-backdrop:/);
    assert.match(css, /--cml-theme-dialog-surface:/);
    assert.match(css, /--cml-theme-overlay-scrim:/);
    assert.match(css, /--cml-theme-preview-header-bg:/);
    assert.match(css, /data-cml-theme-mode="light"[\s\S]*--cml-theme-topbar-bg:/);
  });

  it('routes topbar, dialog, storage panel, and preview backdrop through semantic chrome tokens', () => {
    assert.match(css, /#codex-media-library-root \.cml-topbar \{[\s\S]*background: var\(--cml-theme-topbar-bg\);/);
    assert.match(css, /#codex-media-library-root \.cml-topbar__search \{[\s\S]*background: var\(--cml-theme-search-bg\);/);
    assert.match(css, /#codex-media-library-root \.cml-dialog__backdrop \{[\s\S]*background: var\(--cml-theme-dialog-backdrop\);/);
    assert.match(css, /#codex-media-library-root \.cml-dialog__panel \{[\s\S]*background: var\(--cml-theme-dialog-surface\);/);
    assert.match(css, /#codex-media-library-root \.cml-storage-strip \{[\s\S]*background: var\(--cml-theme-storage-strip-bg\);/);
    assert.match(css, /#codex-media-library-root \.cml-storage-panel__panel \{[\s\S]*background: var\(--cml-theme-storage-panel-bg\);/);
    assert.match(css, /#codex-media-library-root \.cml-storage-panel__summary-card \{[\s\S]*var\(--cml-theme-surface-elevated\)/);
    assert.match(css, /#codex-media-library-root \.cml-preview__backdrop \{[\s\S]*background: var\(--cml-theme-overlay-scrim\);/);
    assert.match(css, /#codex-media-library-root \.cml-preview__header \{[\s\S]*background: var\(--cml-theme-preview-header-bg\);/);
    assert.match(css, /#codex-media-library-root \.cml-preview__info-toolbar \{[\s\S]*background: var\(--cml-theme-preview-info-toolbar-bg\);/);
    assert.match(css, /#codex-media-library-root \.cml-preview__info-section--editable \{[\s\S]*background: var\(--cml-theme-preview-info-card-bg\);/);
    assert.match(css, /#codex-media-library-root \.cml-preview__info-category-value,[\s\S]*color: var\(--cml-theme-preview-info-value\);/);
  });

  it('uses dedicated scrubber tokens so light timeline chrome does not fall back to dark pills', () => {
    assert.match(css, /--cml-theme-scrubber-badge-bg:/);
    assert.match(css, /--cml-theme-scrubber-dot:/);
    assert.match(css, /--cml-theme-scrubber-year:/);
    assert.match(css, /#codex-media-library-root \.cml-scrubber__badge \{[\s\S]*background: var\(--cml-theme-scrubber-badge-bg\);/);
    assert.match(css, /#codex-media-library-root \.cml-scrubber__dot \{[\s\S]*background: var\(--cml-theme-scrubber-dot\);/);
    assert.match(css, /#codex-media-library-root \.cml-scrubber__year-label \{[\s\S]*color: var\(--cml-theme-scrubber-year\);/);
  });

  it('builds the Google-Photos-like light shell with a shared outer surface and an inner rounded content panel', () => {
    assert.match(css, /--cml-theme-content-panel-bg:/);
    assert.match(css, /--cml-theme-shell-base: color-mix\(in srgb, white 80%, var\(--cml-theme-accent\) 20%\);/);
    assert.match(css, /#codex-media-library-root \.cml-sidebar \{[\s\S]*background: var\(--cml-theme-sidebar-bg\);/);
    assert.match(css, /#codex-media-library-root \.cml-main-shell \{[\s\S]*background: var\(--cml-theme-page-bg\);/);
    assert.match(css, /#codex-media-library-root \.cml-main-content-shell \{[\s\S]*border-radius: 28px;[\s\S]*background: var\(--cml-theme-content-panel-bg, transparent\);/);
  });

  it('keeps light shell accent-aware instead of hard-coding Google blue for all theme colors', () => {
    assert.match(css, /--cml-theme-nav-active-bg: color-mix\(in srgb, white 72%, var\(--cml-theme-accent\) 28%\);/);
    assert.match(css, /--cml-theme-search-bg: color-mix\(in srgb, white 84%, var\(--cml-theme-accent\) 16%\);/);
    assert.match(css, /--cml-theme-storage-strip-bg: color-mix\(in srgb, white 74%, var\(--cml-theme-accent\) 26%\);/);
    assert.match(css, /--cml-theme-storage-panel-bg: color-mix\(in srgb, white 84%, var\(--cml-theme-accent\) 16%\);/);
    assert.match(css, /#codex-media-library-root \.cml-storage-strip__meter span \{[\s\S]*var\(--cml-theme-accent\)/);
    assert.match(css, /--cml-theme-scrubber-dot-active: var\(--cml-theme-accent\);/);
    assert.match(css, /--cml-theme-avatar-btn-hover-bg: color-mix\(in srgb, white 74%, var\(--cml-theme-accent\) 26%\);/);
  });

  it('keeps preview chrome neutral in light mode so photos still inspect on dark surfaces', () => {
    assert.match(css, /--cml-theme-preview-header-bg: linear-gradient\(180deg, rgba\(8, 9, 11, 0\.86\), rgba\(8, 9, 11, 0\)\);/);
    assert.match(css, /--cml-theme-preview-info-toolbar-bg: rgba\(21, 22, 25, 0\.92\);/);
    assert.match(css, /--cml-theme-preview-info-card-bg: rgba\(255, 255, 255, 0\.055\);/);
    assert.match(css, /--cml-theme-preview-info-value: #f3f6fb;/);
    assert.match(css, /--cml-theme-preview-info-meta: #c2cad6;/);
    assert.doesNotMatch(css, /--cml-theme-preview-info-card-bg: rgba\(255, 255, 255, 0\.025\);/);
    assert.doesNotMatch(css, /--cml-theme-preview-info-value: #e8eaed;/);
  });

  it('uses readable light-mode avatar menu tokens instead of hard-coded dark dropdown colors', () => {
    assert.match(css, /--cml-theme-avatar-menu-bg:/);
    assert.match(css, /#codex-media-library-root \.cml-avatar-menu \{[\s\S]*background: var\(--cml-theme-avatar-menu-bg\);/);
    assert.match(css, /#codex-media-library-root \.cml-avatar-menu__name \{[\s\S]*color: var\(--cml-theme-avatar-menu-name\);/);
    assert.match(css, /#codex-media-library-root \.cml-avatar-menu__item \{[\s\S]*color: var\(--cml-theme-avatar-menu-item\);/);
  });
});
