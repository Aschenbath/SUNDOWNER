/**
 * EXIF 元数据提取模块
 * 仅在 Pages Functions 运行时保留轻量 JPEG EXIF 时间解析，避免依赖 exifr。
 */

const EXIF_CAPABLE_TYPES = /^image\/(jpeg|jpg|tiff|heic|heif|png|webp|avif|dng)/;
const JPEG_CAPABLE_TYPES = /^image\/(jpeg|jpg)/;
const RUNTIME_EXIF_CAPABLE_TYPES = /^image\/(heic|heif)/;
const EMBEDDED_PREVIEW_CAPABLE_TYPES = /^image\/(heic|heif)/;
const EXIF_OPTIONS = {
    tiff: true,
    exif: true,
    gps: true,
    ifd1: false,
    interop: false,
    pick: [
        'DateTimeOriginal', 'CreateDate',
        'Make', 'Model', 'LensModel',
        'FNumber', 'ExposureTime', 'ISO', 'FocalLength',
        'GPSLatitude', 'GPSLongitude', 'GPSAltitude',
        'Orientation',
    ],
};
const TIFF_TYPE_BYTE = 1;
const TIFF_TYPE_ASCII = 2;
const TIFF_TYPE_SHORT = 3;
const TIFF_TYPE_LONG = 4;
const TIFF_TYPE_RATIONAL = 5;
const TIFF_TYPE_SLONG = 9;
const TIFF_TYPE_SRATIONAL = 10;
const DATE_TIME_TAGS = [0x9003, 0x9004, 0x0132];
const EXIF_IFD_POINTER_TAG = 0x8769;
const GPS_IFD_POINTER_TAG = 0x8825;
const TAG_MAKE = 0x010F;
const TAG_MODEL = 0x0110;
const TAG_ORIENTATION = 0x0112;
const TAG_LENS_MODEL = 0xA434;
const TAG_F_NUMBER = 0x829D;
const TAG_EXPOSURE_TIME = 0x829A;
const TAG_ISO = 0x8827;
const TAG_FOCAL_LENGTH = 0x920A;
const TAG_GPS_LATITUDE_REF = 0x0001;
const TAG_GPS_LATITUDE = 0x0002;
const TAG_GPS_LONGITUDE_REF = 0x0003;
const TAG_GPS_LONGITUDE = 0x0004;
const TAG_GPS_ALTITUDE_REF = 0x0005;
const TAG_GPS_ALTITUDE = 0x0006;
const defaultRuntimeExifModuleLoader = () => import('exifr/dist/full.esm.mjs');
let runtimeExifModule = null;
let runtimeExifModuleLoader = defaultRuntimeExifModuleLoader;
let runtimeExifModulePromise = null;
let runtimeExifModuleLoadSucceeded = false;
let embeddedThumbnailExtractor = null;

/**
 * 从图片 buffer 中提取 EXIF 元数据
 * @param {ArrayBuffer} buffer - 图片文件头部（至少 64KB）
 * @param {string} fileType - MIME 类型
 * @returns {Promise<Object|null>} 结构化 EXIF 对象，无数据时返回 null
 */
export async function extractExifData(buffer, fileType) {
    const normalizedFileType = String(fileType || '').trim().toLowerCase();
    if (!EXIF_CAPABLE_TYPES.test(normalizedFileType)) {
        return null;
    }

    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 4) {
        return null;
    }

    try {
        if (JPEG_CAPABLE_TYPES.test(normalizedFileType)) {
            return extractJpegExifData(buffer);
        }
        if (RUNTIME_EXIF_CAPABLE_TYPES.test(normalizedFileType)) {
            return await extractRuntimeExifData(buffer);
        }
        return null;
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
}

export function __setEmbeddedThumbnailModuleLoaderForTests(loader) {
    runtimeExifModuleLoader = typeof loader === 'function'
        ? loader
        : defaultRuntimeExifModuleLoader;
    runtimeExifModule = null;
    runtimeExifModulePromise = null;
    runtimeExifModuleLoadSucceeded = false;
    embeddedThumbnailExtractor = null;
}

export function __resetEmbeddedThumbnailExtractorForTests() {
    embeddedThumbnailExtractor = null;
    runtimeExifModule = null;
    runtimeExifModuleLoader = defaultRuntimeExifModuleLoader;
    runtimeExifModulePromise = null;
    runtimeExifModuleLoadSucceeded = false;
}

async function getEmbeddedThumbnailExtractor() {
    if (typeof embeddedThumbnailExtractor === 'function') {
        return embeddedThumbnailExtractor;
    }

    const loadedModule = await getRuntimeExifModule();
    if (!loadedModule) {
        return null;
    }
    const defaultExport = loadedModule?.default;
    const thumbnail = defaultExport?.thumbnail || loadedModule?.thumbnail;
    if (typeof thumbnail !== 'function') {
        return null;
    }

    embeddedThumbnailExtractor = (buffer) => thumbnail.call(defaultExport || loadedModule, buffer);
    return embeddedThumbnailExtractor;
}

