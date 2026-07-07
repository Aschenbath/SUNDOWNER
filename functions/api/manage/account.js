import { getDatabase } from '../../utils/databaseAdapter.js';
import { getSecurityConfig } from './sysConfig/security.js';
import { getAdminProfile, sanitizeAdminAvatar, saveAdminProfile } from '../../utils/adminProfile.js';
import {
  ADMIN_SESSION_MAX_AGE,
  createAdminSessionToken,
  makeAdminSessionCookie,
} from '../../utils/adminSession.js';
import { constantTimeEqual } from '../../utils/constantTimeEqual.js';

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

const ACCOUNT_CLIENT_ERRORS = new Set([
  'Username is required',
  'Username is too long',
  'Username cannot contain ":"',
  'Username contains invalid characters',
  'Display name is required',
  'Display name is too long',
  'New password is required',
  'New password must be at least 6 characters',
  'New password is too long',
  'New password contains invalid characters',
  'Avatar image is too large',
  'Avatar must be an image data URL or http(s) URL',
]);

function accountErrorResponse(error) {
  const message = error?.message || '';
  if (ACCOUNT_CLIENT_ERRORS.has(message)) {
    return jsonResponse({ error: message }, { status: 400 });
  }

  console.error('Account update failed:', error);
  return jsonResponse({ error: 'Internal server error.' }, { status: 500 });
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
        if (!providedCurrentPassword || !constantTimeEqual(providedCurrentPassword, currentPassword)) {
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
      if (requestedUsername !== currentUsername || !constantTimeEqual(nextPassword, currentPassword)) {
        const updatedSettings = buildSecurityConfigPayload(securityConfig, requestedUsername, nextPassword);
        await db.put('manage@sysConfig@security', JSON.stringify(updatedSettings));
        const sessionToken = await createAdminSessionToken(requestedUsername, nextPassword, ADMIN_SESSION_MAX_AGE);
        headers.set('Set-Cookie', makeAdminSessionCookie(sessionToken, ADMIN_SESSION_MAX_AGE));
      }

      return jsonResponse(nextProfile, { headers });
    } catch (error) {
      return accountErrorResponse(error);
    }
  }

  return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
}
