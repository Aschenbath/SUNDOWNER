export async function onRequest(context) {
  const cookies = context.request.headers.get('Cookie') || '';
  const match = cookies.match(/(?:^|;\s*)admin_auth=([^;]+)/);
  if (!match) {
    return new Response(JSON.stringify({ username: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    const decoded = atob(decodeURIComponent(match[1]));
    const idx = decoded.indexOf(':');
    const username = idx >= 0 ? decoded.substring(0, idx) : decoded;
    return new Response(JSON.stringify({ username }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ username: null }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
