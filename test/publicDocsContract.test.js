import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);

const readUtf8 = (path) => fs.readFileSync(new URL(path, root), 'utf8');
const exists = (path) => fs.existsSync(new URL(path, root));

const publicDocs = ['README.md', 'README_zh.md', 'AGENTS.md'];
const readmes = ['README.md', 'README_zh.md'];
const currentReadmeScreenshots = [
  'static/readme/current-library.png',
  'static/readme/current-style.png',
  'static/readme/current-films.png',
  'static/readme/current-moments.png',
];

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

function stripMarkdownCode(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '');
}

function cleanMarkdownTarget(rawTarget) {
  const trimmed = rawTarget.trim();
  const angleMatch = trimmed.match(/^<([^>]+)>/);
  if (angleMatch) {
    return angleMatch[1];
  }
  return trimmed.split(/\s+/)[0];
}

function collectMarkdownReferences(markdown) {
  const source = stripMarkdownCode(markdown);
  const references = [];

  for (const match of source.matchAll(/!\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
    const target = cleanMarkdownTarget(match[1]);
    if (localReferenceTarget(target)) {
      references.push({ kind: 'image', target, index: match.index });
    }
  }

  for (const match of source.matchAll(/(?<!!)\[[^\]\n]+\]\(([^)\n]+)\)/g)) {
    const target = cleanMarkdownTarget(match[1]);
    if (localReferenceTarget(target)) {
      references.push({ kind: 'link', target, index: match.index });
    }
  }

  return references
    .sort((a, b) => a.index - b.index)
    .map(({ kind, target }) => ({ kind, target }));
}

function collectReadmeImageTargets(markdown) {
  const targets = [];

  for (const match of markdown.matchAll(/<img\s+[^>]*src="([^"]+)"/g)) {
    const target = localReferenceTarget(match[1]);
    if (target) {
      targets.push(target);
    }
  }

  for (const reference of collectMarkdownReferences(markdown)) {
    if (reference.kind === 'image') {
      targets.push(reference.target.split('#')[0]);
    }
  }

  return [...new Set(targets)];
}

