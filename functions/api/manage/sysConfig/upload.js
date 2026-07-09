import { getDatabase } from '../../../utils/databaseAdapter.js'
import { getCache, setCache, clearCache } from '../../../utils/cache.js'

const CACHE_TTL_MS = 60_000; // 1 minute cache for upload config
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

const SECRET_PLACEHOLDER = 'Configured'

const UPLOAD_SECRET_FIELDS = {
    telegram: ['botToken', 'webhookSecret', 'proxyUrl'],
    s3: ['accessKeyId', 'secretAccessKey'],
    discord: ['botToken', 'proxyUrl'],
    huggingface: ['token'],
}

function createJsonResponse(body, init = {}) {
    const { headers = {}, ...rest } = init
    return new Response(JSON.stringify(body), {
        ...rest,
        headers: {
            ...corsHeaders,
            'content-type': 'application/json',
            ...headers,
        },
    })
}

export function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: corsHeaders,
    })
}

export async function onRequest(context) {
    const { request, env } = context
    const db = getDatabase(env)

    if (request.method === 'GET') {
        // Try cache first
        const cached = getCache(CACHE_TTL_MS);
        if (cached) {
            return createJsonResponse(buildPublicUploadConfig(cached));
        }
        try {
            const settings = await getUploadConfig(db, env);
            setCache(settings, CACHE_TTL_MS);
            return createJsonResponse(buildPublicUploadConfig(settings));
        } catch (error) {
            if (error instanceof SyntaxError) {
                return createJsonResponse({
                    success: false,
                    error: 'Corrupted config data',
                }, {
                    status: 500,
                });
            }
            return createJsonResponse({
                success: false,
                error: 'Failed to load upload config',
            }, {
                status: 500,
            });
        }
    }

    if (request.method === 'POST') {
        let body
        try {
            body = await request.json()
        } catch {
            return createJsonResponse({
                success: false,
                error: 'Invalid JSON body',
            }, {
                status: 400,
            })
        }

        const currentSettings = await getStoredUploadSettings(db)
        const settings = preserveUploadSecrets(normalizeUploadSettings(body), currentSettings)
        await db.put('manage@sysConfig@upload', JSON.stringify(settings));
        // Invalidate cache after mutation
        clearCache();

        return createJsonResponse(buildPublicUploadConfig(await getUploadConfig(db, env)))
    }

    return new Response('Method Not Allowed', {
        status: 405,
        headers: corsHeaders,
    })
}

function buildSafeDirectorySegment(name) {
    return String(name || 'channel')
        .trim()
        .replace(/[\\/:\*\?"'<>\| \(\)\[\]\{\}#%\^`~;@&=\+\$,]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '') || 'channel'
}

function normalizeTelegramSyncChannel(channel = {}) {
    const normalized = { ...channel }

    if (typeof normalized.syncEnabled !== 'boolean') {
        normalized.syncEnabled = false
    }
    if (typeof normalized.importDirectory !== 'string') {
        normalized.importDirectory = ''
    } else if (normalized.importDirectory.trim() !== normalized.importDirectory) {
        normalized.importDirectory = normalized.importDirectory.trim()
    }
    if (typeof normalized.webhookSecret !== 'string') {
        normalized.webhookSecret = ''
    }
    if (normalized.syncMode !== 'polling' && normalized.syncMode !== 'webhook') {
        normalized.syncMode = 'webhook'
    }

    normalized.lastUpdateId = Number.isFinite(Number(normalized.lastUpdateId)) ? Number(normalized.lastUpdateId) : 0
    normalized.lastSyncAt = Number.isFinite(Number(normalized.lastSyncAt)) ? Number(normalized.lastSyncAt) : 0
    normalized.lastProcessedCount = Number.isFinite(Number(normalized.lastProcessedCount)) ? Number(normalized.lastProcessedCount) : 0
    normalized.lastWebhookEventAt = Number.isFinite(Number(normalized.lastWebhookEventAt)) ? Number(normalized.lastWebhookEventAt) : 0

    if (typeof normalized.lastError !== 'string') {
        normalized.lastError = ''
    }
    if (typeof normalized.lastSyncSource !== 'string') {
        normalized.lastSyncSource = ''
    }

    return normalized
}

function normalizeChannelSection(section = {}, options = {}) {
    const { telegram = false, hasLoadBalance = true } = options
    const normalized = {
        ...section,
        channels: Array.isArray(section.channels) ? section.channels.map(channel => ({ ...channel })) : [],
    }

    if (hasLoadBalance) {
        normalized.loadBalance = section.loadBalance || {
            enabled: false,
            channels: [],
        }
    }

    if (telegram) {
        normalized.channels = normalized.channels.map(normalizeTelegramSyncChannel)
    }

    return normalized
}

async function getStoredUploadSettings(db) {
    const settingsStr = await db.get('manage@sysConfig@upload')
    return normalizeUploadSettings(settingsStr ? JSON.parse(settingsStr) : {})
}

function findExistingChannel(channels = [], channel = {}) {
    return channels.find((item) => {
        if (item?.id != null && channel?.id != null && String(item.id) === String(channel.id)) {
            return true
        }
        if (item?.name && channel?.name && item.name === channel.name) {
            return true
        }
        return item?.type && channel?.type
            && item.type === channel.type
            && item?.savePath
            && channel?.savePath
            && item.savePath === channel.savePath
    }) || null
}

function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value || {}, key)
}

