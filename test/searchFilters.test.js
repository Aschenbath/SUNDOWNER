import assert from 'node:assert/strict';

import {
  collectLocationSuggestions,
  countActiveMediaSearchFilters,
  createEmptyMediaSearchFilters,
  matchesMediaSearchFilters,
  normalizeMediaSearchFilters,
  summarizeMediaSearch,
} from '../js/media-library/search-filters.js';

describe('media search filters', () => {
  it('normalizes empty filter state', () => {
    assert.deepEqual(normalizeMediaSearchFilters(), createEmptyMediaSearchFilters());
    assert.equal(countActiveMediaSearchFilters({}), 0);
  });

  it('filters by media type, location, and inclusive date range', () => {
    const filters = normalizeMediaSearchFilters({
      type: 'video',
      locationQuery: 'guangzhou',
      dateFrom: '2026-04-06',
      dateTo: '2026-04-07',
    });

    assert.equal(matchesMediaSearchFilters({
      type: 'video',
      location: 'Guangzhou Riverside',
      year: 2026,
      month: 4,
      day: 6,
      isDocumentLike: false,
      tags: [],
      personLabels: [],
    }, filters), true);

    assert.equal(matchesMediaSearchFilters({
      type: 'photo',
      location: 'Guangzhou Riverside',
      year: 2026,
      month: 4,
      day: 6,
      isDocumentLike: false,
      tags: [],
      personLabels: [],
    }, filters), false);

    assert.equal(matchesMediaSearchFilters({
      type: 'video',
      location: 'Shenzhen',
      year: 2026,
      month: 4,
      day: 6,
      isDocumentLike: false,
      tags: [],
      personLabels: [],
    }, filters), false);

    assert.equal(matchesMediaSearchFilters({
      type: 'video',
      location: 'Guangzhou Riverside',
      year: 2026,
      month: 4,
      day: 8,
      isDocumentLike: false,
      tags: [],
      personLabels: [],
    }, filters), false);
  });

  it('supports document facet and builds readable summaries', () => {
    const filters = {
      type: 'document',
      dateFrom: '2026-04-01',
      dateTo: '',
      locationQuery: 'park',
    };

    assert.equal(matchesMediaSearchFilters({
      type: 'photo',
      location: 'Park archive',
      year: 2026,
      month: 4,
      day: 2,
      isDocumentLike: true,
      tags: ['scan'],
      personLabels: [],
    }, filters), true);

    assert.deepEqual(summarizeMediaSearch(filters), [
      'Documents',
      'From 2026-04-01',
      'Location: park',
    ]);
    assert.equal(countActiveMediaSearchFilters(filters), 3);
  });

  it('collects top location suggestions by frequency', () => {
    const suggestions = collectLocationSuggestions([
      { location: 'Guangzhou' },
      { location: 'Shenzhen' },
      { location: 'Guangzhou' },
      { location: 'Riverside' },
      { location: 'Guangzhou' },
      { location: 'Shenzhen' },
    ], 2);

    assert.deepEqual(suggestions, ['Guangzhou', 'Shenzhen']);
  });
});
