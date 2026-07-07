import { asJsonResponse, asTelegramSyncErrorResponse, handleTelegramWebhook } from '../../../../utils/telegramSync.js'

export async function onRequest(context) {
    const { request, params } = context
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Telegram-Bot-Api-Secret-Token' } })
    }
    if (request.method !== 'POST') {
        return asJsonResponse({ error: 'Method not allowed' }, 405)
    }

    const channelName = decodeURIComponent((params.path && params.path[0]) || '')
    if (!channelName) {
        return asJsonResponse({ success: false, error: 'channelName is required' }, 400)
    }

    try {
        const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || ''
        const payload = await request.json()
        const result = await handleTelegramWebhook(context, channelName, secret, payload)
        return asJsonResponse(result)
    } catch (error) {
        return asTelegramSyncErrorResponse(error, error.status || 500, '[telegram-sync/webhook] Request failed:')
    }
}
