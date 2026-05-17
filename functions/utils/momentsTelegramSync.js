function normalizeText(value) {
  return String(value ?? '').trim();
}

export function extractMomentsCaptionBody(caption = '') {
  const normalized = normalizeText(caption);
  if (!normalized.toLowerCase().startsWith('/moments')) {
    return '';
  }
  return normalized.slice('/moments'.length).trim();
}

export function shouldCreateMomentsFromTelegramMessage({ caption = '', photoFileIds = [] } = {}) {
  return normalizeText(caption).toLowerCase().startsWith('/moments')
    && Array.isArray(photoFileIds)
    && photoFileIds.length > 0;
}

export function buildTelegramMomentsDedupeKey({ chatId = '', messageId = '', mediaGroupId = '' } = {}) {
  const normalizedChatId = normalizeText(chatId);
  const normalizedMediaGroupId = normalizeText(mediaGroupId);
  const normalizedMessageId = normalizeText(messageId);
  if (normalizedMediaGroupId) {
    return `telegram-moments:${normalizedChatId}:group:${normalizedMediaGroupId}`;
  }
  return `telegram-moments:${normalizedChatId}:message:${normalizedMessageId}`;
}

export function buildTelegramMomentsStateKey({ chatId = '', mediaGroupId = '', messageId = '' } = {}) {
  return `${buildTelegramMomentsDedupeKey({ chatId, mediaGroupId, messageId })}:state`;
}
