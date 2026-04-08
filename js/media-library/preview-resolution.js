function normalizeText(value) {
  return String(value || '').trim();
}

function addReferenceKey(keys, value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return;
  }

  keys.add(normalized.toLowerCase());

  if (!/^(?:https?:)?\/\//i.test(normalized) && !normalized.startsWith('/')) {
    return;
  }

  try {
    const url = new URL(normalized, 'https://media-library.local');
    keys.add(url.href.toLowerCase());
    keys.add(url.pathname.toLowerCase());
    keys.add(`${url.pathname}${url.search}`.toLowerCase());
  } catch {
    // Ignore malformed URL-like references and keep the raw normalized key.
  }
}

export function buildMediaReferenceKeys(...values) {
  const keys = new Set();
  values.flat().forEach((value) => addReferenceKey(keys, value));
  return [...keys];
}

export function findPreviewMatch(items, {
  id = '',
  sourceHint = '',
  altHints = []
} = {}) {
  const mediaItems = Array.isArray(items) ? items : [];
  if (!mediaItems.length) {
    return null;
  }

  const normalizedId = normalizeText(id);
  if (normalizedId) {
    const exactMatch = mediaItems.find((item) => normalizeText(item?.id) === normalizedId);
    if (exactMatch) {
      return exactMatch;
    }
  }

  const hintKeys = new Set(buildMediaReferenceKeys(sourceHint, altHints));
  if (!hintKeys.size) {
    return null;
  }

  return mediaItems.find((item) => {
    const itemKeys = buildMediaReferenceKeys(
      item?.sourceId,
      item?.sourceUrl,
      item?.thumbnailUrl,
      item?.posterUrl
    );
    return itemKeys.some((key) => hintKeys.has(key));
  }) || null;
}
