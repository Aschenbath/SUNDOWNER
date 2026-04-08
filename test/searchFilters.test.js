import assert from 'node:assert/strict';

import {
  countActiveMediaSearchFilters,
  createEmptyMediaSearchFilters,
  matchesMediaSearchFilters,
  normalizeMediaSearchFilters,
  parseMediaSearchQuery,
  summarizeMediaSearch,
} from '../js/media-library/search-filters.js';

describe('media search filters', () => {
  it('normalizes empty filter state', () => {
    assert.deepEqual(normalizeMediaSearchFilters(), createEmptyMediaSearchFilters());
    assert.equal(countActiveMediaSearchFilters({}), 0);
  });

  it('parses inline type and location tokens from a single search query', () => {
    const parsed = parseMediaSearchQuery('sunset type:video loc:"guangzhou riverside"');

    assert.equal(parsed.textQuery, 'sunset');
    assert.deepEqual(parsed.filters, {
      type: 'video',
      locationQuery: 'guangzhou riverside',
    });
  });

  it('filters by media type and location', () => {
    const filters = normalizeMediaSearchFilters({
      type: 'video',
      locationQuery: 'guangzhou',
    });

    assert.equal(matchesMediaSearchFilters({
      type: 'video',
      location: 'Guangzhou Riverside',
      isDocumentLike: false,
      tags: [],
      personLabels: [],
    }, filters), true);

    assert.equal(matchesMediaSearchFilters({
      type: 'photo',
      location: 'Guangzhou Riverside',
      isDocumentLike: false,
      tags: [],
      personLabels: [],
    }, filters), false);

    assert.equal(matchesMediaSearchFilters({
      type: 'video',
      location: 'Shenzhen',
      isDocumentLike: false,
      tags: [],
      personLabels: [],
    }, filters), false);
  });

  it('supports document facet and builds readable summaries', () => {
    const filters = {
      type: 'document',
      locationQuery: 'park',
    };

    assert.equal(matchesMediaSearchFilters({
      type: 'photo',
      location: 'Park archive',
      isDocumentLike: true,
      tags: ['scan'],
      personLabels: [],
    }, filters), true);

    assert.deepEqual(summarizeMediaSearch(filters), [
      'Documents',
      'Location: park',
    ]);
    assert.equal(countActiveMediaSearchFilters(filters), 2);
  });
});
