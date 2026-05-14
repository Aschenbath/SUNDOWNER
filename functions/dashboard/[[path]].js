export async function onRequest(context) {
  const url = new URL(context.request.url);
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return fetch(url.toString(), {
    headers: context.request.headers,
  });
}
