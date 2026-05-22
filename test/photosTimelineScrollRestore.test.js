import assert from 'node:assert/strict';
import {
  lastViewedHashKey,
  parseLastViewedHash,
  LAST_VIEWED_HASH_PREFIX,
} from '../js/media-library/preview-overlay.js';

describe('photos timeline scroll restore', () => {
  it('exposes LAST_VIEWED_HASH_PREFIX = lvi-', () => {
    assert.equal(LAST_VIEWED_HASH_PREFIX, 'lvi-');
  });

  it('lastViewedHashKey wraps an item id with the prefix', () => {
    assert.equal(lastViewedHashKey('abc123'), 'lvi-abc123');
  });

  it('lastViewedHashKey returns empty string for falsy id', () => {
    assert.equal(lastViewedHashKey(''), '');
    assert.equal(lastViewedHashKey(null), '');
    assert.equal(lastViewedHashKey(undefined), '');
  });

  it('parseLastViewedHash strips the prefix', () => {
    assert.equal(parseLastViewedHash('lvi-abc123'), 'abc123');
    assert.equal(parseLastViewedHash('#lvi-abc123'), 'abc123');
  });

  it('parseLastViewedHash returns null when prefix is missing', () => {
    assert.equal(parseLastViewedHash('something-else'), null);
    assert.equal(parseLastViewedHash(''), null);
    assert.equal(parseLastViewedHash('#'), null);
  });

  it('parseLastViewedHash is reflexive with lastViewedHashKey', () => {
    const id = 'photo-id-x9';
    assert.equal(parseLastViewedHash(lastViewedHashKey(id)), id);
  });
});
