import { extractExifData } from '../upload/exifExtractor.js'

function normalizeExt(ext = '') {
    return String(ext || '').trim().toLowerCase().replace(/^\./, '')
}

function normalizeKind(kind = '') {
    return String(kind || '').trim().toLowerCase()
}

function detectExt(reference = '') {
    const match = String(reference || '').trim().match(/\.([A-Za-z0-9]{2,8})(?:$|[?#])/)
    return normalizeExt(match?.[1] || '')
}

function inferMimeTypeFromExt(ext = '') {
    const normalized = normalizeExt(ext)
    const imageTypes = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        gif: 'image/gif',
        bmp: 'image/bmp',
        avif: 'image/avif',
        heic: 'image/heic',
        heif: 'image/heif',
    }
    if (imageTypes[normalized]) {
        return imageTypes[normalized]
    }
    const videoTypes = {
        mp4: 'video/mp4',
        mov: 'video/quicktime',
        m4v: 'video/x-m4v',
        webm: 'video/webm',
        avi: 'video/x-msvideo',
    }
    return videoTypes[normalized] || ''
}

export function inferTelegramFileType(kind, media, filePath = '') {
    const explicitType = String(media?.mime_type || '').trim().toLowerCase()
    if (explicitType && explicitType !== 'application/octet-stream') {
        return explicitType
    }
    const inferredExt = detectExt(filePath) || detectExt(media?.file_name || '')
    const inferredType = inferMimeTypeFromExt(inferredExt)
    if (inferredType) {
        return inferredType
    }
    if (normalizeKind(kind) === 'photo') {
        return 'image/jpeg'
    }
    if (normalizeKind(kind) === 'animation') {
        return 'image/gif'
    }
    return 'application/octet-stream'
}

export function inferTelegramExtension(kind, media, filePath = '') {
    const inferredExt = detectExt(filePath) || detectExt(media?.file_name || '')
    if (inferredExt) {
        return inferredExt
    }
    const inferredType = inferTelegramFileType(kind, media, filePath)
    const fallbackExtMap = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'image/bmp': 'bmp',
        'image/avif': 'avif',
        'image/heic': 'heic',
        'image/heif': 'heif',
        'video/mp4': 'mp4',
        'video/quicktime': 'mov',
        'video/x-m4v': 'm4v',
        'video/webm': 'webm',
        'video/x-msvideo': 'avi',
    }
    if (fallbackExtMap[inferredType]) {
        return fallbackExtMap[inferredType]
    }
    if (normalizeKind(kind) === 'photo') {
        return 'jpg'
    }
    if (normalizeKind(kind) === 'animation') {
        return 'gif'
    }
    return 'bin'
}

export function buildTelegramImportMetadataHints(kind, media, filePath = '') {
    const normalizedKind = normalizeKind(kind) || 'unknown'
    const fileType = inferTelegramFileType(normalizedKind, media, filePath)
    const isImage = fileType.startsWith('image/')
    const hints = {
        TgMediaKind: normalizedKind,
        TgPreservationHint: normalizedKind === 'document'
            ? 'original-likely'
            : normalizedKind === 'photo'
                ? 'telegram-photo-variant'
                : 'unknown',
    }

    if (isImage) {
        hints.TgExifRetentionHint = normalizedKind === 'document'
            ? 'likely-retained'
            : normalizedKind === 'photo'
                ? 'unlikely-retained'
                : 'unknown'
    }

    return hints
}

export async function readTelegramImageMetadata(telegramAPI, filePath, fileType) {
    if (!telegramAPI || !filePath || !String(fileType || '').toLowerCase().startsWith('image/')) {
        return { exifData: null }
    }
    try {
        const headerBuffer = await telegramAPI.getFileHeaderByPath(filePath, 65536)
        if (!headerBuffer || !headerBuffer.byteLength) {
            return { exifData: null }
        }
        return {
            exifData: await extractExifData(headerBuffer, fileType),
        }
    } catch (error) {
        console.error('Failed to read Telegram image metadata:', error)
        return { exifData: null }
    }
}