async function getRuntimeExifModule() {
    if (runtimeExifModule) {
        return runtimeExifModule;
    }

    // 只在加载成功后 latch。成功但没拿到可用模块（loader 返回空）也视为已尝试，
    // 保持原来"不重试缺失导出"的行为；只有 import 抛错才允许下一次调用重试，
    // 否则一次瞬时加载失败会让整个 isolate 永久失去嵌入式预览能力。
    if (runtimeExifModuleLoadSucceeded) {
        return runtimeExifModule;
    }

    if (!runtimeExifModulePromise) {
        // 同一请求内的并发调用共享同一个 in-flight import，避免紧凑重试循环。
        runtimeExifModulePromise = (async () => {
            const loadedModule = await runtimeExifModuleLoader();
            runtimeExifModuleLoadSucceeded = true;
            runtimeExifModule = loadedModule;
            return loadedModule;
        })()
            .catch((error) => {
                // 每次失败只记一条日志；memo 清空后下一次请求可以重试 import。
                console.warn('exifr runtime module load failed:', error?.message || error);
                return null;
            })
            .finally(() => {
                runtimeExifModulePromise = null;
            });
    }

    return runtimeExifModulePromise;
}

async function extractRuntimeExifData(buffer) {
    const loadedModule = await getRuntimeExifModule();
    if (!loadedModule) {
        return null;
    }

    const defaultExport = loadedModule?.default;
    const parser = defaultExport?.parse || loadedModule?.parse;
    if (typeof parser !== 'function') {
        return null;
    }

    const raw = await parser.call(defaultExport || loadedModule, buffer, EXIF_OPTIONS);
    return buildExifFromRaw(raw);
}

function extractJpegExifData(buffer) {
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
                return extractTiffExifData(view, tiffStart, offset + 2 + segmentLength);
            }
        }

        offset += 2 + segmentLength;
    }

    return null;
}

function extractTiffExifData(view, tiffStart, segmentEnd) {
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
    const exifIfdOffset = toExifNumber(readTiffValueByTag(
        view,
        tiffStart,
        ifd0Start,
        segmentEnd,
        littleEndian,
        EXIF_IFD_POINTER_TAG,
    ));
    const gpsIfdOffset = toExifNumber(readTiffValueByTag(
        view,
        tiffStart,
        ifd0Start,
        segmentEnd,
        littleEndian,
        GPS_IFD_POINTER_TAG,
    ));

    let exifIfdStart = null;
    let exifDateTime = null;
    if (exifIfdOffset !== null) {
        const candidate = tiffStart + exifIfdOffset;
        if (candidate + 2 <= segmentEnd) {
            exifIfdStart = candidate;
            exifDateTime = findDateTimeInIfd(view, tiffStart, exifIfdStart, segmentEnd, littleEndian, true);
        }
    }

    const result = {};
    const dateTime = exifDateTime || ifd0DateTime;
    if (dateTime) {
        result.dateTime = dateTime;
    }

    const camera = buildCameraFromTiff(view, tiffStart, ifd0Start, exifIfdStart, segmentEnd, littleEndian);
    if (camera) {
        result.camera = camera;
    }

    const shooting = buildShootingFromTiff(view, tiffStart, exifIfdStart, segmentEnd, littleEndian);
    if (shooting) {
        result.shooting = shooting;
    }

    const gpsIfdStart = gpsIfdOffset !== null ? tiffStart + gpsIfdOffset : null;
    const gps = buildGpsFromTiff(view, tiffStart, gpsIfdStart, segmentEnd, littleEndian);
    if (gps) {
        result.gps = gps;
    }

    const orientation = toExifNumber(readTiffValueByTag(
        view,
        tiffStart,
        ifd0Start,
        segmentEnd,
        littleEndian,
        TAG_ORIENTATION,
    ));
    if (orientation != null) {
        result.orientation = orientation;
    }

    return Object.keys(result).length > 0 ? result : null;
}

function buildExifFromRaw(raw) {
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    const result = {};
    const dateTime = normalizeRuntimeDateTime(raw.DateTimeOriginal || raw.CreateDate);
    if (dateTime) {
        result.dateTime = dateTime;
    }

    const camera = buildCamera(raw);
    if (camera) {
        result.camera = camera;
    }

    const gps = buildGPS(raw);
    if (gps) {
        result.gps = gps;
    }

    const shooting = buildShooting(raw);
    if (shooting) {
        result.shooting = shooting;
    }

    if (raw.Orientation != null) {
        result.orientation = raw.Orientation;
    }

    return Object.keys(result).length > 0 ? result : null;
}

