import assert from 'node:assert/strict';
import fs from 'node:fs';

describe('mind visit-side persistence', () => {
  it('keeps current-visit web messages on the right until Mind is actually left', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /let mindVisitStickyMessages = \[\];/);
    assert.match(appSource, /function isMindMessageStickyForVisit/);
    assert.match(appSource, /forceRight: isMindMessageStickyForVisit\(message, stickyMessages\)/);
    assert.match(appSource, /function clearMindVisitStickyMessages\(\)/);
    assert.match(appSource, /const leavingMind = state\.primaryFilter === 'Mind'/);
    assert.match(appSource, /if \(state\.primaryFilter !== 'Mind'\) \{\s*clearMindVisitStickyMessages\(\);/);
  });

  it('serializes the next-visit mirror behind the same Mind mutation queue', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /function enqueueMindMutation\(task\)/);
    assert.match(appSource, /mindMirrorPromise = enqueueMindMutation\(\(\) => postJson\('\/api\/manage\/mind', \{ action: 'mirror' \}\)\)/);
  });

  it('resolves photo-backed wallpaper URLs before falling back to uploaded wallpaper data', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /const wallpaperItem = resolveMindWallpaperItem\(settings\);/);
    assert.match(appSource, /if \(wallpaperItem\) \{/);
    assert.match(appSource, /return normalizeText\(wallpaperItem\.sourceUrl \|\| wallpaperItem\.thumbnailUrl \|\| ''\);/);
    assert.match(appSource, /return normalizeText\(settings\?\.backgroundImageData\);/);
  });

  it('keeps photo wallpaper selection as an id-only draft choice', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /backgroundPhotoId: normalizeText\(actionTarget\.dataset\.id\),/);
    assert.match(appSource, /backgroundImageData: ''/);
  });
});
