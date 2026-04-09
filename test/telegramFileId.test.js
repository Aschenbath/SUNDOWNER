import assert from 'node:assert/strict';
import {
    resolveStoredTelegramFileId,
    resolveStoredTelegramReadTarget,
} from '../functions/utils/telegramFileId.js';

describe('resolveStoredTelegramFileId', () => {
    it('prefers explicit TgFileId from metadata', () => {
        const fileId = resolveStoredTelegramFileId('tg_Telegram_env_43_fileUniqueId.jpg', {
            Channel: 'TelegramNew',
            TgFileId: 'AgADyBcAAm2GuVY',
        });

        assert.equal(fileId, 'AgADyBcAAm2GuVY');
    });

    it('does not treat imported telegram file_unique_ids as usable file_ids', () => {
        const fileId = resolveStoredTelegramFileId('tg_Telegram_env_43_AgADyBcAAm2GuVY.heic', {
            Channel: 'TelegramNew',
            ChannelName: 'Telegram_env',
            TgFileUniqueId: 'AgADyBcAAm2GuVY',
        });

        assert.equal(fileId, '');
    });

    it('still accepts imported keys that already embed a full telegram file_id', () => {
        const fileId = resolveStoredTelegramFileId(
            'tg_Telegram_env_43_AgACAgUAAyEFAATnpBp7AAMHadDV-HVlaHAdpHS7GZrXMQS209YAAt8MaxuXRYFW-69-C9Xd0roBAAMCAAN3AAM7BA.heic',
            {
                Channel: 'TelegramNew',
                ChannelName: 'Telegram_env',
            },
        );

        assert.equal(fileId, 'AgACAgUAAyEFAATnpBp7AAMHadDV-HVlaHAdpHS7GZrXMQS209YAAt8MaxuXRYFW-69-C9Xd0roBAAMCAAN3AAM7BA');
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
    it('prefers Telegram thumbnail ids for preview reads when available', () => {
        const target = resolveStoredTelegramReadTarget('telegram-import/Telegram_env/IMG_2038.HEIC', {
            Channel: 'TelegramNew',
            TgFileId: 'AgAD-original-file-id',
            TgThumbnailFileId: 'AgAD-thumbnail-file-id',
            TgThumbnailFileType: 'image/jpeg',
        }, { preview: true });

        assert.deepEqual(target, {
            fileId: 'AgAD-thumbnail-file-id',
            fileType: 'image/jpeg',
            isPreview: true,
        });
    });

    it('falls back to the original Telegram file id for non-preview reads', () => {
        const target = resolveStoredTelegramReadTarget('telegram-import/Telegram_env/IMG_2038.HEIC', {
            Channel: 'TelegramNew',
            TgFileId: 'AgAD-original-file-id',
            TgThumbnailFileId: 'AgAD-thumbnail-file-id',
            TgThumbnailFileType: 'image/jpeg',
        }, { preview: false });

        assert.deepEqual(target, {
            fileId: 'AgAD-original-file-id',
            fileType: '',
            isPreview: false,
        });
    });
});
