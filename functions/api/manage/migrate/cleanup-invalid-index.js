import { getDatabase } from '../../../utils/databaseAdapter.js';
import { readIndex, rebuildIndex } from '../../../utils/indexManager.js';
import { methodNotAllowed, optionsResponse } from '../../../utils/cors.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
        },
    });
}

/**
 * Cleanup invalid index entries that reference missing metadata.
 * This removes index entries where the actual KV/D1 record doesn't exist,
 * causing "Error: Image Not Found" 404 responses.
 */
export async function onRequestPost(context) {
    const { request, env } = context;

    if (request.method === 'OPTIONS') {
        return optionsResponse(corsHeaders);
    }

    if (request.method !== 'POST') {
        return methodNotAllowed(corsHeaders);
    }

    try {
        const db = getDatabase(env);
        const index = await readIndex(context);

        if (!index || !Array.isArray(index.files)) {
            return jsonResponse({
                success: false,
                error: 'Failed to read index'
            }, 500);
        }

        const totalFiles = index.files.length;
        const invalidFileIds = [];
        const validFiles = [];

        console.log(`Starting cleanup validation of ${totalFiles} index entries...`);

        // Check each index entry to see if metadata exists
        for (const file of index.files) {
            const fileId = file.id;
            if (!fileId) {
                invalidFileIds.push({ id: 'unknown', reason: 'missing_id' });
                continue;
            }

            try {
                const record = await db.getWithMetadata(fileId);
                if (!record) {
                    // Metadata not found - this is an invalid entry
                    invalidFileIds.push({ id: fileId, reason: 'metadata_not_found' });
                    console.log(`Invalid entry found: ${fileId}`);
                } else {
                    // Valid entry - keep it
                    validFiles.push(file);
                }
            } catch (error) {
                console.error(`Error checking file ${fileId}:`, error.message);
                invalidFileIds.push({ id: fileId, reason: 'check_error', error: error.message });
            }
        }

        const removedCount = invalidFileIds.length;
        const keptCount = validFiles.length;

        console.log(`Cleanup scan complete: ${removedCount} invalid, ${keptCount} valid`);

        // If dry run requested, just return the results without modifying
        const body = await request.json().catch(() => ({}));
        const dryRun = body.dryRun === true;

        if (dryRun) {
            return jsonResponse({
                success: true,
                dryRun: true,
                summary: {
                    total: totalFiles,
                    invalid: removedCount,
                    valid: keptCount
                },
                invalidFiles: invalidFileIds.slice(0, 50) // Return first 50 for preview
            });
        }

        // Actually rebuild the index with only valid entries
        if (removedCount > 0) {
            console.log(`Rebuilding index with ${keptCount} valid entries...`);

            // Trigger index rebuild to persist the cleaned index
            await rebuildIndex(context, null, { force: true });

            return jsonResponse({
                success: true,
                cleaned: true,
                summary: {
                    total: totalFiles,
                    removed: removedCount,
                    kept: keptCount
                },
                message: `Removed ${removedCount} invalid index entries. Index rebuilt with ${keptCount} valid files.`
            });
        } else {
            return jsonResponse({
                success: true,
                cleaned: false,
                summary: {
                    total: totalFiles,
                    removed: 0,
                    kept: keptCount
                },
                message: 'No invalid entries found. Index is clean.'
            });
        }

    } catch (error) {
        console.error('Cleanup error:', error);
        return jsonResponse({
            success: false,
            error: error.message || 'Cleanup failed'
        }, 500);
    }
}
