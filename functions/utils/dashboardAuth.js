import {
  fetchSecurityConfig,
  getConfiguredAdminCredentials,
  hasConfiguredAdminCredentials,
  hasSecurityConfigLoadError,
} from './sysConfig.js';
import { getAdminSessionTokenFromRequest, verifyAdminSessionToken } from './adminSession.js';

function normalizeDashboardPath(pathname) {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/')
    ? pathname
    : '/dashboard';
}

export function buildSafeLoginNext(request) {
  const url = new URL(request.url);
  const pathname = normalizeDashboardPath(url.pathname);
  return `${pathname}${url.search || ''}${url.hash || ''}`;
}

export function buildLoginRedirect(request) {
  const url = new URL(request.url);
  const next = buildSafeLoginNext(request);
  return Response.redirect(`${url.origin}/login?next=${encodeURIComponent(next)}`, 302);
}

export async function hasValidAdminSession(request, env) {
  const securityConfig = await fetchSecurityConfig(env);
  if (hasSecurityConfigLoadError(securityConfig) || !hasConfiguredAdminCredentials(securityConfig)) {
    return false;
  }

  const { username, password } = getConfiguredAdminCredentials(securityConfig);
  const sessionToken = getAdminSessionTokenFromRequest(request);
  return Boolean(sessionToken && await verifyAdminSessionToken(sessionToken, username, password));
}
