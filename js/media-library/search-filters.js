const MEDIA_TYPE_FACETS = new Set(['all', 'photo', 'video', 'audio', 'document']);
const TYPE_PREFIXES = new Set(['type', 't', '类型']);
const LOCATION_PREFIXES = new Set(['loc', 'location', 'place', '地点', '位置']);
const CATEGORY_PREFIXES = new Set(['category', 'cat', '分类', '视频分类']);
const CAMERA_PREFIXES = new Set(['camera', 'cam', 'device', '相机']);
const TAG_PREFIXES = new Set(['tag', 'tags', '标签']);
const HAS_PREFIXES = new Set(['has', 'with']);
const AFTER_PREFIXES = new Set(['after', 'since', 'from', '之后', '晚于']);
const BEFORE_PREFIXES = new Set(['before', 'until', 'til', '之前', '早于']);
const YEAR_PREFIXES = new Set(['year', 'yr', '年', '年份']);

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
  if (['audio', 'audios', 'music', 'song', 'songs', 'mp3', '音频', '音乐'].includes(normalized)) {
    return 'audio';
  }
  if (['document', 'documents', 'doc', 'docs', 'scan', 'scans', '文档', '文件', '扫描'].includes(normalized)) {
    return 'document';
  }
  return MEDIA_TYPE_FACETS.has(normalized) ? normalized : '';
}

function normalizeYearValue(value) {
  const match = String(value || '').match(/\d{4}/);
  return match ? match[0] : '';
}

// Accept YYYY, YYYY-MM, YYYY-MM-DD (also '/' or '.' separators). Returns a
// canonical dash-joined string truncated to the granularity the user gave.
function normalizeDateValue(value) {
  const text = normalizeText(value).replace(/[/.]/g, '-');
  const match = text.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/);
  if (!match) {
    return '';
  }
  const parts = [match[1]];
  if (match[2]) {
    parts.push(String(Math.min(12, Math.max(1, Number(match[2])))).padStart(2, '0'));
  }
  if (match[2] && match[3]) {
    parts.push(String(Math.min(31, Math.max(1, Number(match[3])))).padStart(2, '0'));
  }
  return parts.join('-');
}

// Resolve a comparable YYYY-MM-DD string for an item from its capture/created date.
function resolveItemDateString(item) {
  const raw = item?.takenAt || item?.createdAt || item?.deletedAt || '';
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  const year = String(item?.year || '').match(/\d{4}/);
  return year ? `${year[0]}-01-01` : '';
}

// Expand a partial filter date to a full YYYY-MM-DD boundary for lexical compare.
function dateBoundary(normalized, edge) {
  const [y, m, d] = normalized.split('-');
  if (edge === 'start') {
    return `${y}-${m || '01'}-${d || '01'}`;
  }
  if (d) {
    return `${y}-${m}-${d}`;
  }
  if (m) {
    const lastDay = new Date(Number(y), Number(m), 0).getDate();
    return `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  }
  return `${y}-12-31`;
}

export function createEmptyMediaSearchFilters() {
  return {
    type: 'all',
    locationQuery: '',
    categoryQuery: '',
    cameraQuery: '',
    tagQuery: '',
    hasLocation: false,
    dateAfter: '',
    dateBefore: '',
    year: '',
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
    dateAfter: normalizeDateValue(input.dateAfter),
    dateBefore: normalizeDateValue(input.dateBefore),
    year: normalizeYearValue(input.year),
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
      if (['location', 'loc', 'gps', 'place', '位置', '地点'].includes(normalizedValue)) {
        filters.hasLocation = true;
        return;
      }
    }

    if (YEAR_PREFIXES.has(prefix)) {
      const normalizedYear = normalizeYearValue(value);
      if (normalizedYear) {
        filters.year = normalizedYear;
        return;
      }
    }

    if (AFTER_PREFIXES.has(prefix)) {
      const normalizedDate = normalizeDateValue(value);
      if (normalizedDate) {
        filters.dateAfter = normalizedDate;
        return;
      }
    }

    if (BEFORE_PREFIXES.has(prefix)) {
      const normalizedDate = normalizeDateValue(value);
      if (normalizedDate) {
        filters.dateBefore = normalizedDate;
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
  if (filters.dateAfter) {
    count += 1;
  }
  if (filters.dateBefore) {
    count += 1;
  }
  if (filters.year) {
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

  if (filters.year || filters.dateAfter || filters.dateBefore) {
    const itemDay = resolveItemDateString(item);
    if (!itemDay) {
      return false;
    }
    if (filters.year && itemDay.slice(0, 4) !== filters.year) {
      return false;
    }
    if (filters.dateAfter && itemDay < dateBoundary(filters.dateAfter, 'start')) {
      return false;
    }
    if (filters.dateBefore && itemDay > dateBoundary(filters.dateBefore, 'end')) {
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
  if (filters.year) {
    parts.push(`Year: ${filters.year}`);
  }
  if (filters.dateAfter) {
    parts.push(`After: ${filters.dateAfter}`);
  }
  if (filters.dateBefore) {
    parts.push(`Before: ${filters.dateBefore}`);
  }
  return parts;
}
