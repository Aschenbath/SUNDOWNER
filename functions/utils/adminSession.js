export const ADMIN_SESSION_COOKIE_NAME = 'admin_auth';
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function makeAdminSessionCookie(value, maxAge = ADMIN_SESSION_MAX_AGE) {
  return `${ADMIN_SESSION_COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function base64UrlEncodeBytes(bytes) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlEncodeString(value) {
  return base64UrlEncodeBytes(textEncoder.encode(value));
}

function base64UrlDecodeString(value) {
  if (!value) {
    return '';
  }
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return textDecoder.decode(bytes);
}

function getAdminSessionSecret(password) {
  return `sundowner-admin-session:${password || ''}`;
}

async function signData(data, password) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(getAdminSessionSecret(password)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, textEncoder.encode(data));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

export async function createAdminSessionToken(username, password, maxAge = ADMIN_SESSION_MAX_AGE) {
  const expiresAt = Date.now() + maxAge * 1000;
  const payload = JSON.stringify({ u: username, exp: expiresAt });
  const encodedPayload = base64UrlEncodeString(payload);
  const signature = await signData(encodedPayload, password);
  return `${encodedPayload}.${signature}`;
}

export async function verifyAdminSessionToken(token, username, password) {
  if (!token || !username || !password) {
    return false;
  }

  const [encodedPayload, signature] = String(token).split('.');
  if (!encodedPayload || !signature) {
    return false;
  }

  try {
    const expectedSignature = await signData(encodedPayload, password);
    if (expectedSignature !== signature) {
      return false;
    }

    const payload = JSON.parse(base64UrlDecodeString(encodedPayload));
    if (!payload || payload.u !== username) {
      return false;
    }

    if (!Number.isFinite(payload.exp) || payload.exp <= Date.now()) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function getAdminSessionTokenFromRequest(request) {
  const cookies = request.headers.get('Cookie') || '';
  const match = cookies.match(/(?:^|;\s*)admin_auth=([^;]+)/);
  return match ? match[1] : null;
}
