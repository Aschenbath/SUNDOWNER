function getBaseNameWithoutExtension(fileId = '') {
    const normalized = String(fileId || '').split('/').pop() || '';
    const lastDot = normalized.lastIndexOf('.');
    return lastDot > 0 ? normalized.slice(0, lastDot) : normalized;
}

function looksLikeTelegramFileId(value = '') {
    return String(value || '').trim().length >= 40;
}

export function resolveStoredTelegramFileId(fileId = '', metadata = {}) {
    const explicitId = String(
        metadata?.TgFileId
        || metadata?.TgFileID
        || metadata?.tgFileId
        || '',
    ).trim();
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
