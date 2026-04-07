import { fetchSecurityConfig } from '../../utils/sysConfig';

const COOKIE_NAME = 'admin_auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function makeCookie(value, maxAge) {
  const base = `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
  return base;
}

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

  const token = encodeURIComponent(btoa(`${username}:${password}`));
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': makeCookie(token, COOKIE_MAX_AGE),
    },
  });
}

export async function onRequestDelete(context) {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': makeCookie('', 0),
    },
  });
}
