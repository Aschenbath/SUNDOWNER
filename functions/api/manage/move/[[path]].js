import { S3Client, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { purgeCFCache, purgeRandomFileListCache, purgePublicFileListCache } from "../../../utils/purgeCache.js";
import { moveFileInIndex, batchMoveFilesInIndex } from "../../../utils/indexManager.js";
import { getDatabase } from '../../../utils/databaseAdapter.js';
import { resolveS3Access } from '../../../utils/mediaSecurity.js';
import { sanitizeUploadFolder, isPathSafe } from "../../../upload/uploadTools.js";

let createS3Client = (options) => new S3Client(options);

export function __setS3ClientFactoryForTests(factory) {
    createS3Client = typeof factory === 'function'
        ? factory
        : (options) => new S3Client(options);
}

export function __resetS3ClientFactoryForTests() {
    createS3Client = (options) => new S3Client(options);
}

export async function onRequest(context) {
    const { request, env, params, waitUntil } = context;

    const url = new URL(request.url);

    // 读取目标文件夹，并进行路径安全处理
    const rawDist = url.searchParams.get('dist') || '';
    const dist = sanitizeUploadFolder(rawDist);

    // 读取folder参数，判断是否为文件夹移动请求
    const folder = url.searchParams.get('folder');
    if (folder === 'true') {
        try {
            params.path = decodeURIComponent(params.path);
            if (!isPathSafe(params.path)) {
                throw new Error('Invalid path');
            }
            // 使用队列存储需要处理的文件夹
            const folderQueue = [{
                path: params.path.split(',').join('/'),
                dist: dist
            }];

            const processedFiles = [];
            const failedFiles = [];
            const db = getDatabase(env);

            while (folderQueue.length > 0) {
                const currentFolder = folderQueue.shift();
                const curFolderName = currentFolder.path.split('/').pop();

                // 获取指定目录下的所有文件
                const listUrl = new URL(`${url.origin}/api/manage/list?count=-1&dir=${currentFolder.path}`);
                const listRequest = new Request(listUrl, {
                    headers: request.headers,
                });
                const listResponse = await fetch(listRequest);
                const listData = await listResponse.json();

                const files = listData.files;
                const folderDist = currentFolder.dist === '' ? curFolderName : `${currentFolder.dist}/${curFolderName}`;

                // 处理当前文件夹下的所有文件
                for (const file of files) {
                    const fileId = file.name;
                    const fileName = file.name.split('/').pop();
                    const newFileId = `${folderDist}/${fileName}`;
                    const cdnUrl = `https://${url.hostname}/file/${fileId}`;
                    const existingFile = await db.getWithMetadata(newFileId);
                    if (existingFile && existingFile.value !== null) {
                        failedFiles.push(fileId);
                        continue;
                    }

                    const success = await moveFile(env, fileId, newFileId, cdnUrl, url);
                    if (success) {
                        processedFiles.push({ fileId: fileId, newFileId: newFileId });
                    } else {
                        failedFiles.push(fileId);
                    }
                }

                // 将子文件夹添加到队列
                const directories = listData.directories;
                for (const dir of directories) {
                    folderQueue.push({
                        path: dir,
                        dist: folderDist
                    });
                }
            }

            // 批量从索引中删除文件，添加新文件
            if (processedFiles.length > 0) {
                waitUntil(batchMoveFilesInIndex(context, processedFiles.map(file => {
                    return {
                        originalFileId: file.fileId,
                        newFileId: file.newFileId,
                    };
                })));
            }

            // 返回处理结果
            return new Response(JSON.stringify({
                success: true,
                processed: processedFiles,
                failed: failedFiles
            }));

        } catch (e) {
            return new Response(JSON.stringify({
                success: false,
                error: e.message
            }), { status: 400 });
        }
    }

    // 单个文件移动处理
    try {
        // 解码params.path
        params.path = decodeURIComponent(params.path);
        if (!isPathSafe(params.path)) {
            throw new Error('Invalid path');
        }
        const fileId = params.path.split(',').join('/');
        const fileKey = fileId.split('/').pop();
        const newFileId = dist === '' ? fileKey : `${dist}/${fileKey}`;
        const cdnUrl = `https://${url.hostname}/file/${fileId}`;
        const db = getDatabase(env);
        const existingFile = await db.getWithMetadata(newFileId);
        if (existingFile && existingFile.value !== null) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Target file already exists'
            }), { status: 409 });
        }

        const success = await moveFile(env, fileId, newFileId, cdnUrl, url);
        if (!success) {
            throw new Error('Move file failed');
        } else {
            // 从索引中删除旧文件，并添加新文件
            waitUntil(moveFileInIndex(context, fileId, newFileId));
        }

        return new Response(JSON.stringify({
            success: true,
            fileId: fileId,
            newFileId: newFileId
        }));
    } catch (e) {
        return new Response(JSON.stringify({
            success: false,
            error: e.message
        }), { status: 400 });
    }
}

