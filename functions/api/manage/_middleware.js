import {
  fetchSecurityConfig,
  getConfiguredAdminCredentials,
  hasConfiguredAdminCredentials,
  hasSecurityConfigLoadError,
} from '../../utils/sysConfig.js';
import { checkDatabaseConfig } from '../../utils/middleware.js';
import { validateApiToken } from '../../utils/tokenValidator.js';
import { getDatabase } from '../../utils/databaseAdapter.js';
import { getAdminSessionTokenFromRequest, verifyAdminSessionToken } from '../../utils/adminSession.js';

function buildLoginRedirect(request) {
  const url = new URL(request.url);
  const accept = request.headers.get('Accept') || '';
  if (accept.includes('text/html')) {
    return Response.redirect(`${url.origin}/login?next=${encodeURIComponent(url.pathname)}`, 302);
  }
  return new Response(JSON.stringify({ error: 'Unauthorized', code: 'LOGIN_REQUIRED' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

async function errorHandling(context) {
  try {
    return await context.next()
  } catch (err) {
    console.error('Manage middleware request failed', err)
    return new Response('Internal Server Error', {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain;charset=UTF-8',
        'Cache-Control': 'no-store',
      },
    })
  }
}

function basicAuthentication(request) {
  const Authorization = request.headers.get('Authorization')
  const [scheme, encoded] = Authorization.split(' ')

  if (!encoded || scheme !== 'Basic') {
    return BadRequestException('Malformed authorization header.')
  }

  let decoded = ''
  try {
    const buffer = Uint8Array.from(atob(encoded), character => character.charCodeAt(0))
    decoded = new TextDecoder().decode(buffer).normalize()
  } catch {
    return BadRequestException('Invalid authorization value.')
  }
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
      ...corsHeaders,
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
      ...corsHeaders,
      'Content-Type': 'text/plain;charset=UTF-8',
      'Cache-Control': 'no-store',
      'Content-Length': reason.length,
    },
  })
}

function ServiceUnavailableException(reason) {
  return new Response(reason, {
    status: 503,
    statusText: 'Service Unavailable',
    headers: {
      ...corsHeaders,
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

function isPublicPath(pathname) {
  // auth-session must be reachable before login; it does its own credential check
  return pathname === '/api/manage/auth-session'
    || pathname === '/api/manage/me'
    || pathname === '/api/manage/login'
    || isTelegramWebhookPath(pathname)
}

async function authentication(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  const pathname = new URL(context.request.url).pathname
  if (isPublicPath(pathname)) {
    return context.next()
  }

  const securityConfig = await fetchSecurityConfig(context.env)
  if (hasSecurityConfigLoadError(securityConfig)) {
    return ServiceUnavailableException('Security configuration is unavailable.')
  }

  if (!hasConfiguredAdminCredentials(securityConfig)) {
    return ServiceUnavailableException('Admin credentials are not configured.')
  }

  const { username: basicUser, password: basicPass } = getConfiguredAdminCredentials(securityConfig)

  // 1. API token (Bearer / custom header) or Basic Auth
  if (context.request.headers.has('Authorization')) {
    const authHeader = context.request.headers.get('Authorization')

    // Try Bearer token first
    if (authHeader.startsWith('Bearer ')) {
      const requiredPermission = extractRequiredPermission(pathname)
      const db = getDatabase(context.env)
      const tokenValidation = await validateApiToken(context.request, db, requiredPermission)
      if (tokenValidation.valid) {
        return context.next()
      }
      // Invalid Bearer token - reject immediately, don't fallback to Basic
      return UnauthorizedException('Invalid API token.')
    }

    // Try Basic Auth
    if (authHeader.startsWith('Basic ')) {
      const basicAuth = basicAuthentication(context.request)
      if (basicAuth instanceof Response) {
        return basicAuth
      }
      const { user, pass } = basicAuth
      if (basicUser !== user || basicPass !== pass) {
        return UnauthorizedException('Invalid credentials.')
      }
      return context.next()
    }

    // Unsupported authorization scheme
    return UnauthorizedException('Unsupported authorization scheme.')
  }

  // 2. Session cookie set by the custom login page
  const sessionToken = getAdminSessionTokenFromRequest(context.request)
  if (sessionToken && await verifyAdminSessionToken(sessionToken, basicUser, basicPass)) {
    return context.next()
  }

  // Not authenticated — no WWW-Authenticate header so browser won't show native popup
  return buildLoginRedirect(context.request)
}

export const onRequest = [checkDatabaseConfig, errorHandling, authentication]