function applyOptionalOverride(target, source, key) {
    if (hasOwn(source, key)) {
        target[key] = source[key]
    }
}

function preserveUploadSecrets(nextSettings, currentSettings) {
    const next = normalizeUploadSettings(nextSettings)
    for (const [sectionKey, secretFields] of Object.entries(UPLOAD_SECRET_FIELDS)) {
        const nextChannels = next[sectionKey]?.channels || []
        const currentChannels = currentSettings?.[sectionKey]?.channels || []
        nextChannels.forEach((channel) => {
            const existing = findExistingChannel(currentChannels, channel)
            for (const field of secretFields) {
                if (channel[field] === SECRET_PLACEHOLDER) {
                    if (existing?.[field]) {
                        channel[field] = existing[field]
                    } else {
                        delete channel[field]
                    }
                }
            }
        })
    }
    return next
}

function buildPublicUploadConfig(settings = {}) {
    const publicSettings = normalizeUploadSettings(settings)
    for (const [sectionKey, secretFields] of Object.entries(UPLOAD_SECRET_FIELDS)) {
        const channels = publicSettings[sectionKey]?.channels || []
        channels.forEach((channel) => {
            for (const field of secretFields) {
                if (channel[field]) {
                    channel[field] = SECRET_PLACEHOLDER
                }
            }
        })
    }
    return publicSettings
}

export function normalizeUploadSettings(settings = {}) {
    return {
        telegram: normalizeChannelSection(settings.telegram, { telegram: true, hasLoadBalance: true }),
        cfr2: normalizeChannelSection(settings.cfr2, { hasLoadBalance: true }),
        s3: normalizeChannelSection(settings.s3, { hasLoadBalance: true }),
        discord: normalizeChannelSection(settings.discord, { hasLoadBalance: true }),
        huggingface: normalizeChannelSection(settings.huggingface, { hasLoadBalance: true }),
    }
}

