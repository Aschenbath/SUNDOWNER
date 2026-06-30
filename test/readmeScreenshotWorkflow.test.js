import assert from 'node:assert/strict';
import fs from 'node:fs';

const readUtf8 = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const exists = (path) => fs.existsSync(new URL(path, import.meta.url));

describe('README screenshot workflow documentation', () => {
  it('documents and ships a one-command local screenshot refresh wrapper', () => {
    assert.equal(exists('../scripts/capture-readme-screenshots.ps1'), true);

    const wrapper = readUtf8('../scripts/capture-readme-screenshots.ps1');
    assert.match(wrapper, /_sundowner-readme-data/);
    assert.match(wrapper, /'--d1',\s*'img_d1'/);
    assert.match(wrapper, /'--r2',\s*'img_r2'/);
    assert.match(wrapper, /node\.exe['"]?\s+scripts\\capture-readme-screenshots\.mjs/);
    assert.doesNotMatch(wrapper, /npm\.cmd\s+run\s+capture:readme/);
    assert.match(wrapper, /State\s+-eq\s+'Listen'/);
    assert.match(wrapper, /finally/);
    assert.match(wrapper, /Stop-Process/);

    const readme = readUtf8('../README.md');
    const zhReadme = readUtf8('../README_zh.md');
    assert.match(readme, /scripts\/capture-readme-screenshots\.ps1/);
    assert.match(zhReadme, /scripts\/capture-readme-screenshots\.ps1/);

    const captureScript = readUtf8('../scripts/capture-readme-screenshots.mjs');
    assert.match(captureScript, /function findAvailablePort/);
    assert.match(captureScript, /chromeStderr/);
  });
});
