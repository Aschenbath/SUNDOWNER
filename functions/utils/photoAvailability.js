import { getDatabase } from './databaseAdapter.js';

export const PHOTO_NOT_FOUND_GRACE_MS = 14 * 24 * 60 * 60 * 1000;
const KEY_PREFIX = 'manage@sysConfig@photo404@';

export function photoAvailabilityKey(fileId) {
    return KEY_PREFIX + encodeURIComponent(fileId);
}

export function isPhotoFile(fileId, metadata = {}) {
    const type = String(metadata.FileType || '').toLowerCase();
    if (type.startsWith('image/')) return true;
    if (type && !['application/octet-stream', 'binary/octet-stream', 'unknown'].includes(type)) return false;
    return /\.(?:jpe?g|png|gif|webp|bmp|avif|heic|heif)$/i.test(metadata.FileName || fileId);
}

function parseState(raw) {
    try {
        const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const first = Number(value?.first404At);
        const last = Number(value?.confirmed404At);
        return Number.isSafeInteger(first) && first > 0 && Number.isSafeInteger(last) && last >= first
            ? { first404At: first, confirmed404At: last } : null;
    } catch {
        return null;
    }
}

// Only server-observed final responses count. A missing thumbnail alone is not
// evidence that the original is gone. Never turn 403/415/429/5xx into a 404.
export async function recordPhotoResponse(env, fileId, { status, method, preview }, now = Date.now()) {
    if (method !== 'GET' || !fileId || fileId.startsWith('manage@')) return;
    const notFound = status === 404 && !preview;
    const recovered = status === 200 || status === 206;
    if (!notFound && !recovered) return;
    try {
        const db = getDatabase(env);
        const key = photoAvailabilityKey(fileId);
        const previous = parseState(await db.get(key));
        if (recovered) {
            // A real thumbnail/original response makes the photo usable again.
            // A synthetic conditional 304 is deliberately not proof of recovery.
            if (previous) await db.delete(key);
        } else if (!previous || previous.first404At > now) {
            await db.put(key, JSON.stringify({ first404At: now, confirmed404At: now }));
        } else if (now - previous.first404At >= PHOTO_NOT_FOUND_GRACE_MS
            && previous.confirmed404At - previous.first404At < PHOTO_NOT_FOUND_GRACE_MS) {
            // Require a second real 404 after the grace period, not merely a
            // clock advancing after one transient failure. No per-hit writes.
            await db.put(key, JSON.stringify({ ...previous, confirmed404At: now }));
        }
    } catch (error) {
        console.warn('Photo availability update failed:', error?.message || error);
    }
}

// Opt-in page annotation: no storage scans, file mutations, outbound probes or
// pagination changes. Keys live separately from file metadata/index snapshots.
export async function annotatePhotoAvailability(env, files) {
    let db;
    try { db = getDatabase(env); } catch { return files; }
    const result = [...files];
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(8, files.length) }, async () => {
        while (next < files.length) {
            const index = next++;
            const file = files[index];
            const fileId = file.name || file.id;
            if (!fileId || !isPhotoFile(fileId, file.metadata)) continue;
            const metadata = { ...file.metadata };
            // Do not trust caller/imported metadata for this server-owned state.
            delete metadata.PhotoNotFoundSince;
            delete metadata.PhotoNotFoundConfirmedAt;
            try {
                const state = parseState(await db.get(photoAvailabilityKey(fileId)));
                if (state) {
                    metadata.PhotoNotFoundSince = state.first404At;
                    metadata.PhotoNotFoundConfirmedAt = state.confirmed404At;
                }
            } catch (error) {
                // Fail visible: a health-store outage must not hide photos.
                console.warn('Photo availability lookup failed:', error?.message || error);
            }
            result[index] = { ...file, metadata };
        }
    }));
    return result;
}
