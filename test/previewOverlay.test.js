import assert from 'node:assert/strict';

import { PREVIEW_PANEL_SECTION_SELECTORS } from '../js/media-library/preview-overlay.js';

describe('preview overlay sync selectors', () => {
  it('keeps the add-to-album side panel in preview transient sync', () => {
    assert.deepEqual(PREVIEW_PANEL_SECTION_SELECTORS, [
      '.cml-preview__main',
      '.cml-preview__info',
      '.cml-preview__album-panel'
    ]);
  });
});
