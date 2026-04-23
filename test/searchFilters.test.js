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
      categoryQuery: '',
      cameraQuery: '',
      tagQuery: '',
      hasLocation: false,
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

  it('supports category tokens for video classification search', () => {
    const parsed = parseMediaSearchQuery('type:video category:"travel vlog"');

    assert.equal(parsed.textQuery, '');
    assert.deepEqual(parsed.filters, {
      type: 'video',
      locationQuery: '',
      categoryQuery: 'travel vlog',
      cameraQuery: '',
      tagQuery: '',
      hasLocation: false,
    });

    assert.equal(matchesMediaSearchFilters({
      type: 'video',
      videoCategory: 'Travel vlog',
      isDocumentLike: false,
      tags: [],
      personLabels: [],
      location: '',
    }, parsed.filters), true);

    assert.equal(matchesMediaSearchFilters({
      type: 'video',
      videoCategory: '',
      isDocumentLike: false,
      tags: ['travel vlog'],
      personLabels: [],
      location: '',
    }, parsed.filters), false);

    assert.deepEqual(summarizeMediaSearch(parsed.filters), [
      'Videos',
      'Category: travel vlog',
    ]);
    assert.equal(countActiveMediaSearchFilters(parsed.filters), 2);
  });

  it('supports camera, tag, and has:location facets for richer metadata search', () => {
    const parsed = parseMediaSearchQuery('camera:"Canon EOS" tag:night has:location');

    assert.equal(parsed.textQuery, '');
    assert.deepEqual(parsed.filters, {
      type: 'all',
      locationQuery: '',
      categoryQuery: '',
      cameraQuery: 'Canon EOS',
      tagQuery: 'night',
      hasLocation: true,
    });

    assert.equal(matchesMediaSearchFilters({
      type: 'photo',
      location: 'Guangzhou',
      isDocumentLike: false,
      tags: ['night', 'river'],
      personLabels: [],
      exif: {
        camera: {
          make: 'Canon',
          model: 'EOS R6',
          lens: 'RF24-70mm'
        },
        gps: {
          latitude: 23.1,
          longitude: 113.2,
        },
      },
    }, parsed.filters), true);

    assert.equal(matchesMediaSearchFilters({
      type: 'photo',
      location: '',
      isDocumentLike: false,
      tags: ['night'],
      personLabels: [],
      exif: {
        camera: {
          make: 'Canon',
          model: 'EOS R6',
        },
      },
    }, parsed.filters), false);

    assert.deepEqual(summarizeMediaSearch(parsed.filters), [
      'Camera: Canon EOS',
      'Tag: night',
      'Has location',
    ]);
    assert.equal(countActiveMediaSearchFilters(parsed.filters), 3);
  });
});
