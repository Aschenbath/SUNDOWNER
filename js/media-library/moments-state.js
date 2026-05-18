function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeMomentDate(value) {
  const raw = normalizeText(value);
  if (!raw) {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return parsed.toISOString().slice(0, 10);
}

function buildMomentFileUrl(fileId = '', queryParams = null) {
  const normalizedFileId = normalizeText(fileId);
  if (!normalizedFileId) {
    return '/file/';
  }
  const baseRoute = `/file/${normalizedFileId.split('/').map((segment) => encodeURIComponent(segment)).join('/')}`;
  if (!queryParams || typeof queryParams !== 'object') {
    return baseRoute;
  }
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }
  const queryString = searchParams.toString();
  return queryString ? `${baseRoute}?${queryString}` : baseRoute;
}

function supportsMomentBrowserImagePreview(mimeType = '') {
  const normalized = normalizeText(mimeType).toLowerCase();
  return [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/avif',
  ].includes(normalized);
}

function readAttachmentMetadata(attachment = {}) {
  if (attachment.metadata && typeof attachment.metadata === 'object') {
    return attachment.metadata;
  }
  return {};
}

function readMetadataValue(metadata = {}, keys = []) {
  for (const key of keys) {
    if (metadata[key] !== undefined && metadata[key] !== null && metadata[key] !== '') {
      return metadata[key];
    }
  }
  return '';
}

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

export function normalizeMomentDraftAttachments(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item, index) => ({
    source: item?.source === 'existing' ? 'existing' : 'upload',
    draftId: normalizeText(item?.draftId || item?.fileId || item?.name || `draft-${index}`),
    fileId: normalizeText(item?.fileId),
    name: normalizeText(item?.name || item?.metadata?.FileName || item?.fileId?.split('/').pop() || 'Moment photo'),
    previewUrl: normalizeText(item?.previewUrl || item?.sourceUrl || item?.thumbnailUrl),
    metadata: item?.metadata && typeof item.metadata === 'object' ? item.metadata : {},
    file: item?.file ?? null,
  }));
}

export function buildMomentMutationPayload({ body = '', attachments = [], date = '' } = {}) {
  const normalized = normalizeMomentDraftAttachments(attachments);
  return {
    body: normalizeText(body),
    date: normalizeMomentDate(date),
    existingFileIds: normalized
      .filter((item) => item.source === 'existing' && item.fileId)
      .map((item) => item.fileId),
    uploadFiles: normalized
      .filter((item) => item.source === 'upload' && item.file)
      .map((item) => item.file),
  };
}

export function deriveMomentCalendarMonth(selectedDate = '') {
  const normalizedDate = normalizeMomentDate(selectedDate);
  return normalizedDate ? normalizedDate.slice(0, 7) : new Date().toISOString().slice(0, 7);
}

export function buildMomentAttachmentItem(attachment = {}) {
  const metadata = readAttachmentMetadata(attachment);
  const fileId = normalizeText(attachment.fileId || attachment.file_id || attachment.id);
  const sourceUrl = buildMomentFileUrl(fileId);
  const label = normalizeText(
    readMetadataValue(metadata, ['FileName', 'fileName', 'file_name'])
      || fileId.split('/').pop()
      || 'Moment photo'
  );
  const width = toFiniteNumber(readMetadataValue(metadata, ['Width', 'width']));
  const height = toFiniteNumber(readMetadataValue(metadata, ['Height', 'height']));
  const mimeType = normalizeText(readMetadataValue(metadata, ['FileType', 'fileType', 'file_type'])).toLowerCase();
  const browserPreviewSupported = !mimeType || supportsMomentBrowserImagePreview(mimeType);
  const thumbnailUrl = browserPreviewSupported ? sourceUrl : buildMomentFileUrl(fileId, { preview: '1' });

  return {
    ...(attachment.item && typeof attachment.item === 'object' ? attachment.item : {}),
    id: fileId,
    sourceId: fileId,
    type: 'photo',
    label,
    sourceUrl,
    thumbnailUrl,
    browserPreviewSupported,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(mimeType ? { mimeType } : {}),
  };
}

export function normalizeMomentPosts(posts = []) {
  if (!Array.isArray(posts)) {
    return [];
  }

  return posts
    .map((post) => {
      const createdAt = normalizeText(post.createdAt || post.created_at || post.updatedAt || post.updated_at);
      const updatedAt = normalizeText(post.updatedAt || post.updated_at || createdAt);
      const momentDate = normalizeMomentDate(post.momentDate || post.moment_date || post.date || createdAt || updatedAt);
      const attachments = Array.isArray(post.attachments)
        ? post.attachments.map((attachment) => {
            const metadata = readAttachmentMetadata(attachment);
            const fileId = normalizeText(attachment.fileId || attachment.file_id || attachment.id);
            return {
              ...attachment,
              fileId,
              metadata,
              item: buildMomentAttachmentItem({ ...attachment, fileId, metadata }),
            };
          })
        : [];

      return {
        ...post,
        id: normalizeText(post.id),
        body: normalizeText(post.body),
        momentDate,
        createdAt,
        updatedAt,
        date: momentDate,
        attachments,
      };
    })
    .sort((left, right) => {
      const rightTime = Date.parse(`${right.date || ''}T23:59:59.999Z`) || Date.parse(right.createdAt || right.updatedAt || '') || 0;
      const leftTime = Date.parse(`${left.date || ''}T23:59:59.999Z`) || Date.parse(left.createdAt || left.updatedAt || '') || 0;
      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }
      return normalizeText(right.id).localeCompare(normalizeText(left.id));
    });
}
