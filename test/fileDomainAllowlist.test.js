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

  it('rejects bearerless requests without Referer by default even when no allowlist is configured', () => {
    const allowed = isDomainAllowed({
      Referer: null,
      securityConfig: { access: { allowedDomains: '' } },
      url: new URL('https://example.com/file/test.jpg'),
    });
    assert.equal(allowed, false);
  });

  it('allows same-origin Referer when no allowlist is configured', () => {
    const allowed = isDomainAllowed({
      Referer: 'https://example.com/dashboard',
      securityConfig: { access: { allowedDomains: '' } },
      url: new URL('https://example.com/file/test.jpg'),
    });
    assert.equal(allowed, true);
  });

  it('allows explicit bearerless file access opt-out for legacy public deployments', () => {
    const allowed = isDomainAllowed({
      Referer: null,
      securityConfig: { access: { allowedDomains: '', allowBearerlessFileAccess: true } },
      url: new URL('https://example.com/file/test.jpg'),
    });
    assert.equal(allowed, true);
  });

  it('allows no-Referer file requests with a valid authCode header', () => {
    const allowed = isDomainAllowed({
      Referer: null,
      request: new Request('https://example.com/file/test.jpg', {
        headers: { authCode: 'user-secret' },
      }),
      securityConfig: {
        auth: { user: { authCode: 'user-secret' } },
        access: { allowedDomains: '' },
      },
      url: new URL('https://example.com/file/test.jpg'),
    });
    assert.equal(allowed, true);
  });

  it('allows no-Referer file requests with a valid authCode cookie', () => {
    const allowed = isDomainAllowed({
      Referer: null,
      request: new Request('https://example.com/file/test.jpg', {
        headers: { Cookie: 'theme=dark; authCode=user-secret' },
      }),
      securityConfig: {
        auth: { user: { authCode: 'user-secret' } },
        access: { allowedDomains: '' },
      },
      url: new URL('https://example.com/file/test.jpg'),
    });
    assert.equal(allowed, true);
  });

  it('rejects malformed authCode cookies without throwing', () => {
    const allowed = isDomainAllowed({
      Referer: null,
      request: new Request('https://example.com/file/test.jpg', {
        headers: { Cookie: 'authCode=%' },
      }),
      securityConfig: {
        auth: { user: { authCode: 'user-secret' } },
        access: { allowedDomains: '' },
      },
      url: new URL('https://example.com/file/test.jpg'),
    });
    assert.equal(allowed, false);
  });
});
