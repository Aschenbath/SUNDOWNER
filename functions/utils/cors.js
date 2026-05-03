export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, PUT, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export function withCorsHeaders(headers = {}) {
  const merged = new Headers(headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    merged.set(key, value);
  });
  return merged;
}

export function optionsResponse(headers = {}) {
  return new Response(null, {
    status: 204,
    headers: withCorsHeaders(headers),
  });
}

export function jsonResponse(payload, { status = 200, headers = {} } = {}) {
  const merged = withCorsHeaders(headers);
  merged.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(payload), {
    status,
    headers: merged,
  });
}

export function methodNotAllowed(allowedMethods, payload = { error: 'Method not allowed' }) {
  return jsonResponse(payload, {
    status: 405,
    headers: {
      Allow: allowedMethods.join(', '),
    },
  });
}
