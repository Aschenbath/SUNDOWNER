import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseOrigin = process.env.README_SCREENSHOT_BASE_URL || 'http://127.0.0.1:8787';
const username = process.env.README_SCREENSHOT_USER || 'readme-admin';
const password = process.env.README_SCREENSHOT_PASS || 'readme-password';
const outDir = resolve('static/readme');
const profileDir = process.env.README_SCREENSHOT_PROFILE || 'D:\\Codex\\tmp_toDel\\_chrome\\sundowner-readme-shots';
const cdpPort = Number(process.env.README_SCREENSHOT_CDP_PORT || 9227);

const screenshotTargets = [
  {
    file: 'current-library.png',
    prep: `
      (() => {
        const photoButton = Array.from(document.querySelectorAll('button, a, [role="button"], .cml-sidebar__item'))
          .find((el) => (el.textContent || '').trim().includes('Photos'));
        photoButton?.click();
        document.querySelector('.cml-main-content')?.scrollTo?.(0, 0);
        return true;
      })()
    `,
    wait: `document.querySelectorAll('.cml-media-tile').length >= 3`,
  },
  {
    file: 'current-style.png',
    prep: `
      (() => {
        const button = Array.from(document.querySelectorAll('button, a, [role="button"], [data-action]'))
          .find((el) => ((el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '')).includes('Style'));
        button?.click();
        return true;
      })()
    `,
    wait: `document.body.innerText.includes('THEME COLOR')`,
  },
  {
    file: 'current-films.png',
    prep: `
      (() => {
        const button = Array.from(document.querySelectorAll('button, a, [role="button"], .cml-sidebar__item'))
          .find((el) => (el.textContent || '').trim().includes('Films'));
        button?.click();
        document.querySelector('.cml-main-content')?.scrollTo?.(0, 0);
        return true;
      })()
    `,
    wait: `document.querySelectorAll('[data-film-id]').length >= 2 || document.body.innerText.includes('README Noir')`,
  },
  {
    file: 'current-moments.png',
    prep: `
      (() => {
        const button = Array.from(document.querySelectorAll('button, a, [role="button"], .cml-sidebar__item'))
          .find((el) => (el.textContent || '').trim().includes('Moments'));
        button?.click();
        document.querySelector('.cml-main-content')?.scrollTo?.(0, 0);
        return true;
      })()
    `,
    wait: `document.body.innerText.includes('README capture') || document.querySelectorAll('.cml-moments-post, [data-moment-id]').length >= 1`,
  },
];

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function svgAsset({ title, subtitle, colors }) {
  const [a, b, c, d] = colors;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 950" role="img" aria-label="${title}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${a}"/>
      <stop offset="45%" stop-color="${b}"/>
      <stop offset="100%" stop-color="${c}"/>
    </linearGradient>
    <radialGradient id="sun" cx="72%" cy="22%" r="42%">
      <stop offset="0%" stop-color="${d}" stop-opacity=".95"/>
      <stop offset="60%" stop-color="${d}" stop-opacity=".24"/>
      <stop offset="100%" stop-color="${d}" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="18"/>
    </filter>
  </defs>
  <rect width="1400" height="950" fill="url(#bg)"/>
  <rect width="1400" height="950" fill="url(#sun)"/>
  <path d="M0 675 C180 610 320 720 470 660 C610 604 760 475 950 560 C1135 642 1250 560 1400 600 L1400 950 L0 950 Z" fill="#0f172a" opacity=".36"/>
  <path d="M0 735 C210 680 330 785 505 725 C690 660 840 580 1050 655 C1195 706 1275 690 1400 652 L1400 950 L0 950 Z" fill="#f8fafc" opacity=".32"/>
  <g filter="url(#soft)" opacity=".45">
    <circle cx="210" cy="180" r="95" fill="#ffffff"/>
    <circle cx="1175" cy="740" r="130" fill="#ffffff"/>
  </g>
  <g transform="translate(420 112)">
    <rect x="0" y="0" width="560" height="210" rx="34" fill="#ffffff" opacity=".84"/>
    <text x="280" y="86" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="52" font-weight="800" fill="#111827">${title}</text>
    <text x="280" y="142" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="28" fill="#334155">${subtitle}</text>
  </g>
  <g transform="translate(575 405)" opacity=".82">
    <rect x="0" y="0" width="250" height="250" rx="36" fill="#ffffff"/>
    <path d="M56 154 L112 92 L158 138 L184 112 L218 154 Z" fill="${a}" opacity=".9"/>
    <circle cx="88" cy="74" r="24" fill="${d}" opacity=".9"/>
  </g>
</svg>`;
}

const demoAssets = [
  {
    fileName: 'readme-horizon.svg',
    title: 'Horizon Archive',
    subtitle: 'photos / tags / search',
    description: 'Neutral demo image generated by the README screenshot script.',
    dateTaken: '2026-06-28T08:20:00+08:00',
    colors: ['#7dd3fc', '#a7f3d0', '#fde68a', '#fb7185'],
  },
  {
    fileName: 'readme-neon-room.svg',
    title: 'Neon Room',
    subtitle: 'albums / moments',
    description: 'Privacy-safe local fixture for product screenshots.',
    dateTaken: '2026-06-29T20:12:00+08:00',
    colors: ['#818cf8', '#f0abfc', '#fca5a5', '#fde047'],
  },
  {
    fileName: 'readme-field-notes.svg',
    title: 'Field Notes',
    subtitle: 'metadata / recovery',
    description: 'Synthetic media item used only for README captures.',
    dateTaken: '2026-06-30T17:42:00+08:00',
    colors: ['#34d399', '#60a5fa', '#c4b5fd', '#f59e0b'],
  },
];

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${payload?.error || payload?.message || await response.text().catch(() => '')}`);
  }
  return payload;
}

