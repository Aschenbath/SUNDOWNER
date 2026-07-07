import assert from 'node:assert/strict';
import fs from 'node:fs';

import { MindChatView, MindLoadingView } from '../js/media-library/components.js';

const css = fs.readFileSync(new URL('../css/media-library.css', import.meta.url), 'utf8');

function getRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\ /g, '\\s+');
  return css.match(new RegExp(`${escaped}\\s*\\{[\\s\\S]*?\\n\\}`, 'm'))?.[0] || '';
}

describe('identity and loading layout', () => {
  it('renders Mind loading as a centered loading block instead of a chat header', () => {
    const html = MindLoadingView({
      settings: {
        contactName: '威廉',
        contactAvatarData: 'data:image/png;base64,avatar',
        backgroundPreset: 'midnight',
        sendButtonColor: 'green',
      },
    });

    assert.match(html, /cml-mind-loading__identity/);
    assert.match(html, /cml-mind-loading__avatar/);
    assert.match(html, /cml-mind-loading__bubbles/);
    assert.doesNotMatch(html, /cml-mind-header/);
    assert.ok(
      html.indexOf('cml-mind-loading__identity') < html.indexOf('cml-mind-loading__bubbles'),
      'identity should sit above the centered loading bars'
    );
  });

  it('centers the Mind loading state as a single visual group', () => {
    const loadingRoot = getRule('#codex-media-library-root .cml-mind--loading');
    const loadingBlock = getRule('#codex-media-library-root .cml-mind-loading');
    const identityRule = getRule('#codex-media-library-root .cml-mind-loading__identity');
    const bubblesRule = getRule('#codex-media-library-root .cml-mind-loading__bubbles');

    assert.match(loadingRoot, /display:\s*grid;/);
    assert.match(loadingRoot, /place-items:\s*center;/);
    assert.match(loadingBlock, /justify-items:\s*center;/);
    assert.match(loadingBlock, /text-align:\s*center;/);
    assert.match(identityRule, /justify-items:\s*center;/);
    assert.match(bubblesRule, /justify-items:\s*center;/);
  });

  it('keeps Mind loading text readable over photo wallpaper backgrounds', () => {
    const copyRule = getRule('#codex-media-library-root .cml-mind-loading__copy');
    const titleRule = getRule('#codex-media-library-root .cml-mind-loading__title');
    const metaRule = getRule('#codex-media-library-root .cml-mind-loading__meta');

    assert.match(copyRule, /background:\s*rgba\(8, 12, 18, 0\.42\);/);
    assert.match(copyRule, /backdrop-filter:\s*blur\(16px\) saturate\(150%\);/);
    assert.match(titleRule, /color:\s*#ffffff;/);
    assert.match(titleRule, /text-shadow:\s*0 2px 12px rgba\(0, 0, 0, 0\.55\);/);
    assert.match(metaRule, /color:\s*rgba\(255, 255, 255, 0\.82\);/);
  });

  it('does not render unsafe Mind wallpaper CSS declarations from stored image URLs', () => {
    const unsafeWallpaperUrl = "data:image/png;base64,AAAA');--cml-mind-send-bg:red;/*";
    const loadingHtml = MindLoadingView({
      wallpaperUrl: unsafeWallpaperUrl,
      settings: {
        contactName: 'Mind',
        backgroundPreset: 'ios-sky',
        sendButtonColor: 'green',
        backgroundPosition: 'center center',
      },
    });
    const chatHtml = MindChatView({
      messages: [],
      wallpaperUrl: unsafeWallpaperUrl,
      settings: {
        contactName: 'Mind',
        backgroundPreset: 'ios-sky',
        sendButtonColor: 'green',
        backgroundPosition: 'center center',
      },
      settingsDraft: {
        contactName: 'Mind',
        backgroundPreset: 'ios-sky',
        sendButtonColor: 'green',
        backgroundPosition: 'center center',
      },
    });

    assert.doesNotMatch(loadingHtml, /--cml-mind-send-bg:red/);
    assert.doesNotMatch(chatHtml, /--cml-mind-send-bg:red/);
    assert.doesNotMatch(loadingHtml, /--cml-mind-wallpaper-image:url/);
    assert.doesNotMatch(chatHtml, /--cml-mind-wallpaper-image:url/);
  });

  it('gives the Documents list a defined file-manager surface instead of loose rows', () => {
    const headerRule = getRule('#codex-media-library-root .cml-docs-header');
    const titleRule = getRule('#codex-media-library-root .cml-docs-header__title');
    const hintRule = getRule('#codex-media-library-root .cml-docs-header__hint');
    const tableRule = getRule('#codex-media-library-root .cml-docs-table');
    const tableBodyRule = getRule('#codex-media-library-root .cml-docs-table__body');
    const rowRule = getRule('#codex-media-library-root .cml-docs-row');

    assert.match(headerRule, /padding:\s*18px 20px;/);
    assert.match(headerRule, /border-radius:\s*20px;/);
    assert.match(headerRule, /background:\s*color-mix\(in srgb, var\(--cml-theme-surface-elevated\) 88%, var\(--cml-theme-accent\) 12%\);/);
    assert.match(titleRule, /letter-spacing:\s*0;/);
    assert.match(hintRule, /color:\s*var\(--cml-theme-text-muted\);/);
    assert.match(tableRule, /display:\s*grid;/);
    assert.match(tableRule, /background:\s*color-mix\(in srgb, var\(--cml-theme-surface-elevated\) 94%, var\(--cml-theme-accent\) 6%\);/);
    assert.match(tableBodyRule, /gap:\s*8px;/);
    assert.match(rowRule, /grid-template-columns:\s*32px 52px minmax\(0, 1fr\) 150px 104px 40px;/);
    assert.match(rowRule, /height:\s*64px;/);
    assert.match(rowRule, /border:\s*1px solid var\(--cml-theme-card-border\);/);
  });

  it('keeps Documents row details legible and actionable in the light shell', () => {
    const iconRule = getRule('#codex-media-library-root .cml-docs-row__icon');
    const extRule = getRule('#codex-media-library-root .cml-docs-row__ext');
    const nameRule = getRule('#codex-media-library-root .cml-docs-row__name');
    const dateRule = getRule('#codex-media-library-root .cml-docs-row__date');
    const sizeRule = getRule('#codex-media-library-root .cml-docs-row__size');
    const moreRule = getRule('#codex-media-library-root .cml-docs-row__more');

    assert.match(iconRule, /width:\s*42px;/);
    assert.match(iconRule, /box-shadow:\s*inset 0 0 0 1px color-mix\(in srgb, var\(--doc-color, #8ab4f8\) 32%, transparent\);/);
    assert.match(extRule, /letter-spacing:\s*0;/);
    assert.match(nameRule, /font-weight:\s*650;/);
    assert.match(nameRule, /color:\s*var\(--cml-theme-text\);/);
    assert.match(dateRule, /font-variant-numeric:\s*tabular-nums;/);
    assert.match(sizeRule, /font-variant-numeric:\s*tabular-nums;/);
    assert.match(moreRule, /opacity:\s*0\.56;/);
  });

  it('keeps Moments post avatar and author name vertically centered as one identity group', () => {
    const headerRule = getRule('#codex-media-library-root .cml-moment-card__header');
    const identityRule = getRule('#codex-media-library-root .cml-moment-card__identity');

    assert.match(headerRule, /align-items:\s*center;/);
    assert.match(identityRule, /align-items:\s*center;/);
  });

  it('keeps Moments identity header separated from photos when body text is absent', () => {
    const headerRule = getRule('#codex-media-library-root .cml-moment-card__header');

    assert.match(headerRule, /margin-bottom:\s*16px;/);
  });
});
