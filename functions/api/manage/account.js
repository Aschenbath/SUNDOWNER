import { getDatabase } from '../../utils/databaseAdapter.js';
import { getSecurityConfig } from './sysConfig/security.js';
import { getAdminProfile, sanitizeAdminAvatar, saveAdminProfile } from '../../utils/adminProfile.js';
import {
  ADMIN_SESSION_MAX_AGE,
  createAdminSessionToken,
  makeAdminSessionCookie,
} from '../../utils/adminSession.js';

function jsonResponse(payload, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  });
}

function normalizeCredential(value) {
  return String(value || '').trim();
}

function validateUsername(username) {
  if (!username) {
    throw new Error('Username is required');
  }
  if (username.length > 64) {
    throw new Error('Username is too long');
  }
  if (username.includes(':')) {
    throw new Error('Username cannot contain ":"');
  }
  if (/[\0-\x1F\x7F]/.test(username)) {
    throw new Error('Username contains invalid characters');
  }
  return username;
}

function validateDisplayName(displayName) {
  const value = String(displayName || '').trim();
  if (!value) {
    throw new Error('Display name is required');
  }
  if (value.length > 80) {
    throw new Error('Display name is too long');
  }
  return value;
}

function validatePassword(password) {
  const value = String(password || '');
  if (!value) {
    throw new Error('New password is required');
  }
  if (value.length < 6) {
    throw new Error('New password must be at least 6 characters');
  }
  if (value.length > 128) {
    throw new Error('New password is too long');
  }
  if (/[\0-\x1F\x7F]/.test(value)) {
    throw new Error('New password contains invalid characters');
  }
  return value;
}

function buildSecurityConfigPayload(settings, username, password) {
  return {
    ...settings,
    auth: {
      ...(settings.auth || {}),
      admin: {
        ...(settings.auth?.admin || {}),
        adminUsername: username,
        adminPassword: password,
      },
    },
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = getDatabase(env);

  if (request.method === 'GET') {
    const securityConfig = await getSecurityConfig(db, env);
    const username = normalizeCredential(securityConfig.auth?.admin?.adminUsername);
    const profile = await getAdminProfile(db, username);
    return jsonResponse(profile);
  }

  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, { status: 400 });
    }

    const securityConfig = await getSecurityConfig(db, env);
    const currentUsername = normalizeCredential(securityConfig.auth?.admin?.adminUsername);
    const currentPassword = String(securityConfig.auth?.admin?.adminPassword || '');
    const currentProfile = await getAdminProfile(db, currentUsername);

    try {
      const requestedUsername = Object.prototype.hasOwnProperty.call(body || {}, 'username')
        ? validateUsername(normalizeCredential(body.username))
        : currentUsername;
      const requestedDisplayName = Object.prototype.hasOwnProperty.call(body || {}, 'displayName')
        ? validateDisplayName(body.displayName)
        : currentProfile.displayName;
      const requestedAvatar = Object.prototype.hasOwnProperty.call(body || {}, 'avatarData')
        ? sanitizeAdminAvatar(body.avatarData)
        : currentProfile.avatarData;
      const wantsCredentialChange = requestedUsername !== currentUsername || normalizeCredential(body?.newPassword);

      let nextPassword = currentPassword;
      if (wantsCredentialChange) {
        const providedCurrentPassword = String(body?.currentPassword || '');
        if (!providedCurrentPassword || providedCurrentPassword !== currentPassword) {
          return jsonResponse({ error: 'Current password is incorrect' }, { status: 400 });
        }
        if (normalizeCredential(body?.newPassword)) {
          nextPassword = validatePassword(body.newPassword);
        }
      }

      const nextProfile = await saveAdminProfile(db, requestedUsername, {
        displayName: requestedDisplayName,
        avatarData: requestedAvatar,
      });

      const headers = new Headers();
      if (requestedUsername !== currentUsername || nextPassword !== currentPassword) {
        const updatedSettings = buildSecurityConfigPayload(securityConfig, requestedUsername, nextPassword);
        await db.put('manage@sysConfig@security', JSON.stringify(updatedSettings));
        headers.set(
          'Set-Cookie',
          makeAdminSessionCookie(createAdminSessionToken(requestedUsername, nextPassword), ADMIN_SESSION_MAX_AGE),
        );
      }

      return jsonResponse(nextProfile, { headers });
    } catch (error) {
      return jsonResponse({ error: error.message || 'Failed to update account' }, { status: 400 });
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
}
