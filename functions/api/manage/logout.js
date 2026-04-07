export async function onRequest(context) {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'admin_auth=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
    },
  });
}