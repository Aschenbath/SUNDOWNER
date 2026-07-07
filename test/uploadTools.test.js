import assert from 'node:assert/strict';

import { getUploadIp, resolveFileExt, sanitizeFileName } from '../functions/upload/uploadTools.js';

describe('upload tools', () => {
  it('sanitizes malformed percent-encoded filenames instead of throwing', () => {
    assert.doesNotThrow(() => sanitizeFileName('bad%name.jpg'));
    assert.equal(sanitizeFileName('bad%name.jpg'), 'bad_name.jpg');
  });

  it('preserves HEIC and HEIF extensions when resolving upload file ids', () => {
    assert.equal(resolveFileExt('IMG_2038.HEIC', 'image/heic'), 'heic');
    assert.equal(resolveFileExt('IMG_2039.heif', 'application/octet-stream'), 'heif');
  });

  it('trusts Cloudflare upload IP and ignores spoofable forwarded headers', () => {
    const request = new Request('https://example.com/upload', {
      headers: {
        'CF-Connecting-IP': '203.0.113.10',
        'X-Forwarded-For': '198.51.100.1, 198.51.100.2',
        'X-Real-IP': '198.51.100.3',
      },
    });

    assert.equal(getUploadIp(request), '203.0.113.10');
  });

  it('does not derive upload IP from client-controlled forwarding headers', () => {
    const request = new Request('https://example.com/upload', {
      headers: {
        'X-Forwarded-For': '198.51.100.1, 198.51.100.2',
        'X-Real-IP': '198.51.100.3',
        'True-Client-IP': '198.51.100.4',
      },
    });

    assert.equal(getUploadIp(request), null);
  });

  it('rejects comma-separated Cloudflare upload IP values', () => {
    const request = new Request('https://example.com/upload', {
      headers: {
        'CF-Connecting-IP': '203.0.113.10, 198.51.100.1',
      },
    });

    assert.equal(getUploadIp(request), null);
  });
});
