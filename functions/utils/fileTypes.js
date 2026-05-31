/**
 * Unified file type detection and classification
 * Centralizes all file type logic to avoid duplication
 */

// File type buckets
export const FILE_TYPE_BUCKETS = {
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  OTHER: 'other',
};

// File extensions by type
export const FILE_EXTENSIONS = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif', 'heic', 'heif', 'svg', 'ico'],
  video: ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', 'flv', 'wmv', 'mpg', 'mpeg'],
  audio: ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'opus', 'wma', 'ape'],
};

// Generic/unknown MIME types
export const GENERIC_MIME_TYPES = new Set([
  '',
  'application/octet-stream',
  'binary/octet-stream',
  'application/x-binary',
  'application/unknown',
  'unknown',
  'none',
  'null',
]);

/**
 * Normalize file type bucket value
 * @param {string} value - Bucket candidate
 * @returns {string|null} - Normalized bucket or null
 */
export function normalizeFileTypeBucket(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return Object.values(FILE_TYPE_BUCKETS).includes(normalized) ? normalized : null;
}

/**
 * Get file extension from filename
 * @param {string} filename - File name
 * @returns {string} - Extension (lowercase, without dot)
 */
export function getFileExtension(filename) {
  if (!filename) return '';
  const normalized = String(filename).trim();
  const lastDot = normalized.lastIndexOf('.');
  if (lastDot === -1 || lastDot === normalized.length - 1) return '';
  return normalized.slice(lastDot + 1).toLowerCase();
}

/**
 * Check if MIME type is generic/unknown
 * @param {string} mimeType - MIME type
 * @returns {boolean}
 */
export function isGenericMimeType(mimeType) {
  return GENERIC_MIME_TYPES.has(String(mimeType || '').trim().toLowerCase());
}

/**
 * Detect file type bucket from MIME type
 * @param {string} mimeType - MIME type
 * @returns {string|null} - Bucket or null
 */
export function detectBucketFromMimeType(mimeType) {
  const normalized = String(mimeType || '').trim().toLowerCase();

  if (normalized.startsWith('image/') || normalized === 'image' || normalized === 'photo') {
    return FILE_TYPE_BUCKETS.IMAGE;
  }

  if (normalized.startsWith('video/') || normalized === 'video') {
    return FILE_TYPE_BUCKETS.VIDEO;
  }

  if (normalized.startsWith('audio/') || normalized === 'audio') {
    return FILE_TYPE_BUCKETS.AUDIO;
  }

  return null;
}

/**
 * Detect file type bucket from file extension
 * @param {string} extension - File extension (without dot)
 * @returns {string|null} - Bucket or null
 */
export function detectBucketFromExtension(extension) {
  const normalized = String(extension || '').trim().toLowerCase();

  if (FILE_EXTENSIONS.image.includes(normalized)) {
    return FILE_TYPE_BUCKETS.IMAGE;
  }

  if (FILE_EXTENSIONS.video.includes(normalized)) {
    return FILE_TYPE_BUCKETS.VIDEO;
  }

  if (FILE_EXTENSIONS.audio.includes(normalized)) {
    return FILE_TYPE_BUCKETS.AUDIO;
  }

  return null;
}

/**
 * Compute file type bucket from metadata
 * This is the main function used throughout the codebase
 * @param {object} metadata - File metadata
 * @param {string} fileId - File ID (for extension fallback)
 * @returns {string} - File type bucket
 */
