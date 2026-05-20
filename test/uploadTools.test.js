import assert from 'node:assert/strict';

import { resolveFileExt, sanitizeFileName } from '../functions/upload/uploadTools.js';

describe('upload tools', () => {
  it('sanitizes malformed percent-encoded filenames instead of throwing', () => {
    assert.doesNotThrow(() => sanitizeFileName('bad%name.jpg'));
    assert.equal(sanitizeFileName('bad%name.jpg'), 'bad_name.jpg');
  });

  it('preserves HEIC and HEIF extensions when resolving upload file ids', () => {
    assert.equal(resolveFileExt('IMG_2038.HEIC', 'image/heic'), 'heic');
    assert.equal(resolveFileExt('IMG_2039.heif', 'application/octet-stream'), 'heif');
  });
});
