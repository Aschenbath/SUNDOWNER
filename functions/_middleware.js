import { buildLoginRedirect, hasValidAdminSession } from './utils/dashboardAuth.js';

function isDashboardPath(pathname) {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (!isDashboardPath(url.pathname)) {
    return context.next();
  }

  if (await hasValidAdminSession(context.request, context.env)) {
    return context.next();
  }

  return buildLoginRedirect(context.request);
}