function readPngInfo(buffer) {
  const pngSignature = '89504e470d0a1a0a';
  assert.equal(buffer.subarray(0, 8).toString('hex'), pngSignature, 'image should be a PNG file');

  return {
    byteLength: buffer.byteLength,
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
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

  it('uses SUNDOWNER package metadata for the root project', () => {
    const packageJson = JSON.parse(readUtf8('package.json'));
    const packageLock = JSON.parse(readUtf8('package-lock.json'));

    assert.equal(packageJson.name, 'sundowner');
    assert.equal(packageLock.name, 'sundowner');
    assert.equal(packageLock.packages[''].name, 'sundowner');
  });

  it('uses SUNDOWNER Docker Compose metadata and builds this repository', () => {
    const compose = readUtf8('docker-compose.yml');

    assert.match(compose, /^name:\s*sundowner\s*$/m);
    assert.doesNotMatch(compose, /^version:\s*/m);
    assert.match(compose, /^\s{2}sundowner:\s*$/m);
    assert.match(compose, /^\s{4}build:\s*$/m);
    assert.match(compose, /^\s{6}context:\s*\.\s*$/m);
    assert.match(compose, /^\s{4}image:\s*sundowner:local\s*$/m);
    assert.doesNotMatch(compose, /cloudflare-imgbed/i);
    assert.doesNotMatch(compose, /^\s{2}imgbed:\s*$/m);
  });

  it('keeps brand and app icon assets out of the repository root', () => {
    const rootImageAssets = fs
      .readdirSync(root)
      .filter((name) => /\.(?:avif|gif|ico|jpe?g|png|svg|webp)$/i.test(name))
      .sort();

    assert.deepEqual(rootImageAssets, []);
  });

  it('loads organized app icon and brand assets from static folders', () => {
    const indexHtml = readUtf8('index.html');
    const manifest = JSON.parse(readUtf8('manifest.json'));
    const uiOverrides = readUtf8('js/ui-overrides.js');
    const components = readUtf8('js/media-library/components.js');
    const legacyBundle = readUtf8('js/app.f0825045.js');

    for (const icon of ['favicon-32.png', 'favicon-16.png', 'apple-touch-icon.png']) {
      assert.match(indexHtml, new RegExp(`/static/icons/${icon}\\?v=1`));
      assert.equal(exists(`static/icons/${icon}`), true, `static/icons/${icon} should exist`);
    }

    assert.deepEqual(manifest.icons.map((icon) => icon.src), [
      '/static/icons/icon-192.png?v=1',
      '/static/icons/icon-512.png?v=1',
    ]);

    for (const icon of ['icon-192.png', 'icon-512.png']) {
      assert.equal(exists(`static/icons/${icon}`), true, `static/icons/${icon} should exist`);
    }

    assert.match(uiOverrides, /const LOGO_PATH = '\/static\/brand\/logo-sundowner\.png';/);
    assert.match(components, /src="\/static\/brand\/logo-sundowner\.png\?v=1"/);
    assert.equal(exists('static/brand/logo-sundowner.png'), true);
    assert.equal(exists('static/brand/logo-sundowner.svg'), true);
    assert.equal(exists('static/brand/logo.png'), true);
    assert.equal(exists('static/brand/logo-dark.png'), true);
    assert.match(legacyBundle, /\/static\/brand\/logo\.png/);
    assert.match(legacyBundle, /\/static\/brand\/logo-dark\.png/);
    assert.doesNotMatch(legacyBundle, /["']\/logo(?:-dark)?\.png["']/);
  });

  it('keeps legacy root logo URLs compatible through route shims', async () => {
    for (const logo of ['logo.png', 'logo-dark.png']) {
      assert.equal(exists(`functions/${logo}.js`), true);
      const route = await import(new URL(`functions/${logo}.js?test=${Date.now()}`, root));
      const response = await route.onRequestGet({
        request: new Request(`https://sundowner.example/${logo}`),
      });

      assert.equal(response.status, 302);
      assert.equal(response.headers.get('location'), `https://sundowner.example/static/brand/${logo}`);
    }
  });

  it('keeps auxiliary tool pages out of the repository root with route shims', async () => {
    const rootHtmlFiles = fs
      .readdirSync(root)
      .filter((name) => /\.html$/i.test(name))
      .sort();

    assert.deepEqual(rootHtmlFiles, ['health.html', 'index.html']);
    assert.equal(exists('static/tools/telegram-sync-admin.html'), true);
    assert.equal(exists('functions/telegram-sync-admin.html.js'), true);
    assert.match(readUtf8('static/tools/telegram-sync-admin.html'), /<title>SUNDOWNER Telegram Sync<\/title>/);
    assert.match(readUtf8('static/tools/telegram-sync-admin.html'), /<h1>SUNDOWNER Telegram Sync<\/h1>/);

    const route = await import(new URL(`functions/telegram-sync-admin.html.js?test=${Date.now()}`, root));
    const response = await route.onRequestGet({
      request: new Request('https://sundowner.example/telegram-sync-admin.html'),
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), 'https://sundowner.example/static/tools/telegram-sync-admin.html');
  });

  it('keeps README screenshots reproducible and present', () => {
    const packageJson = JSON.parse(readUtf8('package.json'));
    assert.equal(packageJson.scripts['capture:readme:local'], 'powershell -ExecutionPolicy Bypass -File scripts/capture-readme-screenshots.ps1');
    assert.equal(packageJson.scripts['test:docs'], 'mocha test/publicDocsContract.test.js test/readmeScreenshotWorkflow.test.js');
    assert.match(readUtf8('README.md'), /npm run test:docs/);
    assert.match(readUtf8('README_zh.md'), /npm run test:docs/);

    for (const file of currentReadmeScreenshots) {
      assert.equal(exists(file), true, `${file} should be tracked for the README`);
      const pngInfo = readPngInfo(fs.readFileSync(new URL(file, root)));
      assert.ok(pngInfo.width >= 1200, `${file} should be a wide, readable screenshot`);
      assert.ok(pngInfo.height >= 700, `${file} should be a tall enough dashboard screenshot`);
      assert.ok(pngInfo.byteLength >= 100_000, `${file} should not be a tiny placeholder image`);
    }

    for (const file of readmes) {
      const imageTargets = collectReadmeImageTargets(readUtf8(file));
      for (const screenshot of currentReadmeScreenshots) {
        assert.equal(imageTargets.includes(screenshot), true, `${file} should display ${screenshot}`);
      }
      assert.equal(imageTargets.some((target) => target.startsWith('static/readme/legacy/')), false, `${file} should not display legacy README screenshots`);
      assert.equal(imageTargets.includes('static/readme/showcase.png'), false, `${file} should not display the retired composite showcase`);
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

      for (const reference of collectMarkdownReferences(markdown)) {
        const [localPath, hash = ''] = reference.target.split('#');
        const target = localReferenceTarget(reference.target);
        if (target) {
          assert.equal(exists(target), true, `${file} ${reference.kind} should exist: ${target}`);
        }
        if (hash) {
          const anchorSource = localPath ? readUtf8(localPath) : markdown;
          const anchorSet = localPath ? readmeAnchors(anchorSource) : anchors;
          assert.equal(anchorSet.has(decodeURIComponent(hash).toLowerCase()), true, `${file} anchor should exist: ${reference.target}`);
        }
      }
    }
  });

  it('recognizes Markdown inline links and images as local README references', () => {
    const markdown = [
      '[License](LICENSE)',
      '![Library](static/readme/current-library.png)',
      '[External](https://example.com)',
      '`[Ignored](missing.md)`',
    ].join('\n');

    assert.deepEqual(collectMarkdownReferences(markdown), [
      { kind: 'link', target: 'LICENSE' },
      { kind: 'image', target: 'static/readme/current-library.png' },
    ]);
  });

  it('collects README image targets from HTML and Markdown markup', () => {
    const markdown = [
      '<img src="static/readme/current-library.png" alt="Library" />',
      '![Style](static/readme/current-style.png)',
      '[Plain link](static/readme/not-an-image.png)',
    ].join('\n');

    assert.deepEqual(collectReadmeImageTargets(markdown), [
      'static/readme/current-library.png',
      'static/readme/current-style.png',
    ]);
  });

  it('reads PNG dimensions from the image header', () => {
    const png = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
    png.writeUInt32BE(1800, 16);
    png.writeUInt32BE(1100, 20);

    assert.deepEqual(readPngInfo(png), {
      byteLength: 24,
      width: 1800,
      height: 1100,
    });
  });
});
