import { getDatabase } from '../../../utils/databaseAdapter.js';

const SECRET_PLACEHOLDER = 'Configured';

function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function maskSecret(value, { reveal = 0, placeholder = SECRET_PLACEHOLDER } = {}) {
    const normalized = typeof value === 'string' ? value : '';
    if (!normalized) {
        return '';
    }
    if (reveal > 0) {
        const visible = normalized.slice(0, reveal);
        return `${visible}${'*'.repeat(Math.max(0, normalized.length - reveal))}`;
    }
    return placeholder;
}

function preserveSecretPlaceholder(nextValue, storedValue) {
    if (nextValue === SECRET_PLACEHOLDER) {
        return storedValue || '';
    }
    return nextValue || '';
}

function normalizeAdminUsername(value) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized ? normalized : '';
}

function buildPublicUploadSettings(settings = {}) {
    const upload = isPlainObject(settings) ? { ...settings } : {};
    if (isPlainObject(upload.moderate)) {
        upload.moderate = { ...upload.moderate };
        upload.moderate.moderateContentApiKey = maskSecret(upload.moderate.moderateContentApiKey);
        if (hasOwn(upload.moderate, 'apiKey')) {
            upload.moderate.apiKey = maskSecret(upload.moderate.apiKey);
        }
    }
    return upload;
}

function buildPublicSecuritySettings(settings) {
    return {
        auth: {
            user: {
                authCode: maskSecret(settings?.auth?.user?.authCode),
                configured: Boolean(settings?.auth?.user?.authCode),
            },
            admin: {
                adminUsername: normalizeAdminUsername(settings?.auth?.admin?.adminUsername),
                adminPassword: maskSecret(settings?.auth?.admin?.adminPassword),
                configured: Boolean(settings?.auth?.admin?.adminUsername) && Boolean(settings?.auth?.admin?.adminPassword),
            }
        },
        upload: buildPublicUploadSettings(settings?.upload || {}),
        access: settings?.access || {},
        apiTokens: {
            tokens: {}
        }
    };
}

async function getStoredSecuritySettings(db) {
    const settingsStr = await db.get('manage@sysConfig@security');
    return settingsStr ? JSON.parse(settingsStr) : {};
}

function mergePostedAuthSettings(storedAuth = {}, postedAuth) {
    const nextAuth = isPlainObject(storedAuth) ? { ...storedAuth } : {};
    if (!isPlainObject(postedAuth)) {
        return nextAuth;
    }

    if (isPlainObject(postedAuth.user)) {
        nextAuth.user = { ...(nextAuth.user || {}), ...postedAuth.user };
        if (hasOwn(postedAuth.user, 'authCode')) {
            nextAuth.user.authCode = preserveSecretPlaceholder(
                postedAuth.user.authCode,
                storedAuth?.user?.authCode
            );
        }
    }
    if (isPlainObject(postedAuth.admin)) {
        nextAuth.admin = { ...(nextAuth.admin || {}), ...postedAuth.admin };
        if (hasOwn(postedAuth.admin, 'adminPassword')) {
            nextAuth.admin.adminPassword = preserveSecretPlaceholder(
                postedAuth.admin.adminPassword,
                storedAuth?.admin?.adminPassword
            );
        }
    }
    return nextAuth;
}

function mergePostedUploadSettings(storedUpload = {}, postedUpload) {
    const nextUpload = isPlainObject(storedUpload) ? { ...storedUpload } : {};
    if (!isPlainObject(postedUpload)) {
        return nextUpload;
    }

    Object.assign(nextUpload, postedUpload);
    if (isPlainObject(postedUpload.moderate)) {
        const storedModerate = storedUpload?.moderate || {};
        const storedModerationKey = storedModerate.moderateContentApiKey || storedModerate.apiKey || '';
        nextUpload.moderate = { ...(nextUpload.moderate || {}), ...postedUpload.moderate };
        if (hasOwn(postedUpload.moderate, 'moderateContentApiKey')) {
            nextUpload.moderate.moderateContentApiKey = preserveSecretPlaceholder(
                postedUpload.moderate.moderateContentApiKey,
                storedModerationKey
            );
        }
        if (hasOwn(postedUpload.moderate, 'apiKey')) {
            nextUpload.moderate.apiKey = preserveSecretPlaceholder(
                postedUpload.moderate.apiKey,
                storedModerationKey
            );
        }
    }
    return nextUpload;
}

