import {
  fetchSecurityConfig,
  getConfiguredAdminCredentials,
  hasConfiguredAdminCredentials,
  hasSecurityConfigLoadError,
} from '../../utils/sysConfig.js';
import { getAdminSessionTokenFromRequest, verifyAdminSessionToken } from '../../utils/adminSession.js';

export async function onRequest(context) {
  const cookieToken = getAdminSessionTokenFromRequest(context.request);
  const securityConfig = await fetchSecurityConfig(context.env);
  if (hasSecurityConfigLoadError(securityConfig) || !hasConfiguredAdminCredentials(securityConfig)) {
    return new Response(JSON.stringify({ username: null }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const { username } = getConfiguredAdminCredentials(securityConfig);
  const { password } = getConfiguredAdminCredentials(securityConfig);
  if (!cookieToken || !await verifyAdminSessionToken(cookieToken, username, password)) {
    return new Response(JSON.stringify({ username: null }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  return new Response(JSON.stringify({ username }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
