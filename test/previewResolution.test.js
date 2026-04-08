import assert from 'node:assert/strict';

import { buildMediaReferenceKeys, findPreviewMatch } from '../js/media-library/preview-resolution.js';

describe('preview resolution', () => {
  it('normalizes relative and absolute media URLs to overlapping keys', () => {
    const keys = buildMediaReferenceKeys('/file/photos/2026/pond.jpg');

    assert.ok(keys.includes('/file/photos/2026/pond.jpg'));
    assert.ok(keys.includes('https://media-library.local/file/photos/2026/pond.jpg'));
  });

  it('falls back from a stale live tile id to the current managed item via thumbnail URL', () => {
    const items = [
      {
        id: 'managed-pond',
        sourceId: 'photos/2026/pond.jpg',
        sourceUrl: '/file/photos/2026/pond.jpg',
        thumbnailUrl: 'https://sundowner-liy.pages.dev/cdn-cgi/imagedelivery/pond-thumb.jpg',
        posterUrl: ''
      }
    ];

    const match = findPreviewMatch(items, {
      id: 'live-old-pond',
      sourceHint: 'https://sundowner-liy.pages.dev/cdn-cgi/imagedelivery/pond-thumb.jpg'
    });

    assert.equal(match?.id, 'managed-pond');
  });

  it('matches file routes even when one side is relative and the other is absolute', () => {
    const items = [
      {
        id: 'managed-bridge',
        sourceId: 'photos/2026/bridge.jpg',
        sourceUrl: '/file/photos/2026/bridge.jpg',
        thumbnailUrl: '/file/photos/2026/bridge.jpg',
        posterUrl: ''
      }
    ];

    const match = findPreviewMatch(items, {
      id: 'live-old-bridge',
      sourceHint: 'https://sundowner-liy.pages.dev/file/photos/2026/bridge.jpg'
    });

    assert.equal(match?.id, 'managed-bridge');
  });
});
