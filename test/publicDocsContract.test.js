import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);

const readUtf8 = (path) => fs.readFileSync(new URL(path, root), 'utf8');
const exists = (path) => fs.existsSync(new URL(path, root));

const publicDocs = ['README.md', 'README_zh.md', 'AGENTS.md'];
const readmes = ['README.md', 'README_zh.md'];

function githubSlug(heading) {
  return heading
    .replace(/<[^>]+>/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s_-]/gu, '')
    .replace(/\s+/g, '-');
}

function readmeAnchors(markdown) {
  const anchors = new Set();
  for (const match of markdown.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    anchors.add(githubSlug(match[1]));
  }
  return anchors;
}

function localReferenceTarget(target) {
  if (!target || /^(?:https?:|mailto:|tel:)/i.test(target)) {
    return null;
  }
  return target.split('#')[0];
}

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
    assert.match(readUtf8('README.md'), /npm run test:docs/);
    assert.match(readUtf8('README_zh.md'), /npm run test:docs/);

    for (const file of [
      'static/readme/current-library.png',
      'static/readme/current-style.png',
      'static/readme/current-films.png',
      'static/readme/current-moments.png',
    ]) {
      assert.equal(exists(file), true, `${file} should be tracked for the README`);
    }
  });

  it('keeps local start bindings aligned with the documented Cloudflare model', () => {
    const packageJson = JSON.parse(readUtf8('package.json'));
    const startScript = packageJson.scripts.start;
    const readme = readUtf8('README.md');
    const zhReadme = readUtf8('README_zh.md');

    for (const binding of ['img_url', 'img_d1', 'img_r2']) {
      assert.match(readme, new RegExp(`\\b${binding}\\b`), `README.md should document ${binding}`);
      assert.match(zhReadme, new RegExp(`\\b${binding}\\b`), `README_zh.md should document ${binding}`);
      assert.match(startScript, new RegExp(`\\b${binding}\\b`), `npm start should bind ${binding}`);
    }
  });

  it('keeps README local links, anchors, and images resolvable', () => {
    for (const file of readmes) {
      const markdown = readUtf8(file);
      const anchors = readmeAnchors(markdown);

      for (const match of markdown.matchAll(/<a\s+[^>]*href="([^"]+)"/g)) {
        const href = match[1];
        const [localPath, hash = ''] = href.split('#');
        const target = localReferenceTarget(href);
        if (target) {
          assert.equal(exists(target), true, `${file} link target should exist: ${target}`);
        }
        if (hash) {
          const anchorSource = localPath ? readUtf8(localPath) : markdown;
          const anchorSet = localPath ? readmeAnchors(anchorSource) : anchors;
          assert.equal(anchorSet.has(decodeURIComponent(hash).toLowerCase()), true, `${file} anchor should exist: ${href}`);
        }
      }

      for (const match of markdown.matchAll(/<img\s+[^>]*src="([^"]+)"/g)) {
        const src = match[1];
        const target = localReferenceTarget(src);
        if (target) {
          assert.equal(exists(target), true, `${file} image should exist: ${target}`);
        }
      }
    }
  });
});
