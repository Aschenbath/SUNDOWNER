import assert from 'node:assert/strict';

import { decodeFileRoutePath } from '../functions/file/[[path]].js';

describe('/file catch-all path decoding', () => {
  it('preserves an encoded comma inside a real file name', () => {
    assert.equal(
      decodeFileRoutePath('photos/research%2Cfinal.jpg'),
      'photos/research,final.jpg',
    );
  });

  it('keeps legacy comma-separated directory routes compatible', () => {
    assert.equal(
      decodeFileRoutePath('photos,2026,field%20notes.jpg'),
      'photos/2026/field notes.jpg',
    );
  });

  it('normalizes array-shaped Cloudflare catch-all params', () => {
    assert.equal(
      decodeFileRoutePath(['photos', 'research%2Cfinal.jpg']),
      'photos/research,final.jpg',
    );
  });

  it('preserves a literal comma when array segments already express directory boundaries', () => {
    assert.equal(
      decodeFileRoutePath(['photos', 'research,final.jpg']),
      'photos/research,final.jpg',
    );
  });

  it('fails closed on malformed percent encoding', () => {
    assert.throws(() => decodeFileRoutePath('photos/bad%name.jpg'), URIError);
  });
});
