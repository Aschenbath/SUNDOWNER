import assert from 'node:assert/strict';

import { normalizeExternalUploadUrl } from '../functions/upload/index.js';

describe('external upload URL normalization', () => {
  it('normalizes valid HTTP(S) URLs before they are stored as metadata', () => {
    assert.equal(
      normalizeExternalUploadUrl('  https://cdn.example.com/photo.jpg?x=1  '),
      'https://cdn.example.com/photo.jpg?x=1'
    );
  });

  it('rejects missing, malformed, and non-HTTP(S) external URLs', () => {
    assert.equal(normalizeExternalUploadUrl(''), null);
    assert.equal(normalizeExternalUploadUrl('not a url'), null);
    assert.equal(normalizeExternalUploadUrl('ftp://cdn.example.com/photo.jpg'), null);
    assert.equal(normalizeExternalUploadUrl('javascript:alert(1)'), null);
  });
});