async function waitForServer() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`${baseOrigin}/login`, { redirect: 'manual' });
      if (response.status > 0) return;
    } catch {
      await delay(250);
    }
  }
  throw new Error(`Local server did not answer at ${baseOrigin}`);
}

async function getAdminCookie() {
  const response = await fetch(`${baseOrigin}/api/manage/auth-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error(`auth-session failed: ${response.status} ${await response.text()}`);
  }
  const setCookie = response.headers.get('set-cookie') || '';
  const match = setCookie.match(/admin_auth=([^;]+)/);
  if (!match) {
    throw new Error(`auth-session did not return admin_auth cookie: ${setCookie}`);
  }
  return `admin_auth=${match[1]}`;
}

function encodeMetadataPath(fileId) {
  return String(fileId || '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join(',');
}

function fileIdFromSrc(src) {
  const marker = '/file/';
  const index = String(src || '').indexOf(marker);
  return index >= 0 ? decodeURIComponent(src.slice(index + marker.length)) : '';
}

async function apiJson(cookie, path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Cookie', cookie);
  return fetchJson(`${baseOrigin}${path}`, { ...options, headers });
}

async function uploadDemoAsset(cookie, asset) {
  const form = new FormData();
  const svg = svgAsset(asset);
  form.set('file', new File([svg], asset.fileName, { type: 'image/svg+xml' }));

  const payload = await apiJson(cookie, '/upload?uploadChannel=cfr2&uploadFolder=README%20Demo&returnFormat=default&autoRetry=false', {
    method: 'POST',
    body: form,
  });
  const src = payload?.[0]?.src || '';
  const fileId = fileIdFromSrc(src);
  if (!fileId) {
    throw new Error(`Upload did not return a file id for ${asset.fileName}`);
  }

  await apiJson(cookie, `/api/manage/metadata/${encodeMetadataPath(fileId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Title: asset.title,
      Description: asset.description,
      DateTaken: asset.dateTaken,
      Directory: 'README Demo/',
    }),
  });

  return { ...asset, fileId, src };
}

