import assert from 'node:assert/strict';

import { buildTelegramFileUrl, resolveTelegramOrigin } from '../functions/utils/telegramAPI.js';

describe('telegramAPI URL helpers', () => {
    it('uses reverse-proxy domains as the public Telegram origin', () => {
        assert.equal(
            resolveTelegramOrigin('tg-proxy.example.com'),
            'https://tg-proxy.example.com',
        );
        assert.equal(
            buildTelegramFileUrl('bot-token', 'photos/file.jpg', 'tg-proxy.example.com'),
            'https://tg-proxy.example.com/file/botbot-token/photos/file.jpg',
        );
    });

    it('keeps the official Telegram origin when proxyUrl is a full proxy endpoint', () => {
        assert.equal(
            resolveTelegramOrigin('http://127.0.0.1:7890'),
            'https://api.telegram.org',
        );
        assert.equal(
            buildTelegramFileUrl('bot-token', '/photos/file.jpg', 'http://127.0.0.1:7890'),
            'https://api.telegram.org/file/botbot-token/photos/file.jpg',
        );
    });

    it('falls back to the official Telegram origin without proxy config', () => {
        assert.equal(
            buildTelegramFileUrl('bot-token', 'photos/file.jpg'),
            'https://api.telegram.org/file/botbot-token/photos/file.jpg',
        );
    });
});
