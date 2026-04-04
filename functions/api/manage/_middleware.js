import { fetchSecurityConfig } from '../../utils/sysConfig';
import { checkDatabaseConfig } from '../../utils/middleware';
import { validateApiToken } from '../../utils/tokenValidator';
import { getDatabase } from '../../utils/databaseAdapter.js';

let securityConfig = {}
let basicUser = ''
let basicPass = ''

async function errorHandling(context) {
  try {
    return await context.next()
  } catch (err) {
    return new Response(`${err.message}\n${err.stack}`, { status: 500 })
  }
}

function basicAuthentication(request) {
  const Authorization = request.headers.get('Authorization')
  const [scheme, encoded] = Authorization.split(' ')

  if (!encoded || scheme !== 'Basic') {
    return BadRequestException('Malformed authorization header.')
  }

  const buffer = Uint8Array.from(atob(encoded), character => character.charCodeAt(0))
  const decoded = new TextDecoder().decode(buffer).normalize()
  const index = decoded.indexOf(':')

  if (index === -1 || /[\0-\x1F\x7F]/.test(decoded)) {
    return BadRequestException('Invalid authorization value.')
  }

  return {
    user: decoded.substring(0, index),
    pass: decoded.substring(index + 1),
  }
}

function UnauthorizedException(reason) {
  return new Response(reason, {
    status: 401,
    statusText: 'Unauthorized',
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
      'Cache-Control': 'no-store',
      'Content-Length': reason.length,
    },
  })
}

function BadRequestException(reason) {
  return new Response(reason, {
    status: 400,
    statusText: 'Bad Request',
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
      'Cache-Control': 'no-store',
      'Content-Length': reason.length,
    },
  })
}

function extractRequiredPermission(pathname) {
  const pathParts = pathname.toLowerCase().split('/')

  if (pathParts.includes('delete')) {
    return 'delete'
  }

  if (pathParts.includes('list')) {
    return 'list'
  }

  return 'manage'
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, PUT, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Telegram-Bot-Api-Secret-Token',
  'Access-Control-Max-Age': '86400',
}

function isTelegramWebhookPath(pathname) {
  return pathname.startsWith('/api/manage/telegram-sync/webhook/')
}

async function authentication(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  const pathname = new URL(context.request.url).pathname
  if (isTelegramWebhookPath(pathname)) {
    return context.next()
  }

  securityConfig = await fetchSecurityConfig(context.env)
  basicUser = securityConfig.auth.admin.adminUsername
  basicPass = securityConfig.auth.admin.adminPassword

  if (typeof basicUser == 'undefined' || basicUser == null || basicUser == '') {
    return context.next()
  }

  if (context.request.headers.has('Authorization')) {
    const requiredPermission = extractRequiredPermission(pathname)
    const db = getDatabase(context.env)
    const tokenValidation = await validateApiToken(context.request, db, requiredPermission)
    if (tokenValidation.valid) {
      return context.next()
    }

    const { user, pass } = basicAuthentication(context.request)
    if (basicUser !== user || basicPass !== pass) {
      return UnauthorizedException('Invalid credentials.')
    }
    return context.next()
  }

  return new Response('You need to login.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="my scope", charset="UTF-8"',
    },
  })
}

export const onRequest = [checkDatabaseConfig, errorHandling, authentication]