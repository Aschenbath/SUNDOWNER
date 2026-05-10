import { MovieRepository, WATCH_STATUSES } from '../../utils/movieRepository.js';

function jsonResponse(payload, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new Error('Invalid JSON');
  }
}

function getAction(url, fallback = '') {
  return String(url.searchParams.get('action') || fallback || '').trim();
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const repository = context.repository || new MovieRepository(env);

  try {
    if (request.method === 'GET') {
      const action = getAction(url, 'entries');
      if (action === 'warmup') {
        return jsonResponse(await repository.warmup());
      }
      if (action === 'search') {
        return jsonResponse(await repository.searchMovies(
          url.searchParams.get('q') || url.searchParams.get('query') || '',
          Number(url.searchParams.get('page') || 1)
        ));
      }
      if (action === 'detail') {
        const tmdbId = Number(url.searchParams.get('tmdbId') || url.searchParams.get('id') || 0);
        const forceRefresh = ['1', 'true', 'yes'].includes(String(url.searchParams.get('forceRefresh') || '').toLowerCase());
        return jsonResponse({ movie: await repository.getMovieDetail(tmdbId, { forceRefresh }) });
      }
      if (action === 'entries') {
        const watchStatus = url.searchParams.get('watchStatus') || url.searchParams.get('status') || '';
        if (watchStatus && !WATCH_STATUSES.has(watchStatus)) {
          return jsonResponse({ error: 'Unsupported watchStatus' }, { status: 400 });
        }
        return jsonResponse({ entries: await repository.listUserEntries({ watchStatus }) });
      }
      return jsonResponse({ error: 'Unsupported movie operation' }, { status: 400 });
    }

    if (request.method === 'POST' || request.method === 'PATCH') {
      const body = await readJson(request);
      return jsonResponse(await repository.saveOrUpdateUserEntry(body));
    }

    if (request.method === 'DELETE') {
      const id = url.searchParams.get('id') || url.searchParams.get('tmdbId');
      return jsonResponse(await repository.deleteUserEntry(id));
    }

    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  } catch (error) {
    const message = error?.message || 'Movie operation failed';
    const status = message.includes('not configured') ? 503 : 400;
    return jsonResponse({ error: message }, { status });
  }
}
