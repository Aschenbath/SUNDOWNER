const MEDIA_TYPE_FACETS = new Set(['all', 'photo', 'video', 'audio', 'document']);
const TYPE_PREFIXES = new Set(['type', 't', '\u7c7b\u578b']);
const LOCATION_PREFIXES = new Set(['loc', 'location', 'place', '\u5730\u70b9', '\u4f4d\u7f6e']);
const CATEGORY_PREFIXES = new Set(['category', 'cat', '\u5206\u7c7b', '\u89c6\u9891\u5206\u7c7b']);
const CAMERA_PREFIXES = new Set(['camera', 'cam', 'device', '\u76f8\u673a']);
const TAG_PREFIXES = new Set(['tag', 'tags', '\u6807\u7b7e']);
const HAS_PREFIXES = new Set(['has', 'with']);

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeLowerText(value) {
  return normalizeText(value).toLowerCase();
}

function tokenizeSearchQuery(input) {
  const query = normalizeText(input);
  return query ? (query.match(/[^\s:]+:"[^"]+"|[^\s:]+:'[^']+'|"[^"]+"|'[^']+'|\S+/g) || []) : [];
}

function stripWrappingQuotes(value) {
  const text = normalizeText(value);
  if (!text) {
    return '';
  }
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1).trim();
  }
  return text;
}

function normalizeTypeFacet(value) {
  const normalized = normalizeLowerText(value);
  if (['photo', 'photos', 'image', 'images', 'pic', 'pics', '\u7167\u7247', '\u56fe\u7247'].includes(normalized)) {
    return 'photo';
  }
  if (['video', 'videos', 'movie', 'movies', '\u89c6\u9891', '\u5f55\u50cf'].includes(normalized)) {
    return 'video';
  }
  if (['audio', 'audios', 'music', 'song', 'songs', 'mp3', '\u97f3\u9891', '\u97f3\u4e50'].includes(normalized)) {
    return 'audio';
  }
  if (['document', 'documents', 'doc', 'docs', 'scan', 'scans', '\u6587\u6863', '\u6587\u4ef6', '\u626b\u63cf'].includes(normalized)) {
    return 'document';
  }
  return MEDIA_TYPE_FACETS.has(normalized) ? normalized : '';
}

export function createEmptyMediaSearchFilters() {
  return {
    type: 'all',
    locationQuery: '',
    categoryQuery: '',
    cameraQuery: '',
    tagQuery: '',
    hasLocation: false,
  };
}

export function normalizeMediaSearchFilters(input = {}) {
  return {
    type: normalizeTypeFacet(input.type) || 'all',
    locationQuery: normalizeText(input.locationQuery),
    categoryQuery: normalizeText(input.categoryQuery),
    cameraQuery: normalizeText(input.cameraQuery),
    tagQuery: normalizeText(input.tagQuery),
    hasLocation: input.hasLocation === true || normalizeLowerText(input.hasLocation) === 'location',
  };
}

export function parseMediaSearchQuery(input = '') {
  const tokens = tokenizeSearchQuery(input);
  const plainTerms = [];
  const filters = createEmptyMediaSearchFilters();

  tokens.forEach((token) => {
    const separatorIndex = token.indexOf(':');
    if (separatorIndex <= 0) {
      plainTerms.push(stripWrappingQuotes(token));
      return;
    }

    const prefix = normalizeLowerText(token.slice(0, separatorIndex));
    const value = stripWrappingQuotes(token.slice(separatorIndex + 1));

    if (!value) {
      plainTerms.push(stripWrappingQuotes(token));
      return;
    }

    if (TYPE_PREFIXES.has(prefix)) {
      const typeFacet = normalizeTypeFacet(value);
      if (typeFacet) {
        filters.type = typeFacet;
        return;
      }
    }

    if (LOCATION_PREFIXES.has(prefix)) {
      filters.locationQuery = filters.locationQuery
        ? `${filters.locationQuery} ${value}`
        : value;
      return;
    }

    if (CATEGORY_PREFIXES.has(prefix)) {
      filters.categoryQuery = filters.categoryQuery
        ? `${filters.categoryQuery} ${value}`
        : value;
      return;
    }

    if (CAMERA_PREFIXES.has(prefix)) {
      filters.cameraQuery = filters.cameraQuery
        ? `${filters.cameraQuery} ${value}`
        : value;
      return;
    }

    if (TAG_PREFIXES.has(prefix)) {
      filters.tagQuery = filters.tagQuery
        ? `${filters.tagQuery} ${value}`
        : value;
      return;
    }

    if (HAS_PREFIXES.has(prefix)) {
      const normalizedValue = normalizeLowerText(value);
      if (['location', 'loc', 'gps', 'place', '\u4f4d\u7f6e', '\u5730\u70b9'].includes(normalizedValue)) {
        filters.hasLocation = true;
        return;
      }
    }

    plainTerms.push(stripWrappingQuotes(token));
  });

  return {
    rawQuery: normalizeText(input),
    textQuery: normalizeText(plainTerms.join(' ')),
    filters: normalizeMediaSearchFilters(filters),
  };
}

