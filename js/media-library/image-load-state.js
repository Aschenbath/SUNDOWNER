const ALLOWED_IMAGE_PROTOCOLS = new Set(['http:', 'https:']);

function toNonNegativeInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
}

export function buildImageRetryUrl(source, attempt, baseUrl = globalThis.location?.origin || '') {
  const normalizedAttempt = toNonNegativeInteger(attempt);
  if (!source || normalizedAttempt === null || !baseUrl) {
    return '';
  }

  try {
    const url = new URL(String(source), baseUrl);
    if (!ALLOWED_IMAGE_PROTOCOLS.has(url.protocol)) {
      return '';
    }
    url.searchParams.set('retry', String(normalizedAttempt));
    return url.href;
  } catch {
    return '';
  }
}

export function getNextImageSource(dataset = {}) {
  const canonicalSource = String(dataset.canonicalSrc || '').trim();
  const originalSource = String(dataset.originalSrc || '').trim();
  const canUseOriginal = originalSource
    && originalSource !== canonicalSource
    && dataset.triedOriginal !== '1';

  return {
    source: canUseOriginal ? originalSource : canonicalSource,
    usesOriginal: Boolean(canUseOriginal),
  };
}

export function canRetryImage(attempt, maxAttempts = 3) {
  const normalizedAttempt = toNonNegativeInteger(attempt);
  const normalizedMax = toNonNegativeInteger(maxAttempts);
  return normalizedAttempt !== null
    && normalizedMax !== null
    && normalizedAttempt < normalizedMax;
}
