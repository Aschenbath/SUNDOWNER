import assert from 'node:assert/strict';

import { navigationModel } from '../js/media-library/data.js';
import * as components from '../js/media-library/components.js';

const { MomentsView, Sidebar } = components;

const posts = [{
  id: 'moment-1',
  body: '今天云很好看',
  createdAt: '2026-05-16T20:15:00.000Z',
  date: '2026-05-16',
  attachments: [{
    fileId: 'Moments/2026-05-16/cloud space.jpg',
    metadata: { FileName: 'cloud space.jpg', FileType: 'image/jpeg' },
  }],
}];

const hydratedPosts = [{
  id: 'moment-1-hydrated',
  body: '今天云还是很好看',
  createdAt: '2026-05-16T21:00:00.000Z',
  date: '2026-05-16',
  attachments: [{
    item: {
      id: 'photo-1',
      type: 'photo',
      label: 'golden hour.jpg',
      thumbnailUrl: '/thumbs/golden-hour.jpg?size=480&name=golden hour.jpg',
      sourceUrl: '/source/golden hour.jpg?download=1&x="quoted"',
    },
    metadata: { FileName: 'golden hour.jpg', FileType: 'image/jpeg' },
  }],
}];

const telegramImportedPosts = [{
  id: 'moment-telegram-1',
  body: 'test',
  createdAt: '2026-05-17T10:50:00.000Z',
  date: '2026-05-17',
  attachments: [{
    item: {
      id: 'tg_photo_1',
      type: 'photo',
      label: 'IMG_1565.JPG',
      thumbnailUrl: '/file/tg_photo_1?preview=1',
      sourceUrl: '/file/tg_photo_1',
      mimeType: 'image/jpeg',
      browserPreviewSupported: true,
    },
    metadata: { FileName: 'IMG_1565.JPG', FileType: 'image/jpeg', ListType: 'None' },
  }],
}];

