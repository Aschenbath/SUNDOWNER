import assert from 'node:assert/strict';
import { resolveStoredTelegramFileId } from '../functions/utils/telegramFileId.js';

describe('resolveStoredTelegramFileId', () => {
    it('prefers explicit TgFileId from metadata', () => {
        const fileId = resolveStoredTelegramFileId('tg_Telegram_env_43_fileUniqueId.jpg', {
            Channel: 'TelegramNew',
            TgFileId: 'AgADyBcAAm2GuVY',
        });

        assert.equal(fileId, 'AgADyBcAAm2GuVY');
    });

    it('extracts telegram file ids from imported telegram-sync keys', () => {
        const fileId = resolveStoredTelegramFileId('tg_Telegram_env_43_AgADyBcAAm2GuVY.heic', {
            Channel: 'TelegramNew',
            ChannelName: 'Telegram_env',
        });

        assert.equal(fileId, 'AgADyBcAAm2GuVY');
    });

    it('falls back to raw legacy telegram key base names', () => {
        const fileId = resolveStoredTelegramFileId('AQADfhFrG7qLqFZ8.jpg', {
            Channel: 'Telegram',
        });

        assert.equal(fileId, 'AQADfhFrG7qLqFZ8');
    });

    it('does not invent ids for non-imported TelegramNew keys without metadata', () => {
        const fileId = resolveStoredTelegramFileId('1775562023929_市政厅前的吻.jpg', {
            Channel: 'TelegramNew',
        });

        assert.equal(fileId, '');
    });
});
