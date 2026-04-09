function getBaseNameWithoutExtension(fileId = '') {
    const normalized = String(fileId || '').split('/').pop() || '';
    const lastDot = normalized.lastIndexOf('.');
    return lastDot > 0 ? normalized.slice(0, lastDot) : normalized;
}

function looksLikeTelegramFileId(value = '') {
    return String(value || '').trim().length >= 40;
}

function readFirstString(metadata = {}, keys = []) {
    for (const key of keys) {
        const value = String(metadata?.[key] || '').trim();
        if (value) {
            return value;
        }
    }
    return '';
}

export function resolveStoredTelegramFileId(fileId = '', metadata = {}) {
    const explicitId = readFirstString(metadata, [
        'TgFileId',
        'TgFileID',
        'tgFileId',
    ]);
    if (explicitId) {
        return explicitId;
    }

    const channel = String(metadata?.Channel || '').trim();
    const baseName = getBaseNameWithoutExtension(fileId);
    if (!baseName) {
        return '';
    }

    // Telegram sync imports are stored as:
    // tg_<sanitized_channel_name>_<messageId>_<telegram_file_unique_id>.<ext>
    const importedMatch = baseName.match(/^tg_(.+)_(\d+)_(.+)$/);
    const importedCandidate = String(importedMatch?.[3] || '').trim();
    if (importedCandidate) {
        const explicitUniqueId = String(metadata?.TgFileUniqueId || '').trim();
        if (explicitUniqueId && explicitUniqueId === importedCandidate) {
            return '';
        }
        if (looksLikeTelegramFileId(importedCandidate)) {
            return importedCandidate;
        }
        return '';
    }

    // Legacy Telegram records used raw file_id as the storage key base name.
    if (channel === 'Telegram') {
        return baseName;
    }

    return '';
}

export function resolveStoredTelegramThumbnail(metadata = {}) {
    const fileId = readFirstString(metadata, [
        'TgThumbnailFileId',
        'TgThumbFileId',
        'tgThumbnailFileId',
        'tgThumbFileId',
    ]);
    if (!fileId) {
        return null;
    }

    return {
        fileId,
        fileType: readFirstString(metadata, [
            'TgThumbnailFileType',
            'TgThumbFileType',
            'tgThumbnailFileType',
            'tgThumbFileType',
        ]) || 'image/jpeg',
    };
}

export function resolveStoredTelegramReadTarget(fileId = '', metadata = {}, options = {}) {
    if (options?.preview === true) {
        const thumbnail = resolveStoredTelegramThumbnail(metadata);
        if (thumbnail?.fileId) {
            return {
                fileId: thumbnail.fileId,
                fileType: thumbnail.fileType,
                isPreview: true,
            };
        }
    }

    return {
        fileId: resolveStoredTelegramFileId(fileId, metadata),
        fileType: '',
        isPreview: false,
    };
}
