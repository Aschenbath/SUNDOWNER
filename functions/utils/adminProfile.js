const ADMIN_PROFILE_DB_KEY = 'manage@profile@admin';
const DEFAULT_ROLE_LABEL = 'Administrator';

function normalizeText(value) {
  return String(value || '').trim();
}

export function sanitizeAdminAvatar(value) {
  const avatar = String(value || '').trim();
  if (!avatar) {
    return '';
  }
  if (avatar.length > 900000) {
    throw new Error('Avatar image is too large');
  }
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(avatar)) {
    return avatar;
  }
  if (/^https?:\/\/\S+$/i.test(avatar)) {
    return avatar;
  }
  throw new Error('Avatar must be an image data URL or http(s) URL');
}

export function buildAdminProfileRecord(rawProfile, username) {
  const record = rawProfile && typeof rawProfile === 'object' ? rawProfile : {};
  const safeUsername = normalizeText(username);
  const displayName = normalizeText(record.displayName) || safeUsername;
  return {
    username: safeUsername,
    displayName,
    avatarData: typeof record.avatarData === 'string' ? record.avatarData.trim() : '',
    roleLabel: DEFAULT_ROLE_LABEL,
  };
}

export async function getAdminProfile(db, username) {
  const profileText = await db.get(ADMIN_PROFILE_DB_KEY);
  const parsed = profileText ? JSON.parse(profileText) : {};
  return buildAdminProfileRecord(parsed, username);
}

export async function saveAdminProfile(db, username, updates = {}) {
  const currentProfile = await getAdminProfile(db, username);
  const nextProfile = buildAdminProfileRecord({
    ...currentProfile,
    ...updates,
    username,
  }, username);
  await db.put(ADMIN_PROFILE_DB_KEY, JSON.stringify({
    displayName: nextProfile.displayName,
    avatarData: nextProfile.avatarData,
    updatedAt: new Date().toISOString(),
  }));
  return nextProfile;
}
