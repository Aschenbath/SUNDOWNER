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
