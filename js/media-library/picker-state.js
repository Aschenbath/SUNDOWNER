export function getAlbumSelectionTarget(state) {
  return String(state?.albumSelectionTarget || '').trim();
}

export function getVideoAlbumSelectionTarget(state) {
  const value = String(state?.videoAlbumSelectionTarget || '').trim();
  return value.length <= 48 ? value : value.slice(0, 48).trim();
}

export function hasAnyPickerTarget(state) {
  return Boolean(
    getAlbumSelectionTarget(state)
    || getVideoAlbumSelectionTarget(state)
    || state?.privateSelectionMode
  );
}

export function resetAddToTargetModes(state, {
  preserveAlbumSelectionTarget = false,
  preserveVideoAlbumSelectionTarget = false,
  preservePrivateSelectionMode = false,
  preserveAlbumPickerDistinctOnly = false
} = {}) {
  if (!preserveAlbumSelectionTarget) {
    state.albumSelectionTarget = '';
  }
  if (!preserveVideoAlbumSelectionTarget) {
    state.videoAlbumSelectionTarget = '';
  }
  if (!preservePrivateSelectionMode) {
    state.privateSelectionMode = false;
  }
  if (!preserveAlbumPickerDistinctOnly) {
    state.albumPickerDistinctOnly = false;
  }
}

export function isPhotosRouteReplay(rawHash) {
  return /^photos(?:\/|$)/i.test(rawHash || 'photos');
}

export function buildPickerPreserveFlags(state, rawHash) {
  const photosRouteReplay = isPhotosRouteReplay(rawHash);
  return {
    preserveAlbumSelectionTarget: Boolean(state?.albumSelectionTarget) && photosRouteReplay,
    preserveVideoAlbumSelectionTarget: Boolean(state?.videoAlbumSelectionTarget) && photosRouteReplay,
    preservePrivateSelectionMode: Boolean(state?.privateSelectionMode) && photosRouteReplay,
    preserveAlbumPickerDistinctOnly: Boolean(state?.albumPickerDistinctOnly) && photosRouteReplay,
  };
}

export function canUseDistinctAlbumPicker(state) {
  return Boolean(getAlbumSelectionTarget(state))
    && !getVideoAlbumSelectionTarget(state)
    && !state?.privateSelectionMode;
}
