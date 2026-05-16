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

function buildMomentFileUrl(fileId = '') {
  const normalizedFileId = normalizeText(fileId);
  if (!normalizedFileId) {
    return '/file/';
  }
  return `/file/${normalizedFileId.split('/').map((segment) => encodeURIComponent(segment)).join('/')}`;
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

  return {
    ...(attachment.item && typeof attachment.item === 'object' ? attachment.item : {}),
    id: fileId,
    sourceId: fileId,
    type: 'photo',
    label,
    sourceUrl,
    thumbnailUrl: sourceUrl,
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
        createdAt,
        updatedAt,
        date: normalizeMomentDate(post.date || createdAt || updatedAt),
        attachments,
      };
    })
    .sort((left, right) => {
      const rightTime = Date.parse(right.createdAt || right.updatedAt || '') || 0;
      const leftTime = Date.parse(left.createdAt || left.updatedAt || '') || 0;
      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }
      return normalizeText(right.id).localeCompare(normalizeText(left.id));
    });
}
