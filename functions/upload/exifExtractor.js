/**
 * EXIF 元数据提取模块
 * 仅在 Pages Functions 运行时保留轻量 JPEG EXIF 时间解析，避免依赖 exifr。
 */

const EXIF_CAPABLE_TYPES = /^image\/(jpeg|jpg|tiff|heic|heif|png|webp|avif|dng)/;
const JPEG_CAPABLE_TYPES = /^image\/(jpeg|jpg)/;
const EMBEDDED_PREVIEW_CAPABLE_TYPES = /^image\/(heic|heif)/;
const TIFF_TYPE_ASCII = 2;
const TIFF_TYPE_LONG = 4;
const DATE_TIME_TAGS = [0x9003, 0x9004, 0x0132];
const EXIF_IFD_POINTER_TAG = 0x8769;
const defaultEmbeddedThumbnailModuleLoader = () => import('exifr/dist/full.esm.mjs');
let embeddedThumbnailExtractor = null;
let embeddedThumbnailModuleLoader = defaultEmbeddedThumbnailModuleLoader;
let embeddedThumbnailLoaderAttempted = false;

/**
 * 从图片 buffer 中提取 EXIF 元数据
 * @param {ArrayBuffer} buffer - 图片文件头部（至少 64KB）
 * @param {string} fileType - MIME 类型
 * @returns {Promise<Object|null>} 结构化 EXIF 对象，无数据时返回 null
 */
export async function extractExifData(buffer, fileType) {
    if (!EXIF_CAPABLE_TYPES.test(fileType)) {
        return null;
    }

    if (!JPEG_CAPABLE_TYPES.test(fileType) || !(buffer instanceof ArrayBuffer) || buffer.byteLength < 4) {
        return null;
    }

    try {
        const dateTime = extractJpegExifDateTime(buffer);
        if (!dateTime) {
            return null;
        }

        return {
            dateTime,
        };
    } catch (error) {
        console.error('EXIF extraction failed:', error.message || error);
        return null;
    }
}

export function supportsEmbeddedPreviewExtraction(fileType) {
    return EMBEDDED_PREVIEW_CAPABLE_TYPES.test(String(fileType || '').trim().toLowerCase());
}

export async function extractEmbeddedPreview(buffer, fileType) {
    if (!supportsEmbeddedPreviewExtraction(fileType) || !buffer) {
        return null;
    }

    try {
        const extractor = await getEmbeddedThumbnailExtractor();
        if (typeof extractor !== 'function') {
            return null;
        }

        const rawThumbnail = await extractor(buffer);
        if (!rawThumbnail) {
            return null;
        }

        const bytes = rawThumbnail instanceof Uint8Array
            ? rawThumbnail
            : new Uint8Array(rawThumbnail);
        if (!bytes.byteLength) {
            return null;
        }

        return {
            bytes,
            mimeType: detectPreviewMimeType(bytes),
        };
    } catch (error) {
        console.error('Embedded preview extraction failed:', error.message || error);
        return null;
    }
}

export function __setEmbeddedThumbnailExtractorForTests(extractor) {
    embeddedThumbnailExtractor = typeof extractor === 'function' ? extractor : null;
    embeddedThumbnailLoaderAttempted = typeof embeddedThumbnailExtractor === 'function';
}

export function __setEmbeddedThumbnailModuleLoaderForTests(loader) {
    embeddedThumbnailModuleLoader = typeof loader === 'function'
        ? loader
        : defaultEmbeddedThumbnailModuleLoader;
    embeddedThumbnailExtractor = null;
    embeddedThumbnailLoaderAttempted = false;
}

export function __resetEmbeddedThumbnailExtractorForTests() {
    embeddedThumbnailExtractor = null;
    embeddedThumbnailModuleLoader = defaultEmbeddedThumbnailModuleLoader;
    embeddedThumbnailLoaderAttempted = false;
}

async function getEmbeddedThumbnailExtractor() {
    if (typeof embeddedThumbnailExtractor === 'function') {
        return embeddedThumbnailExtractor;
    }

    if (embeddedThumbnailLoaderAttempted) {
        return null;
    }

    embeddedThumbnailLoaderAttempted = true;
    const loadedModule = await embeddedThumbnailModuleLoader();
    const defaultExport = loadedModule?.default;
    const thumbnail = defaultExport?.thumbnail || loadedModule?.thumbnail;
    if (typeof thumbnail !== 'function') {
        return null;
    }

    embeddedThumbnailExtractor = (buffer) => thumbnail.call(defaultExport || loadedModule, buffer);
    return embeddedThumbnailExtractor;
}

function extractJpegExifDateTime(buffer) {
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0, false) !== 0xFFD8) {
        return null;
    }

    let offset = 2;
    while (offset + 4 <= view.byteLength) {
        if (view.getUint8(offset) !== 0xFF) {
            break;
        }

        const marker = view.getUint8(offset + 1);
        if (marker === 0xD9 || marker === 0xDA) {
            break;
        }

        const segmentLength = view.getUint16(offset + 2, false);
        if (segmentLength < 2 || offset + 2 + segmentLength > view.byteLength) {
            break;
        }

        if (marker === 0xE1 && segmentLength >= 8) {
            const exifStart = offset + 4;
            if (readAscii(view, exifStart, 6) === 'Exif\0\0') {
                const tiffStart = exifStart + 6;
                return extractTiffDateTime(view, tiffStart, offset + 2 + segmentLength);
            }
        }

        offset += 2 + segmentLength;
    }

    return null;
}

