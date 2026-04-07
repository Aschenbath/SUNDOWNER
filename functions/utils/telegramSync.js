import { getDatabase } from './databaseAdapter.js'
import { TelegramAPI } from './telegramAPI.js'
import { addFileToIndex, removeFileFromIndex } from './indexManager.js'
import { getUploadConfig, normalizeUploadSettings } from '../api/manage/sysConfig/upload.js'
import { sanitizeUploadFolder, sanitizeFileName, resolveFileExt, moderateContent } from '../upload/uploadTools.js'

const TELEGRAM_ALLOWED_UPDATES = ['channel_post', 'edited_channel_post']
const TELEGRAM_ALBUM_COMMAND_PREFIX = 'telegram-sync@album-command@'
const TELEGRAM_ALBUM_COMMAND_TTL_MS = 10 * 60 * 1000
const TELEGRAM_SYNC_RESPONSE_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Telegram-Bot-Api-Secret-Token',
    'Access-Control-Max-Age': '86400',
}

function asJsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: TELEGRAM_SYNC_RESPONSE_HEADERS,
    })
}

function normalizeChatId(value) {
    return String(value ?? '').trim()
}

function getChannelImportRoot(channelName, importDirectory) {
    const fallback = typeof importDirectory === 'string' ? importDirectory : `telegram-import/${channelName}`
    return sanitizeUploadFolder(fallback)
}

function createImportDirectory(channelName, importDirectory) {
    const normalized = getChannelImportRoot(channelName, importDirectory)
    return normalized ? `${normalized}/` : ''
}

function createScopedImportDirectory(channel, albumPath = '') {
    const baseRoot = getChannelImportRoot(channel.name, channel.importDirectory)
    const scopedPath = sanitizeUploadFolder(albumPath || '')
    const combined = [baseRoot, scopedPath].filter(Boolean).join('/')
    return combined ? `${combined}/` : ''
}

function buildImportedBaseName(channelName, messageId, fileUniqueId) {
    const safeChannel = sanitizeFileName(channelName)
    return `tg_${safeChannel}_${messageId}_${fileUniqueId}`
}

function buildDefaultFileName(kind, messageId, ext) {
    return `${kind}_${messageId}.${ext}`
}

function inferFileType(kind, media) {
    if (media?.mime_type) {
        return media.mime_type
    }
    if (kind === 'photo') {
        return 'image/jpeg'
    }
    if (kind === 'animation') {
        return 'image/gif'
    }
    return 'application/octet-stream'
}

function inferExtension(kind, media, filePath) {
    const fallbackName = media?.file_name || ''
    return resolveFileExt(filePath || fallbackName || `${kind}.bin`, inferFileType(kind, media))
}

function extractMediaFromMessage(message) {
    if (!message) {
        return null
    }

    if (Array.isArray(message.photo) && message.photo.length > 0) {
        const photo = message.photo.reduce((prev, current) =>
            (prev.file_size || 0) > (current.file_size || 0) ? prev : current,
        )
        return { kind: 'photo', media: photo }
    }
    if (message.animation) {
        return { kind: 'animation', media: message.animation }
    }
    if (message.video) {
        return { kind: 'video', media: message.video }
    }
    if (message.audio) {
        return { kind: 'audio', media: message.audio }
    }
    if (message.document) {
        return { kind: 'document', media: message.document }
    }

    return null
}

function buildImportedFileId(channelName, importDirectory, messageId, fileUniqueId, ext) {
    const normalizedDirectory = sanitizeUploadFolder(importDirectory || '')
    const baseName = buildImportedBaseName(channelName, messageId, fileUniqueId)
    return normalizedDirectory ? `${normalizedDirectory}/${baseName}.${ext}` : `${baseName}.${ext}`
}

function buildMessagePrefix(channelName, importDirectory, messageId) {
    const normalizedDirectory = sanitizeUploadFolder(importDirectory || '')
    const baseNamePrefix = `tg_${sanitizeFileName(channelName)}_${messageId}_`
    return normalizedDirectory ? `${normalizedDirectory}/${baseNamePrefix}` : baseNamePrefix
}

