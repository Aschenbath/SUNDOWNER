import { removeFileFromIndex, batchRemoveFilesFromIndex } from "../../../utils/indexManager.js";
import { getDatabase } from '../../../utils/databaseAdapter.js';
import { markRecycleBinMetadata, isRecycleBinMetadata } from '../../../utils/recycleBin.js';
import { permanentlyDeleteFileRecord } from '../../../utils/mediaDeletion.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

export async function onRequest(context) {
    const { request, env, params, waitUntil } = context;

    const url = new URL(request.url);
    const permanent = url.searchParams.get('permanent') === 'true';

    // 文件夹删除请求
    const folder = url.searchParams.get('folder');
    if (folder === 'true') {
        try {
            params.path = decodeURIComponent(params.path);
            const folderQueue = [{
                path: params.path.split(',').join('/')
            }];

            const deletedFiles = [];
            const failedFiles = [];

            while (folderQueue.length > 0) {
                const currentFolder = folderQueue.shift();

                const listUrl = new URL(`${url.origin}/api/manage/list?count=-1&dir=${currentFolder.path}`);
                const listRequest = new Request(listUrl, {
                    headers: request.headers,
                });
                const listResponse = await fetch(listRequest);
                const listData = await listResponse.json();

                for (const file of listData.files) {
                    const fileId = file.name;
                    const success = permanent
                        ? await permanentlyDeleteFileRecord(context, fileId)
                        : await softDeleteFile(env, fileId);
                    if (success) {
                        deletedFiles.push(fileId);
                    } else {
                        failedFiles.push(fileId);
                    }
                }

                for (const dir of listData.directories) {
                    folderQueue.push({ path: dir });
                }
            }

            if (deletedFiles.length > 0) {
                waitUntil(batchRemoveFilesFromIndex(context, deletedFiles));
            }

            return new Response(JSON.stringify({
                success: true,
                deleted: deletedFiles,
                failed: failedFiles,
                recycled: !permanent
            }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });

        } catch (e) {
            return new Response(JSON.stringify({
                success: false,
                error: e.message
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
    }

    // 单个文件删除
    try {
        params.path = decodeURIComponent(params.path);
        const fileId = params.path.split(',').join('/');

        const success = permanent
            ? await permanentlyDeleteFileRecord(context, fileId)
            : await softDeleteFile(env, fileId);

        if (!success) {
            throw new Error('Delete file failed');
        }

        waitUntil(removeFileFromIndex(context, fileId));

        return new Response(JSON.stringify({
            success: true,
            fileId,
            recycled: !permanent
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (e) {
        return new Response(JSON.stringify({
            success: false,
            error: e.message
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

async function softDeleteFile(env, fileId) {
    try {
        const db = getDatabase(env);
        const record = await db.getWithMetadata(fileId);

        if (!record) {
            console.warn(`File ${fileId} not found, skipping`);
            return true;
        }

        if (isRecycleBinMetadata(record.metadata || {})) {
            return true;
        }

        const nextMetadata = markRecycleBinMetadata(record.metadata || {});
        await db.put(fileId, record.value || '', { metadata: nextMetadata });
        return true;
    } catch (e) {
        console.error('Soft delete failed:', e);
        return false;
    }
}
