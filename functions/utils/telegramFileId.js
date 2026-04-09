function getBaseNameWithoutExtension(fileId = '') {
    const normalized = String(fileId || '').split('/').pop() || '';
    const lastDot = normalized.lastIndexOf('.');
    return lastDot > 0 ? normalized.slice(0, lastDot) : normalized;
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
    // tg_<sanitized_channel_name>_<messageId>_<telegram_file_id>.<ext>
    const importedMatch = baseName.match(/^tg_(.+)_(\d+)_(.+)$/);
    if (importedMatch?.[3]) {
        return importedMatch[3];
    }

    // Legacy Telegram records used raw file_id as the storage key base name.
    if (channel === 'Telegram') {
        return baseName;
    }

    return '';
}