function buildCamera(raw) {
    const make = normalizeExifText(raw.Make);
    const model = normalizeExifText(raw.Model);
    const lens = normalizeExifText(raw.LensModel);
    if (!make && !model && !lens) {
        return null;
    }
    const camera = {};
    if (make) camera.make = make;
    if (model) camera.model = model;
    if (lens) camera.lens = lens;
    return camera;
}

function buildGPS(raw) {
    const latitude = toExifNumber(raw.GPSLatitude);
    const longitude = toExifNumber(raw.GPSLongitude);
    if (latitude == null || longitude == null) {
        return null;
    }
    const gps = { latitude, longitude };
    const altitude = toExifNumber(raw.GPSAltitude);
    if (altitude != null) {
        gps.altitude = Math.round(altitude);
    }
    return gps;
}

function buildShooting(raw) {
    const shooting = {};
    const fNumber = toExifNumber(raw.FNumber);
    const exposureTime = formatExposureTime(raw.ExposureTime);
    const iso = toExifNumber(raw.ISO);
    const focalLength = toExifNumber(raw.FocalLength);
    if (fNumber != null) shooting.fNumber = fNumber;
    if (exposureTime) shooting.exposureTime = exposureTime;
    if (iso != null) shooting.iso = iso;
    if (focalLength != null) shooting.focalLength = focalLength;
    return Object.keys(shooting).length > 0 ? shooting : null;
}

function buildCameraFromTiff(view, tiffStart, ifd0Start, exifIfdStart, segmentEnd, littleEndian) {
    const make = normalizeExifText(readTiffValueByTag(view, tiffStart, ifd0Start, segmentEnd, littleEndian, TAG_MAKE));
    const model = normalizeExifText(readTiffValueByTag(view, tiffStart, ifd0Start, segmentEnd, littleEndian, TAG_MODEL));
    const lens = normalizeExifText(readTiffValueByTag(view, tiffStart, exifIfdStart, segmentEnd, littleEndian, TAG_LENS_MODEL));
    if (!make && !model && !lens) {
        return null;
    }
    const camera = {};
    if (make) camera.make = make;
    if (model) camera.model = model;
    if (lens) camera.lens = lens;
    return camera;
}

function buildShootingFromTiff(view, tiffStart, exifIfdStart, segmentEnd, littleEndian) {
    const shooting = {};
    const fNumber = toExifNumber(readTiffValueByTag(view, tiffStart, exifIfdStart, segmentEnd, littleEndian, TAG_F_NUMBER));
    const exposureTime = formatExposureTime(readTiffValueByTag(
        view,
        tiffStart,
        exifIfdStart,
        segmentEnd,
        littleEndian,
        TAG_EXPOSURE_TIME,
    ));
    const iso = toExifNumber(readTiffValueByTag(view, tiffStart, exifIfdStart, segmentEnd, littleEndian, TAG_ISO));
    const focalLength = toExifNumber(readTiffValueByTag(
        view,
        tiffStart,
        exifIfdStart,
        segmentEnd,
        littleEndian,
        TAG_FOCAL_LENGTH,
    ));
    if (fNumber != null) shooting.fNumber = fNumber;
    if (exposureTime) shooting.exposureTime = exposureTime;
    if (iso != null) shooting.iso = iso;
    if (focalLength != null) shooting.focalLength = focalLength;
    return Object.keys(shooting).length > 0 ? shooting : null;
}

function buildGpsFromTiff(view, tiffStart, gpsIfdStart, segmentEnd, littleEndian) {
    if (!gpsIfdStart || gpsIfdStart + 2 > segmentEnd) {
        return null;
    }

    const latitude = gpsCoordinateToDecimal(
        readTiffValueByTag(view, tiffStart, gpsIfdStart, segmentEnd, littleEndian, TAG_GPS_LATITUDE),
        normalizeExifText(readTiffValueByTag(view, tiffStart, gpsIfdStart, segmentEnd, littleEndian, TAG_GPS_LATITUDE_REF)),
    );
    const longitude = gpsCoordinateToDecimal(
        readTiffValueByTag(view, tiffStart, gpsIfdStart, segmentEnd, littleEndian, TAG_GPS_LONGITUDE),
        normalizeExifText(readTiffValueByTag(view, tiffStart, gpsIfdStart, segmentEnd, littleEndian, TAG_GPS_LONGITUDE_REF)),
    );
    if (latitude == null || longitude == null) {
        return null;
    }

    const gps = { latitude, longitude };
    const altitude = toExifNumber(readTiffValueByTag(view, tiffStart, gpsIfdStart, segmentEnd, littleEndian, TAG_GPS_ALTITUDE));
    if (altitude != null) {
        const altitudeRef = toExifNumber(readTiffValueByTag(
            view,
            tiffStart,
            gpsIfdStart,
            segmentEnd,
            littleEndian,
            TAG_GPS_ALTITUDE_REF,
        ));
        gps.altitude = Math.round(altitudeRef === 1 ? -altitude : altitude);
    }
    return gps;
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

            const value = readTiffEntryValue(view, tiffStart, entryOffset, segmentEnd, littleEndian);
            const normalized = normalizeExifDateTime(value);
            if (normalized) {
                return normalized;
            }
        }
    }

    return null;
}