export function computeFileTypeBucket(metadata = {}, fileId = '') {
  // 1. Check explicit bucket in metadata
  const explicitBucket = normalizeFileTypeBucket(
    metadata?.FileTypeBucket || metadata?.file_type_bucket
  );
  if (explicitBucket) {
    return explicitBucket;
  }

  // 2. Check MIME type
  const mimeType = String(
    metadata?.FileType || metadata?.file_type || ''
  ).trim().toLowerCase();

  const bucketFromMime = detectBucketFromMimeType(mimeType);
  if (bucketFromMime) {
    return bucketFromMime;
  }

  // 3. If MIME is generic, try extension
  if (isGenericMimeType(mimeType)) {
    const filename = String(
      metadata?.FileName || metadata?.file_name || fileId || ''
    ).trim();
    const extension = getFileExtension(filename);
    const bucketFromExt = detectBucketFromExtension(extension);
    if (bucketFromExt) {
      return bucketFromExt;
    }
  }

  // 4. Default to 'other'
  return FILE_TYPE_BUCKETS.OTHER;
}

/**
 * Check if file is an image
 * @param {object} metadata - File metadata
 * @param {string} fileId - File ID
 * @returns {boolean}
 */
export function isImageFile(metadata, fileId = '') {
  return computeFileTypeBucket(metadata, fileId) === FILE_TYPE_BUCKETS.IMAGE;
}

/**
 * Check if file is a video
 * @param {object} metadata - File metadata
 * @param {string} fileId - File ID
 * @returns {boolean}
 */
export function isVideoFile(metadata, fileId = '') {
  return computeFileTypeBucket(metadata, fileId) === FILE_TYPE_BUCKETS.VIDEO;
}

/**
 * Check if file is audio
 * @param {object} metadata - File metadata
 * @param {string} fileId - File ID
 * @returns {boolean}
 */
export function isAudioFile(metadata, fileId = '') {
  return computeFileTypeBucket(metadata, fileId) === FILE_TYPE_BUCKETS.AUDIO;
}

/**
 * Get human-readable file type label
 * @param {string} bucket - File type bucket
 * @returns {string}
 */
export function getFileTypeLabel(bucket) {
  const labels = {
    [FILE_TYPE_BUCKETS.IMAGE]: 'Image',
    [FILE_TYPE_BUCKETS.VIDEO]: 'Video',
    [FILE_TYPE_BUCKETS.AUDIO]: 'Audio',
    [FILE_TYPE_BUCKETS.OTHER]: 'Document',
  };
  return labels[bucket] || 'File';
}

/**
 * SQL WHERE clause for file type bucket filtering
 * Use this in D1 queries for consistent filtering
 * @param {string} bucket - File type bucket
 * @returns {string} - SQL WHERE clause fragment
 */
export function getFileTypeBucketSqlFilter(bucket) {
  const normalized = normalizeFileTypeBucket(bucket);
  if (!normalized) {
    return '1=1'; // No filter
  }
  return `file_type_bucket = '${normalized}'`;
}

/**
 * Legacy MIME type patterns (for backward compatibility)
 * These match the old SQL patterns in d1Database.js
 */
export const LEGACY_SQL_PATTERNS = {
  IMAGE_TYPE_SQL: `(
    json_extract(metadata, '$.FileType') LIKE 'image/%'
    OR json_extract(metadata, '$.file_type') LIKE 'image/%'
    OR json_extract(metadata, '$.FileType') = 'image'
    OR json_extract(metadata, '$.file_type') = 'image'
    OR json_extract(metadata, '$.FileType') = 'photo'
    OR json_extract(metadata, '$.file_type') = 'photo'
  )`,
  VIDEO_TYPE_SQL: `(
    json_extract(metadata, '$.FileType') LIKE 'video/%'
    OR json_extract(metadata, '$.file_type') LIKE 'video/%'
    OR json_extract(metadata, '$.FileType') = 'video'
    OR json_extract(metadata, '$.file_type') = 'video'
  )`,
  AUDIO_TYPE_SQL: `(
    json_extract(metadata, '$.FileType') LIKE 'audio/%'
    OR json_extract(metadata, '$.file_type') LIKE 'audio/%'
    OR json_extract(metadata, '$.FileType') = 'audio'
    OR json_extract(metadata, '$.file_type') = 'audio'
  )`,
};
