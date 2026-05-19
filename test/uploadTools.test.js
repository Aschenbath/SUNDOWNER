import assert from 'node:assert/strict';

import { sanitizeFileName } from '../functions/upload/uploadTools.js';

describe('upload tools', () => {
  it('sanitizes malformed percent-encoded filenames instead of throwing', () => {
    assert.doesNotThrow(() => sanitizeFileName('bad%name.jpg'));
    assert.equal(sanitizeFileName('bad%name.jpg'), 'bad_name.jpg');
  });
});