async function seedDemoContent(cookie) {
  const uploaded = [];
  for (const asset of demoAssets) {
    uploaded.push(await uploadDemoAsset(cookie, asset));
  }

  const momentForm = new FormData();
  momentForm.set('body', 'README capture: local demo media, D1 moments, and privacy-safe fixture data.');
  momentForm.set('date', '2026-06-30');
  momentForm.append('existingFileIds[]', uploaded[0].fileId);
  momentForm.append('existingFileIds[]', uploaded[1].fileId);
  await apiJson(cookie, '/api/manage/moments', {
    method: 'POST',
    body: momentForm,
  });

  const filmPayloads = [
    {
      source: 'manual',
      id: 'readme-noir',
      title: 'README Noir',
      originalTitle: 'README Noir',
      director: 'Local Fixture',
      releaseDate: '2026-06-30',
      runtime: 96,
      genres: ['Archive', 'Design'],
      country: 'Local',
      language: 'Demo',
      overview: 'A privacy-safe manual film entry used to prove the current Films surface.',
      watchStatus: 'watched',
      userRating: 4.8,
      watchedAt: '2026-06-30',
      isFavorite: true,
      posterUrlOverride: uploaded[1].src,
      backdropUrlOverride: uploaded[2].src,
      noteMarkdown: 'Captured from a local Wrangler run with generated demo media.',
    },
    {
      source: 'manual',
      id: 'sync-at-dawn',
      title: 'Sync at Dawn',
      originalTitle: 'Sync at Dawn',
      director: 'Fixture Studio',
      releaseDate: '2026-06-29',
      runtime: 82,
      genres: ['Cloudflare', 'Recovery'],
      country: 'Local',
      language: 'Demo',
      overview: 'A second neutral entry so the Films page has real density.',
      watchStatus: 'wantToWatch',
      userRating: 4.2,
      posterUrlOverride: uploaded[0].src,
      backdropUrlOverride: uploaded[0].src,
      noteMarkdown: 'No user data, no upstream screenshots.',
    },
  ];

  for (const payload of filmPayloads) {
    await apiJson(cookie, '/api/manage/movies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  return uploaded;
}

async function waitForCdp() {
  const url = `http://127.0.0.1:${cdpPort}/json/version`;
  for (let i = 0; i < 80; i += 1) {
    try {
      return await fetchJson(url);
    } catch {
      await delay(250);
    }
  }
  throw new Error('Chrome CDP endpoint did not start');
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve: resolvePending, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolvePending(message.result);
    }
  });
  return new Promise((resolveConnect, reject) => {
    ws.addEventListener('open', () => {
      resolveConnect({
        send(method, params = {}) {
          const messageId = ++id;
          ws.send(JSON.stringify({ id: messageId, method, params }));
          return new Promise((resolvePending, rejectPending) => {
            pending.set(messageId, { resolve: resolvePending, reject: rejectPending });
          });
        },
        close() {
          ws.close();
        },
      });
    });
    ws.addEventListener('error', reject);
  });
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(`Evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
  }
  return result.result?.value;
}

async function waitForExpression(client, expression, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(client, expression)) return;
    await delay(250);
  }
  throw new Error(`Timed out waiting for expression: ${expression}`);
}

async function capture(client, filename) {
  await delay(900);
  const result = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const target = resolve(outDir, filename);
  writeFileSync(target, Buffer.from(result.data, 'base64'));
  console.log(target);
}

async function captureScreenshots(cookie) {
  mkdirSync(outDir, { recursive: true });
  rmSync(profileDir, { recursive: true, force: true });
  mkdirSync(profileDir, { recursive: true });

  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-extensions',
    '--hide-scrollbars',
    '--window-size=1800,1100',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  try {
    const version = await waitForCdp();
    const browser = await connect(version.webSocketDebuggerUrl);
    const target = await browser.send('Target.createTarget', { url: 'about:blank' });
    const pages = await fetchJson(`http://127.0.0.1:${cdpPort}/json/list`);
    const pageInfo = pages.find((item) => item.id === target.targetId);
    const page = await connect(pageInfo.webSocketDebuggerUrl);
    const cookieValue = cookie.replace(/^admin_auth=/, '');

    await page.send('Page.enable');
    await page.send('Network.enable');
    await page.send('Runtime.enable');
    await page.send('Network.setCookie', {
      name: 'admin_auth',
      value: cookieValue,
      url: `${baseOrigin}/`,
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
    });
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: 1800,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await page.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: 'light' }],
    });
    await page.send('Page.navigate', { url: `${baseOrigin}/dashboard` });
    await waitForExpression(page, `document.body && document.body.innerText.includes('SUNDOWNER')`);
    await waitForExpression(page, `document.readyState === 'complete' || document.readyState === 'interactive'`);
    await delay(2500);

    for (const targetShot of screenshotTargets) {
      await evaluate(page, targetShot.prep);
      await waitForExpression(page, targetShot.wait);
      await capture(page, targetShot.file);
    }

    page.close();
    browser.close();
  } finally {
    chrome.kill();
  }
}

await waitForServer();
const cookie = await getAdminCookie();
await seedDemoContent(cookie);
await captureScreenshots(cookie);
