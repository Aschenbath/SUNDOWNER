import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const cssPath = path.resolve('css/media-library.css');
const css = fs.readFileSync(cssPath, 'utf8');

describe('phone breakpoint tokens', () => {
  it('defines --cml-phone-break: 640px on :root', () => {
    assert.match(css, /:root[^}]*--cml-phone-break:\s*640px/s);
  });

  it('defines --cml-phone-small-break: 420px on :root', () => {
    assert.match(css, /:root[^}]*--cml-phone-small-break:\s*420px/s);
  });

  it('uses the 640px breakpoint as the primary phone media query', () => {
    const matches = css.match(/@media \(max-width: 640px\)/g) || [];
    assert.ok(matches.length >= 5, `expected at least 5 @media (max-width: 640px) blocks, found ${matches.length}`);
  });
});
