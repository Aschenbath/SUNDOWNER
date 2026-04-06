import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { purgeCFCache, purgeRandomFileListCache, purgePublicFileListCache } from "./purgeCache";
import { DiscordAPI } from "./discordAPI.js";
import { HuggingFaceAPI } from "./huggingfaceAPI.js";
import { getDatabase } from './databaseAdapter.js';

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
            await deleteS3File(img);
        }

        if (img.metadata?.Channel === 'Discord') {
            await deleteDiscordFile(img);
        }

        if (img.metadata?.Channel === 'HuggingFace') {
            await deleteHuggingFaceFile(img);
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

async function deleteS3File(img) {
    const s3Client = new S3Client({
        region: img.metadata?.S3Region || "auto",
        endpoint: img.metadata?.S3Endpoint,
        credentials: {
            accessKeyId: img.metadata?.S3AccessKeyId,
            secretAccessKey: img.metadata?.S3SecretAccessKey
        },
        forcePathStyle: img.metadata?.S3PathStyle || false
    });

    await s3Client.send(new DeleteObjectCommand({
        Bucket: img.metadata?.S3BucketName,
        Key: img.metadata?.S3FileKey,
    }));
}

async function deleteDiscordFile(img) {
    const botToken = img.metadata?.DiscordBotToken;
    const channelId = img.metadata?.DiscordChannelId;
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

async function deleteHuggingFaceFile(img) {
    const token = img.metadata?.HfToken;
    const repo = img.metadata?.HfRepo;
    const filePath = img.metadata?.HfFilePath;
    const isPrivate = img.metadata?.HfIsPrivate || false;

    if (!token || !repo || !filePath) {
        throw new Error('HuggingFace file missing required metadata for deletion');
    }

    const huggingfaceAPI = new HuggingFaceAPI(token, repo, isPrivate);
    const success = await huggingfaceAPI.deleteFile(filePath, `Delete ${filePath}`);
    if (!success) {
        throw new Error('HuggingFace Delete Failed: API returned false');
    }
}
