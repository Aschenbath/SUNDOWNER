/**
 * EXIF 元数据提取模块
 * 从图片文件的 ArrayBuffer 中解析 EXIF 信息（拍摄时间、GPS、相机参数等）
 * 使用 exifr 库，纯 JS 实现，兼容 Cloudflare Workers
 */
import exifr from 'exifr/dist/full.esm.mjs';

const EXIF_OPTIONS = {
    tiff: true,
    exif: true,
    gps: true,
    ifd1: false,      // 跳过缩略图 IFD，节省解析时间
    interop: false,
    pick: [
        'DateTimeOriginal', 'CreateDate',
        'Make', 'Model', 'LensModel',
        'FNumber', 'ExposureTime', 'ISO', 'FocalLength',
        'GPSLatitude', 'GPSLongitude', 'GPSAltitude',
        'Orientation'
    ]
};

const EXIF_CAPABLE_TYPES = /^image\/(jpeg|tiff|heic|heif|png|webp|avif|dng)/;
const EMBEDDED_PREVIEW_CAPABLE_TYPES = /^image\/(heic|heif)/;
let embeddedThumbnailExtractor = (buffer) => exifr.thumbnail(buffer);

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
    try {
        const raw = await exifr.parse(buffer, EXIF_OPTIONS);
        if (!raw) {
            return null;
        }
        const result = {};
        // 拍摄时间
        const dt = raw.DateTimeOriginal || raw.CreateDate;
        if (dt) {
            result.dateTime = dt instanceof Date ? dt.toISOString() : String(dt);
        }
        // 相机信息
        const camera = buildCamera(raw);
        if (camera) {
            result.camera = camera;
        }
        // GPS 坐标
        const gps = buildGPS(raw);
        if (gps) {
            result.gps = gps;
        }
        // 拍摄参数
        const shooting = buildShooting(raw);
        if (shooting) {
            result.shooting = shooting;
        }
        // 方向
        if (raw.Orientation != null) {
            result.orientation = raw.Orientation;
        }
        return Object.keys(result).length > 0 ? result : null;
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
        const rawThumbnail = await embeddedThumbnailExtractor(buffer);
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
    embeddedThumbnailExtractor = typeof extractor === 'function'
        ? extractor
        : ((buffer) => exifr.thumbnail(buffer));
}

export function __resetEmbeddedThumbnailExtractorForTests() {
    embeddedThumbnailExtractor = (buffer) => exifr.thumbnail(buffer);
}

function buildCamera(raw) {
    const make = raw.Make?.trim();
    const model = raw.Model?.trim();
    const lens = raw.LensModel?.trim();
    if (!make && !model && !lens) {
        return null;
    }
    const cam = {};
    if (make) cam.make = make;
    if (model) cam.model = model;
    if (lens) cam.lens = lens;
    return cam;
}

function buildGPS(raw) {
    const lat = raw.GPSLatitude;
    const lng = raw.GPSLongitude;
    if (lat == null || lng == null) {
        return null;
    }
    const gps = { latitude: lat, longitude: lng };
    if (raw.GPSAltitude != null) {
        gps.altitude = Math.round(raw.GPSAltitude);
    }
    return gps;
}

function buildShooting(raw) {
    const parts = {};
    if (raw.FNumber != null) parts.fNumber = raw.FNumber;
    if (raw.ExposureTime != null) {
        // 格式化快门速度：0.008 → "1/125"
        parts.exposureTime = raw.ExposureTime < 1
            ? `1/${Math.round(1 / raw.ExposureTime)}`
            : `${raw.ExposureTime}`;
    }
    if (raw.ISO != null) parts.iso = raw.ISO;
    if (raw.FocalLength != null) parts.focalLength = raw.FocalLength;
    return Object.keys(parts).length > 0 ? parts : null;
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
