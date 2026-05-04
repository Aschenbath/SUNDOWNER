export function createEmptyAdminProfileDraft() {
  return {
    username: '',
    displayName: '',
    avatarData: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };
}

export function createEmptyAdminPageDraft() {
  return {
    siteTitle: '',
    ownerName: '',
    logoUrl: '',
    announcement: '',
    adminBkImg: '',
    adminLoginBkImg: ''
  };
}

export function createEmptyAdminCloudDraft() {
  return {
    publicBrowseEnabled: false,
    publicBrowseAllowedDir: '',
    randomImageEnabled: false,
    randomImageAllowedDir: '',
    telemetryEnabled: false
  };
}

export function resetAdminPasswordDraft(draft) {
  return {
    ...draft,
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };
}

export function hydrateAdminProfileDraft(profile, normalizeText) {
  return {
    ...createEmptyAdminProfileDraft(),
    username: normalizeText(profile?.username),
    displayName: normalizeText(profile?.displayName) || normalizeText(profile?.username),
    avatarData: normalizeText(profile?.avatarData)
  };
}

export function parseAdminRecoveryMatches(input = '', normalizeText) {
  const lines = String(input || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const matches = [];
  for (let index = 0; index < lines.length; index += 1) {
    const parts = lines[index].split('|').map((part) => normalizeText(part));
    if (parts.length < 2) {
      throw new Error(`Recovery match line ${index + 1} must include at least key and message ID or file ID.`);
    }

    const [key, messageId, chatId, channelName, fileId] = parts;
    if (!key) {
      throw new Error(`Recovery match line ${index + 1} is missing the file key.`);
    }
    if (!messageId && !fileId) {
      throw new Error(`Recovery match line ${index + 1} must include either a message ID or a file ID.`);
    }

    matches.push({
      key,
      ...(messageId ? { messageId } : {}),
      ...(chatId ? { chatId } : {}),
      ...(channelName ? { channelName } : {}),
      ...(fileId ? { fileId } : {}),
    });
  }

  return matches;
}

export function createAdminPageDraft(config) {
  const entries = Array.isArray(config) ? config : [];
  const getValue = (label) => {
    const match = entries.find((entry) => String(entry?.key || '').trim() === label);
    return typeof match?.value === 'string' ? match.value : '';
  };
  return {
    siteTitle: getValue('siteTitle'),
    ownerName: getValue('author'),
    logoUrl: getValue('file_ico'),
    announcement: getValue('homeDescription'),
    adminBkImg: getValue('adminBkImg'),
    adminLoginBkImg: getValue('adminLoginBkImg')
  };
}

export function applyAdminPageDraftToConfig(config, draft) {
  const entries = Array.isArray(config) ? config.map((entry) => ({ ...entry })) : [];
  const valueMap = new Map([
    ['siteTitle', draft.siteTitle || ''],
    ['author', draft.ownerName || ''],
    ['file_ico', draft.logoUrl || ''],
    ['homeDescription', draft.announcement || ''],
    ['adminBkImg', draft.adminBkImg || ''],
    ['adminLoginBkImg', draft.adminLoginBkImg || '']
  ]);
  const seen = new Set();
  const nextEntries = entries.map((entry) => {
    const key = String(entry?.key || '').trim();
    if (!valueMap.has(key)) {
      return entry;
    }
    seen.add(key);
    return {
      ...entry,
      value: valueMap.get(key)
    };
  });
  for (const [key, value] of valueMap.entries()) {
    if (!seen.has(key)) {
      nextEntries.push({ key, value });
    }
  }
  return { config: nextEntries };
}

export function createAdminCloudDraft(settings) {
  const cfg = settings && typeof settings === 'object' ? settings : {};
  return {
    publicBrowseEnabled: Boolean(cfg.publicBrowse?.enable),
    publicBrowseAllowedDir: typeof cfg.publicBrowse?.allowDir === 'string' ? cfg.publicBrowse.allowDir : '',
    randomImageEnabled: Boolean(cfg.randomImage?.enable),
    randomImageAllowedDir: typeof cfg.randomImage?.allowDir === 'string' ? cfg.randomImage.allowDir : '',
    telemetryEnabled: Boolean(cfg.showStatus)
  };
}

export function applyAdminCloudDraftToSettings(settings, draft) {
  const base = settings && typeof settings === 'object' ? { ...settings } : {};
  const publicBrowse = base.publicBrowse && typeof base.publicBrowse === 'object' ? { ...base.publicBrowse } : {};
  const randomImage = base.randomImage && typeof base.randomImage === 'object' ? { ...base.randomImage } : {};
  publicBrowse.enable = Boolean(draft.publicBrowseEnabled);
  publicBrowse.allowDir = draft.publicBrowseAllowedDir || '';
  randomImage.enable = Boolean(draft.randomImageEnabled);
  randomImage.allowDir = draft.randomImageAllowedDir || '';
  return {
    ...base,
    publicBrowse,
    randomImage,
    showStatus: Boolean(draft.telemetryEnabled)
  };
}

export function updateAdminDraftField(state, section, field, rawValue) {
  if (!section || !field) {
    return;
  }
  if (state.adminPanelError) {
    state.adminPanelError = '';
  }
  if (section === 'account') {
    state.adminProfileDraft[field] = rawValue;
    return;
  }
  if (section === 'site') {
    state.adminPageDraft[field] = rawValue;
    return;
  }
  if (section === 'cloud') {
    state.adminCloudDraft[field] = rawValue;
  }
}
