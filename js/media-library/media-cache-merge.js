function normalizeMergeText(value) {
  return String(value ?? '').trim();
}

function getMediaCacheSortTimestamp(item) {
  const directValue = Number(item?.sortOrder || item?.timestamp || item?.TimeStamp || 0);
  if (Number.isFinite(directValue) && directValue > 0) {
    return directValue < 1000000000000 ? directValue * 1000 : directValue;
  }
  const parsed = Date.parse(item?.takenAt || item?.deletedAt || item?.createdAt || item?.updatedAt || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getMediaCacheMergeKey(item) {
  return normalizeMergeText(item?.sourceId || item?.id || '');
}

export function mergeIndexedMediaWithCachedItems(indexedItems = [], cachedItems = []) {
  const merged = [];
  const seenKeys = new Set();

  const pushItem = (item) => {
    if (!item || typeof item !== 'object') {
      return;
    }
    const key = getMediaCacheMergeKey(item);
    if (!key || seenKeys.has(key)) {
      return;
    }
    seenKeys.add(key);
    merged.push({ item, order: merged.length });
  };

  indexedItems.forEach(pushItem);
  cachedItems.forEach(pushItem);
  return merged
    .sort((left, right) => {
      const delta = getMediaCacheSortTimestamp(right.item) - getMediaCacheSortTimestamp(left.item);
      return delta || left.order - right.order;
    })
    .map((entry) => entry.item);
}

export function removeMediaCacheItems(items = [], removedKeys = []) {
  const blockedKeys = new Set(
    (removedKeys instanceof Set ? [...removedKeys] : removedKeys)
      .map(normalizeMergeText)
      .filter(Boolean)
  );
  if (!blockedKeys.size) {
    return Array.isArray(items) ? items.filter(Boolean) : [];
  }
  return (Array.isArray(items) ? items : [])
    .filter(Boolean)
    .filter((item) => !blockedKeys.has(getMediaCacheMergeKey(item)));
}

export function mergeIndexedMediaResultWithCache(indexedResult = {}, cachedPayload = null) {
  const indexedItems = Array.isArray(indexedResult.items) ? indexedResult.items.filter(Boolean) : [];
  const indexedLoadedCount = Number(indexedResult.loadedCount) || indexedItems.length;
  const indexedTotalCount = Number(indexedResult.totalCount) || indexedItems.length;

  // When the server returned a complete (non-truncated) result set, treat it as
  // authoritative: don't supplement from the local cache, since that would
  // resurrect items the server has already deleted in another session.
  const serverIsComplete = indexedTotalCount <= indexedItems.length;
  if (serverIsComplete || !cachedPayload) {
    return {
      ...indexedResult,
      items: indexedItems,
      source: indexedResult.source || 'indexed',
      loadedCount: indexedLoadedCount,
      totalCount: indexedTotalCount,
      isTruncated: false,
    };
  }

  const cachedItems = Array.isArray(cachedPayload?.items) ? cachedPayload.items.filter(Boolean) : [];
  const mergedItems = mergeIndexedMediaWithCachedItems(indexedItems, cachedItems);
  const cacheSupplementedCount = Math.max(0, mergedItems.length - indexedItems.length);
  const cachedTotalCount = Number(cachedPayload?.librarySyncMeta?.totalCount) || cachedItems.length;
  const totalCount = Math.max(indexedTotalCount, cachedTotalCount, mergedItems.length);

  return {
    ...indexedResult,
    items: mergedItems,
    source: cacheSupplementedCount > 0 ? 'indexed-cache' : (indexedResult.source || 'indexed'),
    loadedCount: Math.max(indexedLoadedCount, mergedItems.length),
    totalCount,
    isTruncated: totalCount > mergedItems.length,
    ...(cacheSupplementedCount > 0 ? { cacheSupplementedCount } : {}),
  };
}
