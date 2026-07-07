const assert = require('node:assert/strict');

class MemoryKV {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async put(key, value) {
    this.store.set(key, String(value));
  }

  async delete(key) {
    this.store.delete(key);
  }
}

describe('telegramSync dedupe helpers', () => {
  let buildTelegramDedupeKey;
  let loadTelegramDedupeRecord;
  let resolveTelegramDedupeDecision;
  let saveTelegramDedupeRecord;

  before(async () => {
    const module = await import('../functions/utils/telegramDedupe.js');
    buildTelegramDedupeKey = module.buildTelegramDedupeKey;
    loadTelegramDedupeRecord = module.loadTelegramDedupeRecord;
    resolveTelegramDedupeDecision = module.resolveTelegramDedupeDecision;
    saveTelegramDedupeRecord = module.saveTelegramDedupeRecord;
  });

  it('builds a stable dedupe key per channel and message', () => {
    const key = buildTelegramDedupeKey('My Channel', 42);
    assert.equal(key, 'telegram-sync@dedupe@My_Channel@42');
  });

  it('does not throw on literal percent sequences in channel names', () => {
    const key = buildTelegramDedupeKey('Main%bad Channel', 43);
    assert.equal(key, 'telegram-sync@dedupe@Main_bad_Channel@43');
  });

  it('skips duplicate messages when file unique id matches', async () => {
    const db = new MemoryKV();
    await saveTelegramDedupeRecord(db, 'main', 1001, {
      fileId: 'tg_main_1001_abc.jpg',
      fileUniqueId: 'abc',
    });

    const decision = await resolveTelegramDedupeDecision(db, 'main', 1001, 'abc');
    assert.equal(decision.shouldSkip, true);
    assert.equal(decision.record.fileId, 'tg_main_1001_abc.jpg');
  });

  it('allows reimport when file unique id changes', async () => {
    const db = new MemoryKV();
    await saveTelegramDedupeRecord(db, 'main', 1002, {
      fileId: 'tg_main_1002_old.jpg',
      fileUniqueId: 'old',
    });

    const decision = await resolveTelegramDedupeDecision(db, 'main', 1002, 'new');
    assert.equal(decision.shouldSkip, false);
    assert.equal(decision.record.fileId, 'tg_main_1002_old.jpg');
  });

  it('drops corrupted dedupe payloads', async () => {
    const db = new MemoryKV();
    const key = buildTelegramDedupeKey('main', 1003);
    await db.put(key, '{ not json }');

    const record = await loadTelegramDedupeRecord(db, 'main', 1003);
    assert.equal(record, null);
    assert.equal(await db.get(key), null);
  });
});
