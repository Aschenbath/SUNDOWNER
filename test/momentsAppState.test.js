import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  buildMomentAttachmentItem,
  buildMomentMutationPayload,
  deriveMomentCalendarMonth,
  normalizeMomentDraftAttachments,
  normalizeMomentPosts,
} from '../js/media-library/moments-state.js';

const appSource = fs.readFileSync(new URL('../js/media-library/app.js', import.meta.url), 'utf8');

describe('Moments app helpers', () => {
  it('normalizes posts and maps attachments to media preview items', () => {
    const posts = normalizeMomentPosts([{
      id: 'moment-1',
      body: 'hello',
      createdAt: '2026-05-16T20:15:00.000Z',
      attachments: [{
        fileId: 'Moments/2026-05-16/a space.jpg',
        metadata: { FileName: 'a space.jpg', FileType: 'image/jpeg', Width: 800, Height: 600 },
      }],
    }]);

    assert.equal(posts[0].date, '2026-05-16');
    assert.equal(posts[0].attachments[0].item.id, 'Moments/2026-05-16/a space.jpg');
    assert.equal(posts[0].attachments[0].item.thumbnailUrl, '/file/Moments/2026-05-16/a%20space.jpg');
    assert.equal(posts[0].attachments[0].item.type, 'photo');
  });

  it('accepts snake_case API payloads and preserves raw file ids', () => {
    const posts = normalizeMomentPosts([{
      id: 'moment-2',
      body: 'snake',
      created_at: '2026-05-17T08:00:00.000Z',
      moment_date: '2026-05-10',
      attachments: [{
        file_id: 'Moments/2026-05-17/b.jpg',
        metadata: { file_name: 'b.jpg', file_type: 'image/jpeg', width: 640, height: 480 },
      }],
    }]);

    assert.equal(posts[0].createdAt, '2026-05-17T08:00:00.000Z');
    assert.equal(posts[0].date, '2026-05-10');
    assert.equal(posts[0].momentDate, '2026-05-10');
    assert.equal(posts[0].attachments[0].fileId, 'Moments/2026-05-17/b.jpg');
    assert.equal(posts[0].attachments[0].item.id, 'Moments/2026-05-17/b.jpg');
    assert.equal(posts[0].attachments[0].item.label, 'b.jpg');
  });

  it('derives the calendar month from selected date', () => {
    assert.equal(deriveMomentCalendarMonth('2026-05-16'), '2026-05');
    assert.equal(deriveMomentCalendarMonth('bad'), new Date().toISOString().slice(0, 7));
  });

  it('builds attachment preview items with labels and dimensions', () => {
    const item = buildMomentAttachmentItem({
      fileId: 'photo.jpg',
      metadata: { FileName: 'Photo', FileType: 'image/jpeg', Width: 100, Height: 50 },
    });
    assert.equal(item.id, 'photo.jpg');
    assert.equal(item.label, 'Photo');
    assert.equal(item.width, 100);
    assert.equal(item.height, 50);
  });

  it('uses preview thumbnails for unsupported image formats while keeping the original source url', () => {
    const item = buildMomentAttachmentItem({
      fileId: 'Moments/2026-05-17/flower.heic',
      metadata: { FileName: 'flower.heic', FileType: 'image/heic' },
    });

    assert.equal(item.sourceUrl, '/file/Moments/2026-05-17/flower.heic');
    assert.equal(item.thumbnailUrl, '/file/Moments/2026-05-17/flower.heic?preview=1');
    assert.equal(item.browserPreviewSupported, false);
  });

  it('normalizes mixed draft attachments from upload and existing sources', () => {
    const draft = normalizeMomentDraftAttachments([
      { source: 'existing', fileId: 'Photos/2026-05-16/a.jpg', metadata: { FileName: 'a.jpg', FileType: 'image/jpeg' } },
      { source: 'upload', name: 'b.jpg', previewUrl: 'blob:preview-b' },
    ]);

    assert.equal(draft.length, 2);
    assert.equal(draft[0].source, 'existing');
    assert.equal(draft[0].fileId, 'Photos/2026-05-16/a.jpg');
    assert.equal(draft[1].source, 'upload');
    assert.equal(draft[1].previewUrl, 'blob:preview-b');
  });

  it('builds edit payloads from current draft attachment state', () => {
    const payload = buildMomentMutationPayload({
      body: 'edited',
      date: '2026-04-30',
      attachments: [
        { source: 'existing', fileId: 'Photos/2026-05-16/a.jpg' },
        { source: 'upload', file: { name: 'b.jpg' } },
      ],
    });

    assert.equal(payload.date, '2026-04-30');
    assert.deepEqual(payload.existingFileIds, ['Photos/2026-05-16/a.jpg']);
    assert.equal(payload.uploadFiles.length, 1);
  });

  it('keeps attachment order in the final mutation payload', () => {
    const payload = buildMomentMutationPayload({
      body: 'ordered',
      attachments: [
        { source: 'existing', fileId: 'Photos/2026-05-16/b.jpg' },
        { source: 'existing', fileId: 'Photos/2026-05-16/a.jpg' },
      ],
    });

    assert.deepEqual(payload.existingFileIds, [
      'Photos/2026-05-16/b.jpg',
      'Photos/2026-05-16/a.jpg',
    ]);
  });

  it('wires the Moments route, actions, loading, and preview item source in app.js', () => {
    assert.match(appSource, /MomentsView\(/);
    assert.match(appSource, /isMomentsView/);
    assert.match(appSource, /\/api\/manage\/moments/);
    assert.match(appSource, /choose-moment-photos/);
    assert.match(appSource, /publish-moment/);
    assert.match(appSource, /select-moments-date/);
    assert.match(appSource, /change-moments-month/);
    assert.match(appSource, /delete-moment/);
    assert.match(appSource, /getMomentAttachmentItems\(\)/);
    assert.match(appSource, /#\/moments/);
    assert.match(appSource, /loadMoments\(\{ forceRender: true \}\)/);
    assert.match(appSource, /data-moments-draft-input/);
    assert.match(appSource, /state\.momentsDraftBody = input\.value/);
    assert.match(appSource, /state\.momentsDraftDate = input\.value/);
    assert.match(appSource, /dragstart/);
    assert.match(appSource, /let draggedMomentDraftIndex = -1;/);
    assert.match(appSource, /new FormData\(\)/);
    assert.match(appSource, /URL\.createObjectURL\(/);
    assert.match(appSource, /URL\.revokeObjectURL\(/);
  });

  it('skips the full library sync on the critical path when mounting directly into Moments', () => {
    assert.match(appSource, /if \(state\.primaryFilter === 'Moments' && !state\.momentsHydrated && !state\.momentsLoading\) \{/);
    assert.match(appSource, /loadJson\(MOMENTS_CACHE_KEY, null\)/);
    assert.match(appSource, /saveJson\(MOMENTS_CACHE_KEY,/);
    assert.match(appSource, /void loadMoments\(\{ forceRender: false \}\)/);
    assert.match(appSource, /if \(state\.primaryFilter !== 'Moments'\) \{\s*syncLiveMedia\(\{ forceRender: false \}\);/);
    assert.match(appSource, /await loadMoments\(\{ forceRender: false, background: true \}\)/);
    assert.match(appSource, /if \(state\.momentsHydrated\) \{\s*render\(\);\s*void loadMoments\(\{ forceRender: false, background: true \}\);/);
  });

  it('keeps the Moments photo picker lazy and patches selection without a full page render', () => {
    assert.match(appSource, /let momentsPickerItemsCache = \[\];/);
    assert.match(appSource, /function getMomentsPickerItemsSignature\(\)/);
    assert.match(appSource, /function patchMomentPickerSelection\(\)/);
    assert.match(appSource, /pickerItems: state\.momentsPickerOpen \? getMomentPickerItems\(\) : \[\]/);
    assert.match(appSource, /if \(!patchMomentPickerSelection\(\)\) \{\s*render\(\);\s*\}/);
    assert.doesNotMatch(appSource, /momentDayItems:/);
    assert.doesNotMatch(appSource, /function buildMomentDayItems/);
  });

  it('patches Moments calendar date changes without refreshing the full route', () => {
    assert.match(appSource, /function patchMomentsSelectedDateView\(\)/);
    assert.match(appSource, /renderMomentsCalendar/);
    assert.match(appSource, /renderMomentsDayWall/);
    assert.match(appSource, /data-moments-stat="selected-date"/);
    assert.match(appSource, /case 'select-moments-date':[\s\S]*?setMomentSelectedDate\(actionTarget\.dataset\.date, \{ syncMonth: true \}\);[\s\S]*?if \(!patchMomentsSelectedDateView\(\)\) \{\s*render\(\);\s*\}[\s\S]*?return true;/);
    assert.match(appSource, /case 'change-moments-month':[\s\S]*?if \(!patchMomentsCalendar\(\)\) \{\s*render\(\);\s*\}[\s\S]*?return true;/);
  });

  it('keeps Moment edits in the source card and includes the editable date in saves', () => {
    assert.match(appSource, /momentsDraftDate/);
    assert.match(appSource, /function startEditingMoment\(post\)[\s\S]*?state\.momentsDraftDate = normalizeText\(post\.date\)/);
    assert.match(appSource, /function buildMomentFormData\(\)[\s\S]*?date: state\.momentsDraftDate \|\| state\.momentsSelectedDate/);
    assert.match(appSource, /formData\.set\('date', payload\.date\)/);
    assert.match(appSource, /function patchMomentsPostCard\(postId = ''\)/);
    assert.match(appSource, /renderMomentsFeed\(\{[\s\S]*?posts: \[post\]/);
    assert.match(appSource, /editingPostId: state\.momentsEditingPostId/);
  });

  it('progressively hydrates the Photos index instead of blocking first paint on every page', () => {
    assert.match(appSource, /const firstPayload = await fetchListPage\(0, INITIAL_PHOTOS_PAGE_SIZE\)/);
    assert.match(appSource, /const initialItems = firstFiles/);
    assert.match(appSource, /scheduleDeferredStartupTask\(async \(\) => \{/);
    assert.match(appSource, /sortBy: 'timestamp'/);
    assert.match(appSource, /sortOrder: 'desc'/);
    assert.match(appSource, /const seenFileIds = new Set/);
    assert.match(appSource, /addedCount === 0/);
    assert.match(appSource, /persistMediaPayload\(/);
    assert.match(appSource, /state\.mediaItems = fullItems/);
    assert.match(appSource, /state\.librarySyncMeta = \{/);
    assert.match(appSource, /render\(\);/);
    assert.match(appSource, /const INITIAL_PHOTOS_PAGE_SIZE = 200/);
    assert.match(appSource, /void loadPersistedAlbumState\(\{ forceRender: false \}\)/);
    assert.match(appSource, /void loadPersistedPlaylistState\(\{ forceRender: false \}\)/);
    assert.match(appSource, /void loadMovieEntries\(\{ forceRender: false \}\)/);
  });

  it('keeps cached Photos visible and stops loading when the live list request fails', () => {
    assert.match(appSource, /const MEDIA_PAYLOAD_CACHE_KEY = 'codex-media-library-media-payload-cache';/);
    assert.match(appSource, /function readCachedMediaPayload\(\) \{/);
    assert.match(appSource, /function persistMediaPayload\(payload = \{\}\) \{/);
    assert.match(appSource, /const cachedMediaPayload = readCachedMediaPayload\(\);/);
    assert.match(appSource, /if \(cachedMediaPayload\?\.items\?\.length && !state\.mediaItems\.length\) \{/);
    assert.match(appSource, /state\.librarySyncMeta = \{\s*\.\.\.cachedMediaPayload\.librarySyncMeta,\s*source: 'cache'/);
    assert.match(appSource, /const hasFallbackItems = items\.length > 0;/);
    assert.match(appSource, /const shouldKeepLoading = !hasFallbackItems/);
  });

  it('keeps the topbar storage summary aligned with loaded Photos when quota metadata is empty', () => {
    assert.match(appSource, /function buildLoadedMediaStorageSummaryFallback\(baseSummary = state\.storageSummary\) \{/);
    assert.match(appSource, /const loadedItems = safeArray\(state\.mediaItems\);/);
    assert.match(appSource, /loadedItems\.reduce\(\(sum, item\) => sum \+ Math\.max\(0, Number\(item\?\.sizeMb\) \|\| 0\), 0\)/);
    assert.match(appSource, /const shouldUseLoadedFallback = loadedFallback\.totalCount > 0[\s\S]*?&& nextSummary\.totalCount === 0[\s\S]*?&& nextSummary\.usedMb === 0;/);
    assert.match(appSource, /nextSummary = shouldUseLoadedFallback \? loadedFallback : nextSummary;/);
    assert.match(appSource, /state\.isLibraryLoading = false;\s*primeStorageSummaryFromLoadedMedia\(\);\s*void syncStorageSummary\(\{ forceRender: false \}\);/);
  });

  it('primes the storage topbar from loaded Photos before waiting on quota requests', () => {
    assert.match(appSource, /function primeStorageSummaryFromLoadedMedia\(\) \{/);
    assert.match(appSource, /const loadedSummary = buildLoadedMediaStorageSummaryFallback\(state\.storageSummary\);/);
    assert.match(appSource, /const nextSummary = buildStorageSummaryUpdate\(\{[\s\S]*?usedMb: Math\.max\(state\.storageSummary\.usedMb, loadedSummary\.usedMb\),[\s\S]*?totalCount: Math\.max\(state\.storageSummary\.totalCount, loadedSummary\.totalCount\),/);
    assert.match(appSource, /if \(sameStorageSummary\(state\.storageSummary, nextSummary\)\) \{/);
    assert.match(appSource, /state\.storageSummary = nextSummary;/);
    assert.match(appSource, /const topbarPatched = patchTopbarStorageTrigger\(\);/);
    assert.match(appSource, /state\.mediaItems = items;\s*changed = true;\s*primeStorageSummaryFromLoadedMedia\(\);\s*void syncStorageSummary\(\);/);
    assert.match(appSource, /state\.mediaItems = fullItems;\s*state\.librarySyncMeta = nextLibrarySyncMeta;\s*state\.isLibraryLoading = false;\s*primeStorageSummaryFromLoadedMedia\(\);\s*void syncStorageSummary\(\{ forceRender: false \}\);/);
  });

  it('shows loaded Telegram previews clearly while the full photo keeps loading', () => {
    assert.match(appSource, /function revealLoadedPreviewImage\(img, tile\) \{/);
    assert.match(appSource, /img\.classList\.remove\('is-blur-placeholder'\);/);
    assert.match(appSource, /tile\.classList\.add\('is-preview-loaded'\);/);
    assert.match(appSource, /if \(fullSrc && img\.src !== fullSrc\) \{[\s\S]*?revealLoadedPreviewImage\(img, tile\);[\s\S]*?swapTileToFullImage\(img, tile, fullSrc\);[\s\S]*?return;/);
    assert.match(appSource, /img\.addEventListener\('load', function onBlurLoad\(\) \{[\s\S]*?revealLoadedPreviewImage\(img, tile\);[\s\S]*?swapTileToFullImage\(img, tile, fullSrc\);/);
  });
});
