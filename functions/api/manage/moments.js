import { fetchSecurityConfig, fetchUploadConfig } from '../../utils/sysConfig.js';
import { MomentsStore } from '../../utils/momentsStore.js';
import { userAuthCheck } from '../../utils/userAuth.js';
import { hasValidAdminSession } from '../../utils/dashboardAuth.js';
import { processFileUpload } from '../../upload/index.js';
import { getUploadIp, isBlockedUploadIp } from '../../upload/uploadTools.js';

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

function normalizeMomentDate(value) {
  const raw = normalizeText(value, 20);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }
  if (!raw) {
    return '';
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
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

function buildUploadHeaders(request) {
  const headers = new Headers();
  const safeHeaderNames = [
    'Authorization',
    'authCode',
    'X-Telegram-Bot-Api-Secret-Token',
    'cf-connecting-ip',
    'x-real-ip',
    'x-forwarded-for',
    'x-client-ip',
    'x-host',
    'x-originating-ip',
    'x-cluster-client-ip',
    'forwarded-for',
    'forwarded',
    'via',
    'requester',
    'true-client-ip',
    'client-ip',
    'x-remote-ip',
    'fastly-client-ip',
    'akamai-origin-hop',
    'x-remote-addr',
    'x-remote-host',
    'x-client-ips',
  ];

  for (const name of safeHeaderNames) {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  return headers;
}

async function assertUploadAllowed(context, uploadUrl, uploadRequest) {
  const authorized = await userAuthCheck(
    context.env,
    uploadUrl,
    uploadRequest,
    'upload',
    { allowCookieAuthCode: false },
  );
  if (!authorized) {
    const adminAuthorized = await hasValidAdminSession(context.request, context.env);
    if (!adminAuthorized) {
      const error = new Error('Unauthorized');
      error.status = 401;
      error.expose = true;
      throw error;
    }
  }

  const uploadIp = getUploadIp(uploadRequest);
  if (await isBlockedUploadIp(context.env, uploadIp)) {
    const error = new Error('Upload IP is blocked');
    error.status = 403;
    error.expose = true;
    throw error;
  }
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
    headers: buildUploadHeaders(context.request),
    body: form,
  });

  await assertUploadAllowed(context, uploadUrl, uploadRequest);

  const uploadContext = {
    ...context,
    request: uploadRequest,
    url: uploadUrl,
    formdata: form,
    securityConfig: context.securityConfig || await fetchSecurityConfig(context.env),
    uploadConfig: context.uploadConfig || await fetchUploadConfig(context.env, context),
  };

  const processUpload = context.processUploadFile || processFileUpload;
  const response = await processUpload(uploadContext, form);
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

function collectExistingFileIds(form) {
  const fileIds = [];
  for (const key of ['existingFileIds[]', 'existingFileIds']) {
    for (const entry of form.getAll(key)) {
      const value = normalizeText(entry, 500);
      if (value) {
        fileIds.push(value);
      }
    }
  }
  return [...new Set(fileIds)];
}

async function buildMomentMutationInput(context) {
  const now = resolveNow(context);
  const form = await context.request.formData();
  const body = normalizeText(form.get('body'), MAX_BODY_LENGTH);
  const date = normalizeMomentDate(form.get('date')) || todayFolderDate(now);
  const uploadFolder = `Moments/${date}`;
  const photos = collectPhotos(form);
  const existingFileIds = collectExistingFileIds(form);

  if (!body && photos.length === 0 && existingFileIds.length === 0) {
    throw new Error('Moment body or at least one photo is required');
  }
  if (photos.length + existingFileIds.length > MAX_PHOTOS) {
    throw new Error('A Moment can include at most 9 photos');
  }
  if (photos.some((file) => !String(file.type || '').toLowerCase().startsWith('image/'))) {
    throw new Error('Moments photos must be images');
  }

  const uploadFile = context.uploadFile || defaultUploadFile;
  // Parallel upload for better performance
  const uploaded = await Promise.all(
    photos.map((file) => uploadFile({ context, file, uploadFolder }))
  );

  return {
    body,
    date,
    fileIds: [...existingFileIds, ...uploaded.map((item) => item.fileId)],
    now: now.toISOString(),
  };
}

async function handlePost(context, store) {
  const mutation = await buildMomentMutationInput(context);
  const post = await store.createPost(mutation);
  return jsonResponse({ post });
}

async function handlePatch(context, store) {
  const url = new URL(context.request.url);
  const id = url.searchParams.get('id') || '';
  if (!id) {
    const error = new Error('Moment id is required');
    error.status = 400;
    error.expose = true;
    throw error;
  }
  const mutation = await buildMomentMutationInput(context);
  const post = await store.updatePost(id, mutation);
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
    if (context.request.method === 'PATCH') {
      return await handlePatch(context, store);
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
