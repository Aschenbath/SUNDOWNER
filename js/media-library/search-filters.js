const MEDIA_TYPE_FACETS = new Set(['all', 'photo', 'video', 'document']);
const TYPE_PREFIXES = new Set(['type', 't', '类型']);
const LOCATION_PREFIXES = new Set(['loc', 'location', 'place', '地点', '位置']);

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
  if (['photo', 'photos', 'image', 'images', 'pic', 'pics', '照片', '图片'].includes(normalized)) {
    return 'photo';
  }
  if (['video', 'videos', 'movie', 'movies', '视频', '录像'].includes(normalized)) {
    return 'video';
  }
  if (['document', 'documents', 'doc', 'docs', 'scan', 'scans', '文档', '文件', '扫描'].includes(normalized)) {
    return 'document';
  }
  return MEDIA_TYPE_FACETS.has(normalized) ? normalized : '';
}

export function createEmptyMediaSearchFilters() {
  return {
    type: 'all',
    locationQuery: '',
  };
}

export function normalizeMediaSearchFilters(input = {}) {
  return {
    type: normalizeTypeFacet(input.type) || 'all',
    locationQuery: normalizeText(input.locationQuery),
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

  return true;
}

export function summarizeMediaSearch(filtersInput = {}) {
  const filters = normalizeMediaSearchFilters(filtersInput);
  const parts = [];
  if (filters.type !== 'all') {
    parts.push(filters.type === 'document' ? 'Documents' : `${filters.type[0].toUpperCase()}${filters.type.slice(1)}s`);
  }
  if (filters.locationQuery) {
    parts.push(`Location: ${filters.locationQuery}`);
  }
  return parts;
}