function buildAlbumCommandKey(channelName) {
    return `${TELEGRAM_ALBUM_COMMAND_PREFIX}${sanitizeFileName(channelName)}`
}

function extractAlbumCommand(message) {
    const text = typeof message?.text === 'string' ? message.text.trim() : ''
    const match = text.match(/^\/album(?:@[\w_]+)?(?:\s+(.+))?$/i)
    if (!match) {
        return null
    }

    const rawArgument = String(match[1] || '').trim()
    if (!rawArgument || /^clear$/i.test(rawArgument)) {
        return { action: 'invalid', albumPath: '' }
    }

    const albumPath = sanitizeUploadFolder(rawArgument)
    if (!albumPath) {
        return { action: 'invalid', albumPath: '' }
    }

    return { action: 'set', albumPath }
}

async function loadAlbumCommandState(db, channelName) {
    const key = buildAlbumCommandKey(channelName)
    const raw = await db.get(key)
    if (!raw) {
        return null
    }

    try {
        const parsed = JSON.parse(raw)
        const expiresAt = Number(parsed?.expiresAt || 0)
        if (expiresAt && expiresAt > Date.now()) {
            return parsed
        }
    } catch (error) {
        // fall through and clear invalid state
    }

    await db.delete(key)
    return null
}

async function saveAlbumCommandState(db, channelName, state) {
    await db.put(buildAlbumCommandKey(channelName), JSON.stringify(state))
}

async function clearAlbumCommandState(db, channelName) {
    await db.delete(buildAlbumCommandKey(channelName))
}

async function handleAlbumCommandMessage(context, channel, update, message, command) {
    const db = getDatabase(context.env)

    if (command.action === 'invalid') {
        return {
            ignored: true,
            reason: 'album_command_invalid',
            albumCommand: true,
        }
    }

    const now = Date.now()
    await saveAlbumCommandState(db, channel.name, {
        albumPath: command.albumPath,
        commandUpdateId: Number(update.update_id || 0),
        commandMessageId: Number(message.message_id || 0),
        createdAt: now,
        expiresAt: now + TELEGRAM_ALBUM_COMMAND_TTL_MS,
        consumedMessageId: 0,
        consumedMediaGroupId: '',
        lastTouchedAt: 0,
    })

    return {
        ignored: true,
        reason: 'album_command_set',
        albumCommand: true,
        albumPath: command.albumPath,
    }
}

async function resolveAlbumPathForMessage(context, channel, update, message) {
    const db = getDatabase(context.env)
    const state = await loadAlbumCommandState(db, channel.name)
    const defaultImportDirectory = createImportDirectory(channel.name, channel.importDirectory)
    if (!state?.albumPath) {
        return {
            albumPath: '',
            importDirectory: defaultImportDirectory,
        }
    }

    const updateId = Number(update.update_id || 0)
    const messageId = Number(message.message_id || 0)
    const mediaGroupId = String(message.media_group_id || '').trim()
    const commandUpdateId = Number(state.commandUpdateId || 0)
    const shouldApplyToCurrentMessage = !commandUpdateId || updateId > commandUpdateId

    if (state.consumedMediaGroupId) {
        if (mediaGroupId && mediaGroupId === state.consumedMediaGroupId) {
            state.lastTouchedAt = Date.now()
            state.expiresAt = Date.now() + TELEGRAM_ALBUM_COMMAND_TTL_MS
            await saveAlbumCommandState(db, channel.name, state)
            return {
                albumPath: state.albumPath,
                importDirectory: createScopedImportDirectory(channel, state.albumPath),
            }
        }
        return {
            albumPath: '',
            importDirectory: defaultImportDirectory,
        }
    }

    if (state.consumedMessageId) {
        if (messageId && messageId === Number(state.consumedMessageId)) {
            state.lastTouchedAt = Date.now()
            state.expiresAt = Date.now() + TELEGRAM_ALBUM_COMMAND_TTL_MS
            await saveAlbumCommandState(db, channel.name, state)
            return {
                albumPath: state.albumPath,
                importDirectory: createScopedImportDirectory(channel, state.albumPath),
            }
        }
        return {
            albumPath: '',
            importDirectory: defaultImportDirectory,
        }
    }

    if (!shouldApplyToCurrentMessage) {
        return {
            albumPath: '',
            importDirectory: defaultImportDirectory,
        }
    }

    const nextState = {
        ...state,
        lastTouchedAt: Date.now(),
        expiresAt: Date.now() + TELEGRAM_ALBUM_COMMAND_TTL_MS,
        consumedMessageId: mediaGroupId ? 0 : messageId,
        consumedMediaGroupId: mediaGroupId || '',
    }
    await saveAlbumCommandState(db, channel.name, nextState)

    return {
        albumPath: state.albumPath,
        importDirectory: createScopedImportDirectory(channel, state.albumPath),
    }
}

