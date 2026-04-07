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

function cloneMetadata(metadata = {}) {
  return metadata && typeof metadata === 'object' ? { ...metadata } : {};
}

function findChannelByName(section, channelName) {
  if (!section || !Array.isArray(section.channels) || !channelName) {
    return null;
  }
  return section.channels.find((channel) => channel?.name === channelName) || null;
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

  if (env.TG_BOT_TOKEN && (!metadata.ChannelName || metadata.ChannelName === 'Telegram_env')) {
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
    };
  }

  const config = await loadUploadConfig(env);
  const channel = findChannelByName(config.s3, metadata.ChannelName);
  if (channel?.accessKeyId && channel?.secretAccessKey) {
    return {
      accessKeyId: channel.accessKeyId,
      secretAccessKey: channel.secretAccessKey,
    };
  }

  if (env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY && (!metadata.ChannelName || metadata.ChannelName === 'S3_env')) {
    return {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
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
