const DEFAULT_TELEGRAM_ORIGIN = 'https://api.telegram.org'
const PROXY_ENV_KEYS = [
    'HTTPS_PROXY',
    'https_proxy',
    'ALL_PROXY',
    'all_proxy',
    'HTTP_PROXY',
    'http_proxy',
]

let proxyAgentFactoryPromise = null

function hasScheme(value = '') {
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(String(value).trim())
}

export function resolveTelegramOrigin(proxyUrl = '') {
    const normalized = String(proxyUrl || '').trim()
    if (!normalized) {
        return DEFAULT_TELEGRAM_ORIGIN
    }

    if (hasScheme(normalized)) {
        return DEFAULT_TELEGRAM_ORIGIN
    }

    return `https://${normalized.replace(/^\/+|\/+$/g, '')}`
}

export function buildTelegramFileUrl(botToken, filePath, proxyUrl = '') {
    const normalizedPath = String(filePath || '').replace(/^\/+/, '')
    return `${resolveTelegramOrigin(proxyUrl)}/file/bot${botToken}/${normalizedPath}`
}

function resolveProxyEndpoint(proxyUrl = '') {
    const normalized = String(proxyUrl || '').trim()
    if (normalized && hasScheme(normalized)) {
        return normalized
    }

    const envObject = typeof process !== 'undefined' ? process.env || {} : {}
    for (const key of PROXY_ENV_KEYS) {
        const value = String(envObject[key] || '').trim()
        if (value) {
            return value
        }
    }

    return ''
}

function shouldUseProxyDispatcher(proxyEndpoint = '') {
    return !!proxyEndpoint && typeof process !== 'undefined' && !!process.versions?.node
}

async function loadProxyAgentFactory() {
    if (!proxyAgentFactoryPromise) {
        proxyAgentFactoryPromise = new Function('return import("undici")')()
            .then(mod => mod.ProxyAgent || null)
            .catch(() => null)
    }

    return proxyAgentFactoryPromise
}

/**
 * Telegram API wrapper
 */
export class TelegramAPI {
    constructor(botToken, proxyUrl = '') {
        this.botToken = botToken
        this.proxyUrl = proxyUrl
        this.apiOrigin = resolveTelegramOrigin(proxyUrl)
        this.baseURL = `${this.apiOrigin}/bot${this.botToken}`
        this.fileDomain = this.apiOrigin
        this.proxyEndpoint = resolveProxyEndpoint(proxyUrl)
        this.dispatcher = null
        this.dispatcherPromise = null
        this.defaultHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
        }
    }

    async resolveDispatcher() {
        if (!shouldUseProxyDispatcher(this.proxyEndpoint)) {
            return undefined
        }

        if (this.dispatcher) {
            return this.dispatcher
        }

        if (!this.dispatcherPromise) {
            this.dispatcherPromise = loadProxyAgentFactory().then(ProxyAgent => {
                if (!ProxyAgent) {
                    return undefined
                }
                this.dispatcher = new ProxyAgent(this.proxyEndpoint)
                return this.dispatcher
            })
        }

        return await this.dispatcherPromise
    }

    async request(methodName, options = {}) {
        const {
            method = 'GET',
            params = null,
            body = null,
            headers = {},
        } = options

        let url = `${this.baseURL}/${methodName}`
        const requestInit = {
            method,
            headers: {
                ...this.defaultHeaders,
                ...headers,
            },
        }

        const dispatcher = await this.resolveDispatcher()
        if (dispatcher) {
            requestInit.dispatcher = dispatcher
        }

        if (params && Object.keys(params).length > 0) {
            const searchParams = new URLSearchParams()
            for (const [key, value] of Object.entries(params)) {
                if (value === undefined || value === null || value === '') {
                    continue
                }
                searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value))
            }
            url += `?${searchParams.toString()}`
        }

        if (body !== null && body !== undefined) {
            requestInit.body = body
        }

        const response = await fetch(url, requestInit)
        if (!response.ok) {
            throw new Error(`Telegram API error: ${response.status} ${response.statusText}`)
        }

        const responseData = await response.json()
        if (!responseData.ok) {
            throw new Error(responseData.description || 'Telegram API request failed')
        }

        return responseData.result
    }

    async sendFile(file, chatId, functionName, functionType, caption = '', fileName = '') {
        const formData = new FormData()
        formData.append('chat_id', chatId)
        if (fileName) {
            formData.append(functionType, file, fileName)
        } else {
            formData.append(functionType, file)
        }
        if (caption) {
            formData.append('caption', caption)
        }

        const requestInit = {
            method: 'POST',
            headers: this.defaultHeaders,
            body: formData,
        }
        const dispatcher = await this.resolveDispatcher()
        if (dispatcher) {
            requestInit.dispatcher = dispatcher
        }

        const response = await fetch(`${this.baseURL}/${functionName}`, requestInit)
        if (!response.ok) {
            throw new Error(`Telegram API error: ${response.statusText}`)
        }

        return await response.json()
    }

    getFileInfo(responseData) {
        const getFileDetails = file => ({
            file_id: file.file_id,
            file_unique_id: file.file_unique_id,
            file_name: file.file_name || file.file_unique_id,
            file_size: file.file_size,
            mime_type: file.mime_type,
        })

        try {
            if (!responseData.ok) {
                console.error('Telegram API error:', responseData.description)
                return null
            }

            if (responseData.result.photo) {
                const largestPhoto = responseData.result.photo.reduce((prev, current) =>
                    (prev.file_size > current.file_size) ? prev : current,
                )
                return getFileDetails(largestPhoto)
            }

            if (responseData.result.video) {
                return getFileDetails(responseData.result.video)
            }

            if (responseData.result.audio) {
                return getFileDetails(responseData.result.audio)
            }

            if (responseData.result.document) {
                return getFileDetails(responseData.result.document)
            }

            if (responseData.result.animation) {
                return getFileDetails(responseData.result.animation)
            }

            return null
        } catch (error) {
            console.error('Error parsing Telegram response:', error.message)
            return null
        }
    }

    async getFile(fileId) {
        return await this.request('getFile', {
            method: 'GET',
            params: { file_id: fileId },
        })
    }

    async getFilePath(fileId) {
        try {
            const fileData = await this.getFile(fileId)
            return fileData?.file_path || null
        } catch (error) {
            console.error('Error getting file path:', error.message)
            return null
        }
    }

    async getFileContent(fileId) {
        const filePath = await this.getFilePath(fileId)
        if (!filePath) {
            throw new Error(`File path not found for fileId: ${fileId}`)
        }
        return await this.fetchFileResponseByPath(filePath)
    }

    async fetchFileResponseByPath(filePath, options = {}) {
        const { headers = {} } = options
        const requestInit = {
            headers: {
                ...this.defaultHeaders,
                ...headers,
            },
        }
        const dispatcher = await this.resolveDispatcher()
        if (dispatcher) {
            requestInit.dispatcher = dispatcher
        }

        const fullURL = buildTelegramFileUrl(this.botToken, filePath, this.proxyUrl)
        return await fetch(fullURL, requestInit)
    }

    async getFileHeaderByPath(filePath, maxBytes = 65536) {
        if (!filePath) {
            return null
        }
        const endByte = Math.max(0, Number(maxBytes) - 1)
        const response = await this.fetchFileResponseByPath(filePath, {
            headers: {
                Range: `bytes=0-${endByte}`,
            },
        })
        if (!response.ok) {
            throw new Error(`Telegram file header request failed: ${response.status} ${response.statusText}`)
        }
        return await response.arrayBuffer()
    }

    async getUpdates(options = {}) {
        const {
            offset,
            limit = 100,
            timeout = 0,
            allowedUpdates = ['channel_post', 'edited_channel_post'],
        } = options

        return await this.request('getUpdates', {
            method: 'GET',
            params: {
                offset,
                limit,
                timeout,
                allowed_updates: allowedUpdates,
            },
        })
    }

    async setWebhook(url, options = {}) {
        const {
            secretToken,
            allowedUpdates = ['channel_post', 'edited_channel_post'],
            dropPendingUpdates = false,
        } = options

        const formData = new FormData()
        formData.append('url', url)
        if (secretToken) {
            formData.append('secret_token', secretToken)
        }
        if (allowedUpdates) {
            formData.append('allowed_updates', JSON.stringify(allowedUpdates))
        }
        if (dropPendingUpdates) {
            formData.append('drop_pending_updates', 'true')
        }

        return await this.request('setWebhook', {
            method: 'POST',
            body: formData,
        })
    }

    async deleteWebhook(dropPendingUpdates = false) {
        return await this.request('deleteWebhook', {
            method: 'GET',
            params: {
                drop_pending_updates: dropPendingUpdates ? 'true' : 'false',
            },
        })
    }

    async getWebhookInfo() {
        return await this.request('getWebhookInfo', {
            method: 'GET',
        })
    }
}

