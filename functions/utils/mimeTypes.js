const GENERIC_MIME_TYPES = new Set([
    '',
    'application/octet-stream',
    'binary/octet-stream',
    'application/x-binary',
    'application/unknown',
    'unknown',
    'none',
    'null',
    'image',
    'video',
    'audio',
    'photo',
]);

const MIME_TYPES_BY_EXTENSION = new Map([
    ['jpg', 'image/jpeg'],
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['gif', 'image/gif'],
    ['webp', 'image/webp'],
    ['bmp', 'image/bmp'],
    ['avif', 'image/avif'],
    ['heic', 'image/heic'],
    ['heif', 'image/heif'],
    ['svg', 'image/svg+xml'],
    ['mp4', 'video/mp4'],
    ['webm', 'video/webm'],
    ['mov', 'video/quicktime'],
    ['m4v', 'video/x-m4v'],
    ['avi', 'video/x-msvideo'],
    ['mp3', 'audio/mpeg'],
    ['m4a', 'audio/mp4'],
    ['aac', 'audio/aac'],
    ['wav', 'audio/wav'],
    ['ogg', 'audio/ogg'],
    ['flac', 'audio/flac'],
    ['pdf', 'application/pdf'],
    ['zip', 'application/zip'],
    ['rar', 'application/x-rar-compressed'],
    ['7z', 'application/x-7z-compressed'],
    ['doc', 'application/msword'],
    ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['xls', 'application/vnd.ms-excel'],
    ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['ppt', 'application/vnd.ms-powerpoint'],
    ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    ['txt', 'text/plain'],
    ['csv', 'text/csv'],
]);

export function normalizeMimeType(value = '') {
    return String(value || '').trim().toLowerCase();
}

export function isGenericMimeType(value = '') {
    return GENERIC_MIME_TYPES.has(normalizeMimeType(value));
}

export function inferMimeTypeFromFileName(fileName = '') {
    const reference = String(fileName || '').trim().toLowerCase();
    const match = reference.match(/\.([a-z0-9]{2,8})(?:$|[?#\s])/);
    return MIME_TYPES_BY_EXTENSION.get(match?.[1] || '') || '';
}

export function resolveMimeType(rawMimeType = '', references = [], fallback = 'application/octet-stream') {
    const normalized = normalizeMimeType(rawMimeType);
    if (normalized && !isGenericMimeType(normalized)) {
        return normalized;
    }

    for (const reference of references) {
        const inferred = inferMimeTypeFromFileName(reference);
        if (inferred) {
            return inferred;
        }
    }

    return normalized || fallback;
}