function extractTiffDateTime(view, tiffStart, segmentEnd) {
    if (tiffStart + 8 > segmentEnd) {
        return null;
    }

    const byteOrderMark = readAscii(view, tiffStart, 2);
    const littleEndian = byteOrderMark === 'II' ? true : byteOrderMark === 'MM' ? false : null;
    if (littleEndian === null) {
        return null;
    }

    if (view.getUint16(tiffStart + 2, littleEndian) !== 0x002A) {
        return null;
    }

    const ifd0Offset = view.getUint32(tiffStart + 4, littleEndian);
    if (ifd0Offset === 0) {
        return null;
    }

    const ifd0Start = tiffStart + ifd0Offset;
    const ifd0DateTime = findDateTimeInIfd(view, tiffStart, ifd0Start, segmentEnd, littleEndian, false);
    const exifIfdOffset = findExifIfdPointer(view, tiffStart, ifd0Start, segmentEnd, littleEndian);

    if (exifIfdOffset !== null) {
        const exifIfdStart = tiffStart + exifIfdOffset;
        const exifDateTime = findDateTimeInIfd(view, tiffStart, exifIfdStart, segmentEnd, littleEndian, true);
        if (exifDateTime) {
            return exifDateTime;
        }
    }

    return ifd0DateTime;
}

function findExifIfdPointer(view, tiffStart, ifdStart, segmentEnd, littleEndian) {
    const entryCount = readIfdEntryCount(view, ifdStart, segmentEnd, littleEndian);
    if (entryCount === null) {
        return null;
    }

    for (let index = 0; index < entryCount; index += 1) {
        const entryOffset = ifdStart + 2 + index * 12;
        if (entryOffset + 12 > segmentEnd) {
            return null;
        }

        const tag = view.getUint16(entryOffset, littleEndian);
        if (tag !== EXIF_IFD_POINTER_TAG) {
            continue;
        }

        const type = view.getUint16(entryOffset + 2, littleEndian);
        const count = view.getUint32(entryOffset + 4, littleEndian);
        if (type !== TIFF_TYPE_LONG || count < 1) {
            return null;
        }

        return view.getUint32(entryOffset + 8, littleEndian);
    }

    return null;
}

function findDateTimeInIfd(view, tiffStart, ifdStart, segmentEnd, littleEndian, preferExifTags) {
    const entryCount = readIfdEntryCount(view, ifdStart, segmentEnd, littleEndian);
    if (entryCount === null) {
        return null;
    }

    const tags = preferExifTags ? DATE_TIME_TAGS : [0x0132];
    for (const wantedTag of tags) {
        for (let index = 0; index < entryCount; index += 1) {
            const entryOffset = ifdStart + 2 + index * 12;
            if (entryOffset + 12 > segmentEnd) {
                return null;
            }

            const tag = view.getUint16(entryOffset, littleEndian);
            if (tag !== wantedTag) {
                continue;
            }

            const value = readAsciiEntryValue(view, tiffStart, entryOffset, segmentEnd, littleEndian);
            const normalized = normalizeExifDateTime(value);
            if (normalized) {
                return normalized;
            }
        }
    }

    return null;
}

function readIfdEntryCount(view, ifdStart, segmentEnd, littleEndian) {
    if (ifdStart + 2 > segmentEnd) {
        return null;
    }
    return view.getUint16(ifdStart, littleEndian);
}

function readAsciiEntryValue(view, tiffStart, entryOffset, segmentEnd, littleEndian) {
    const type = view.getUint16(entryOffset + 2, littleEndian);
    const count = view.getUint32(entryOffset + 4, littleEndian);
    if (type !== TIFF_TYPE_ASCII || count < 1) {
        return null;
    }

    let valueOffset = entryOffset + 8;
    if (count > 4) {
        const relativeOffset = view.getUint32(entryOffset + 8, littleEndian);
        valueOffset = tiffStart + relativeOffset;
    }

    if (valueOffset < 0 || valueOffset + count > segmentEnd) {
        return null;
    }

    return readAscii(view, valueOffset, count).replace(/\0+$/, '').trim();
}

function readAscii(view, offset, length) {
    let result = '';
    for (let index = 0; index < length && offset + index < view.byteLength; index += 1) {
        result += String.fromCharCode(view.getUint8(offset + index));
    }
    return result;
}

function normalizeExifDateTime(value) {
    if (!value) {
        return null;
    }

    const match = String(value).trim().match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (!match) {
        return null;
    }

    const [, year, month, day, hour, minute, second] = match;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
}

function detectPreviewMimeType(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length < 4) {
        return 'image/jpeg';
    }

    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
        return 'image/png';
    }

    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
        return 'image/jpeg';
    }

    if (bytes.length >= 12
        && bytes[0] === 0x52
        && bytes[1] === 0x49
        && bytes[2] === 0x46
        && bytes[3] === 0x46
        && bytes[8] === 0x57
        && bytes[9] === 0x45
        && bytes[10] === 0x42
        && bytes[11] === 0x50) {
        return 'image/webp';
    }

    return 'image/jpeg';
}
