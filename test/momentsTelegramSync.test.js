import assert from 'node:assert/strict';

describe('momentsTelegramSync', () => {
  let extractMomentsCaptionBody;
  let shouldCreateMomentsFromTelegramMessage;
  let buildTelegramMomentsDedupeKey;
  let buildTelegramMomentsStateKey;
  let shouldUpsertTelegramMomentsPost;

  before(async () => {
    ({
      extractMomentsCaptionBody,
      shouldCreateMomentsFromTelegramMessage,
      buildTelegramMomentsDedupeKey,
      buildTelegramMomentsStateKey,
      shouldUpsertTelegramMomentsPost,
    } = await import('../functions/utils/momentsTelegramSync.js'));
  });

  it('extracts body text after /moments', () => {
    assert.equal(extractMomentsCaptionBody('/moments hello world'), 'hello world');
    assert.equal(extractMomentsCaptionBody('/moments'), '');
  });

  it('requires image content and a /moments caption prefix', () => {
    assert.equal(shouldCreateMomentsFromTelegramMessage({ caption: '/moments hi', photoFileIds: ['a'] }), true);
    assert.equal(shouldCreateMomentsFromTelegramMessage({ caption: 'hi', photoFileIds: ['a'] }), false);
    assert.equal(shouldCreateMomentsFromTelegramMessage({ caption: '/moments hi', photoFileIds: [] }), false);
  });

  it('builds a stable dedupe key from media-group identity when present', () => {
    assert.equal(
      buildTelegramMomentsDedupeKey({ chatId: '1', messageId: '2', mediaGroupId: '3' }),
      'telegram-moments:1:group:3'
    );
  });

  it('keeps message identity when media-group id is absent', () => {
    assert.equal(
      buildTelegramMomentsDedupeKey({ chatId: '1', messageId: '2', mediaGroupId: '' }),
      'telegram-moments:1:message:2'
    );
  });

  it('prefers the group-level dedupe key so one album becomes one Moments post', () => {
    const keyA = buildTelegramMomentsDedupeKey({ chatId: '100', messageId: '200', mediaGroupId: 'group-1' });
    const keyB = buildTelegramMomentsDedupeKey({ chatId: '100', messageId: '201', mediaGroupId: 'group-1' });
    assert.equal(keyA, keyB);
  });

  it('builds a stable state key for cross-request media-group aggregation', () => {
    const keyA = buildTelegramMomentsStateKey({ chatId: '100', messageId: '200', mediaGroupId: 'group-1' });
    const keyB = buildTelegramMomentsStateKey({ chatId: '100', messageId: '201', mediaGroupId: 'group-1' });
    assert.equal(keyA, keyB);
    assert.match(keyA, /:state$/);
  });

  it('continues appending photo ids for later media-group items even when only the first item had /moments caption', () => {
    assert.equal(
      shouldUpsertTelegramMomentsPost({
        caption: '',
        photoFileIds: ['b'],
        mediaGroupId: 'group-1',
        previousState: { postId: 'moment-1', fileIds: ['a'] },
      }),
      true,
    );
  });

  it('does not create or append without /moments intent or previous album state', () => {
    assert.equal(
      shouldUpsertTelegramMomentsPost({
        caption: '',
        photoFileIds: ['b'],
        mediaGroupId: 'group-1',
        previousState: null,
      }),
      false,
    );
  });
});