function createSyncSnapshot(channel) {
    return {
        syncEnabled: !!channel.syncEnabled,
        syncMode: channel.syncMode || 'webhook',
        importDirectory: channel.importDirectory || '',
        lastUpdateId: Number(channel.lastUpdateId || 0),
        lastSyncAt: Number(channel.lastSyncAt || 0),
        lastProcessedCount: Number(channel.lastProcessedCount || 0),
        lastError: channel.lastError || '',
        lastSyncSource: channel.lastSyncSource || '',
        lastWebhookEventAt: Number(channel.lastWebhookEventAt || 0),
    }
}

async function loadUploadSettings(env) {
    const db = getDatabase(env)
    return normalizeUploadSettings(await getUploadConfig(db, env))
}

async function saveUploadSettings(env, settings) {
    const db = getDatabase(env)
    const normalized = normalizeUploadSettings(settings)
    await db.put('manage@sysConfig@upload', JSON.stringify(normalized))
    return normalized
}

async function updateTelegramChannels(env, channelNames, updater) {
    const settings = await loadUploadSettings(env)
    let changed = false

    settings.telegram.channels = settings.telegram.channels.map(channel => {
        if (!channelNames.includes(channel.name)) {
            return channel
        }

        const updated = updater({ ...channel }) || channel
        changed = true
        return updated
    })

    if (changed) {
        return await saveUploadSettings(env, settings)
    }

    return settings
}

export async function getTelegramSyncChannels(env, { includeDisabled = true } = {}) {
    const settings = await loadUploadSettings(env)
    const channels = Array.isArray(settings.telegram?.channels) ? settings.telegram.channels : []
    return includeDisabled ? channels : channels.filter(channel => channel.enabled)
}

export async function getTelegramSyncChannelByName(env, channelName, options = {}) {
    const { includeDisabled = true } = options
    const channels = await getTelegramSyncChannels(env, { includeDisabled })
    return channels.find(channel => channel.name === channelName) || null
}

async function getTelegramSyncChannelsByBot(env, channel) {
    const channels = await getTelegramSyncChannels(env, { includeDisabled: true })
    return channels.filter(item =>
        item.botToken === channel.botToken
        && (item.proxyUrl || '') === (channel.proxyUrl || ''),
    )
}

function getMatchingChannelForMessage(channels, message) {
    const chatId = normalizeChatId(message?.chat?.id)
    return channels.find(channel => normalizeChatId(channel.chatId) === chatId) || null
}

async function cleanupStaleImportedFiles(context, prefix, keepFileId) {
    const db = getDatabase(context.env)
    let cursor = null
    const staleFileIds = []

    while (true) {
        const listResult = await db.list({
            prefix,
            limit: 100,
            cursor,
        })

        for (const item of listResult.keys || []) {
            if (item.name !== keepFileId) {
                staleFileIds.push(item.name)
            }
        }

        cursor = listResult.cursor
        if (!cursor) {
            break
        }
    }

    for (const staleFileId of staleFileIds) {
        await db.delete(staleFileId)
        await removeFileFromIndex(context, staleFileId)
    }

    return staleFileIds
}

