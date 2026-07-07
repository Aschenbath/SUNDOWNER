const TELEGRAM_DEDUPE_PREFIX = 'telegram-sync@dedupe@'

function sanitizeFileName(fileName) {
    let value = String(fileName || '')
    try {
        value = decodeURIComponent(value)
    } catch {
        // Channel names may contain literal percent sequences; sanitize them instead of aborting sync.
    }
    value = value.split('/').pop()
    const unsafeCharsRe = /[\\\/:\*\?"'<>\| \(\)\[\]\{\}#%\^`~;@&=\+\$,]/g
    return value.replace(unsafeCharsRe, '_')
}

export function buildTelegramDedupeKey(channelName, messageId) {
    return `${TELEGRAM_DEDUPE_PREFIX}${sanitizeFileName(channelName)}@${messageId}`
}

export async function loadTelegramDedupeRecord(db, channelName, messageId) {
    const key = buildTelegramDedupeKey(channelName, messageId)
    const raw = await db.get(key)
    if (!raw) {
        return null
    }
    try {
        return JSON.parse(raw)
    } catch (error) {
        await db.delete(key)
        return null
    }
}

export async function saveTelegramDedupeRecord(db, channelName, messageId, record) {
    const key = buildTelegramDedupeKey(channelName, messageId)
    await db.put(key, JSON.stringify(record))
}

export async function resolveTelegramDedupeDecision(db, channelName, messageId, fileUniqueId) {
    const record = await loadTelegramDedupeRecord(db, channelName, messageId)
    if (!record) {
        return { shouldSkip: false, record: null }
    }
    if (record.fileUniqueId && record.fileUniqueId === fileUniqueId) {
        return { shouldSkip: true, record }
    }
    return { shouldSkip: false, record }
}
