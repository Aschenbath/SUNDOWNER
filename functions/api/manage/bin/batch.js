import { addFileToIndex, removeFileFromIndex } from '../../../utils/indexManager.js';
import { getDatabase } from '../../../utils/databaseAdapter.js';
import { isRecycleBinMetadata, restoreRecycleBinMetadata } from '../../../utils/recycleBin.js';
import { permanentlyDeleteFileRecord } from '../../../utils/mediaDeletion.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

export async function onRequest(context) {
    const { request, env, waitUntil } = context;

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const body = await request.json();
        const { action, fileIds } = body;

        if (!Array.isArray(fileIds) || fileIds.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'fileIds must be a non-empty array'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        if (action !== 'restore' && action !== 'delete') {
            return new Response(JSON.stringify({
                success: false,
                error: 'action must be "restore" or "delete"'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        const capped = fileIds.slice(0, 100);
        const db = getDatabase(env);
        let succeeded = 0;
        let failed = 0;
        const succeededIds = [];
        const failedIds = [];

        for (const fileId of capped) {
            if (action === 'restore') {
                const ok = await restoreOne(db, context, fileId);
                if (ok) {
                    succeeded++;
                    succeededIds.push(fileId);
                } else {
                    failed++;
                    failedIds.push(fileId);
                }
            } else {
                const ok = await permanentlyDeleteFileRecord(context, fileId);
                if (ok) {
                    waitUntil(removeFileFromIndex(context, fileId));
                    succeeded++;
                    succeededIds.push(fileId);
                } else {
                    failed++;
                    failedIds.push(fileId);
                }
            }
        }

        return new Response(JSON.stringify({
            success: true,
            action,
            succeeded,
            failed,
            total: capped.length,
            succeededIds,
            failedIds
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

async function restoreOne(db, context, fileId) {
    try {
        const record = await db.getWithMetadata(fileId);
        if (!record || !isRecycleBinMetadata(record.metadata || {})) {
            return false;
        }

        const nextMetadata = restoreRecycleBinMetadata(record.metadata || {});
        await db.put(fileId, record.value || '', { metadata: nextMetadata });
        await addFileToIndex(context, fileId, nextMetadata);
        return true;
    } catch (e) {
        console.error(`Restore ${fileId} failed:`, e);
        return false;
    }
}