async function buildImportedMetadata(context, channel, message, source, mediaInfo, filePath, importContext = {}) {
    const { kind, media } = mediaInfo
    const fileType = inferFileType(kind, media)
    const ext = inferExtension(kind, media, filePath)
    const fileName = sanitizeFileName(media.file_name || buildDefaultFileName(kind, message.message_id, ext))
    const importDirectory = importContext.importDirectory || createImportDirectory(channel.name, channel.importDirectory)
    const timestamp = Number(message.edit_date || message.date || Math.floor(Date.now() / 1000)) * 1000

    const metadata = {
        FileName: fileName,
        FileType: fileType,
        FileSize: ((Number(media.file_size || 0)) / 1024 / 1024).toFixed(2),
        FileSizeBytes: Number(media.file_size || 0),
        UploadIP: 'telegram-channel-sync',
        UploadAddress: 'Telegram Channel',
        ListType: 'None',
        TimeStamp: timestamp,
        Label: 'None',
        Directory: importDirectory,
        Tags: [],
        Channel: 'TelegramNew',
        ChannelName: channel.name,
        TgFileId: media.file_id,
        TgChatId: channel.chatId,
        TgFileUniqueId: media.file_unique_id,
        TgMessageId: message.message_id,
        TgUpdateSource: source,
    }

    if (importContext.albumPath) {
        metadata.Album = importContext.albumPath
        metadata.TgAlbumPath = importContext.albumPath
    }

    if (filePath) {
        const moderateDomain = channel.proxyUrl ? `https://${channel.proxyUrl}` : 'https://api.telegram.org'
        const moderateUrl = `${moderateDomain}/file/bot${channel.botToken}/${filePath}`
        try {
            metadata.Label = await moderateContent(context.env, moderateUrl)
        } catch (error) {
            console.error('Failed to moderate imported Telegram media:', error)
        }
    }

    return { metadata, ext }
}

export async function importTelegramUpdate(context, channel, update, source = 'webhook') {
    const message = update.channel_post || update.edited_channel_post
    if (!message) {
        return { ignored: true, reason: 'not_channel_post' }
    }
    if (normalizeChatId(message.chat?.id) !== normalizeChatId(channel.chatId)) {
        return { ignored: true, reason: 'channel_mismatch' }
    }

    const albumCommand = extractAlbumCommand(message)
    const mediaInfo = extractMediaFromMessage(message)
    if (albumCommand && !mediaInfo) {
        return await handleAlbumCommandMessage(context, channel, update, message, albumCommand)
    }
    if (!mediaInfo) {
        return { ignored: true, reason: 'no_supported_media' }
    }

    const telegramAPI = new TelegramAPI(channel.botToken, channel.proxyUrl || '')
    const filePath = await telegramAPI.getFilePath(mediaInfo.media.file_id)
    const importContext = await resolveAlbumPathForMessage(context, channel, update, message)
    const { metadata, ext } = await buildImportedMetadata(context, channel, message, source, mediaInfo, filePath, importContext)
    const directoryKey = sanitizeUploadFolder(importContext.importDirectory || '')
    const fileId = buildImportedFileId(channel.name, directoryKey, message.message_id, mediaInfo.media.file_unique_id || mediaInfo.media.file_id, ext)
    const prefix = buildMessagePrefix(channel.name, directoryKey, message.message_id)

    const db = getDatabase(context.env)
    const staleFileIds = await cleanupStaleImportedFiles(context, prefix, fileId)
    await db.put(fileId, '', { metadata })
    await addFileToIndex(context, fileId, metadata)

    return {
        imported: true,
        ignored: false,
        fileId,
        staleFileIds,
        channelName: channel.name,
        messageId: message.message_id,
        updateId: update.update_id,
    }
}

function createSummary() {
    return {
        success: true,
        importedCount: 0,
        ignoredCount: 0,
        importedFiles: [],
        ignoredReasons: [],
        maxUpdateId: 0,
    }
}

