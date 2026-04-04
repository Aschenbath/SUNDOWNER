import { asJsonResponse, deleteTelegramWebhook } from '../../../../utils/telegramSync.js'

export async function onRequest(context) {
    const { request } = context
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } })
    }
    if (request.method !== 'POST') {
        return asJsonResponse({ error: 'Method not allowed' }, 405)
    }

    const url = new URL(request.url)
    const channelName = url.searchParams.get('channelName') || ''
    if (!channelName) {
        return asJsonResponse({ success: false, error: 'channelName is required' }, 400)
    }

    try {
        const dropPendingUpdates = url.searchParams.get('dropPendingUpdates') === 'true'
        const result = await deleteTelegramWebhook(context, channelName, { dropPendingUpdates })
        return asJsonResponse(result)
    } catch (error) {
        return asJsonResponse({ success: false, error: error.message }, error.status || 500)
    }
}