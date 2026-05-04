import assert from 'node:assert/strict';

import {
  applyAdminCloudDraftToSettings,
  applyAdminPageDraftToConfig,
  createAdminCloudDraft,
  createAdminPageDraft,
  createEmptyAdminCloudDraft,
  createEmptyAdminPageDraft,
  createEmptyAdminProfileDraft,
  parseAdminRecoveryMatches,
} from '../js/media-library/admin-runtime.js';

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

describe('admin runtime pure helpers', () => {
  it('createEmptyAdminProfileDraft returns the expected empty shape', () => {
    assert.deepEqual(createEmptyAdminProfileDraft(), {
      username: '',
      displayName: '',
      avatarData: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  });

  it('createEmptyAdminPageDraft returns the expected empty shape', () => {
    assert.deepEqual(createEmptyAdminPageDraft(), {
      siteTitle: '',
      ownerName: '',
      logoUrl: '',
      announcement: '',
      adminBkImg: '',
      adminLoginBkImg: '',
    });
  });

  it('createEmptyAdminCloudDraft returns the expected empty shape', () => {
    assert.deepEqual(createEmptyAdminCloudDraft(), {
      publicBrowseEnabled: false,
      publicBrowseAllowedDir: '',
      randomImageEnabled: false,
      randomImageAllowedDir: '',
      telemetryEnabled: false,
    });
  });

  it('createAdminPageDraft maps known config keys into a page draft', () => {
    const draft = createAdminPageDraft([
      { key: 'siteTitle', value: 'SUNDOWNER' },
      { key: 'author', value: 'LA' },
      { key: 'file_ico', value: 'https://example.com/logo.svg' },
      { key: 'homeDescription', value: 'hello world' },
      { key: 'adminBkImg', value: 'bing' },
      { key: 'adminLoginBkImg', value: '["a"]' },
    ]);

    assert.deepEqual(draft, {
      siteTitle: 'SUNDOWNER',
      ownerName: 'LA',
      logoUrl: 'https://example.com/logo.svg',
      announcement: 'hello world',
      adminBkImg: 'bing',
      adminLoginBkImg: '["a"]',
    });
  });

  it('createAdminPageDraft handles missing and partial config safely', () => {
    assert.deepEqual(createAdminPageDraft(null), {
      siteTitle: '',
      ownerName: '',
      logoUrl: '',
      announcement: '',
      adminBkImg: '',
      adminLoginBkImg: '',
    });

    assert.deepEqual(createAdminPageDraft([{ key: 'siteTitle', value: 'Only title' }]), {
      siteTitle: 'Only title',
      ownerName: '',
      logoUrl: '',
      announcement: '',
      adminBkImg: '',
      adminLoginBkImg: '',
    });
  });

  it('applyAdminPageDraftToConfig applies draft values and preserves unrelated config keys', () => {
    const original = [
      { key: 'siteTitle', value: 'Old title', extra: true },
      { key: 'author', value: 'Old author' },
      { key: 'custom', value: 'keep me' },
    ];
    const draft = {
      siteTitle: 'New title',
      ownerName: 'New author',
      logoUrl: 'https://example.com/logo.svg',
      announcement: 'Notice',
      adminBkImg: 'bing',
      adminLoginBkImg: 'login-bing',
    };

    const result = applyAdminPageDraftToConfig(original, draft);

    assert.notStrictEqual(result.config, original);
    assert.equal(result.config.find((item) => item.key === 'siteTitle')?.value, 'New title');
    assert.equal(result.config.find((item) => item.key === 'author')?.value, 'New author');
    assert.equal(result.config.find((item) => item.key === 'custom')?.value, 'keep me');
    assert.equal(result.config.find((item) => item.key === 'file_ico')?.value, 'https://example.com/logo.svg');
    assert.equal(result.config.find((item) => item.key === 'homeDescription')?.value, 'Notice');
    assert.equal(result.config.find((item) => item.key === 'adminBkImg')?.value, 'bing');
    assert.equal(result.config.find((item) => item.key === 'adminLoginBkImg')?.value, 'login-bing');
    assert.equal(original.find((item) => item.key === 'siteTitle')?.value, 'Old title');
  });

  it('createAdminCloudDraft maps public browse, random image, and telemetry settings', () => {
    const draft = createAdminCloudDraft({
      publicBrowse: { enable: true, allowDir: '/albums/public' },
      randomImage: { enable: false, allowDir: '/wallpaper' },
      showStatus: true,
    });

    assert.deepEqual(draft, {
      publicBrowseEnabled: true,
      publicBrowseAllowedDir: '/albums/public',
      randomImageEnabled: false,
      randomImageAllowedDir: '/wallpaper',
      telemetryEnabled: true,
    });
  });

  it('createAdminCloudDraft handles missing and partial settings safely', () => {
    assert.deepEqual(createAdminCloudDraft(null), {
      publicBrowseEnabled: false,
      publicBrowseAllowedDir: '',
      randomImageEnabled: false,
      randomImageAllowedDir: '',
      telemetryEnabled: false,
    });

    assert.deepEqual(createAdminCloudDraft({ publicBrowse: { enable: true } }), {
      publicBrowseEnabled: true,
      publicBrowseAllowedDir: '',
      randomImageEnabled: false,
      randomImageAllowedDir: '',
      telemetryEnabled: false,
    });
  });

  it('applyAdminCloudDraftToSettings applies draft values and preserves unrelated settings keys', () => {
    const original = {
      publicBrowse: { enable: false, allowDir: '/old', fixed: true },
      randomImage: { enable: false, allowDir: '/old-wall', mode: 'shuffle' },
      showStatus: false,
      untouched: { keep: true },
    };
    const draft = {
      publicBrowseEnabled: true,
      publicBrowseAllowedDir: '/albums/public',
      randomImageEnabled: true,
      randomImageAllowedDir: '/wallpaper',
      telemetryEnabled: true,
    };

    const result = applyAdminCloudDraftToSettings(original, draft);

    assert.notStrictEqual(result, original);
    assert.equal(result.publicBrowse.enable, true);
    assert.equal(result.publicBrowse.allowDir, '/albums/public');
    assert.equal(result.randomImage.enable, true);
    assert.equal(result.randomImage.allowDir, '/wallpaper');
    assert.equal(result.showStatus, true);
    assert.deepEqual(result.untouched, { keep: true });
    assert.equal(original.publicBrowse.enable, false);
    assert.equal(original.randomImage.allowDir, '/old-wall');
  });

  it('parseAdminRecoveryMatches parses valid lines and ignores empty ones', () => {
    const input = [
      'path/to/file.jpg | 42 | -100123 | Telegram_env',
      '',
      'path/to/file-2.heic | 77 |  | Telegram_env | AgAC123',
      '   ',
    ].join('\n');

    assert.deepEqual(parseAdminRecoveryMatches(input, normalizeText), [
      {
        key: 'path/to/file.jpg',
        messageId: '42',
        chatId: '-100123',
        channelName: 'Telegram_env',
      },
      {
        key: 'path/to/file-2.heic',
        messageId: '77',
        channelName: 'Telegram_env',
        fileId: 'AgAC123',
      },
    ]);
  });

  it('parseAdminRecoveryMatches throws on invalid lines', () => {
    assert.throws(
      () => parseAdminRecoveryMatches('only-key', normalizeText),
      /must include at least key and message ID or file ID/
    );

    assert.throws(
      () => parseAdminRecoveryMatches('   | 42', normalizeText),
      /is missing the file key/
    );

    assert.throws(
      () => parseAdminRecoveryMatches('path/to/file.jpg |   |   | Telegram_env', normalizeText),
      /must include either a message ID or a file ID/
    );
  });
});
