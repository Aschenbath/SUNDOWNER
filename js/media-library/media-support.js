function normalizeMimeType(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function supportsBrowserImagePreview(mimeType) {
  return !/^image\/(?:heic|heif)\b/.test(normalizeMimeType(mimeType));
}

export function shouldDisplayMediaItem(item = {}) {
  const type = String(item?.type || '').trim().toLowerCase();
  if (type !== 'photo') {
    return true;
  }

  if (item?.browserPreviewSupported === false) {
    return false;
  }

  const mimeType = normalizeMimeType(item?.mimeType || item?.fileType || '');
  if (!mimeType) {
    return true;
  }

  return supportsBrowserImagePreview(mimeType);
}
