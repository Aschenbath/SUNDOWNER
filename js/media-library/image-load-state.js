const ALLOWED_IMAGE_PROTOCOLS = new Set(['http:', 'https:']);

function toNonNegativeInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
}

function sameImageSource(left, right) {
  const first = String(left || '').trim();
  const second = String(right || '').trim();
  if (!first || !second) {
    return first === second;
  }
  try {
    const baseUrl = globalThis.location?.origin || 'http://localhost';
    return new URL(first, baseUrl).href === new URL(second, baseUrl).href;
  } catch {
    return first === second;
  }
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
  const currentSource = String(dataset.currentSrc || dataset.src || '').trim();
  const fullSource = String(dataset.fullSrc || '').trim();
  const canUseOriginal = originalSource
    && !sameImageSource(originalSource, currentSource)
    && dataset.triedOriginal !== '1';
  const canUseFull = !canUseOriginal
    && fullSource
    && !sameImageSource(fullSource, currentSource)
    && dataset.triedFull !== '1';

  return {
    source: canUseOriginal ? originalSource : (canUseFull ? fullSource : canonicalSource),
    usesOriginal: Boolean(canUseOriginal),
    usesFull: Boolean(canUseFull),
  };
}

export function canRetryImage(attempt, maxAttempts = 3) {
  const normalizedAttempt = toNonNegativeInteger(attempt);
  const normalizedMax = toNonNegativeInteger(maxAttempts);
  return normalizedAttempt !== null
    && normalizedMax !== null
    && normalizedAttempt < normalizedMax;
}