describe('Moments components', () => {
  it('adds Moments to primary navigation', () => {
    assert.ok(navigationModel.primary.includes('Moments'));
  });

  it('exports MomentsView', () => {
    assert.equal(typeof MomentsView, 'function');
  });

  it('renders a Moments sidebar item', () => {
    const html = Sidebar({
      navigationModel,
      state: { primaryFilter: 'Moments', secondaryFilter: '', privateViewOpen: false },
      storageSummary: { usedMb: 0, totalCount: 0, isLoading: false },
    });
    assert.match(html, /data-primary="Moments"/);
    assert.match(html, /aria-current="page"/);
  });

  it('renders composer, calendar, day wall, and post feed', () => {
    const html = MomentsView({
      posts,
      isLoading: false,
      isPublishing: false,
      draftBody: 'draft',
      draftAttachments: [{ name: 'local.jpg', previewUrl: 'blob:local', source: 'upload' }],
      selectedDate: '2026-05-16',
      calendarMonth: '2026-05',
      datesWithPhotos: { '2026-05-16': 1 },
      authorName: 'Aschenbath',
      authorAvatarData: '',
      error: '',
    });

    assert.match(html, /data-moments-view/);
    assert.match(html, /Private journal/);
    assert.match(html, /cml-moments__stats/);
    assert.match(html, /<strong>1<\/strong><em>Posts<\/em>/);
    assert.match(html, /data-moments-composer/);
    assert.match(html, /data-moments-draft-input/);
    assert.match(html, /cml-moments-composer__toolbar/);
    assert.match(html, /data-action="choose-moment-photos"/);
    assert.match(html, /data-action="publish-moment"/);
    assert.match(html, /data-moments-calendar/);
    assert.match(html, /data-action="select-moments-date"/);
    assert.match(html, /data-moments-day-wall/);
    assert.match(html, /今天云很好看/);
    assert.match(html, /Aschenbath/);
    assert.match(html, /cml-moment-card__actions/);
    assert.match(html, /cml-moment-card__stamp/);
    assert.match(html, /cml-moment-card__footer/);
    assert.match(html, /data-action="edit-moment"/);
    assert.match(html, /data-action="delete-moment"/);
    assert.match(html, /data-action="open-preview"/);
    assert.match(html, /data-id="Moments\/2026-05-16\/cloud space\.jpg"/);
    assert.match(html, /data-preview-source="\/file\/Moments\/2026-05-16\/cloud%20space\.jpg"/);
    assert.match(html, /src="\/file\/Moments\/2026-05-16\/cloud%20space\.jpg"/);
    assert.doesNotMatch(html, /src="\/file\/Moments%2F2026-05-16%2Fcloud%20space\.jpg"/);
    assert.doesNotMatch(html, /data-preview-source="\/file\/Moments%2F2026-05-16%2Fcloud%20space\.jpg"/);
    assert.match(html, /cloud space.jpg/);
    assert.match(html, /draft/);
    assert.match(html, /local.jpg/);
  });

  it('uses hydrated attachment sourceUrl as the preview source hint with escaping', () => {
    const html = MomentsView({
      posts: hydratedPosts,
      isLoading: false,
      isPublishing: false,
      draftBody: '',
      draftFiles: [],
      selectedDate: '2026-05-16',
      calendarMonth: '2026-05',
      datesWithPhotos: { '2026-05-16': 1 },
      authorName: 'Aschenbath',
      authorAvatarData: '',
      error: '',
    });

    assert.match(html, /data-id="photo-1"/);
    assert.match(html, /data-preview-source="\/source\/golden hour\.jpg\?download=1&amp;x=&quot;quoted&quot;"/);
    assert.match(html, /src="\/thumbs\/golden-hour\.jpg\?size=480&amp;name=golden hour\.jpg"/);
  });

  it('shows publish failure while preserving draft markup', () => {
    const html = MomentsView({
      posts: [],
      isLoading: false,
      isPublishing: false,
      draftBody: 'retry me',
      draftAttachments: [{ name: 'keep.jpg', previewUrl: 'blob:keep', source: 'upload' }],
      selectedDate: '2026-05-16',
      calendarMonth: '2026-05',
      datesWithPhotos: {},
      authorName: 'Aschenbath',
      authorAvatarData: '',
      error: 'Publish failed',
    });

    assert.match(html, /Publish failed/);
    assert.match(html, /data-moments-draft-input/);
    assert.match(html, /retry me/);
    assert.match(html, /keep.jpg/);
  });

  it('renders a Choose from Photos action and in-place edit controls', () => {
    const html = MomentsView({
      posts,
      isLoading: false,
      isPublishing: false,
      draftBody: 'hello',
      draftDate: '2026-05-12',
      draftAttachments: [
        { name: 'photo-1.jpg', previewUrl: '/file/photo-1', source: 'existing', fileId: 'photo-1' },
        { name: 'photo-2.jpg', previewUrl: '/file/photo-2', source: 'existing', fileId: 'photo-2' },
      ],
      editingPostId: 'moment-1',
      pickerOpen: true,
      pickerItems: [{ id: 'photo-1', sourceUrl: '/file/photo-1', thumbnailUrl: '/file/photo-1', label: 'photo-1', type: 'photo' }],
      pickerSelectedIds: ['photo-1'],
      selectedDate: '2026-05-16',
      calendarMonth: '2026-05',
      datesWithPhotos: { '2026-05-16': 1 },
      authorName: 'Aschenbath',
      authorAvatarData: '',
      error: '',
    });

    assert.match(html, /Choose from Photos/);
    assert.match(html, /Save changes/);
    assert.match(html, /data-moment-editor/);
    assert.match(html, /data-moments-edit-date/);
    assert.match(html, /value="2026-05-12"/);
    assert.match(html, /Cancel/);
    assert.match(html, /data-action="open-moments-photo-picker"/);
    assert.match(html, /data-action="toggle-moments-picker-photo"/);
    assert.match(html, /data-action="apply-moments-photo-picker"/);
    assert.match(html, /cml-moments-picker__check/);
    assert.match(html, />Add 1<\/button>/);
    assert.match(html, /cml-moments-composer__preview-grid/);
    assert.match(html, /cml-moment-card__photos--double/);
    assert.match(html, /cml-moments-composer__drag-handle/);
    assert.match(html, /draggable="true"/);
    assert.match(html, /data-moment-draft-index="0"/);
    assert.doesNotMatch(html, /data-moments-composer/);
  });

  it('renders Telegram-imported Moments images as images instead of generic photo labels', () => {
    const html = MomentsView({
      posts: telegramImportedPosts,
      isLoading: false,
      isPublishing: false,
      draftBody: '',
      draftAttachments: [],
      selectedDate: '2026-05-17',
      calendarMonth: '2026-05',
      datesWithPhotos: { '2026-05-17': 1 },
      authorName: 'Aschenbath',
      authorAvatarData: '',
      error: '',
    });

    assert.match(html, /src="\/file\/tg_photo_1\?preview=1"/);
    assert.doesNotMatch(html, />Photo<\/span>/);
  });

  it('shows only selected-day attachments in the day wall', () => {
    const html = MomentsView({
      posts: [
        ...posts,
        {
          id: 'moment-2',
          body: '昨晚散步',
          createdAt: '2026-05-15T19:10:00.000Z',
          date: '2026-05-15',
          attachments: [{
            fileId: 'Moments/2026-05-15/other.jpg',
            metadata: { FileName: 'other.jpg', FileType: 'image/jpeg' },
          }],
        },
      ],
      isLoading: false,
      isPublishing: false,
      draftBody: '',
      draftFiles: [],
      selectedDate: '2026-05-16',
      calendarMonth: '2026-05',
      datesWithPhotos: { '2026-05-15': 1, '2026-05-16': 1 },
      authorName: 'Aschenbath',
      authorAvatarData: '',
      error: '',
    });

    const dayWall = html.match(/<section class="cml-moments-day-wall"[\s\S]*?<\/section>/);
    assert.ok(dayWall, 'expected day wall section to be rendered');
    assert.match(dayWall[0], /cloud space.jpg/);
    assert.match(dayWall[0], /data-id="Moments\/2026-05-16\/cloud space\.jpg"/);
    assert.match(dayWall[0], /data-preview-source="\/file\/Moments\/2026-05-16\/cloud%20space\.jpg"/);
    assert.match(dayWall[0], /src="\/file\/Moments\/2026-05-16\/cloud%20space\.jpg"/);
    assert.doesNotMatch(dayWall[0], /data-preview-source="\/file\/Moments%2F2026-05-16%2Fcloud%20space\.jpg"/);
    assert.doesNotMatch(dayWall[0], /other.jpg/);
  });
});
