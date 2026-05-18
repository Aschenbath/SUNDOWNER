function normalizeMergeText(value) {
  return String(value ?? '').trim();
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
    merged.push(item);
  };

  indexedItems.forEach(pushItem);
  cachedItems.forEach(pushItem);
  return merged;
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
  const cachedItems = Array.isArray(cachedPayload?.items) ? cachedPayload.items.filter(Boolean) : [];
  const mergedItems = mergeIndexedMediaWithCachedItems(indexedItems, cachedItems);
  const cacheSupplementedCount = Math.max(0, mergedItems.length - indexedItems.length);
  const indexedLoadedCount = Number(indexedResult.loadedCount) || indexedItems.length;
  const indexedTotalCount = Number(indexedResult.totalCount) || indexedItems.length;
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
