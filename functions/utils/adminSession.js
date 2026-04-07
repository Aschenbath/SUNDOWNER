export const ADMIN_SESSION_COOKIE_NAME = 'admin_auth';
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export function makeAdminSessionCookie(value, maxAge = ADMIN_SESSION_MAX_AGE) {
  return `${ADMIN_SESSION_COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function createAdminSessionToken(username, password) {
  return encodeURIComponent(btoa(`${username}:${password}`));
}

export function parseAdminSessionToken(token) {
  if (!token) {
    return null;
  }
  try {
    const decoded = atob(decodeURIComponent(token));
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) {
      return null;
    }
    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

export function getAdminSessionFromRequest(request) {
  const cookies = request.headers.get('Cookie') || '';
  const match = cookies.match(/(?:^|;\s*)admin_auth=([^;]+)/);
  if (!match) {
    return null;
  }
  return parseAdminSessionToken(match[1]);
}
