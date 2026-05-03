import {
  fetchSecurityConfig,
  getConfiguredAdminCredentials,
  hasConfiguredAdminCredentials,
  hasSecurityConfigLoadError,
} from '../../utils/sysConfig.js';
import {
  ADMIN_SESSION_MAX_AGE,
  createAdminSessionToken,
  makeAdminSessionCookie,
} from '../../utils/adminSession.js';
import { jsonResponse, optionsResponse } from '../../utils/cors.js';

export function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, {
      status: 400,
    });
  }

  const { username, password } = body || {};

  if (!username || !password) {
    return jsonResponse({ error: 'Username and password required' }, {
      status: 400,
    });
  }

  const securityConfig = await fetchSecurityConfig(env);
  if (hasSecurityConfigLoadError(securityConfig)) {
    return jsonResponse({ error: 'Security configuration is unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  if (!hasConfiguredAdminCredentials(securityConfig)) {
    return jsonResponse({ error: 'Admin credentials are not configured' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const { username: rightUser, password: rightPass } = getConfiguredAdminCredentials(securityConfig);

  if (!rightUser || username !== rightUser || password !== rightPass) {
    return jsonResponse({ error: 'Invalid username or password' }, {
      status: 401,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const token = await createAdminSessionToken(username, password, ADMIN_SESSION_MAX_AGE);
  return jsonResponse({ ok: true }, {
    status: 200,
    headers: {
      'Set-Cookie': makeAdminSessionCookie(token, ADMIN_SESSION_MAX_AGE),
    },
  });
}

export async function onRequestDelete(context) {
  return jsonResponse({ ok: true }, {
    status: 200,
    headers: {
      'Set-Cookie': makeAdminSessionCookie('', 0),
    },
  });
}
