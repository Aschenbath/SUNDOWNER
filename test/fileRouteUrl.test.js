import assert from 'node:assert/strict';

import {
  buildFileRoutePath,
  buildFileRouteUrl,
  buildHttpsFileRouteUrl,
  encodeFileRoutePath,
} from '../functions/utils/fileRouteUrl.js';

describe('file route URL helpers', () => {
  it('encodes each file id path segment while preserving path separators', () => {
    assert.equal(
      encodeFileRoutePath('photos/2026 trip/a?b#c & d.jpg'),
      'photos/2026%20trip/a%3Fb%23c%20%26%20d.jpg',
    );
  });

  it('builds encoded relative file route paths', () => {
    assert.equal(
      buildFileRoutePath('photos/a?b#c.jpg'),
      '/file/photos/a%3Fb%23c.jpg',
    );
  });

  it('builds encoded absolute file route URLs from origins', () => {
    assert.equal(
      buildFileRouteUrl('https://example.com/', 'photos/a?b#c.jpg'),
      'https://example.com/file/photos/a%3Fb%23c.jpg',
    );
  });

  it('builds encoded HTTPS file route URLs from hostnames', () => {
    assert.equal(
      buildHttpsFileRouteUrl('cdn.example.com', 'photos/a?b#c.jpg'),
      'https://cdn.example.com/file/photos/a%3Fb%23c.jpg',
    );
  });
});
