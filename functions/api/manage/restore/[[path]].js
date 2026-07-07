import { addFileToIndex } from "../../../utils/indexManager.js";
import { getDatabase } from '../../../utils/databaseAdapter.js';
import {
    cleanupExpiredRecycleBin,
    isRecycleBinMetadata,
    restoreRecycleBinMetadata
} from "../../../utils/recycleBin.js";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
}

function decodeSafePath(rawPath) {
    try {
        return decodeURIComponent(rawPath || '');
    } catch {
        throw new Error('Invalid file path');
    }
}

function restoreErrorResponse(error) {
    const message = error?.message || '';
    if (message === 'File not found' || message === 'Invalid file path') {
        return jsonResponse({
            success: false,
            error: message
        }, 400);
    }

    console.error('Restore failed:', error);
    return jsonResponse({
        success: false,
        error: 'Internal server error.'
    }, 500);
}

export async function onRequest(context) {
    const { request, env, params, waitUntil } = context;

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
        return jsonResponse({
            success: false,
            error: 'Method not allowed'
        }, 405);
    }

    waitUntil(cleanupExpiredRecycleBin(context));

    try {
        params.path = decodeSafePath(params.path);
        const fileId = params.path.split(',').join('/');
        const db = getDatabase(env);
        const record = await db.getWithMetadata(fileId);

        if (!record) {
            throw new Error('File not found');
        }

        if (!isRecycleBinMetadata(record.metadata || {})) {
            return jsonResponse({
                success: true,
                fileId,
                restored: false,
                message: 'File is not in recycle bin'
            });
        }

        const nextMetadata = restoreRecycleBinMetadata(record.metadata || {});
        await db.put(fileId, record.value || '', { metadata: nextMetadata });
        waitUntil(addFileToIndex(context, fileId, nextMetadata));

        return jsonResponse({
            success: true,
            fileId,
            restored: true
        });
    } catch (error) {
        return restoreErrorResponse(error);
    }
}
