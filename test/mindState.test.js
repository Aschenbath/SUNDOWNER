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

  it('preserves a data-url wallpaper fallback when saving a photo-backed Mind wallpaper', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /async function captureMindWallpaperDataFromItem\(item\) \{/);
    assert.match(appSource, /if \(optimisticSettings\.backgroundPhotoId && !optimisticSettings\.backgroundImageData\) \{/);
    assert.match(appSource, /optimisticSettings\.backgroundImageData = await captureMindWallpaperDataFromItem\(wallpaperItem\);/);
  });

  it('prefers uploaded wallpaper data over photo-backed wallpaper sources', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /const uploadedWallpaper = normalizeText\(settings\?\.backgroundImageData\);/);
    assert.match(appSource, /if \(uploadedWallpaper\) \{/);
    assert.match(appSource, /return uploadedWallpaper;/);
    assert.match(appSource, /const wallpaperItem = resolveMindWallpaperItem\(settings\);/);
  });

  it('eagerly captures selected photo wallpapers into backgroundImageData', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /void captureMindWallpaperDataFromItem\(wallpaperItem\)/);
    assert.match(appSource, /backgroundImageData: dataUrl/);
  });

  it('blocks photo-backed saves when the selected wallpaper item cannot be resolved', () => {
    const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

    assert.match(appSource, /if \(!wallpaperItem\) \{/);
    assert.match(appSource, /showToast\('Please reselect the wallpaper photo before saving'\);/);
  });
});
