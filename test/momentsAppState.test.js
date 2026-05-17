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
      attachments: [{
        file_id: 'Moments/2026-05-17/b.jpg',
        metadata: { file_name: 'b.jpg', file_type: 'image/jpeg', width: 640, height: 480 },
      }],
    }]);

    assert.equal(posts[0].createdAt, '2026-05-17T08:00:00.000Z');
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
      attachments: [
        { source: 'existing', fileId: 'Photos/2026-05-16/a.jpg' },
        { source: 'upload', file: { name: 'b.jpg' } },
      ],
    });

    assert.deepEqual(payload.existingFileIds, ['Photos/2026-05-16/a.jpg']);
    assert.equal(payload.uploadFiles.length, 1);
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
    assert.match(appSource, /new FormData\(\)/);
    assert.match(appSource, /URL\.createObjectURL\(/);
    assert.match(appSource, /URL\.revokeObjectURL\(/);
  });

  it('skips the full library sync on the critical path when mounting directly into Moments', () => {
    assert.match(appSource, /if \(state\.primaryFilter === 'Moments' && !state\.momentsHydrated && !state\.momentsLoading\) \{/);
    assert.match(appSource, /void loadMoments\(\{ forceRender: false \}\)/);
    assert.match(appSource, /if \(state\.primaryFilter !== 'Moments'\) \{\s*syncLiveMedia\(\{ forceRender: false \}\);/);
  });
});
