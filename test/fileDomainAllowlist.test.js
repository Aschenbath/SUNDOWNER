import assert from 'node:assert/strict';

import { isDomainAllowed } from '../functions/file/fileTools.js';

describe('file domain allowlist hardening', () => {
  it('matches full hostnames safely without regex overreach', () => {
    const allowed = isDomainAllowed({
      Referer: 'https://cdn.example.com/photo',
      securityConfig: { access: { allowedDomains: 'example.com' } },
      url: new URL('https://example.com/file/test.jpg'),
    });
    assert.equal(allowed, true);
  });

  it('rejects crafted lookalike hostnames', () => {
    const allowed = isDomainAllowed({
      Referer: 'https://exampleXcom.evil.com/photo',
      securityConfig: { access: { allowedDomains: 'example.com' } },
      url: new URL('https://example.com/file/test.jpg'),
    });
    assert.equal(allowed, false);
  });

  it('rejects requests without Referer when an allowlist is configured', () => {
    const allowed = isDomainAllowed({
      Referer: null,
      securityConfig: { access: { allowedDomains: 'example.com' } },
      url: new URL('https://example.com/file/test.jpg'),
    });
    assert.equal(allowed, false);
  });

  it('allows requests without Referer when no allowlist is configured', () => {
    const allowed = isDomainAllowed({
      Referer: null,
      securityConfig: { access: { allowedDomains: '' } },
      url: new URL('https://example.com/file/test.jpg'),
    });
    assert.equal(allowed, true);
  });
});
