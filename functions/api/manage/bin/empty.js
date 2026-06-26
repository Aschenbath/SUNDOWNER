import { listRecycleBinRecords } from '../../../utils/recycleBin.js';
import { permanentlyDeleteFileRecord } from '../../../utils/mediaDeletion.js';
import { removeFileFromIndex } from '../../../utils/indexManager.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

export async function onRequest(context) {
    const { request, waitUntil } = context;

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({
            success: false,
            error: 'Method not allowed'
        }), {
            status: 405,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    try {
        const records = await listRecycleBinRecords(context.env, { limit: 500 });

        if (records.length === 0) {
            return new Response(JSON.stringify({
                success: true,
                deleted: 0,
                message: 'Recycle bin is already empty'
            }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        let deleted = 0;
        let failed = 0;
        const deletedIds = [];
        const failedIds = [];

        for (const record of records) {
            const ok = await permanentlyDeleteFileRecord(context, record.name);
            if (ok) {
                waitUntil(removeFileFromIndex(context, record.name));
                deleted++;
                deletedIds.push(record.name);
            } else {
                failed++;
                failedIds.push(record.name);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            deleted,
            failed,
            deletedIds,
            failedIds
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        console.error('bin/empty request failed:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Unable to empty the recycle bin'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}