function mergePostedAccessSettings(storedAccess = {}, postedAccess) {
    const nextAccess = isPlainObject(storedAccess) ? { ...storedAccess } : {};
    if (!isPlainObject(postedAccess)) {
        return nextAccess;
    }
    return { ...nextAccess, ...postedAccess };
}

function mergePostedSecuritySettings(currentSettings = {}, postedSettings = {}, storedSettings = {}) {
    const nextSettings = isPlainObject(storedSettings) ? { ...storedSettings } : {};
    nextSettings.auth = mergePostedAuthSettings(storedSettings.auth, postedSettings.auth);
    nextSettings.upload = mergePostedUploadSettings(storedSettings.upload, postedSettings.upload);
    nextSettings.access = mergePostedAccessSettings(storedSettings.access, postedSettings.access);
    nextSettings.apiTokens = storedSettings.apiTokens || currentSettings.apiTokens || { tokens: {} };
    return nextSettings;
}

export async function onRequest(context) {
    const { request, env } = context;
    const db = getDatabase(env);

    if (request.method === 'GET') {
        const settings = await getSecurityConfig(db, env);
        return new Response(JSON.stringify(buildPublicSecuritySettings(settings)), {
            headers: {
                'content-type': 'application/json',
            },
        });
    }

    if (request.method === 'POST') {
        const body = await request.json();
        const currentSettings = await getSecurityConfig(db, env);
        const storedSettings = await getStoredSecuritySettings(db);
        const settings = mergePostedSecuritySettings(currentSettings, body, storedSettings);

        await db.put('manage@sysConfig@security', JSON.stringify(settings));

        return new Response('security settings saved', {
            headers: {
                'content-type': 'application/json',
            },
        });
    }
}

export async function getSecurityConfig(db, env) {
    const settings = {};
    const settingsStr = await db.get('manage@sysConfig@security');
    const settingsKV = settingsStr ? JSON.parse(settingsStr) : {};

    const kvAuth = settingsKV.auth || {};
    settings.auth = {
        user: {
            authCode: kvAuth.user?.authCode || env.AUTH_CODE || '',
        },
        admin: {
            adminUsername: kvAuth.admin?.adminUsername || env.BASIC_USER || '',
            adminPassword: kvAuth.admin?.adminPassword || env.BASIC_PASS || '',
        }
    };

    const kvUpload = settingsKV.upload || {};
    settings.upload = {
        moderate: {
            enabled: kvUpload.moderate?.enabled ?? false,
            channel: kvUpload.moderate?.channel || 'moderatecontent.com',
            moderateContentApiKey: kvUpload.moderate?.moderateContentApiKey || kvUpload.moderate?.apiKey || env.ModerateContentApiKey || '',
            nsfwApiPath: kvUpload.moderate?.nsfwApiPath || '',
        }
    };

    const kvAccess = settingsKV.access || {};
    settings.access = {
        allowedDomains: kvAccess.allowedDomains || env.ALLOWED_DOMAINS || '',
        whiteListMode: kvAccess.whiteListMode ?? env.WhiteList_Mode === 'true',
        allowBearerlessFileAccess: kvAccess.allowBearerlessFileAccess ?? env.ALLOW_BEARERLESS_FILE_ACCESS === 'true',
    };

    const kvApiTokens = settingsKV.apiTokens || {};
    settings.apiTokens = {
        tokens: kvApiTokens.tokens || {}
    };

    return settings;
}
