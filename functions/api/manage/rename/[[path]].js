import { S3Client, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { purgeCFCache, purgeRandomFileListCache, purgePublicFileListCache } from "../../../utils/purgeCache.js";
import { moveFileInIndex } from "../../../utils/indexManager.js";
import { getDatabase } from '../../../utils/databaseAdapter.js';
import { resolveS3Access, sanitizeExposedMetadata } from '../../../utils/mediaSecurity.js';
import { sanitizeUploadFolder } from "../../../upload/uploadTools.js";

// CORS 跨域响应头
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, PUT, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

let createS3Client = (options) => new S3Client(options);

export function __setS3ClientFactoryForTests(factory) {
    createS3Client = typeof factory === 'function'
        ? factory
        : (options) => new S3Client(options);
}

export function __resetS3ClientFactoryForTests() {
    createS3Client = (options) => new S3Client(options);
}

function decodeFileId(rawPath) {
    try {
        return decodeURIComponent(rawPath || '').split(',').join('/');
    } catch {
        throw new Error('Invalid file path');
    }
}

export async function onRequest(context) {
    const { request, env, params, waitUntil } = context;

    // OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    // 仅允许 POST 方法
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({
            success: false,
            message: 'Method not allowed. Use POST.',
        }), {
            status: 405,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }

    try {
        // 从 params.path 解析 fileId（需要 decodeURIComponent 处理中文等特殊字符）
        const fileId = decodeFileId(params.path);

        if (!fileId) {
            return new Response(JSON.stringify({
                success: false,
                message: 'File ID is required.',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        // 解析请求体
        let body;
        try {
            body = await request.json();
        } catch (e) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Invalid request body. Expected JSON.',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        // 验证请求体中包含 newFileId
        if (!body || typeof body.newFileId !== 'string' || !body.newFileId.trim()) {
            return new Response(JSON.stringify({
                success: false,
                message: 'newFileId is required and must be a non-empty string.',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        // 路径安全处理
        const newFileId = sanitizeUploadFolder(body.newFileId.trim());

        const url = new URL(request.url);
        const db = getDatabase(env);

        // 获取当前文件数据
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

        // 检查目标 File_ID 是否已存在（重复性检测）
        const existingFile = await db.getWithMetadata(newFileId);
        if (existingFile && existingFile.value !== null) {
            return new Response(JSON.stringify({
                success: false,
                message: '目标文件名已存在',
            }), {
                status: 409,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        // 执行文件迁移
        const metadata = { ...fileData.metadata };
        let cleanupCopiedRemote = null;
        let deleteOldRemote = null;

        // 如果是 R2 渠道的图片，需要移动 R2 中对应的图片
        if (metadata?.Channel === 'CloudflareR2') {
            const R2DataBase = env.img_r2;

            // 获取原文件内容
            const object = await R2DataBase.get(fileId);
            if (!object) {
                throw new Error('R2 Object Not Found');
            }

            // 复制到新位置
            await R2DataBase.put(newFileId, object.body);

            // 删除旧文件
            cleanupCopiedRemote = () => R2DataBase.delete(newFileId);
            deleteOldRemote = () => R2DataBase.delete(fileId);
        }

        // S3 渠道的图片，需要移动 S3 中对应的图片
        if (metadata?.Channel === 'S3') {
            const { success, newKey, oldKey, bucketName, endpoint, region, pathStyle, cdnFileUrl, deleteOld, deleteCopied, error } = await moveS3File(env, fileData, newFileId, fileId);
            if (success) {
                // 更新 metadata
                cleanupCopiedRemote = deleteCopied;
                deleteOldRemote = deleteOld;
                const previousS3FileKey = metadata.S3FileKey || oldKey;
                if (endpoint) {
                    metadata.S3Endpoint = endpoint;
                }
                metadata.S3BucketName = bucketName;
                metadata.S3PathStyle = pathStyle;
                metadata.S3Region = region || "auto";
                metadata.S3FileKey = newFileId;

                if (endpoint) {
                    const s3ServerDomain = endpoint.replace(/https?:\/\//, "");
                    metadata.S3Location = pathStyle
                        ? `https://${s3ServerDomain}/${bucketName}/${newKey}`
                        : `https://${bucketName}.${s3ServerDomain}/${newKey}`;
                } else if (metadata.S3Location && previousS3FileKey && newKey && metadata.S3Location.endsWith(previousS3FileKey)) {
                    metadata.S3Location = `${metadata.S3Location.slice(0, -previousS3FileKey.length)}${newKey}`;
                }
                if (metadata.S3CdnFileUrl && previousS3FileKey && newKey && metadata.S3CdnFileUrl.endsWith(previousS3FileKey)) {
                    metadata.S3CdnFileUrl = `${metadata.S3CdnFileUrl.slice(0, -previousS3FileKey.length)}${newKey}`;
                } else if (!metadata.S3CdnFileUrl && cdnFileUrl) {
                    metadata.S3CdnFileUrl = cdnFileUrl;
                }
            } else {
                throw new Error(error || 'S3 move failed');
            }
        }

        // 旧版 Telegram 渠道和 Telegraph 渠道不支持重命名
        if (metadata?.Channel === 'Telegram' || metadata?.Channel === undefined) {
            return new Response(JSON.stringify({
                success: false,
                message: '旧版 Telegram/Telegraph 渠道不支持重命名',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        // 更新文件夹信息，根目录为空，否则为 aaa/123/ 的格式
        const DirectoryPath = newFileId.split('/').slice(0, -1).join('/') === '' ? '' : newFileId.split('/').slice(0, -1).join('/') + '/';
        metadata.Directory = DirectoryPath;

        // 更新 KV 存储
        let newMetadataWritten = false;
        try {
            await db.put(newFileId, fileData.value, { metadata });
            newMetadataWritten = true;
            await db.delete(fileId);
        } catch (metadataError) {
            if (newMetadataWritten) {
                try {
                    await db.delete(newFileId);
                } catch (rollbackError) {
                    console.error('Failed to roll back new metadata after metadata commit failure:', rollbackError);
                }
            }
            if (cleanupCopiedRemote) {
                try {
                    await cleanupCopiedRemote();
                } catch (cleanupError) {
                    console.error('Failed to clean copied remote object after metadata commit failure:', cleanupError);
                }
            }
            throw metadataError;
        }

        if (deleteOldRemote) {
            try {
                await deleteOldRemote();
            } catch (deleteOldError) {
                console.error('Failed to delete old remote object after metadata commit:', deleteOldError);
            }
        }

        // 清除 CDN 缓存
        const cdnUrl = `https://${url.hostname}/file/${fileId}`;
        await purgeCFCache(env, cdnUrl);

        // 清除 api/randomFileList 等 API 缓存
        const normalizedFolder = fileId.split('/').slice(0, -1).join('/');
        const normalizedDist = newFileId.split('/').slice(0, -1).join('/');
        await purgeRandomFileListCache(url.origin, normalizedFolder, normalizedDist);
        await purgePublicFileListCache(url.origin, normalizedFolder, normalizedDist);

        // 更新索引
        waitUntil(moveFileInIndex(context, fileId, newFileId));

        return new Response(JSON.stringify({
            success: true,
            newFileId,
            metadata: sanitizeExposedMetadata(metadata),
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });

    } catch (error) {
        if (error?.message === 'Invalid file path') {
            return new Response(JSON.stringify({
                success: false,
                message: 'Invalid file path',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        console.error('Error renaming file:', error);
        return new Response(JSON.stringify({
            success: false,
            message: 'Internal server error.',
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }
}

// 移动 S3 渠道的图片
async function moveS3File(env, img, newFileId, fileId) {
    const s3Access = await resolveS3Access(env, img.metadata || {});
    if (!s3Access?.accessKeyId || !s3Access?.secretAccessKey) {
        return { success: false, error: 'S3 channel credentials not available for move' };
    }

    const bucketName = img.metadata?.S3BucketName || s3Access.bucketName;
    const endpoint = img.metadata?.S3Endpoint || s3Access.endpoint;
    const region = img.metadata?.S3Region || s3Access.region || "auto";
    const pathStyle = img.metadata?.S3PathStyle ?? s3Access.pathStyle ?? false;
    const oldKey = img.metadata?.S3FileKey || fileId;
    const newKey = newFileId;
    if (!bucketName || !oldKey) {
        return { success: false, error: 'S3 file info not found for move' };
    }

    const s3Client = createS3Client({
        region,
        endpoint,
        credentials: {
            accessKeyId: s3Access.accessKeyId,
            secretAccessKey: s3Access.secretAccessKey
        },
        forcePathStyle: pathStyle
    });

    try {
        // 复制文件到新位置
        await s3Client.send(new CopyObjectCommand({
            Bucket: bucketName,
            CopySource: `/${bucketName}/${oldKey}`,
            Key: newKey,
        }));

        // 返回新的 S3 文件信息
        const cdnFileUrl = s3Access.cdnDomain ? `${s3Access.cdnDomain.replace(/\/$/, '')}/${newKey}` : null;
        return {
            success: true,
            newKey,
            oldKey,
            bucketName,
            endpoint,
            region,
            pathStyle,
            cdnFileUrl,
            deleteOld: () => s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: oldKey })),
            deleteCopied: () => s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: newKey })),
        };
    } catch (error) {
        console.error("S3 Move Failed:", error);
        return { success: false, error: error.message };
    }
}
