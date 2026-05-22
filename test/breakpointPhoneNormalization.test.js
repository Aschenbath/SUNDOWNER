import assert from 'node:assert/strict';
import fs from 'node:fs';

describe('phone breakpoint tokens', () => {
  const css = fs.readFileSync(new URL('../css/media-library.css', import.meta.url), 'utf8');

  it('defines --cml-phone-break: 640px on :root', () => {
    assert.match(css, /:root[^}]*--cml-phone-break:\s*640px/);
  });

  it('defines --cml-phone-small-break: 420px on :root', () => {
    assert.match(css, /:root[^}]*--cml-phone-small-break:\s*420px/);
  });

  it('uses the 640px breakpoint as the primary phone media query', () => {
    const matches = css.match(/@media \(max-width: 640px\)/g) || [];
    assert.ok(matches.length >= 5, `expected at least 5 @media (max-width: 640px) blocks, found ${matches.length}`);
  });
});

describe('phone breakpoint normalization', () => {
  const css = fs.readFileSync(new URL('../css/media-library.css', import.meta.url), 'utf8');

  it('does not use 680px as a phone-segment breakpoint', () => {
    const sixEightyMatches = css.match(/@media \(max-width: 680px\)/g) || [];
    assert.equal(sixEightyMatches.length, 0, '680px breakpoints should be migrated to 640px');
  });

  it('keeps 720px only when explicitly tagged tablet-segment', () => {
    const lines = css.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('@media (max-width: 720px)')) {
        const next = (lines[i + 1] || '') + (lines[i + 2] || '');
        assert.match(next, /tablet-segment/, `720px @media at line ${i + 1} must have /* tablet-segment */ marker`);
      }
    });
  });
});
