import { purgeCFCache, purgeRandomFileListCache, purgePublicFileListCache } from "../../../utils/purgeCache.js";
import { addFileToIndex } from "../../../utils/indexManager.js";
import { getDatabase } from "../../../utils/databaseAdapter.js";
import { sanitizeExposedMetadata } from "../../../utils/mediaSecurity.js";

function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
        },
    });
}

function decodeFilePath(rawPath) {
    try {
        return decodeURIComponent(String(rawPath || '').split(',').join('/'));
    } catch {
        return null;
    }
}

function buildFileUrl(origin, fileId) {
    return `${origin}/file/${String(fileId).split('/').map(encodeURIComponent).join('/')}`;
}

export async function onRequest(context) {
    const { request, env, params, waitUntil } = context;
    const url = new URL(request.url);
    const fileId = decodeFilePath(params.path);

    if (!fileId) {
        return jsonResponse({
            success: false,
            message: 'Invalid file path.',
        }, 400);
    }

    try {
        const db = getDatabase(env);
        const value = await db.getWithMetadata(fileId);

        if (!value || !value.metadata) {
            return jsonResponse({
                success: false,
                message: 'File not found.',
            }, 404);
        }

        const nextMetadata = { ...value.metadata, ListType: "Block" };
        await db.put(fileId, value.value, { metadata: nextMetadata });

        const cdnUrl = buildFileUrl(url.origin, fileId);
        await purgeCFCache(env, cdnUrl);

        const normalizedFolder = fileId.split('/').slice(0, -1).join('/');
        await purgeRandomFileListCache(url.origin, normalizedFolder);
        await purgePublicFileListCache(url.origin, normalizedFolder);

        waitUntil(addFileToIndex(context, fileId, nextMetadata));

        return jsonResponse(sanitizeExposedMetadata(nextMetadata));
    } catch (error) {
        console.error('Block-list update failed:', error);
        return jsonResponse({
            success: false,
            message: 'Internal server error.',
        }, 500);
    }
}
