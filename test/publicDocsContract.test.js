import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);

const readUtf8 = (path) => fs.readFileSync(new URL(path, root), 'utf8');
const exists = (path) => fs.existsSync(new URL(path, root));

const publicDocs = ['README.md', 'README_zh.md', 'AGENTS.md'];

describe('public documentation contract', () => {
  it('uses SUNDOWNER as the only public product name', () => {
    for (const file of publicDocs) {
      const text = readUtf8(file);
      assert.doesNotMatch(text, /leosDrive/i, `${file} should not show the old secondary brand`);
      assert.doesNotMatch(text, /SUNDOWNER\s*\/\s*leosDrive/i, `${file} should not use the old compound brand`);
    }

    assert.match(readUtf8('README.md'), /<h1>SUNDOWNER<\/h1>/);
    assert.match(readUtf8('README_zh.md'), /<h1>SUNDOWNER<\/h1>/);
  });

  it('keeps README screenshots reproducible and present', () => {
    const packageJson = JSON.parse(readUtf8('package.json'));
    assert.equal(packageJson.scripts['capture:readme:local'], 'powershell -ExecutionPolicy Bypass -File scripts/capture-readme-screenshots.ps1');
    assert.equal(packageJson.scripts['test:docs'], 'mocha test/publicDocsContract.test.js test/readmeScreenshotWorkflow.test.js');

    for (const file of [
      'static/readme/current-library.png',
      'static/readme/current-style.png',
      'static/readme/current-films.png',
      'static/readme/current-moments.png',
    ]) {
      assert.equal(exists(file), true, `${file} should be tracked for the README`);
    }
  });
});
