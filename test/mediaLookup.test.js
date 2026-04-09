import assert from 'node:assert/strict';

import { getLookupKeys } from '../js/media-library/media-lookup.js';

describe('media lookup keys', () => {
  it('matches imported records against /file routes with preview query strings', () => {
    const recordKeys = new Set(getLookupKeys(
      'telegram-import/Telegram_env/IMG_1006.HEIC',
      'IMG_1006.HEIC',
      'IMG_1006.HEIC'
    ));

    const domKeys = getLookupKeys(
      'https://sundowner-liy.pages.dev/file/telegram-import/Telegram_env/IMG_1006.HEIC?preview=1',
      'IMG_1006.HEIC',
      'IMG_1006.HEIC'
    );

    assert.ok(domKeys.some((key) => recordKeys.has(key)));
    assert.ok(domKeys.includes('telegram-import/telegram_env/img_1006'));
    assert.ok(domKeys.includes('img_1006'));
  });

  it('matches legacy tg_* imports against absolute file URLs', () => {
    const recordKeys = new Set(getLookupKeys(
      'tg_Telegram_env_43_AgADYBcAAm2GuVY.heic',
      'IMG_0626.HEIC',
      'IMG_0626.HEIC'
    ));

    const domKeys = getLookupKeys(
      'https://sundowner-liy.pages.dev/file/tg_Telegram_env_43_AgADYBcAAm2GuVY.heic?preview=1',
      'IMG_0626.HEIC',
      'IMG_0626.HEIC'
    );

    assert.ok(domKeys.some((key) => recordKeys.has(key)));
    assert.ok(domKeys.includes('tg_telegram_env_43_agadybcaam2guvy'));
  });
});
