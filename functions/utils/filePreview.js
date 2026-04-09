const HEIC_MIME_PATTERN = /^image\/(?:heic|heif)\b/i;

export function isBrowserPreviewConvertibleImage(fileType = '') {
    return HEIC_MIME_PATTERN.test(String(fileType || '').trim().toLowerCase());
}

export function wantsBrowserPreview(request, url, fileType = '') {
    if (!request || !url) {
        return false;
    }
    if (request.method !== 'GET') {
        return false;
    }
    if (request.headers.get('Range')) {
        return false;
    }
    if (url.searchParams.get('preview') !== '1') {
        return false;
    }
    return isBrowserPreviewConvertibleImage(fileType);
}

export async function readBinaryBody(body) {
    if (body == null) {
        return new Uint8Array();
    }
    if (body instanceof Uint8Array) {
        return body;
    }
    if (ArrayBuffer.isView(body)) {
        return new Uint8Array(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength));
    }
    if (body instanceof ArrayBuffer) {
        return new Uint8Array(body);
    }
    if (typeof body.arrayBuffer === 'function') {
        return new Uint8Array(await body.arrayBuffer());
    }
    return new Uint8Array(await new Response(body).arrayBuffer());
}

export async function convertImageBodyToBrowserPreview(body) {
    const input = await readBinaryBody(body);
    if (!input.byteLength) {
        return input;
    }
    const sharpModule = await import('sharp');
    const sharp = sharpModule.default || sharpModule;
    const converted = await sharp(input, { failOn: 'none' })
        .rotate()
        .webp({ quality: 82 })
        .toBuffer();
    return converted instanceof Uint8Array ? converted : new Uint8Array(converted);
}