export async function getUploadConfig(db, env) {
    const settings = {}
    const settingsStr = await db.get('manage@sysConfig@upload')
    const settingsKV = normalizeUploadSettings(settingsStr ? JSON.parse(settingsStr) : {})

    const telegram = {}
    const telegramChannels = []
    telegram.channels = telegramChannels
    if (env.TG_BOT_TOKEN) {
        telegramChannels.push(normalizeTelegramSyncChannel({
            id: 1,
            name: 'Telegram_env',
            type: 'telegram',
            savePath: 'environment variable',
            botToken: env.TG_BOT_TOKEN,
            chatId: env.TG_CHAT_ID,
            proxyUrl: env.TG_PROXY_URL || '',
            enabled: true,
            fixed: true,
        }))
    }
    for (const tg of settingsKV.telegram?.channels || []) {
        if (tg.savePath === 'environment variable') {
            if (telegramChannels[0]) {
                telegramChannels[0].enabled = tg.enabled
                applyOptionalOverride(telegramChannels[0], tg, 'proxyUrl')
                telegramChannels[0].syncEnabled = tg.syncEnabled
                telegramChannels[0].importDirectory = tg.importDirectory
                applyOptionalOverride(telegramChannels[0], tg, 'webhookSecret')
                telegramChannels[0].syncMode = tg.syncMode
                telegramChannels[0].lastUpdateId = tg.lastUpdateId
                telegramChannels[0].lastSyncAt = tg.lastSyncAt
                telegramChannels[0].lastProcessedCount = tg.lastProcessedCount
                telegramChannels[0].lastError = tg.lastError
                telegramChannels[0].lastSyncSource = tg.lastSyncSource
                telegramChannels[0].lastWebhookEventAt = tg.lastWebhookEventAt
            }
            continue
        }
        tg.id = telegramChannels.length + 1
        telegramChannels.push(normalizeTelegramSyncChannel(tg))
    }
    telegram.loadBalance = settingsKV.telegram?.loadBalance || {
        enabled: false,
        channels: [],
    }

    const cfr2 = {}
    const cfr2Channels = []
    cfr2.channels = cfr2Channels
    if (env.img_r2) {
        cfr2Channels.push({
            id: 1,
            name: 'R2_env',
            type: 'cfr2',
            savePath: 'environment variable',
            publicUrl: env.R2PublicUrl,
            enabled: true,
            fixed: true,
        })
    }
    for (const r2 of settingsKV.cfr2?.channels || []) {
        if (r2.savePath === 'environment variable') {
            if (cfr2Channels[0]) {
                cfr2Channels[0].publicUrl = r2.publicUrl
                cfr2Channels[0].enabled = r2.enabled
                cfr2Channels[0].quota = r2.quota
            }
            continue
        }
        r2.id = cfr2Channels.length + 1
        cfr2Channels.push(r2)
    }
    cfr2.loadBalance = settingsKV.cfr2?.loadBalance || {
        enabled: false,
        channels: [],
    }

    const s3 = {}
    const s3Channels = []
    s3.channels = s3Channels
    if (env.S3_ACCESS_KEY_ID) {
        s3Channels.push({
            id: 1,
            name: 'S3_env',
            type: 's3',
            savePath: 'environment variable',
            accessKeyId: env.S3_ACCESS_KEY_ID,
            secretAccessKey: env.S3_SECRET_ACCESS_KEY,
            region: env.S3_REGION || 'auto',
            bucketName: env.S3_BUCKET_NAME,
            endpoint: env.S3_ENDPOINT,
            pathStyle: env.S3_PATH_STYLE === 'true',
            cdnDomain: env.S3_CDN_DOMAIN || '',
            enabled: true,
            fixed: true,
        })
    }
    for (const s of settingsKV.s3?.channels || []) {
        if (s.savePath === 'environment variable') {
            if (s3Channels[0]) {
                s3Channels[0].enabled = s.enabled
                s3Channels[0].quota = s.quota
                s3Channels[0].cdnDomain = s.cdnDomain
            }
            continue
        }
        s.id = s3Channels.length + 1
        s3Channels.push(s)
    }
    s3.loadBalance = settingsKV.s3?.loadBalance || {
        enabled: false,
        channels: [],
    }

    const discord = {}
    const discordChannels = []
    discord.channels = discordChannels
    if (env.DISCORD_BOT_TOKEN) {
        discordChannels.push({
            id: 1,
            name: 'Discord_env',
            type: 'discord',
            savePath: 'environment variable',
            botToken: env.DISCORD_BOT_TOKEN,
            channelId: env.DISCORD_CHANNEL_ID,
            proxyUrl: env.DISCORD_PROXY_URL || '',
            isNitro: env.DISCORD_IS_NITRO === 'true',
            enabled: true,
            fixed: true,
        })
    }
    for (const dc of settingsKV.discord?.channels || []) {
        if (dc.savePath === 'environment variable') {
            if (discordChannels[0]) {
                discordChannels[0].enabled = dc.enabled
                applyOptionalOverride(discordChannels[0], dc, 'proxyUrl')
                discordChannels[0].isNitro = dc.isNitro
            }
            continue
        }
        dc.id = discordChannels.length + 1
        discordChannels.push(dc)
    }
    discord.loadBalance = settingsKV.discord?.loadBalance || {
        enabled: false,
        channels: [],
    }

    const huggingface = {}
    const huggingfaceChannels = []
    huggingface.channels = huggingfaceChannels
    if (env.HF_TOKEN) {
        huggingfaceChannels.push({
            id: 1,
            name: 'HuggingFace_env',
            type: 'huggingface',
            savePath: 'environment variable',
            token: env.HF_TOKEN,
            repo: env.HF_REPO,
            isPrivate: env.HF_PRIVATE === 'true',
            enabled: true,
            fixed: true,
        })
    }
    for (const hf of settingsKV.huggingface?.channels || []) {
        if (hf.savePath === 'environment variable') {
            if (huggingfaceChannels[0]) {
                huggingfaceChannels[0].enabled = hf.enabled
                huggingfaceChannels[0].isPrivate = hf.isPrivate
            }
            continue
        }
        hf.id = huggingfaceChannels.length + 1
        huggingfaceChannels.push(hf)
    }
    huggingface.loadBalance = settingsKV.huggingface?.loadBalance || {
        enabled: false,
        channels: [],
    }

    settings.telegram = telegram
    settings.cfr2 = cfr2
    settings.s3 = s3
    settings.discord = discord
    settings.huggingface = huggingface

    return settings
}
