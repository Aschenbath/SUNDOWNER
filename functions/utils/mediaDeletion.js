import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { purgeCFCache, purgeRandomFileListCache, purgePublicFileListCache } from "./purgeCache.js";
import { DiscordAPI } from "./discordAPI.js";
import { HuggingFaceAPI } from "./huggingfaceAPI.js";
import { getDatabase } from './databaseAdapter.js';
import { resolveDiscordAccess, resolveHuggingFaceAccess, resolveS3Access } from './mediaSecurity.js';

let createS3Client = (options) => new S3Client(options);

export function __setS3ClientFactoryForTests(factory) {
    createS3Client = typeof factory === 'function'
        ? factory
        : (options) => new S3Client(options);
}

export function __resetS3ClientFactoryForTests() {
    createS3Client = (options) => new S3Client(options);
}

export async function permanentlyDeleteFileRecord(context, fileId, options = {}) {
    const { env } = context;
    const db = getDatabase(env);
    const requestUrl = new URL(options.requestUrl || context.request.url);
    const cdnUrl = options.cdnUrl || `https://${requestUrl.hostname}/file/${fileId}`;

    try {
        const img = await db.getWithMetadata(fileId);
        if (!img) {
            console.warn(`File ${fileId} not found in database, skipping delete`);
            return true;
        }

        if (img.metadata?.Channel === 'CloudflareR2') {
            await env.img_r2.delete(fileId);
        }

        if (img.metadata?.Channel === 'S3') {
            await deleteS3File(env, img, fileId);
        }

        if (img.metadata?.Channel === 'Discord') {
            await deleteDiscordFile(env, img);
        }

        if (img.metadata?.Channel === 'HuggingFace') {
            await deleteHuggingFaceFile(env, img);
        }

        await db.delete(fileId);
        await purgeCFCache(env, cdnUrl);

        const normalizedFolder = fileId.split('/').slice(0, -1).join('/');
        await purgeRandomFileListCache(requestUrl.origin, normalizedFolder);
        await purgePublicFileListCache(requestUrl.origin, normalizedFolder);

        return true;
    } catch (error) {
        console.error('Delete file failed:', error);
        return false;
    }
}

async function deleteS3File(env, img, fileId) {
    const s3Access = await resolveS3Access(env, img.metadata || {});
    if (!s3Access?.accessKeyId || !s3Access?.secretAccessKey) {
        throw new Error('S3 channel credentials not available for deletion');
    }

    const bucketName = img.metadata?.S3BucketName || s3Access.bucketName;
    const key = img.metadata?.S3FileKey || fileId;
    if (!bucketName || !key) {
        throw new Error('S3 file info not found for deletion');
    }

    const s3Client = createS3Client({
        region: img.metadata?.S3Region || s3Access.region || "auto",
        endpoint: img.metadata?.S3Endpoint || s3Access.endpoint,
        credentials: {
            accessKeyId: s3Access.accessKeyId,
            secretAccessKey: s3Access.secretAccessKey
        },
        forcePathStyle: img.metadata?.S3PathStyle ?? s3Access.pathStyle ?? false
    });

    await s3Client.send(new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
    }));
}

async function deleteDiscordFile(env, img) {
    const discordAccess = await resolveDiscordAccess(env, img.metadata || {});
    const botToken = discordAccess?.botToken;
    const channelId = img.metadata?.DiscordChannelId || discordAccess?.channelId;
    const messageId = img.metadata?.DiscordMessageId;

    if (!botToken || !channelId || !messageId) {
        throw new Error('Discord file missing required metadata for deletion');
    }

    const discordAPI = new DiscordAPI(botToken);
    const success = await discordAPI.deleteMessage(channelId, messageId);
    if (!success) {
        throw new Error('Discord Delete Failed: API returned false');
    }
}

async function deleteHuggingFaceFile(env, img) {
    const hfAccess = await resolveHuggingFaceAccess(env, img.metadata || {});
    const token = hfAccess?.token;
    const repo = img.metadata?.HfRepo || hfAccess?.repo;
    const filePath = img.metadata?.HfFilePath;
    const isPrivate = typeof img.metadata?.HfIsPrivate === 'boolean' ? img.metadata.HfIsPrivate : !!hfAccess?.isPrivate;

    if (!token || !repo || !filePath) {
        throw new Error('HuggingFace file missing required metadata for deletion');
    }

    const huggingfaceAPI = new HuggingFaceAPI(token, repo, isPrivate);
    const success = await huggingfaceAPI.deleteFile(filePath, `Delete ${filePath}`);
    if (!success) {
        throw new Error('HuggingFace Delete Failed: API returned false');
    }
}
