import { fetchSecurityConfig } from '../../utils/sysConfig.js';
import {
  ADMIN_SESSION_MAX_AGE,
  createAdminSessionToken,
  makeAdminSessionCookie,
} from '../../utils/adminSession.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { username, password } = body || {};

  if (!username || !password) {
    return new Response(JSON.stringify({ error: 'Username and password required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const securityConfig = await fetchSecurityConfig(env);
  const rightUser = securityConfig.auth.admin.adminUsername;
  const rightPass = securityConfig.auth.admin.adminPassword;

  if (!rightUser || username !== rightUser || password !== rightPass) {
    return new Response(JSON.stringify({ error: 'Invalid username or password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const token = await createAdminSessionToken(username, password, ADMIN_SESSION_MAX_AGE);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': makeAdminSessionCookie(token, ADMIN_SESSION_MAX_AGE),
    },
  });
}

export async function onRequestDelete(context) {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': makeAdminSessionCookie('', 0),
    },
  });
}
