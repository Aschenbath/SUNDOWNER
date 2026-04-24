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
    assert.match(css, /#codex-media-library-root \.cml-storage-panel__summary-card \{[\s\S]*var\(--cml-theme-surface-elevated\)/);
    assert.match(css, /#codex-media-library-root \.cml-preview__backdrop \{[\s\S]*background: var\(--cml-theme-overlay-scrim\);/);
    assert.match(css, /#codex-media-library-root \.cml-preview__header \{[\s\S]*background: var\(--cml-theme-preview-header-bg\);/);
  });

  it('uses dedicated scrubber tokens so light timeline chrome does not fall back to dark pills', () => {
    assert.match(css, /--cml-theme-scrubber-badge-bg:/);
    assert.match(css, /--cml-theme-scrubber-dot:/);
    assert.match(css, /--cml-theme-scrubber-year:/);
    assert.match(css, /#codex-media-library-root \.cml-scrubber__badge \{[\s\S]*background: var\(--cml-theme-scrubber-badge-bg\);/);
    assert.match(css, /#codex-media-library-root \.cml-scrubber__dot \{[\s\S]*background: var\(--cml-theme-scrubber-dot\);/);
    assert.match(css, /#codex-media-library-root \.cml-scrubber__year-label \{[\s\S]*color: var\(--cml-theme-scrubber-year\);/);
  });
});
