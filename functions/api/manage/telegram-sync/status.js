import { asJsonResponse, getTelegramSyncStatus } from '../../../utils/telegramSync.js'

export async function onRequest(context) {
    const { request } = context
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } })
    }
    if (request.method !== 'GET') {
        return asJsonResponse({ error: 'Method not allowed' }, 405)
    }

    try {
        const channelName = new URL(request.url).searchParams.get('channelName') || ''
        const status = await getTelegramSyncStatus(context.env, channelName)
        return asJsonResponse({ success: true, data: status })
    } catch (error) {
        return asJsonResponse({ success: false, error: error.message }, 500)
    }
}