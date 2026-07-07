import assert from 'node:assert/strict';

import {
  resolveHuggingFaceFileUrl,
  resolveTelegramAccess,
} from '../functions/utils/mediaSecurity.js';

class MemoryKV {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async put(key, value) {
    this.store.set(key, String(value));
  }
}

function createEnv(overrides = {}) {
  return {
    img_url: new MemoryKV(),
    ...overrides,
  };
}

describe('resolveTelegramAccess', () => {
  it('matches configured telegram channels after normalizing the channel name', async () => {
    const env = createEnv();
    await env.img_url.put('manage@sysConfig@upload', JSON.stringify({
      telegram: {
        channels: [
          {
            name: 'Telegram env',
            botToken: 'channel-token',
            chatId: 'chat-1',
            proxyUrl: 'proxy.example.com',
          },
        ],
      },
    }));

    const access = await resolveTelegramAccess(env, {
      Channel: 'TelegramNew',
      ChannelName: 'Telegram_env',
    });

    assert.deepEqual(access, {
      botToken: 'channel-token',
      chatId: 'chat-1',
      proxyUrl: 'proxy.example.com',
    });
  });

  it('falls back to env telegram credentials for legacy telegram channel names', async () => {
    const env = createEnv({
      TG_BOT_TOKEN: 'env-token',
      TG_CHAT_ID: 'env-chat',
      TG_PROXY_URL: 'env-proxy.example.com',
    });

    const access = await resolveTelegramAccess(env, {
      Channel: 'Telegram',
      ChannelName: 'Telegram_env_legacy',
    });

    assert.deepEqual(access, {
      botToken: 'env-token',
      chatId: 'env-chat',
      proxyUrl: 'env-proxy.example.com',
    });
  });
});

describe('resolveHuggingFaceFileUrl', () => {
  it('falls back to the canonical repo path for untrusted metadata URLs', () => {
    const fileUrl = resolveHuggingFaceFileUrl({
      HfFileUrl: 'https://evil.example.com/steal-token',
    }, 'owner/private-repo', 'photos/private.jpg');

    assert.equal(fileUrl, 'https://huggingface.co/datasets/owner/private-repo/resolve/main/photos/private.jpg');
  });

  it('allows HTTPS HuggingFace metadata URLs', () => {
    const fileUrl = resolveHuggingFaceFileUrl({
      HfFileUrl: 'https://huggingface.co/datasets/owner/private-repo/resolve/main/photos/private.jpg?download=1',
    }, 'owner/private-repo', 'photos/private.jpg');

    assert.equal(fileUrl, 'https://huggingface.co/datasets/owner/private-repo/resolve/main/photos/private.jpg?download=1');
  });
});
