import { addFileToIndex } from '../../../utils/indexManager.js';
import { getDatabase } from '../../../utils/databaseAdapter.js';
import { sanitizeExposedMetadata } from '../../../utils/mediaSecurity.js';
import { parseLooseCaptureTimestamp } from '../../../../js/media-library/time-resolution.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, PUT, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

const VIDEO_CATEGORY_MAX_LENGTH = 48;
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.webm', '.mkv', '.avi', '.3gp', '.mpeg', '.mpg'];
const PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.heic', '.heif', '.avif'];

function normalizeVideoCategory(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function isVideoMetadata(fileId, metadata = {}) {
    const mimeType = String(metadata?.FileType || metadata?.MimeType || '').toLowerCase();
    if (mimeType.startsWith('video/')) {
        return true;
    }

    const nameHaystack = String(metadata?.FileName || fileId || '').toLowerCase();
    return VIDEO_EXTENSIONS.some((extension) => nameHaystack.endsWith(extension));
}

function isPhotoMetadata(fileId, metadata = {}) {
    const mimeType = String(metadata?.FileType || metadata?.MimeType || '').toLowerCase();
    if (mimeType.startsWith('image/')) {
        return true;
    }

    const nameHaystack = String(metadata?.FileName || fileId || '').toLowerCase();
    return PHOTO_EXTENSIONS.some((extension) => nameHaystack.endsWith(extension));
}

export async function onRequest(context) {
    const { request, env, params, waitUntil } = context;

    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    if (request.method !== 'PATCH') {
        return new Response(JSON.stringify({
            success: false,
            message: 'Method not allowed. Use PATCH.',
        }), {
            status: 405,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }

    try {
        const fileId = decodeURIComponent(params.path).split(',').join('/');

        if (!fileId) {
            return new Response(JSON.stringify({
                success: false,
                message: 'File ID is required.',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return new Response(JSON.stringify({
                success: false,
                message: 'Invalid request body. Expected JSON.',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        const hasSupportedField = body && (
            typeof body.FileName === 'string'
            || typeof body.FileType === 'string'
            || typeof body.Title === 'string'
            || typeof body.Artist === 'string'
            || typeof body.Album === 'string'
            || typeof body.Description === 'string'
            || typeof body.Directory === 'string'
            || typeof body.DateTaken === 'string'
            || typeof body.VideoCategory === 'string'
            || typeof body.PrivateAlbum === 'boolean'
        );

        if (!hasSupportedField) {
            return new Response(JSON.stringify({
                success: false,
                message: 'At least one of FileName, FileType, Title, Artist, Album, Description, Directory, DateTaken, VideoCategory, or PrivateAlbum is required.',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        if (typeof body.DateTaken === 'string') {
            const normalizedDateTaken = body.DateTaken.trim();
            if (!normalizedDateTaken || !Number.isFinite(parseLooseCaptureTimestamp(normalizedDateTaken))) {
                return new Response(JSON.stringify({
                    success: false,
                    message: 'DateTaken must be a valid date-time string.',
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                });
            }
        }

        if (typeof body.VideoCategory === 'string') {
            const normalizedVideoCategory = normalizeVideoCategory(body.VideoCategory);
            if (normalizedVideoCategory.length > VIDEO_CATEGORY_MAX_LENGTH) {
                return new Response(JSON.stringify({
                    success: false,
                    message: `VideoCategory must be ${VIDEO_CATEGORY_MAX_LENGTH} characters or fewer.`,
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders },
                });
            }
        }

        const db = getDatabase(env);
        const fileData = await db.getWithMetadata(fileId);

        if (!fileData || !fileData.metadata) {
            return new Response(JSON.stringify({
                success: false,
                message: 'File not found.',
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        const updatedMetadata = { ...fileData.metadata };
        if (typeof body.VideoCategory === 'string' && !isVideoMetadata(fileId, updatedMetadata)) {
            return new Response(JSON.stringify({
                success: false,
                message: 'VideoCategory can only be set on video files.',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }
        if (typeof body.PrivateAlbum === 'boolean' && !isPhotoMetadata(fileId, updatedMetadata) && !isVideoMetadata(fileId, updatedMetadata)) {
            return new Response(JSON.stringify({
                success: false,
                message: 'PrivateAlbum can only be set on photo or video files.',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }
        if (typeof body.FileName === 'string') {
            updatedMetadata.FileName = body.FileName;
        }
        if (typeof body.FileType === 'string') {
            updatedMetadata.FileType = body.FileType;
        }
        if (typeof body.Title === 'string') {
            updatedMetadata.Title = body.Title;
        }
        if (typeof body.Artist === 'string') {
            updatedMetadata.Artist = body.Artist;
        }
        if (typeof body.Album === 'string') {
            updatedMetadata.Album = body.Album;
        }
        if (typeof body.Description === 'string') {
            updatedMetadata.Description = body.Description;
        }
        if (typeof body.Directory === 'string') {
            updatedMetadata.Directory = body.Directory;
        }
        if (typeof body.DateTaken === 'string') {
            updatedMetadata.DateTaken = body.DateTaken.trim();
        }
        if (typeof body.VideoCategory === 'string') {
            const normalizedVideoCategory = normalizeVideoCategory(body.VideoCategory);
            delete updatedMetadata.Category;
            if (normalizedVideoCategory) {
                updatedMetadata.VideoCategory = normalizedVideoCategory;
            } else {
                delete updatedMetadata.VideoCategory;
            }
        }
        if (typeof body.PrivateAlbum === 'boolean') {
            if (body.PrivateAlbum) {
                updatedMetadata.PrivateAlbum = true;
            } else {
                delete updatedMetadata.PrivateAlbum;
            }
        }

        await db.put(fileId, fileData.value, { metadata: updatedMetadata });
        waitUntil(addFileToIndex(context, fileId, updatedMetadata));

        return new Response(JSON.stringify({
            success: true,
            metadata: sanitizeExposedMetadata(updatedMetadata),
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    } catch (error) {
        console.error('Error updating metadata:', error);
        return new Response(JSON.stringify({
            success: false,
            message: 'Internal server error.',
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }
}
