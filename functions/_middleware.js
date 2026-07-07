import { buildLoginRedirect, hasValidAdminSession } from './utils/dashboardAuth.js';

const BASELINE_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

function isDashboardPath(pathname) {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

function withBaselineSecurityHeaders(response) {
  const secured = new Response(response.body, response);

  for (const [name, value] of Object.entries(BASELINE_SECURITY_HEADERS)) {
    if (!secured.headers.has(name)) {
      secured.headers.set(name, value);
    }
  }

  return secured;
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  let response;

  if (!isDashboardPath(url.pathname)) {
    response = await context.next();
  } else if (await hasValidAdminSession(context.request, context.env)) {
    response = await context.next();
  } else {
    response = buildLoginRedirect(context.request);
  }

  return withBaselineSecurityHeaders(response);
}
