import assert from 'node:assert/strict';
import fs from 'node:fs';

import { MindLoadingView } from '../js/media-library/components.js';

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

  it('keeps Moments post avatar and author name vertically centered as one identity group', () => {
    const headerRule = getRule('#codex-media-library-root .cml-moment-card__header');
    const identityRule = getRule('#codex-media-library-root .cml-moment-card__identity');

    assert.match(headerRule, /align-items:\s*center;/);
    assert.match(identityRule, /align-items:\s*center;/);
  });
});
