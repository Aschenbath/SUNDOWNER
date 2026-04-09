import assert from 'node:assert/strict';

import { AdminPanel } from '../js/media-library/components.js';

function createBaseState() {
  return {
    adminPanelOpen: true,
    adminPanelTab: 'cloud',
    adminPanelLoading: false,
    adminPanelBusy: false,
    adminPanelError: '',
    adminMigrationStatus: null,
    adminMigrationLoading: false,
    adminMigrationError: '',
    adminOrphanScanLoading: false,
    adminOrphanScanError: '',
    adminOrphanScanResult: null,
    adminDisplayName: 'Admin',
    adminUsername: 'admin',
    adminProfileDraft: {
      displayName: 'Admin',
      username: 'admin',
      avatarData: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    adminPageDraft: {
      siteTitle: 'SUNDOWNER',
      ownerName: 'Admin',
      logoUrl: '',
      announcement: '',
      adminBkImg: '',
      adminLoginBkImg: '',
    },
    adminCloudDraft: {
      publicBrowseEnabled: false,
      publicBrowseAllowedDir: '',
      randomImageEnabled: false,
      randomImageAllowedDir: '',
      telemetryEnabled: false,
    },
  };
}

describe('AdminPanel migration surfaces', () => {
  it('renders D1 migration status inside the cloud tab', () => {
    const state = createBaseState();
    state.adminMigrationStatus = {
      database: {
        hasKV: true,
        hasD1: true,
        usingKV: false,
        usingD1: true,
        usingHybrid: true,
      },
      migration: {
        state: 'in_progress',
        complete: false,
        nextCursor: 'cursor-2',
        updatedAt: '2026-04-09T22:20:00.000Z',
      },
    };

    const html = AdminPanel({
      state,
      storageSummary: {
        usedMb: 128,
        totalCount: 42,
        totalQuotaGb: 10,
      },
    });

    assert.match(html, /KV to D1 rollout/);
    assert.match(html, /Refresh status/);
    assert.match(html, /In progress/);
    assert.match(html, /Hybrid KV \+ D1/);
    assert.match(html, /cursor-2/);
  });

  it('renders orphan scan findings in the cloud tab', () => {
    const state = createBaseState();
    state.adminOrphanScanResult = {
      total: 3,
      returned: 2,
      truncated: true,
      files: [
        {
          id: '1775628424666_city-kiss.jpg',
          channelName: 'Telegram_env',
          directory: 'photos/inbox',
          reason: 'timestamp-style Telegram record without TgFileId/TgMessageId',
        },
        {
          id: '1775562023929_old.jpg',
          channelName: 'Telegram_env',
          directory: '',
          reason: 'timestamp-style Telegram record without TgFileId/TgMessageId',
        },
      ],
    };

    const html = AdminPanel({
      state,
      storageSummary: {
        usedMb: 64,
        totalCount: 2,
        totalQuotaGb: 10,
      },
    });

    assert.match(html, /Telegram orphan scan/);
    assert.match(html, /Run orphan scan/);
    assert.match(html, /Showing 2 of 3 candidates/);
    assert.match(html, /1775628424666_city-kiss\.jpg/);
    assert.match(html, /Telegram_env/);
    assert.match(html, /The API truncated the result set/);
  });
});
