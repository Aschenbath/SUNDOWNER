import { asJsonResponse, asTelegramSyncErrorResponse, runTelegramSync } from '../../../utils/telegramSync.js'

export async function onRequest(context) {
    const { request } = context
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } })
    }
    if (request.method !== 'POST') {
        return asJsonResponse({ error: 'Method not allowed' }, 405)
    }

    const channelName = new URL(request.url).searchParams.get('channelName') || ''
    if (!channelName) {
        return asJsonResponse({ success: false, error: 'channelName is required' }, 400)
    }

    try {
        const result = await runTelegramSync(context, channelName)
        return asJsonResponse(result)
    } catch (error) {
        return asTelegramSyncErrorResponse(error, error.status || 500, '[telegram-sync/run] Request failed:')
    }
}
