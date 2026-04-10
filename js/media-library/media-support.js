function normalizeMimeType(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function supportsBrowserImagePreview(mimeType) {
  return !/^image\/(?:heic|heif)\b/.test(normalizeMimeType(mimeType));
}

export function shouldDisplayMediaItem(item = {}) {
  return Boolean(item && typeof item === 'object');
}
