import { getDatabase } from './databaseAdapter.js'

const MIND_STORAGE_KEY = 'manage@sysConfig@mind'
const MAX_MIND_MESSAGES = 600
const DEFAULT_MIND_SETTINGS = {
    contactName: 'Mind',
    contactAvatarData: '',
    backgroundPreset: 'ios-sky',
    backgroundImageData: '',
    backgroundPhotoId: '',
    backgroundPosition: 'center center',
    sendButtonColor: 'green',
}

function normalizeText(value) {
    return String(value ?? '').replace(/\r\n/g, '\n').trim()
}

function createEmptyMindState() {
    return {
        messages: [],
        settings: { ...DEFAULT_MIND_SETTINGS },
    }
}

function normalizePreset(value) {
    const preset = normalizeText(value)
    const allowed = new Set(['ios-sky', 'sunset-glow', 'seafoam', 'midnight', 'paper'])
    return allowed.has(preset) ? preset : DEFAULT_MIND_SETTINGS.backgroundPreset
}

function normalizeImageData(value) {
    const data = normalizeText(value)
    return /^data:image\//i.test(data) || /^\/file\//i.test(data) ? data : ''
}

function normalizeBackgroundPosition(value) {
    const position = normalizeText(value).toLowerCase()
    const allowed = new Set([
        'left top',
        'center top',
        'right top',
        'left center',
        'center center',
        'right center',
        'left bottom',
        'center bottom',
        'right bottom',
    ])
    return allowed.has(position) ? position : DEFAULT_MIND_SETTINGS.backgroundPosition
}

function normalizeMindSettings(input = {}) {
    const sendButtonColor = normalizeText(input.sendButtonColor).toLowerCase()
    const allowedSendButtonColors = new Set(['default', 'blue', 'green', 'yellow', 'pink', 'orange', 'purple', 'black'])
    return {
        contactName: normalizeText(input.contactName) || DEFAULT_MIND_SETTINGS.contactName,
        contactAvatarData: normalizeImageData(input.contactAvatarData),
        backgroundPreset: normalizePreset(input.backgroundPreset),
        backgroundImageData: normalizeImageData(input.backgroundImageData),
        backgroundPhotoId: normalizeText(input.backgroundPhotoId),
        backgroundPosition: normalizeBackgroundPosition(input.backgroundPosition),
        sendButtonColor: allowedSendButtonColors.has(sendButtonColor) ? sendButtonColor : DEFAULT_MIND_SETTINGS.sendButtonColor,
    }
}

function normalizeTimestamp(value) {
    const timestamp = Number(value)
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now()
}

function normalizeMindMessage(input = {}) {
    const id = normalizeText(input.id) || crypto.randomUUID()
    const text = normalizeText(input.text)
    if (!text) {
        return null
    }
    const source = normalizeText(input.source).toLowerCase() === 'telegram' ? 'telegram' : 'web'
    const phase = source === 'web' && normalizeText(input.phase).toLowerCase() === 'fresh'
        ? 'fresh'
        : 'mirrored'
    const createdAt = normalizeTimestamp(input.createdAt)
    const updatedAt = normalizeTimestamp(input.updatedAt || createdAt)
    const sourceRef = normalizeText(input.sourceRef)
    const channelName = normalizeText(input.channelName)
    return {
        id,
        text,
        source,
        phase,
        createdAt,
        updatedAt,
        sourceRef,
        channelName,
    }
}

function normalizeMindState(rawValue) {
    if (!rawValue) {
        return createEmptyMindState()
    }

    try {
        const parsed = JSON.parse(rawValue)
        const sourceMessages = Array.isArray(parsed?.messages) ? parsed.messages : []
        const messages = sourceMessages
            .map((message) => normalizeMindMessage(message))
            .filter(Boolean)
            .sort((left, right) => {
                if (left.createdAt !== right.createdAt) {
                    return left.createdAt - right.createdAt
                }
                return left.id.localeCompare(right.id)
            })
            .slice(-MAX_MIND_MESSAGES)
        return {
            messages,
            settings: normalizeMindSettings(parsed?.settings || {}),
        }
    } catch {
        return createEmptyMindState()
    }
}

async function readMindState(env) {
    const db = getDatabase(env)
    const rawValue = await db.get(MIND_STORAGE_KEY)
    return normalizeMindState(rawValue)
}

async function writeMindState(env, state) {
    const db = getDatabase(env)
    const normalized = normalizeMindState(JSON.stringify(state))
    await db.put(MIND_STORAGE_KEY, JSON.stringify(normalized))
    return normalized
}

export async function getMindState(env) {
    return readMindState(env)
}

export async function appendWebMindMessage(env, text) {
    const normalizedText = normalizeText(text)
    if (!normalizedText) {
        throw new Error('Message text is required')
    }
    const state = await readMindState(env)
    state.messages.push(normalizeMindMessage({
        text: normalizedText,
        source: 'web',
        phase: 'fresh',
    }))
    return writeMindState(env, state)
}

export async function upsertTelegramMindMessage(env, {
    text,
    channelName = '',
    messageId = '',
    createdAt = Date.now(),
} = {}) {
    const normalizedText = normalizeText(text)
    if (!normalizedText) {
        return readMindState(env)
    }

    const normalizedChannelName = normalizeText(channelName)
    const normalizedMessageId = normalizeText(messageId)
    const sourceRef = normalizedMessageId
        ? `telegram:${normalizedChannelName}:${normalizedMessageId}`
        : ''

    const state = await readMindState(env)
    const existingIndex = sourceRef
        ? state.messages.findIndex((message) => message.sourceRef === sourceRef)
        : -1
    const nextMessage = normalizeMindMessage({
        id: existingIndex >= 0 ? state.messages[existingIndex]?.id : '',
        text: normalizedText,
        source: 'telegram',
        phase: 'mirrored',
        createdAt,
        updatedAt: Date.now(),
        sourceRef,
        channelName: normalizedChannelName,
    })
    if (!nextMessage) {
        return writeMindState(env, state)
    }
    if (existingIndex >= 0) {
        state.messages.splice(existingIndex, 1, nextMessage)
    } else {
        state.messages.push(nextMessage)
    }
    return writeMindState(env, state)
}

export async function mirrorFreshMindMessages(env) {
    const state = await readMindState(env)
    let changed = false
    state.messages = state.messages.map((message) => {
        if (message.source === 'web' && message.phase === 'fresh') {
            changed = true
            return {
                ...message,
                phase: 'mirrored',
                updatedAt: Date.now(),
            }
        }
        return message
    })
    return changed ? writeMindState(env, state) : state
}

export async function updateMindSettings(env, partialSettings = {}) {
    const state = await readMindState(env)
    state.settings = normalizeMindSettings({
        ...state.settings,
        ...partialSettings,
    })
    return writeMindState(env, state)
}

export async function deleteMindMessage(env, messageId) {
    const normalizedId = normalizeText(messageId)
    if (!normalizedId) {
        throw new Error('Message id is required')
    }
    const state = await readMindState(env)
    state.messages = state.messages.filter((message) => message.id !== normalizedId)
    return writeMindState(env, state)
}