async function processUpdatesForChannels(context, channels, updates, source) {
    const summary = createSummary()

    for (const update of updates) {
        summary.maxUpdateId = Math.max(summary.maxUpdateId, Number(update.update_id || 0))
        const message = update.channel_post || update.edited_channel_post
        const matchedChannel = getMatchingChannelForMessage(channels, message)
        if (!matchedChannel || !matchedChannel.syncEnabled || !matchedChannel.enabled) {
            summary.ignoredCount += 1
            summary.ignoredReasons.push({ updateId: update.update_id, reason: 'channel_not_enabled' })
            continue
        }

        const result = await importTelegramUpdate(context, matchedChannel, update, source)
        if (result.imported) {
            summary.importedCount += 1
            summary.importedFiles.push(result)
        } else {
            summary.ignoredCount += 1
            summary.ignoredReasons.push({ updateId: update.update_id, reason: result.reason || 'ignored' })
        }
    }

    return summary
}

function createChannelStatus(channel, snapshot, webhookInfo = null) {
    return {
        name: channel.name,
        enabled: !!channel.enabled,
        fixed: !!channel.fixed,
        syncEnabled: !!channel.syncEnabled,
        syncMode: channel.syncMode || 'webhook',
        importDirectory: channel.importDirectory,
        chatId: channel.chatId,
        lastUpdateId: snapshot.lastUpdateId,
        lastSyncAt: snapshot.lastSyncAt,
        lastProcessedCount: snapshot.lastProcessedCount,
        lastError: snapshot.lastError,
        lastSyncSource: snapshot.lastSyncSource,
        lastWebhookEventAt: snapshot.lastWebhookEventAt,
        webhookInfo,
        manualRunAllowed: !webhookInfo?.url,
    }
}

export async function getTelegramSyncStatus(env, channelName = '') {
    const channels = await getTelegramSyncChannels(env, { includeDisabled: true })
    const filteredChannels = channelName ? channels.filter(channel => channel.name === channelName) : channels
    const webhookInfoCache = new Map()
    const statuses = []

    for (const channel of filteredChannels) {
        let webhookInfo = null
        if (channel.botToken) {
            const cacheKey = `${channel.botToken}@@${channel.proxyUrl || ''}`
            if (!webhookInfoCache.has(cacheKey)) {
                try {
                    const telegramAPI = new TelegramAPI(channel.botToken, channel.proxyUrl || '')
                    webhookInfoCache.set(cacheKey, await telegramAPI.getWebhookInfo())
                } catch (error) {
                    webhookInfoCache.set(cacheKey, { error: error.message, url: '' })
                }
            }
            webhookInfo = webhookInfoCache.get(cacheKey)
        }
        statuses.push(createChannelStatus(channel, createSyncSnapshot(channel), webhookInfo))
    }

    return channelName ? (statuses[0] || null) : statuses
}

export async function setupTelegramWebhook(context, channelName) {
    const channel = await getTelegramSyncChannelByName(context.env, channelName, { includeDisabled: true })
    if (!channel) {
        throw new Error('Telegram channel not found')
    }

    const sameBotChannels = (await getTelegramSyncChannelsByBot(context.env, channel)).filter(item =>
        item.name !== channel.name && item.enabled && item.syncEnabled,
    )
    if (sameBotChannels.length > 0) {
        const error = new Error('Webhook mode currently requires one synced Telegram channel per bot token. Disable sync on the other channels or switch them to manual polling.')
        error.status = 409
        throw error
    }

    const webhookSecret = channel.webhookSecret || crypto.randomUUID().replace(/-/g, '')
    const origin = new URL(context.request.url).origin
    const encodedChannelName = encodeURIComponent(channel.name)
    const webhookUrl = `${origin}/api/manage/telegram-sync/webhook/${encodedChannelName}`

    const telegramAPI = new TelegramAPI(channel.botToken, channel.proxyUrl || '')
    await telegramAPI.setWebhook(webhookUrl, {
        secretToken: webhookSecret,
        allowedUpdates: TELEGRAM_ALLOWED_UPDATES,
    })

    await updateTelegramChannels(context.env, [channel.name], current => ({
        ...current,
        syncEnabled: true,
        syncMode: 'webhook',
        webhookSecret,
        lastError: '',
    }))

    return {
        success: true,
        channelName: channel.name,
        webhookUrl,
        webhookSecret,
    }
}

