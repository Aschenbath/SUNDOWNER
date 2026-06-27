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
      dateAfter: '',
      dateBefore: '',
      year: '',
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
      dateAfter: '',
      dateBefore: '',
      year: '',
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

  it('keeps unknown prefixed tokens as plain query text while merging repeated facets', () => {
    const parsed = parseMediaSearchQuery('type:music loc:park location:"night market" tag:summer tags:"family trip" rating:five');

    assert.equal(parsed.textQuery, 'rating:five');
    assert.deepEqual(parsed.filters, {
      type: 'audio',
      locationQuery: 'park night market',
      categoryQuery: '',
      cameraQuery: '',
      tagQuery: 'summer family trip',
      hasLocation: false,
      dateAfter: '',
      dateBefore: '',
      year: '',
    });

    assert.equal(matchesMediaSearchFilters({
      type: 'audio',
      location: 'Park night market',
      isDocumentLike: false,
      tags: ['summer family trip'],
      personLabels: [],
    }, parsed.filters), true);

    assert.deepEqual(summarizeMediaSearch(parsed.filters), [
      'Music',
      'Location: park night market',
      'Tag: summer family trip',
    ]);
    assert.equal(countActiveMediaSearchFilters(parsed.filters), 3);
  });

  it('matches has:location from GPS even when text location is missing', () => {
    const parsed = parseMediaSearchQuery('has:gps');

    assert.equal(parsed.filters.hasLocation, true);
    assert.equal(matchesMediaSearchFilters({
      type: 'photo',
      location: '',
      isDocumentLike: false,
      tags: [],
      personLabels: [],
      exif: {
        gps: {
          latitude: 0,
          longitude: 113.2,
        },
      },
    }, parsed.filters), true);
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
      dateAfter: '',
      dateBefore: '',
      year: '',
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

  it('parses and applies year and date-range filters', () => {
    const parsed = parseMediaSearchQuery('sunset year:2023 after:2023-06 before:2023/8/15');
    assert.equal(parsed.textQuery, 'sunset');
    assert.equal(parsed.filters.year, '2023');
    assert.equal(parsed.filters.dateAfter, '2023-06');
    assert.equal(parsed.filters.dateBefore, '2023-08-15');
    assert.equal(countActiveMediaSearchFilters(parsed.filters), 3);
    assert.deepEqual(summarizeMediaSearch(parsed.filters), [
      'Year: 2023',
      'After: 2023-06',
      'Before: 2023-08-15',
    ]);

    const inRange = { type: 'photo', takenAt: '2023-07-04T10:00:00.000Z', tags: [], personLabels: [] };
    const tooEarly = { type: 'photo', takenAt: '2023-05-20T10:00:00.000Z', tags: [], personLabels: [] };
    const tooLate = { type: 'photo', takenAt: '2023-09-01T10:00:00.000Z', tags: [], personLabels: [] };
    const wrongYear = { type: 'photo', takenAt: '2022-07-04T10:00:00.000Z', tags: [], personLabels: [] };

    assert.equal(matchesMediaSearchFilters(inRange, parsed.filters), true);
    assert.equal(matchesMediaSearchFilters(tooEarly, parsed.filters), false);
    assert.equal(matchesMediaSearchFilters(tooLate, parsed.filters), false);
    assert.equal(matchesMediaSearchFilters(wrongYear, parsed.filters), false);
  });

  it('matches a bare year filter (incl. Chinese 年 prefix) against item.year when takenAt is absent', () => {
    const parsed = parseMediaSearchQuery('年:2021');
    assert.equal(parsed.filters.year, '2021');
    assert.equal(matchesMediaSearchFilters({ type: 'photo', year: 2021, tags: [], personLabels: [] }, parsed.filters), true);
    assert.equal(matchesMediaSearchFilters({ type: 'photo', year: 2020, tags: [], personLabels: [] }, parsed.filters), false);
  });
});
