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

export async function onRequest(context) {
    const { request, env, params, waitUntil } = context;

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    waitUntil(cleanupExpiredRecycleBin(context));

    try {
        params.path = decodeURIComponent(params.path);
        const fileId = params.path.split(',').join('/');
        const db = getDatabase(env);
        const record = await db.getWithMetadata(fileId);

        if (!record) {
            throw new Error('File not found');
        }

        if (!isRecycleBinMetadata(record.metadata || {})) {
            return new Response(JSON.stringify({
                success: true,
                fileId,
                restored: false,
                message: 'File is not in recycle bin'
            }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        const nextMetadata = restoreRecycleBinMetadata(record.metadata || {});
        await db.put(fileId, record.value || '', { metadata: nextMetadata });
        waitUntil(addFileToIndex(context, fileId, nextMetadata));

        return new Response(JSON.stringify({
            success: true,
            fileId,
            restored: true
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}
