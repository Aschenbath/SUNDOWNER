import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../css/media-library.css', import.meta.url), 'utf8');
const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function getRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\ /g, '\\s+');
  return css.match(new RegExp(`${escaped}\\s*\\{[\\s\\S]*?\\n\\}`, 'm'))?.[0] || '';
}

describe('mobile CSS foundation', () => {
  it('defines phone and mini-player layout tokens on the media-library root', () => {
    const rootRule = getRule('#codex-media-library-root');

    assert.match(rootRule, /--cml-phone-break:\s*640px;/);
    assert.match(rootRule, /--cml-phone-small-break:\s*420px;/);
    assert.match(rootRule, /--cml-mini-player-height:\s*64px;/);
  });

  it('normalizes phone-intent breakpoints to 640px', () => {
    assert.doesNotMatch(css, /@media \(max-width: 680px\)/);
    assert.doesNotMatch(css, /@media \(max-width: 720px\)/);
    assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.cml-album-dialog--sheet/);
    assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.cml-private-access/);
    assert.match(css, /@media \(max-width: 640px\)[\s\S]*\[data-film-detail-page\]/);
  });

  it('marks the preview stage as manipulation-safe for mobile double taps', () => {
    const stageRules = [...css.matchAll(/#codex-media-library-root \.cml-preview__stage\s*\{[\s\S]*?\n\}/g)]
      .map((match) => match[0]);

    assert.ok(stageRules.some((rule) => /touch-action:\s*manipulation;/.test(rule)));
  });

  it('hides the mobile mini-player while preview is open', () => {
    assert.match(
      css,
      /#codex-media-library-root:has\(\.cml-preview\) \.cml-mobile-audio-player\s*\{[\s\S]*?display:\s*none;/
    );
  });

  it('adds phone grid padding for the active mobile mini-player and safe area', () => {
    assert.match(
      css,
      /@media \(max-width: 640px\)[\s\S]*#codex-media-library-root:has\(\.cml-mobile-audio-player\) \.cml-media-grid\s*\{[\s\S]*?padding-bottom:\s*calc\(var\(--cml-mini-player-height,\s*64px\) \+ env\(safe-area-inset-bottom,\s*0px\)\);/
    );
  });

  it('bumps the media-library stylesheet cache version', () => {
    assert.match(indexHtml, /\/css\/media-library\.css\?v=281/);
  });
});