export function countActiveMediaSearchFilters(input = {}) {
  const filters = normalizeMediaSearchFilters(input);
  let count = 0;
  if (filters.type !== 'all') {
    count += 1;
  }
  if (filters.locationQuery) {
    count += 1;
  }
  if (filters.categoryQuery) {
    count += 1;
  }
  if (filters.cameraQuery) {
    count += 1;
  }
  if (filters.tagQuery) {
    count += 1;
  }
  if (filters.hasLocation) {
    count += 1;
  }
  return count;
}

export function matchesMediaSearchFilters(item, input = {}) {
  const filters = normalizeMediaSearchFilters(input);

  if (filters.type === 'photo' && item?.type !== 'photo') {
    return false;
  }
  if (filters.type === 'video' && item?.type !== 'video') {
    return false;
  }
  if (filters.type === 'audio' && item?.type !== 'audio') {
    return false;
  }
  if (filters.type === 'document' && !item?.isDocumentLike) {
    return false;
  }

  if (filters.locationQuery) {
    const locationNeedle = filters.locationQuery.toLowerCase();
    const locationHaystack = [
      item?.location,
      ...(Array.isArray(item?.tags) ? item.tags : []),
      ...(Array.isArray(item?.personLabels) ? item.personLabels : []),
    ].join(' ').toLowerCase();
    if (!locationHaystack.includes(locationNeedle)) {
      return false;
    }
  }

  if (filters.categoryQuery) {
    const categoryNeedle = filters.categoryQuery.toLowerCase();
    const categoryHaystack = String(item?.videoCategory || '').toLowerCase();
    if (!categoryHaystack.includes(categoryNeedle)) {
      return false;
    }
  }

  if (filters.cameraQuery) {
    const cameraNeedle = filters.cameraQuery.toLowerCase();
    const cameraHaystack = [
      item?.exif?.camera?.make,
      item?.exif?.camera?.model,
      item?.exif?.camera?.lens,
    ].join(' ').toLowerCase();
    if (!cameraHaystack.includes(cameraNeedle)) {
      return false;
    }
  }

  if (filters.tagQuery) {
    const tagNeedle = filters.tagQuery.toLowerCase();
    const tagHaystack = (Array.isArray(item?.tags) ? item.tags : []).join(' ').toLowerCase();
    if (!tagHaystack.includes(tagNeedle)) {
      return false;
    }
  }

  if (filters.hasLocation) {
    const hasGps = Boolean(item?.exif?.gps?.latitude != null && item?.exif?.gps?.longitude != null);
    const hasLocationText = Boolean(normalizeText(item?.location));
    if (!hasGps && !hasLocationText) {
      return false;
    }
  }

  return true;
}

export function summarizeMediaSearch(filtersInput = {}) {
  const filters = normalizeMediaSearchFilters(filtersInput);
  const parts = [];
  if (filters.type !== 'all') {
    parts.push(
      filters.type === 'document'
        ? 'Documents'
        : filters.type === 'audio'
          ? 'Music'
          : `${filters.type[0].toUpperCase()}${filters.type.slice(1)}s`
    );
  }
  if (filters.locationQuery) {
    parts.push(`Location: ${filters.locationQuery}`);
  }
  if (filters.categoryQuery) {
    parts.push(`Category: ${filters.categoryQuery}`);
  }
  if (filters.cameraQuery) {
    parts.push(`Camera: ${filters.cameraQuery}`);
  }
  if (filters.tagQuery) {
    parts.push(`Tag: ${filters.tagQuery}`);
  }
  if (filters.hasLocation) {
    parts.push('Has location');
  }
  return parts;
}