export async function deleteTelegramWebhook(context, channelName, { dropPendingUpdates = false } = {}) {
    const channel = await getTelegramSyncChannelByName(context.env, channelName, { includeDisabled: true })
    if (!channel) {
        throw new Error('Telegram channel not found')
    }

    const telegramAPI = new TelegramAPI(channel.botToken, channel.proxyUrl || '')
    await telegramAPI.deleteWebhook(dropPendingUpdates)

    await updateTelegramChannels(context.env, [channel.name], current => ({
        ...current,
        lastError: '',
    }))

    return {
        success: true,
        channelName: channel.name,
    }
}

export async function runTelegramSync(context, channelName) {
    const channel = await getTelegramSyncChannelByName(context.env, channelName, { includeDisabled: true })
    if (!channel) {
        throw new Error('Telegram channel not found')
    }
    if (!channel.syncEnabled) {
        throw new Error('Telegram sync is disabled for this channel')
    }

    const telegramAPI = new TelegramAPI(channel.botToken, channel.proxyUrl || '')
    const webhookInfo = await telegramAPI.getWebhookInfo()
    if (channel.syncMode === 'webhook' && webhookInfo?.url) {
        const error = new Error('Webhook is active for this bot. Disable webhook or switch to polling before running manual sync.')
        error.status = 409
        throw error
    }

    const relatedChannels = (await getTelegramSyncChannelsByBot(context.env, channel)).filter(item => item.syncEnabled && item.enabled)
    const updates = await telegramAPI.getUpdates({
        offset: Number(channel.lastUpdateId || 0) > 0 ? Number(channel.lastUpdateId || 0) + 1 : undefined,
        limit: 100,
        timeout: 0,
        allowedUpdates: TELEGRAM_ALLOWED_UPDATES,
    })

    const summary = await processUpdatesForChannels(context, relatedChannels, updates, 'manual')
    const affectedChannelNames = relatedChannels.map(item => item.name)
    const now = Date.now()
    const processedCountByChannel = new Map()

    for (const importedFile of summary.importedFiles) {
        processedCountByChannel.set(
            importedFile.channelName,
            (processedCountByChannel.get(importedFile.channelName) || 0) + 1,
        )
    }

    await updateTelegramChannels(context.env, affectedChannelNames, current => ({
        ...current,
        lastUpdateId: summary.maxUpdateId || current.lastUpdateId || 0,
        lastSyncAt: now,
        lastProcessedCount: processedCountByChannel.get(current.name) || 0,
        lastError: '',
        lastSyncSource: 'manual',
    }))

    return {
        ...summary,
        channelName,
        webhookInfo,
    }
}

export async function handleTelegramWebhook(context, channelName, providedSecret, update) {
    const channel = await getTelegramSyncChannelByName(context.env, channelName, { includeDisabled: true })
    if (!channel) {
        const error = new Error('Telegram channel not found')
        error.status = 404
        throw error
    }
    if (!channel.syncEnabled) {
        return {
            success: true,
            ignored: true,
            reason: 'sync_disabled',
        }
    }
    if (!channel.webhookSecret || providedSecret !== channel.webhookSecret) {
        const error = new Error('Invalid Telegram webhook secret')
        error.status = 401
        throw error
    }

    const result = await importTelegramUpdate(context, channel, update, 'webhook')
    const now = Date.now()

    await updateTelegramChannels(context.env, [channel.name], current => ({
        ...current,
        lastSyncAt: now,
        lastProcessedCount: result.imported ? 1 : 0,
        lastError: '',
        lastSyncSource: 'webhook',
        lastWebhookEventAt: now,
    }))

    return {
        success: true,
        ...result,
    }
}

export { asJsonResponse, TELEGRAM_SYNC_RESPONSE_HEADERS }
