/**
 * Telegram API wrapper
 */
export class TelegramAPI {
    constructor(botToken, proxyUrl = '') {
        this.botToken = botToken
        this.proxyUrl = proxyUrl
        const apiDomain = proxyUrl ? `https://${proxyUrl}` : 'https://api.telegram.org'
        this.baseURL = `${apiDomain}/bot${this.botToken}`
        this.fileDomain = proxyUrl ? `https://${proxyUrl}` : 'https://api.telegram.org'
        this.defaultHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
        }
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

        const response = await fetch(`${this.baseURL}/${functionName}`, {
            method: 'POST',
            headers: this.defaultHeaders,
            body: formData,
        })
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

        const fullURL = `${this.fileDomain}/file/bot${this.botToken}/${filePath}`
        return await fetch(fullURL, {
            headers: this.defaultHeaders,
        })
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