function readIfdEntryCount(view, ifdStart, segmentEnd, littleEndian) {
    if (!ifdStart || ifdStart + 2 > segmentEnd) {
        return null;
    }
    return view.getUint16(ifdStart, littleEndian);
}

function readTiffValueByTag(view, tiffStart, ifdStart, segmentEnd, littleEndian, wantedTag) {
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
        if (tag === wantedTag) {
            return readTiffEntryValue(view, tiffStart, entryOffset, segmentEnd, littleEndian);
        }
    }

    return null;
}

function readTiffEntryValue(view, tiffStart, entryOffset, segmentEnd, littleEndian) {
    const type = view.getUint16(entryOffset + 2, littleEndian);
    const count = view.getUint32(entryOffset + 4, littleEndian);
    const typeSize = getTiffTypeSize(type);
    if (!typeSize || count < 1) {
        return null;
    }

    const totalBytes = typeSize * count;
    let valueOffset = entryOffset + 8;
    if (totalBytes > 4) {
        const relativeOffset = view.getUint32(entryOffset + 8, littleEndian);
        valueOffset = tiffStart + relativeOffset;
    }

    if (valueOffset < 0 || valueOffset + totalBytes > segmentEnd) {
        return null;
    }

    if (type === TIFF_TYPE_ASCII) {
        return readAscii(view, valueOffset, count).replace(/\0+$/, '').trim();
    }

    const values = [];
    for (let index = 0; index < count; index += 1) {
        const offset = valueOffset + index * typeSize;
        if (type === TIFF_TYPE_BYTE) {
            values.push(view.getUint8(offset));
        } else if (type === TIFF_TYPE_SHORT) {
            values.push(view.getUint16(offset, littleEndian));
        } else if (type === TIFF_TYPE_LONG) {
            values.push(view.getUint32(offset, littleEndian));
        } else if (type === TIFF_TYPE_RATIONAL) {
            const numerator = view.getUint32(offset, littleEndian);
            const denominator = view.getUint32(offset + 4, littleEndian);
            values.push(denominator ? numerator / denominator : null);
        } else if (type === TIFF_TYPE_SLONG) {
            values.push(view.getInt32(offset, littleEndian));
        } else if (type === TIFF_TYPE_SRATIONAL) {
            const numerator = view.getInt32(offset, littleEndian);
            const denominator = view.getInt32(offset + 4, littleEndian);
            values.push(denominator ? numerator / denominator : null);
        }
    }

    if (values.length === 0) {
        return null;
    }
    return values.length === 1 ? values[0] : values;
}

function getTiffTypeSize(type) {
    if (type === TIFF_TYPE_BYTE || type === TIFF_TYPE_ASCII) return 1;
    if (type === TIFF_TYPE_SHORT) return 2;
    if (type === TIFF_TYPE_LONG || type === TIFF_TYPE_SLONG) return 4;
    if (type === TIFF_TYPE_RATIONAL || type === TIFF_TYPE_SRATIONAL) return 8;
    return 0;
}

function normalizeRuntimeDateTime(value) {
    if (!value) {
        return null;
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    const normalized = normalizeExifDateTime(value);
    return normalized || String(value).trim() || null;
}

function normalizeExifText(value) {
    return String(value || '').trim();
}

function toExifNumber(value) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first == null || first === '') {
        return null;
    }
    const number = Number(first);
    return Number.isFinite(number) ? number : null;
}

function formatExposureTime(value) {
    const text = typeof value === 'string' ? value.trim().replace(/s$/i, '') : '';
    if (text) {
        return text;
    }

    const number = toExifNumber(value);
    if (number == null || number <= 0) {
        return '';
    }
    return number < 1 ? `1/${Math.round(1 / number)}` : `${number}`;
}

function gpsCoordinateToDecimal(value, reference) {
    const values = Array.isArray(value) ? value : [value];
    if (values.length < 3) {
        return toExifNumber(value);
    }

    const degrees = toExifNumber(values[0]);
    const minutes = toExifNumber(values[1]);
    const seconds = toExifNumber(values[2]);
    if (degrees == null || minutes == null || seconds == null) {
        return null;
    }

    const sign = /^(S|W)$/i.test(reference) ? -1 : 1;
    return sign * (Math.abs(degrees) + minutes / 60 + seconds / 3600);
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
