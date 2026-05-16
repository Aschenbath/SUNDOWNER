import { fetchSecurityConfig, fetchUploadConfig } from '../../utils/sysConfig.js';
import { MomentsStore } from '../../utils/momentsStore.js';
import { processFileUpload } from '../../upload/index.js';

const MAX_BODY_LENGTH = 2000;
const MAX_PHOTOS = 9;

function jsonResponse(payload, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(payload), { ...init, headers });
}

function normalizeText(value, maxLength = 0) {
  const normalized = String(value ?? '').replace(/\r\n?/g, '\n').trim();
  return maxLength > 0 ? normalized.slice(0, maxLength) : normalized;
}

function resolveNow(context) {
  const nowValue = context?.now;
  const now = nowValue ? new Date(nowValue) : new Date();
  return Number.isNaN(now.getTime()) ? new Date() : now;
}

function todayFolderDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function extractFileIdFromSrc(src = '') {
  const normalized = String(src || '').trim();
  const marker = '/file/';
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex >= 0) {
    return decodeURIComponent(normalized.slice(markerIndex + marker.length));
  }
  return normalized.replace(/^\/+file\//, '');
}

async function defaultUploadFile({ context, file, uploadFolder }) {
  const form = new FormData();
  form.set('file', file);

  const uploadUrl = new URL(context.request.url);
  uploadUrl.pathname = '/upload';
  uploadUrl.search = '';
  uploadUrl.searchParams.set('uploadFolder', uploadFolder);
  uploadUrl.searchParams.set('returnFormat', 'default');

  const uploadRequest = new Request(uploadUrl.toString(), {
    method: 'POST',
    headers: context.request.headers,
    body: form,
  });

  const uploadContext = {
    ...context,
    request: uploadRequest,
    url: uploadUrl,
    formdata: form,
    securityConfig: context.securityConfig || await fetchSecurityConfig(context.env),
    uploadConfig: context.uploadConfig || await fetchUploadConfig(context.env, context),
  };

  const response = await processFileUpload(uploadContext, form);
  if (!response.ok) {
    throw new Error((await response.text()) || 'Photo upload failed');
  }

  const payload = await response.json();
  const src = payload?.[0]?.src || '';
  const fileId = extractFileIdFromSrc(src);
  if (!fileId) {
    throw new Error('Photo upload did not return a file id');
  }

  return { fileId, src };
}

function mapError(error) {
  if (error?.status === 503 || /D1 database is required/i.test(error?.message || '')) {
    return { status: 503, error: 'Moments require D1 storage' };
  }

  const message = error?.message || 'Moment operation failed';
  if (Number.isInteger(error?.status)) {
    return {
      status: error.status,
      error: error.expose === false && error.status >= 500 ? 'Moment operation failed' : message,
    };
  }
  if (/required|at most|must be images|not found|Invalid|id is required|multipart|formdata|content-type|boundary/i.test(message)) {
    return { status: 400, error: message };
  }

  return { status: 500, error: 'Moment operation failed' };
}

async function handleGet(context, store) {
  const url = new URL(context.request.url);
  return jsonResponse(await store.listPosts({
    date: url.searchParams.get('date') || '',
    page: url.searchParams.get('page') || 1,
    pageSize: url.searchParams.get('pageSize') || 30,
  }));
}

function collectPhotos(form) {
  const photos = [];
  for (const key of ['photos[]', 'photos']) {
    for (const entry of form.getAll(key)) {
      if (entry instanceof File && entry.size > 0) {
        photos.push(entry);
      }
    }
  }
  return photos;
}

async function handlePost(context, store) {
  const now = resolveNow(context);
  const uploadFolder = `Moments/${todayFolderDate(now)}`;
  const form = await context.request.formData();
  const body = normalizeText(form.get('body'), MAX_BODY_LENGTH);
  const photos = collectPhotos(form);

  if (!body && photos.length === 0) {
    throw new Error('Moment body or at least one photo is required');
  }
  if (photos.length > MAX_PHOTOS) {
    throw new Error('A Moment can include at most 9 photos');
  }
  if (photos.some((file) => !String(file.type || '').toLowerCase().startsWith('image/'))) {
    throw new Error('Moments photos must be images');
  }

  const uploadFile = context.uploadFile || defaultUploadFile;
  const uploaded = [];
  for (const file of photos) {
    uploaded.push(await uploadFile({ context, file, uploadFolder }));
  }

  const post = await store.createPost({
    body,
    fileIds: uploaded.map((item) => item.fileId),
    now: now.toISOString(),
  });

  return jsonResponse({ post });
}

async function handleDelete(context, store) {
  const url = new URL(context.request.url);
  const id = url.searchParams.get('id') || '';
  return jsonResponse(await store.deletePost(id));
}

export async function onRequest(context) {
  try {
    const store = context.store || new MomentsStore(context.env);
    if (context.request.method === 'GET') {
      return await handleGet(context, store);
    }
    if (context.request.method === 'POST') {
      return await handlePost(context, store);
    }
    if (context.request.method === 'DELETE') {
      return await handleDelete(context, store);
    }
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  } catch (error) {
    const mapped = mapError(error);
    return jsonResponse({ error: mapped.error }, { status: mapped.status });
  }
}