// 移动单个文件的核心函数
async function moveFile(env, fileId, newFileId, cdnUrl, url) {
    try {
        const db = getDatabase(env);

        // 读取图片信息
        const img = await db.getWithMetadata(fileId);

        // 如果是R2渠道的图片，需要移动R2中对应的图片
        if (img.metadata?.Channel === 'CloudflareR2') {
            const R2DataBase = env.img_r2;

            // 获取原文件内容
            const object = await R2DataBase.get(fileId);
            if (!object) {
                throw new Error('R2 Object Not Found');
            }

            // 复制到新位置
            await R2DataBase.put(newFileId, object.body);

            // 删除旧文件
            await R2DataBase.delete(fileId);
        }

        // S3 渠道的图片，需要移动S3中对应的图片
        if (img.metadata?.Channel === 'S3') {
            const { success, newKey, oldKey, bucketName, endpoint, region, pathStyle, cdnFileUrl, error } = await moveS3File(env, img, newFileId, fileId);
            if (success) {
                // 更新 metadata
                const previousS3FileKey = img.metadata.S3FileKey || oldKey;
                if (endpoint) {
                    img.metadata.S3Endpoint = endpoint;
                }
                img.metadata.S3BucketName = bucketName;
                img.metadata.S3PathStyle = pathStyle;
                img.metadata.S3Region = region || "auto";
                img.metadata.S3FileKey = newFileId;

                if (endpoint) {
                    const s3ServerDomain = endpoint.replace(/https?:\/\//, "");
                    img.metadata.S3Location = pathStyle
                        ? `https://${s3ServerDomain}/${bucketName}/${newKey}`
                        : `https://${bucketName}.${s3ServerDomain}/${newKey}`;
                } else if (img.metadata.S3Location && previousS3FileKey && newKey && img.metadata.S3Location.endsWith(previousS3FileKey)) {
                    img.metadata.S3Location = `${img.metadata.S3Location.slice(0, -previousS3FileKey.length)}${newKey}`;
                }
                if (img.metadata.S3CdnFileUrl && previousS3FileKey && newKey && img.metadata.S3CdnFileUrl.endsWith(previousS3FileKey)) {
                    img.metadata.S3CdnFileUrl = `${img.metadata.S3CdnFileUrl.slice(0, -previousS3FileKey.length)}${newKey}`;
                } else if (!img.metadata.S3CdnFileUrl && cdnFileUrl) {
                    img.metadata.S3CdnFileUrl = cdnFileUrl;
                }
            } else {
                throw new Error(error || 'S3 move failed');
            }
        }

        // 旧版 Telegram 渠道和 Telegraph 渠道不支持移动
        if (img.metadata?.Channel === 'Telegram' || img.metadata?.Channel === undefined) {
            throw new Error('Unsupported Channel');
        }

        // 更新文件夹信息，根目录为空，否则为 aaa/123/ 的格式
        const DirectoryPath = newFileId.split('/').slice(0, -1).join('/') === '' ? '' : newFileId.split('/').slice(0, -1).join('/') + '/';
        img.metadata.Directory = DirectoryPath;

        // 更新KV存储
        await db.put(newFileId, img.value, { metadata: img.metadata });
        await db.delete(fileId);

        // 清除CDN缓存
        await purgeCFCache(env, cdnUrl);

        // 清除 api/randomFileList 等API缓存
        const normalizedFolder = fileId.split('/').slice(0, -1).join('/');
        const normalizedDist = newFileId.split('/').slice(0, -1).join('/');
        await purgeRandomFileListCache(url.origin, normalizedFolder, normalizedDist);
        await purgePublicFileListCache(url.origin, normalizedFolder, normalizedDist);

        return true;
    } catch (e) {
        console.error('Move file failed:', e);
        return false;
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
        forcePathStyle: pathStyle // 是否启用路径风格
    });

    try {
        // 复制文件到新位置
        await s3Client.send(new CopyObjectCommand({
            Bucket: bucketName,
            CopySource: `/${bucketName}/${oldKey}`,
            Key: newKey,
        }));

        // 复制成功后，删除旧文件
        await s3Client.send(new DeleteObjectCommand({
            Bucket: bucketName,
            Key: oldKey,
        }));

        // 返回新的 S3 文件信息
        const cdnFileUrl = s3Access.cdnDomain ? `${s3Access.cdnDomain.replace(/\/$/, '')}/${newKey}` : null;
        return { success: true, newKey, oldKey, bucketName, endpoint, region, pathStyle, cdnFileUrl };
    } catch (error) {
        console.error("S3 Move Failed:", error);
        return { success: false, error: error.message };
    }
}
