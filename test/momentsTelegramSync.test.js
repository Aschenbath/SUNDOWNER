import assert from 'node:assert/strict';

describe('momentsTelegramSync', () => {
  let extractMomentsCaptionBody;
  let shouldCreateMomentsFromTelegramMessage;
  let buildTelegramMomentsDedupeKey;

  before(async () => {
    ({
      extractMomentsCaptionBody,
      shouldCreateMomentsFromTelegramMessage,
      buildTelegramMomentsDedupeKey,
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
});
