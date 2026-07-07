import { getDatabase } from './databaseAdapter.js';
import { getUploadConfig } from '../api/manage/sysConfig/upload.js';

const SENSITIVE_METADATA_KEYS = [
  'TgBotToken',
  'TgProxyUrl',
  'DiscordBotToken',
  'DiscordProxyUrl',
  'S3AccessKeyId',
  'S3SecretAccessKey',
  'HfToken',
];

const TRUSTED_HUGGINGFACE_HOSTS = [
  'huggingface.co',
  'hf.co',
];

function cloneMetadata(metadata = {}) {
  return metadata && typeof metadata === 'object' ? { ...metadata } : {};
}

function normalizeChannelKey(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeS3PathStyle(value) {
  return value === true || value === 'true';
}

function findChannelByName(section, channelName) {
  if (!section || !Array.isArray(section.channels) || !channelName) {
    return null;
  }
  const requested = normalizeChannelKey(channelName);
  return section.channels.find((channel) => {
    if (!channel?.name) {
      return false;
    }
    return channel.name === channelName
      || normalizeChannelKey(channel.name) === requested;
  }) || null;
}

async function loadUploadConfig(env) {
  const db = getDatabase(env);
  return getUploadConfig(db, env);
}

export function stripSensitiveMetadata(metadata = {}) {
  const sanitized = cloneMetadata(metadata);
  for (const key of SENSITIVE_METADATA_KEYS) {
    delete sanitized[key];
  }
  return sanitized;
}

export function sanitizeExposedMetadata(metadata = {}) {
  return stripSensitiveMetadata(metadata);
}

function isTrustedHuggingFaceHostname(hostname = '') {
  const normalized = String(hostname || '').trim().toLowerCase();
  return TRUSTED_HUGGINGFACE_HOSTS.some((trustedHost) => (
    normalized === trustedHost || normalized.endsWith(`.${trustedHost}`)
  ));
}

function normalizeUrlLike(value = '') {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  return `https://${normalized}`;
}

function buildCdnUrl(cdnDomain, fileKey) {
  const base = normalizeUrlLike(cdnDomain).replace(/\/+$/, '');
  const key = String(fileKey || '').replace(/^\/+/, '');
  if (!base || !key) {
    return null;
  }
  return `${base}/${key}`;
}

function isUrlUnderBase(candidate, base) {
  if (candidate.protocol !== base.protocol || candidate.hostname !== base.hostname || candidate.port !== base.port) {
    return false;
  }

  const basePath = base.pathname.replace(/\/+$/, '');
  if (!basePath) {
    return true;
  }

  return candidate.pathname === basePath || candidate.pathname.startsWith(`${basePath}/`);
}

export function buildCanonicalHuggingFaceFileUrl(repo, filePath) {
  return `https://huggingface.co/datasets/${repo}/resolve/main/${filePath}`;
}

export function resolveHuggingFaceFileUrl(metadata = {}, repo, filePath) {
  const canonicalUrl = buildCanonicalHuggingFaceFileUrl(repo, filePath);
  try {
    const metadataUrl = new URL(String(metadata.HfFileUrl || '').trim());
    if (metadataUrl.protocol === 'https:' && isTrustedHuggingFaceHostname(metadataUrl.hostname)) {
      return metadataUrl.toString();
    }
  } catch {
    // Ignore malformed or missing metadata URLs and fall back to repo/path.
  }
  return canonicalUrl;
}

export function resolveS3CdnFileUrl(metadata = {}, s3Access = {}, fileId = '') {
  const canonicalUrl = buildCdnUrl(s3Access?.cdnDomain, metadata?.S3FileKey || fileId);
  if (!canonicalUrl) {
    return null;
  }

  try {
    const baseUrl = new URL(normalizeUrlLike(s3Access.cdnDomain));
    const metadataUrl = new URL(String(metadata.S3CdnFileUrl || '').trim());
    if ((metadataUrl.protocol === 'https:' || metadataUrl.protocol === 'http:') && isUrlUnderBase(metadataUrl, baseUrl)) {
      return metadataUrl.toString();
    }
  } catch {
    // Ignore malformed or missing metadata URLs and fall back to channel-derived CDN path.
  }

  return canonicalUrl;
}

export async function resolveTelegramAccess(env, metadata = {}) {
  if (metadata.TgBotToken) {
    return {
      botToken: metadata.TgBotToken,
      chatId: metadata.TgChatId || null,
      proxyUrl: metadata.TgProxyUrl || '',
    };
  }

  const config = await loadUploadConfig(env);
  const channel = findChannelByName(config.telegram, metadata.ChannelName);
  if (channel?.botToken) {
    return {
      botToken: channel.botToken,
      chatId: metadata.TgChatId || channel.chatId || null,
      proxyUrl: channel.proxyUrl || '',
    };
  }

  const normalizedChannelName = normalizeChannelKey(metadata.ChannelName);
  if (
    env.TG_BOT_TOKEN
    && (
      metadata.Channel === 'Telegram'
      || metadata.Channel === 'TelegramNew'
      || !metadata.ChannelName
      || normalizedChannelName === 'telegram_env'
      || normalizedChannelName.startsWith('telegram_env_')
    )
  ) {
    return {
      botToken: env.TG_BOT_TOKEN,
      chatId: metadata.TgChatId || env.TG_CHAT_ID || null,
      proxyUrl: env.TG_PROXY_URL || '',
    };
  }

  return null;
}

export async function resolveDiscordAccess(env, metadata = {}) {
  if (metadata.DiscordBotToken) {
    return {
      botToken: metadata.DiscordBotToken,
      channelId: metadata.DiscordChannelId || null,
      proxyUrl: metadata.DiscordProxyUrl || '',
    };
  }

  const config = await loadUploadConfig(env);
  const channel = findChannelByName(config.discord, metadata.ChannelName);
  if (channel?.botToken) {
    return {
      botToken: channel.botToken,
      channelId: metadata.DiscordChannelId || channel.channelId || null,
      proxyUrl: channel.proxyUrl || '',
    };
  }

  if (env.DISCORD_BOT_TOKEN && (!metadata.ChannelName || metadata.ChannelName === 'Discord_env')) {
    return {
      botToken: env.DISCORD_BOT_TOKEN,
      channelId: metadata.DiscordChannelId || env.DISCORD_CHANNEL_ID || null,
      proxyUrl: env.DISCORD_PROXY_URL || '',
    };
  }

  return null;
}

export async function resolveS3Access(env, metadata = {}) {
  if (metadata.S3AccessKeyId && metadata.S3SecretAccessKey) {
    return {
      accessKeyId: metadata.S3AccessKeyId,
      secretAccessKey: metadata.S3SecretAccessKey,
      endpoint: metadata.S3Endpoint || undefined,
      bucketName: metadata.S3BucketName || undefined,
      region: metadata.S3Region || 'auto',
      pathStyle: normalizeS3PathStyle(metadata.S3PathStyle),
      cdnDomain: metadata.S3CdnDomain || undefined,
      channelName: metadata.ChannelName || undefined,
    };
  }

  const config = await loadUploadConfig(env);
  const channel = findChannelByName(config.s3, metadata.ChannelName);
  if (channel?.accessKeyId && channel?.secretAccessKey) {
    return {
      accessKeyId: channel.accessKeyId,
      secretAccessKey: channel.secretAccessKey,
      endpoint: channel.endpoint || undefined,
      bucketName: channel.bucketName || undefined,
      region: channel.region || 'auto',
      pathStyle: normalizeS3PathStyle(channel.pathStyle),
      cdnDomain: channel.cdnDomain || undefined,
      channelName: channel.name || metadata.ChannelName || undefined,
    };
  }

  if (env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY && (!metadata.ChannelName || metadata.ChannelName === 'S3_env')) {
    return {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      endpoint: env.S3_ENDPOINT || undefined,
      bucketName: env.S3_BUCKET_NAME || undefined,
      region: env.S3_REGION || 'auto',
      pathStyle: normalizeS3PathStyle(env.S3_PATH_STYLE),
      cdnDomain: env.S3_CDN_DOMAIN || undefined,
      channelName: 'S3_env',
    };
  }

  return null;
}

export async function resolveHuggingFaceAccess(env, metadata = {}) {
  if (metadata.HfToken) {
    return {
      token: metadata.HfToken,
      repo: metadata.HfRepo || null,
      isPrivate: metadata.HfIsPrivate || false,
    };
  }

  const config = await loadUploadConfig(env);
  const channel = findChannelByName(config.huggingface, metadata.ChannelName);
  if (channel?.token) {
    return {
      token: channel.token,
      repo: metadata.HfRepo || channel.repo || null,
      isPrivate: typeof metadata.HfIsPrivate === 'boolean' ? metadata.HfIsPrivate : !!channel.isPrivate,
    };
  }

  if (env.HF_TOKEN && (!metadata.ChannelName || metadata.ChannelName === 'HuggingFace_env')) {
    return {
      token: env.HF_TOKEN,
      repo: metadata.HfRepo || env.HF_REPO || null,
      isPrivate: typeof metadata.HfIsPrivate === 'boolean' ? metadata.HfIsPrivate : env.HF_PRIVATE === 'true',
    };
  }

  return null;
}
