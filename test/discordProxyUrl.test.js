import assert from 'node:assert/strict';

import { resolveDiscordFileUrl } from '../functions/utils/discordAPI.js';

describe('Discord proxy URL normalization', () => {
  it('keeps the original CDN URL when no proxy is configured', () => {
    const fileUrl = 'https://cdn.discordapp.com/attachments/1/2/file.jpg?ex=1&is=2';
    assert.equal(resolveDiscordFileUrl(fileUrl, ''), fileUrl);
  });

  it('supports bare proxy host values', () => {
    const fileUrl = 'https://cdn.discordapp.com/attachments/1/2/file.jpg?ex=1&is=2';
    assert.equal(
      resolveDiscordFileUrl(fileUrl, 'cdn-proxy.example.com'),
      'https://cdn-proxy.example.com/attachments/1/2/file.jpg?ex=1&is=2'
    );
  });

  it('supports full proxy origins without producing double protocols', () => {
    const fileUrl = 'https://cdn.discordapp.com/attachments/1/2/file.jpg?ex=1&is=2';
    assert.equal(
      resolveDiscordFileUrl(fileUrl, 'http://127.0.0.1:7890'),
      'http://127.0.0.1:7890/attachments/1/2/file.jpg?ex=1&is=2'
    );
  });

  it('leaves non-discord URLs untouched', () => {
    const fileUrl = 'https://example.com/file.jpg';
    assert.equal(resolveDiscordFileUrl(fileUrl, 'cdn-proxy.example.com'), fileUrl);
  });
});
