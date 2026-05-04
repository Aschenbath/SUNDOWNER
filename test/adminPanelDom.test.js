import assert from 'node:assert/strict';

import { AdminPanel } from '../js/media-library/components.js';

function createBaseState(overrides = {}) {
  return {
    adminPanelOpen: true,
    adminPanelTab: 'account',
    adminPanelLoading: false,
    adminPanelBusy: false,
    adminPanelError: '',
    adminMigrationStatus: null,
    adminMigrationLoading: false,
    adminMigrationError: '',
    adminOrphanScanLoading: false,
    adminOrphanScanError: '',
    adminOrphanScanResult: null,
    adminRecoveryTargetChatId: '',
    adminRecoveryMatchesText: '',
    adminRecoverCaptureTimesLoading: false,
    adminRecoverCaptureTimesError: '',
    adminRecoverCaptureTimesResult: null,
    adminRecoverTgFileIdsLoading: false,
    adminRecoverTgFileIdsError: '',
    adminRecoverTgFileIdsResult: null,
    adminRecoverTgThumbnailsLoading: false,
    adminRecoverTgThumbnailsError: '',
    adminRecoverTgThumbnailsResult: null,
    adminTelegramChannels: [
      {
        name: 'Telegram_env',
        chatId: '-100123',
        importDirectory: '/',
        syncEnabled: true,
        manualRunAllowed: true,
        lastProcessedCount: 2,
        lastUpdateId: 42,
        lastSyncAt: 1715000000000,
        lastSyncSource: 'webhook',
        lastWebhookEventAt: 1715000100000,
        lastError: '',
        webhookInfo: {
          url: 'https://example.com/webhook',
          pending_update_count: 0,
        },
      },
    ],
    adminTelegramLoading: false,
    adminTelegramBusy: false,
    adminTelegramError: '',
    adminDisplayName: 'LA',
    adminUsername: 'nashaschenbath',
    adminAvatarData: '',
    adminProfileDraft: {
      username: 'nashaschenbath',
      displayName: 'LA',
      avatarData: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    adminPageDraft: {
      siteTitle: 'SUNDOWNER',
      ownerName: 'LA',
      logoUrl: 'https://example.com/logo.svg',
      announcement: 'hello',
      adminBkImg: 'bing',
      adminLoginBkImg: 'bing',
    },
    adminCloudDraft: {
      publicBrowseEnabled: true,
      publicBrowseAllowedDir: '/albums/public',
      randomImageEnabled: true,
      randomImageAllowedDir: '/wallpaper',
      telemetryEnabled: false,
    },
    ...overrides,
  };
}

function renderAdminPanel(stateOverrides = {}, storageSummary = { usedMb: 512, totalCount: 42, totalQuotaGb: 10 }) {
  return AdminPanel({
    state: createBaseState(stateOverrides),
    storageSummary,
  });
}

describe('AdminPanel DOM contracts', () => {
  it('renders editable account inputs for the account tab', () => {
    const html = renderAdminPanel({ adminPanelTab: 'account' });

    const inputCount = (html.match(/class="cml-admin-panel__input"/g) || []).length;
    const passwordCount = (html.match(/type="password"/g) || []).length;

    assert.ok(inputCount >= 5, `expected at least 5 admin inputs, got ${inputCount}`);
    assert.ok(passwordCount >= 3, `expected at least 3 password inputs, got ${passwordCount}`);

    assert.match(html, /data-admin-section="account"/);
    assert.match(html, /data-admin-field="displayName"/);
    assert.match(html, /data-admin-field="username"/);
    assert.match(html, /data-admin-field="currentPassword"/);
    assert.match(html, /data-admin-field="newPassword"/);
    assert.match(html, /data-admin-field="confirmPassword"/);
  });

  it('keeps password helper copy on placeholder attributes instead of only loose text', () => {
    const html = renderAdminPanel({ adminPanelTab: 'account' });

    assert.match(html, /placeholder="Required for username or password changes"/);
    assert.match(html, /placeholder="Leave blank to keep current password"/);
    assert.match(html, /placeholder="Repeat the new password"/);
    assert.match(html, /<input type="password"[^>]*placeholder="Required for username or password changes"/);
    assert.match(html, /<input type="password"[^>]*placeholder="Leave blank to keep current password"/);
    assert.match(html, /<input type="password"[^>]*placeholder="Repeat the new password"/);
  });

  it('renders the Save account button with the real action hook and save-button class', () => {
    const html = renderAdminPanel({ adminPanelTab: 'account' });

    assert.match(html, /data-action="save-admin-account"/);
    assert.match(html, /cml-admin-panel__save-button/);
    assert.match(html, />Save account</);
  });

  it('renders the Site tab with expected field markers and save action', () => {
    const html = renderAdminPanel({ adminPanelTab: 'site' });

    assert.match(html, /Brand and entry surfaces/);
    assert.match(html, /data-admin-section="site"/);
    assert.match(html, /data-admin-field="siteTitle"/);
    assert.match(html, /data-admin-field="ownerName"/);
    assert.match(html, /data-admin-field="logoUrl"/);
    assert.match(html, /data-action="save-admin-site"/);
    assert.match(html, />Save site settings</);
  });

  it('renders the Cloud tab with expected markers and save action', () => {
    const html = renderAdminPanel({ adminPanelTab: 'cloud' });

    assert.match(html, /Service controls/);
    assert.match(html, /Enable public browse/);
    assert.match(html, /data-admin-section="cloud"/);
    assert.match(html, /data-admin-field="publicBrowseAllowedDir"/);
    assert.match(html, /data-admin-field="randomImageAllowedDir"/);
    assert.match(html, /data-action="save-admin-cloud"/);
    assert.match(html, />Save cloud settings</);
  });

  it('renders the Telegram tab with sync markers and action hooks', () => {
    const html = renderAdminPanel({ adminPanelTab: 'telegram' });

    assert.match(html, /Channel sync/);
    assert.match(html, /Telegram_env/);
    assert.match(html, /data-action="refresh-admin-telegram"/);
    assert.match(html, /data-action="tg-setup-webhook"/);
    assert.match(html, /data-action="tg-run-sync"/);
    assert.match(html, /data-action="tg-delete-webhook"/);
  });

  it('fails closed if the account tab loses all admin inputs while open', () => {
    const html = renderAdminPanel({ adminPanelOpen: true, adminPanelTab: 'account' });
    const accountInputCount = (html.match(/class="cml-admin-panel__input"/g) || []).length;

    assert.ok(accountInputCount > 0, 'expected account tab to render admin inputs when panel is open');
  });
});
