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
    fileId: 'Moments/2026-05-16/cloud.jpg',
    metadata: { FileName: 'cloud.jpg', FileType: 'image/jpeg' },
    item: {
      id: 'Moments/2026-05-16/cloud.jpg',
      thumbnailUrl: '/file/Moments/2026-05-16/cloud.jpg',
      sourceUrl: '/file/Moments/2026-05-16/cloud.jpg',
      type: 'photo',
      label: 'cloud.jpg',
    },
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
      draftFiles: [{ name: 'local.jpg', previewUrl: 'blob:local' }],
      selectedDate: '2026-05-16',
      calendarMonth: '2026-05',
      datesWithPhotos: { '2026-05-16': 1 },
      authorName: 'Aschenbath',
      authorAvatarData: '',
      error: '',
    });

    assert.match(html, /data-moments-view/);
    assert.match(html, /data-moments-composer/);
    assert.match(html, /data-moments-draft-input/);
    assert.match(html, /data-action="choose-moment-photos"/);
    assert.match(html, /data-action="publish-moment"/);
    assert.match(html, /data-moments-calendar/);
    assert.match(html, /data-action="select-moments-date"/);
    assert.match(html, /data-moments-day-wall/);
    assert.match(html, /今天云很好看/);
    assert.match(html, /Aschenbath/);
    assert.match(html, /data-action="delete-moment"/);
    assert.match(html, /data-action="open-preview"/);
    assert.match(html, /cloud.jpg/);
    assert.match(html, /draft/);
    assert.match(html, /local.jpg/);
  });

  it('shows publish failure while preserving draft markup', () => {
    const html = MomentsView({
      posts: [],
      isLoading: false,
      isPublishing: false,
      draftBody: 'retry me',
      draftFiles: [{ name: 'keep.jpg', previewUrl: 'blob:keep' }],
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
            item: {
              id: 'Moments/2026-05-15/other.jpg',
              thumbnailUrl: '/file/Moments/2026-05-15/other.jpg',
              sourceUrl: '/file/Moments/2026-05-15/other.jpg',
              type: 'photo',
              label: 'other.jpg',
            },
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
    assert.match(dayWall[0], /cloud.jpg/);
    assert.doesNotMatch(dayWall[0], /other.jpg/);
  });
});
