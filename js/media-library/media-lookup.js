function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function decodeValue(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function stripExtension(value) {
  return String(value || '').replace(/\.(?:jpg|jpeg|png|webp|gif|bmp|avif|heic|heif|mp4|mov|m4v|webm|avi)$/i, '');
}

function normalizeLookupValue(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }

  let candidate = normalized;
  try {
    if (/^(?:https?:)?\/\//i.test(candidate) || candidate.startsWith('/')) {
      const url = new URL(candidate, 'https://media-library.local');
      candidate = `${url.pathname}${url.search}`;
    }
  } catch {
    candidate = normalized;
  }

  return decodeValue(candidate)
    .split('#')[0]
    .split('?')[0]
    .replace(/^\/+/, '')
    .replace(/^file\//i, '');
}

function extractFileNameFromPath(pathLike) {
  const raw = String(pathLike || '').split('#')[0].split('?')[0];
  const parts = raw.split('/');
  return decodeValue(parts[parts.length - 1] || '');
}

export function createLookupKey(value) {
  return stripExtension(normalizeLookupValue(value)).toLowerCase();
}

export function getLookupKeys(fileId, fileName, label) {
  const normalizedId = normalizeLookupValue(fileId);
  const pathName = extractFileNameFromPath(normalizedId);
  const values = [fileId, normalizedId, pathName, fileName, label]
    .map(createLookupKey)
    .filter(Boolean);
  return [...new Set(values)];
}
