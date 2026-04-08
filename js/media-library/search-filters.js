const MEDIA_TYPE_FACETS = new Set(['all', 'photo', 'video', 'document']);

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeLowerText(value) {
  return normalizeText(value).toLowerCase();
}

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function isIsoDateInput(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function formatDateInputValue(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return `${value.getFullYear()}-${padDatePart(value.getMonth() + 1)}-${padDatePart(value.getDate())}`;
  }
  const text = normalizeText(value);
  if (!text) {
    return '';
  }
  if (isIsoDateInput(text)) {
    return text;
  }
  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) {
    return '';
  }
  return formatDateInputValue(parsed);
}

function toDateBoundaryStamp(value, { endOfDay = false } = {}) {
  const formatted = formatDateInputValue(value);
  if (!formatted) {
    return null;
  }
  const [year, month, day] = formatted.split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return endOfDay
    ? Date.UTC(year, month - 1, day, 23, 59, 59, 999)
    : Date.UTC(year, month - 1, day, 0, 0, 0, 0);
}

function getItemDayStamp(item) {
  if (Number.isFinite(Number(item?.year)) && Number.isFinite(Number(item?.month)) && Number.isFinite(Number(item?.day))) {
    return Date.UTC(Number(item.year), Number(item.month) - 1, Number(item.day), 12, 0, 0, 0);
  }
  const parsed = Date.parse(item?.takenAt || '');
  return Number.isFinite(parsed) ? parsed : null;
}

export function createEmptyMediaSearchFilters() {
  return {
    type: 'all',
    dateFrom: '',
    dateTo: '',
    locationQuery: '',
  };
}

export function normalizeMediaSearchFilters(input = {}) {
  const normalizedType = normalizeLowerText(input.type);
  const dateFrom = formatDateInputValue(input.dateFrom);
  const dateTo = formatDateInputValue(input.dateTo);
  const normalized = {
    type: MEDIA_TYPE_FACETS.has(normalizedType) ? normalizedType : 'all',
    dateFrom,
    dateTo,
    locationQuery: normalizeText(input.locationQuery),
  };
  if (normalized.dateFrom && normalized.dateTo && normalized.dateFrom > normalized.dateTo) {
    normalized.dateFrom = dateTo;
    normalized.dateTo = dateFrom;
  }
  return normalized;
}

export function countActiveMediaSearchFilters(input = {}) {
  const filters = normalizeMediaSearchFilters(input);
  let count = 0;
  if (filters.type !== 'all') {
    count += 1;
  }
  if (filters.dateFrom) {
    count += 1;
  }
  if (filters.dateTo) {
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
    const locationHaystack = [
      item?.location,
      ...(Array.isArray(item?.tags) ? item.tags : []),
      ...(Array.isArray(item?.personLabels) ? item.personLabels : []),
    ].join(' ').toLowerCase();
    if (!locationHaystack.includes(filters.locationQuery.toLowerCase())) {
      return false;
    }
  }

  const itemStamp = getItemDayStamp(item);
  const fromStamp = toDateBoundaryStamp(filters.dateFrom);
  const toStamp = toDateBoundaryStamp(filters.dateTo, { endOfDay: true });

  if (fromStamp !== null && itemStamp !== null && itemStamp < fromStamp) {
    return false;
  }
  if (toStamp !== null && itemStamp !== null && itemStamp > toStamp) {
    return false;
  }

  return true;
}

export function collectLocationSuggestions(items, limit = 8) {
  const counts = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const location = normalizeText(item?.location);
    if (!location) {
      continue;
    }
    counts.set(location, (counts.get(location) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, Math.max(0, Number(limit) || 0))
    .map(([location]) => location);
}

export function summarizeMediaSearch(filtersInput = {}) {
  const filters = normalizeMediaSearchFilters(filtersInput);
  const parts = [];
  if (filters.type !== 'all') {
    parts.push(filters.type === 'document' ? 'Documents' : `${filters.type[0].toUpperCase()}${filters.type.slice(1)}s`);
  }
  if (filters.dateFrom || filters.dateTo) {
    if (filters.dateFrom && filters.dateTo) {
      parts.push(`${filters.dateFrom} to ${filters.dateTo}`);
    } else if (filters.dateFrom) {
      parts.push(`From ${filters.dateFrom}`);
    } else if (filters.dateTo) {
      parts.push(`Until ${filters.dateTo}`);
    }
  }
  if (filters.locationQuery) {
    parts.push(`Location: ${filters.locationQuery}`);
  }
  return parts;
}