// Telegram 官方 file_path 在 getFile 之后 ~60min 内有效，重复浏览同一张图片每次
// 都打一次 getFile 太重（TG 全局 30 RPS 容易触顶，30万次/月配额也吃紧）。这里
// 用 Cloudflare Worker edge cache 做 ~50min 的薄缓存，按 file_id 唯一定位；
// 不传 cache 时调用退化成直连 TelegramAPI.getFilePath，所以测试侧、upload/sync
// 这种低频调用可以选择不带缓存。
const TELEGRAM_FILE_PATH_CACHE_TTL_SECONDS = 3000;
const TELEGRAM_FILE_PATH_CACHE_KEY_PREFIX = 'https://internal.cache/tg-file-path/v1/';

function buildTelegramFilePathCacheKey(fileId) {
    return new Request(
        `${TELEGRAM_FILE_PATH_CACHE_KEY_PREFIX}${encodeURIComponent(fileId)}`,
        { method: 'GET' },
    );
}

export async function resolveTelegramFilePathCached(telegramAPI, fileId, cache = null) {
    if (!telegramAPI || !fileId) {
        return null;
    }

    let cacheKey = null;
    if (cache) {
        cacheKey = buildTelegramFilePathCacheKey(fileId);
        try {
            const cached = await cache.match(cacheKey);
            if (cached) {
                const cachedPath = (await cached.text()).trim();
                if (cachedPath) {
                    return cachedPath;
                }
            }
        } catch (error) {
            console.warn('Telegram file_path cache lookup failed:', error?.message || error);
        }
    }

    const filePath = await telegramAPI.getFilePath(fileId);

    if (filePath && cache && cacheKey) {
        try {
            await cache.put(cacheKey, new Response(filePath, {
                headers: {
                    'Cache-Control': `public, max-age=${TELEGRAM_FILE_PATH_CACHE_TTL_SECONDS}`,
                    'Content-Type': 'text/plain',
                },
            }));
        } catch (error) {
            console.warn('Telegram file_path cache write failed:', error?.message || error);
        }
    }

    return filePath;
}
