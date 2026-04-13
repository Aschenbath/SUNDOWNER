import { resolveMediaCaptureTimestamp } from '../../js/media-library/time-resolution.js';

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function pickExistingCaptureValue(metadata = {}) {
    const exif = metadata?.Exif && typeof metadata.Exif === 'object' ? metadata.Exif : null;
    const candidates = [
        metadata?.DateTaken,
        metadata?.dateTaken,
        metadata?.TakenAt,
        metadata?.takenAt,
        exif?.dateTime,
        exif?.DateTimeOriginal,
        exif?.CreateDate,
    ];

    for (const candidate of candidates) {
        if (candidate instanceof Date && Number.isFinite(candidate.getTime())) {
            return candidate.toISOString();
        }

        const text = normalizeText(candidate);
        if (text) {
            return text;
        }
    }

    return '';
}

export function derivePersistedCaptureTime(metadata = {}, reference = '') {
    const existingValue = pickExistingCaptureValue(metadata);
    if (existingValue) {
        return existingValue;
    }

    const timestamp = resolveMediaCaptureTimestamp(metadata, reference || metadata?.FileName || '');
    if (!Number.isFinite(timestamp)) {
        return '';
    }

    return new Date(timestamp).toISOString();
}

export function ensurePersistedCaptureTime(metadata = {}, reference = '') {
    if (!metadata || typeof metadata !== 'object') {
        return metadata;
    }

    if (normalizeText(metadata.DateTaken)) {
        return metadata;
    }

    const persistedValue = derivePersistedCaptureTime(metadata, reference);
    if (!persistedValue) {
        return metadata;
    }

    return {
        ...metadata,
        DateTaken: persistedValue,
    };
}

export function mergeCaptureMetadata(currentMetadata = {}, sourceMetadata = {}, reference = '') {
    const nextMetadata = {
        ...(currentMetadata && typeof currentMetadata === 'object' ? currentMetadata : {}),
    };
    const source = sourceMetadata && typeof sourceMetadata === 'object' ? sourceMetadata : {};

    const sourceExif = source.Exif && typeof source.Exif === 'object' ? source.Exif : null;
    if (sourceExif && Object.keys(sourceExif).length > 0) {
        const currentExif = nextMetadata.Exif && typeof nextMetadata.Exif === 'object' ? nextMetadata.Exif : {};
        nextMetadata.Exif = {
            ...currentExif,
            ...sourceExif,
        };
    }

    const persistedValue = derivePersistedCaptureTime(source, reference)
        || derivePersistedCaptureTime(nextMetadata, reference);
    if (persistedValue && !normalizeText(nextMetadata.DateTaken)) {
        nextMetadata.DateTaken = persistedValue;
    }

    return nextMetadata;
}

export async function loadLegacyKvIndexMetadataMap(env, targetIds = null) {
    const kv = env?.img_url;
    if (!kv || typeof kv.get !== 'function') {
        return new Map();
    }

    let meta;
    try {
        const metaRaw = await kv.get('manage@index@meta');
        if (!metaRaw) {
            return new Map();
        }
        meta = JSON.parse(metaRaw);
    } catch {
        return new Map();
    }

    const chunkCount = Number.parseInt(meta?.chunkCount, 10) || 0;
    if (chunkCount <= 0) {
        return new Map();
    }

    const filter = targetIds
        ? new Set(
            Array.from(targetIds)
                .map((value) => normalizeText(value))
                .filter(Boolean),
        )
        : null;
    const metadataMap = new Map();

    for (let chunkId = 0; chunkId < chunkCount; chunkId += 1) {
        let files;
        try {
            const chunkRaw = await kv.get(`manage@index_${chunkId}`);
            if (!chunkRaw) {
                continue;
            }
            files = JSON.parse(chunkRaw);
        } catch {
            continue;
        }

        if (!Array.isArray(files)) {
            continue;
        }

        for (const file of files) {
            const fileId = normalizeText(file?.id);
            if (!fileId || metadataMap.has(fileId)) {
                continue;
            }

            if (filter && !filter.has(fileId)) {
                continue;
            }

            if (file?.metadata && typeof file.metadata === 'object') {
                metadataMap.set(fileId, file.metadata);
            }
        }

        if (filter && metadataMap.size >= filter.size) {
            break;
        }
    }

    return metadataMap;
}
