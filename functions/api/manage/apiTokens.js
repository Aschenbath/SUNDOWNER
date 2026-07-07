import { getDatabase } from '../../utils/databaseAdapter.js';
import { filterAutoDeleteTokens } from '../../utils/tokenExpiration.js';
import { constantTimeEqual } from '../../utils/constantTimeEqual.js';

const TOKEN_HASH_ALGORITHM = 'sha256-salted-v1';
const TOKEN_SALT_BYTES = 16;

export async function onRequest(context) {
    // API Token管理，支持创建、删除、列出Token
    const {
      request,
      env
    } = context;

    const db = getDatabase(env);
    const url = new URL(request.url)
    const method = request.method

    // GET - 获取所有Token列表
    if (method === 'GET') {
        const tokens = await getApiTokens(db)
        return new Response(JSON.stringify(tokens), {
            headers: {
                'content-type': 'application/json',
            },
        })
    }

    // POST - 创建新Token
    if (method === 'POST') {
        const body = await request.json()
        const { name, permissions, owner, expiresAt = null, autoDelete = false } = body

        if (!name || !permissions || !owner) {
            return new Response(JSON.stringify({ error: '缺少必要参数' }), {
                status: 400,
                headers: {
                    'content-type': 'application/json',
                },
            })
        }

        const token = await createApiToken(db, name, permissions, owner, expiresAt, autoDelete)
        return new Response(JSON.stringify(token), {
            headers: {
                'content-type': 'application/json',
            },
        })
    }

    // DELETE - 删除Token
    if (method === 'DELETE') {
        const tokenId = url.searchParams.get('id')
        
        if (!tokenId) {
            return new Response(JSON.stringify({ error: '缺少Token ID' }), {
                status: 400,
                headers: {
                    'content-type': 'application/json',
                },
            })
        }

        const result = await deleteApiToken(db, tokenId)
        return new Response(JSON.stringify(result), {
            headers: {
                'content-type': 'application/json',
            },
        })
    }

    // PUT - 更新Token权限
    if (method === 'PUT') {
        const body = await request.json()
        const { tokenId, permissions, expiresAt = null, autoDelete = false } = body

        if (!tokenId || !permissions) {
            return new Response(JSON.stringify({ error: '缺少必要参数' }), {
                status: 400,
                headers: {
                    'content-type': 'application/json',
                },
            })
        }

        const result = await updateApiToken(db, tokenId, permissions, expiresAt, autoDelete)
        return new Response(JSON.stringify(result), {
            headers: {
                'content-type': 'application/json',
            },
        })
    }

    return new Response('Method not allowed', { status: 405 })
}

// 获取所有API Token
async function getApiTokens(db) {
    const settingsStr = await db.get('manage@sysConfig@security')
    const settings = settingsStr ? JSON.parse(settingsStr) : {}
    const tokens = settings.apiTokens?.tokens || {}
    let shouldSave = false

    for (const tokenId in tokens) {
        if (await ensureTokenStoredAsHash(tokens[tokenId])) {
            shouldSave = true
        }
    }
    
    // 将 tokens 对象转为数组，并应用向后兼容默认值
    const tokenArray = Object.keys(tokens).map(id => {
        const token = tokens[id]
        return {
            id,
            name: token.name,
            owner: token.owner,
            permissions: token.permissions,
            createdAt: token.createdAt,
            updatedAt: token.updatedAt,
            expiresAt: token.expiresAt ?? null,
            autoDelete: token.autoDelete ?? false
        }
    })
    
    // 使用 filterAutoDeleteTokens 识别需要自动删除的 Token
    const { toDelete, toKeep } = filterAutoDeleteTokens(tokenArray)
    
    // 从数据库中删除符合自动删除条件的 Token
    if (toDelete.length > 0) {
        for (const t of toDelete) {
            delete settings.apiTokens.tokens[t.id]
        }
        shouldSave = true
    }

    if (shouldSave) {
        await db.put('manage@sysConfig@security', JSON.stringify(settings))
    }
    
    // 返回时不包含实际token值，只返回基本信息
    const tokenList = toKeep.map(t => serializeTokenForManagement(t.id, t))
    
    return { tokens: tokenList }
}

function serializeTokenForManagement(id, tokenData) {
    return {
        id,
        name: tokenData.name,
        owner: tokenData.owner,
        permissions: tokenData.permissions,
        createdAt: tokenData.createdAt,
        updatedAt: tokenData.updatedAt,
        expiresAt: tokenData.expiresAt ?? null,
        autoDelete: tokenData.autoDelete ?? false
    }
}

// 创建新的API Token
async function createApiToken(db, name, permissions, owner, expiresAt = null, autoDelete = false) {
    const settingsStr = await db.get('manage@sysConfig@security')
    const settings = settingsStr ? JSON.parse(settingsStr) : {}
    
    if (!settings.apiTokens) {
        settings.apiTokens = { tokens: {} }
    }
    
    const tokenId = generateTokenId()
    const token = generateApiToken()
    const now = new Date().toISOString()
    const tokenHashFields = await createTokenHashFields(token)
    
    const tokenData = {
        id: tokenId,
        name,
        owner,
        permissions,
        createdAt: now,
        updatedAt: now,
        expiresAt: expiresAt ?? null,
        autoDelete: autoDelete === true,
        ...tokenHashFields
    }
    
    settings.apiTokens.tokens[tokenId] = tokenData
    
    // 保存到数据库
    await db.put('manage@sysConfig@security', JSON.stringify(settings))
    
    return {
        id: tokenId,
        name,
        token,
        owner,
        permissions,
        createdAt: now,
        updatedAt: now,
        expiresAt: tokenData.expiresAt,
        autoDelete: tokenData.autoDelete
    }
}

// 删除API Token
async function deleteApiToken(db, tokenId) {
    const settingsStr = await db.get('manage@sysConfig@security')
    const settings = settingsStr ? JSON.parse(settingsStr) : {}
    
    if (!settings.apiTokens?.tokens?.[tokenId]) {
        return { error: 'Token 不存在' }
    }
    
    delete settings.apiTokens.tokens[tokenId]
    
    // 保存到数据库
    await db.put('manage@sysConfig@security', JSON.stringify(settings))
    
    return { success: true, message: 'Token 已删除' }
}

// 更新API Token
async function updateApiToken(db, tokenId, permissions, expiresAt = null, autoDelete = false) {
    const settingsStr = await db.get('manage@sysConfig@security')
    const settings = settingsStr ? JSON.parse(settingsStr) : {}
    
    if (!settings.apiTokens?.tokens?.[tokenId]) {
        return { error: 'Token 不存在' }
    }
    
    await ensureTokenStoredAsHash(settings.apiTokens.tokens[tokenId])
    settings.apiTokens.tokens[tokenId].permissions = permissions
    settings.apiTokens.tokens[tokenId].updatedAt = new Date().toISOString()
    settings.apiTokens.tokens[tokenId].expiresAt = expiresAt ?? null
    settings.apiTokens.tokens[tokenId].autoDelete = autoDelete === true
    
    // 保存到数据库
    await db.put('manage@sysConfig@security', JSON.stringify(settings))
    
    return { 
        success: true, 
        message: 'Token 已更新',
        token: serializeTokenForManagement(tokenId, settings.apiTokens.tokens[tokenId])
    }
}

// 生成随机Token（使用密码学安全随机源）
function generateApiToken() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return 'imgbed_' + hex.slice(0, 32);
}

// 生成Token ID（使用密码学安全随机源）
function generateTokenId() {
    return crypto.randomUUID();
}

function bytesToHex(bytes) {
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function generateTokenSalt() {
    const bytes = new Uint8Array(TOKEN_SALT_BYTES);
    crypto.getRandomValues(bytes);
    return bytesToHex(bytes);
}

async function computeTokenHash(token, salt) {
    const data = new TextEncoder().encode(`${salt}:${token}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return bytesToHex(new Uint8Array(digest));
}

async function createTokenHashFields(token) {
    const tokenSalt = generateTokenSalt();
    const tokenHash = await computeTokenHash(token, tokenSalt);
    return {
        tokenHashAlgorithm: TOKEN_HASH_ALGORITHM,
        tokenSalt,
        tokenHash
    };
}

function hasUsableTokenHash(tokenData) {
    return typeof tokenData?.tokenHash === 'string'
        && typeof tokenData?.tokenSalt === 'string'
        && tokenData.tokenHash.length > 0
        && tokenData.tokenSalt.length > 0;
}

async function ensureTokenStoredAsHash(tokenData) {
    if (!tokenData) {
        return false;
    }

    if (hasUsableTokenHash(tokenData)) {
        if (Object.prototype.hasOwnProperty.call(tokenData, 'token')) {
            delete tokenData.token;
            return true;
        }
        return false;
    }

    if (typeof tokenData.token !== 'string' || !tokenData.token) {
        return false;
    }

    const tokenHashFields = await createTokenHashFields(tokenData.token);
    Object.assign(tokenData, tokenHashFields);
    delete tokenData.token;
    return true;
}

async function storedTokenMatches(tokenData, token) {
    if (!tokenData || typeof token !== 'string' || !token) {
        return false;
    }

    if (hasUsableTokenHash(tokenData)) {
        const computedHash = await computeTokenHash(token, tokenData.tokenSalt);
        return constantTimeEqual(computedHash, tokenData.tokenHash);
    }

    if (typeof tokenData.token === 'string') {
        return constantTimeEqual(tokenData.token, token);
    }

    return false;
}

// 根据Token获取权限（供其他API使用）
export async function getTokenPermissions(db, token) {
    const settingsStr = await db.get('manage@sysConfig@security')
    const settings = settingsStr ? JSON.parse(settingsStr) : {}
    const tokens = settings.apiTokens?.tokens || {}
    
    // 查找匹配的token
    for (const tokenId in tokens) {
        if (await storedTokenMatches(tokens[tokenId], token)) {
            if (await ensureTokenStoredAsHash(tokens[tokenId])) {
                await db.put('manage@sysConfig@security', JSON.stringify(settings))
            }
            return tokens[tokenId].permissions
        }
    }
    
    return null
}

// 根据Token获取完整数据对象（供tokenValidator使用）
export async function getTokenData(db, token) {
    const settingsStr = await db.get('manage@sysConfig@security')
    const settings = settingsStr ? JSON.parse(settingsStr) : {}
    const tokens = settings.apiTokens?.tokens || {}
    
    // 查找匹配的token
    for (const tokenId in tokens) {
        const t = tokens[tokenId]
        if (await storedTokenMatches(t, token)) {
            if (await ensureTokenStoredAsHash(t)) {
                await db.put('manage@sysConfig@security', JSON.stringify(settings))
            }
            return {
                id: t.id || tokenId,
                name: t.name,
                owner: t.owner,
                permissions: t.permissions,
                createdAt: t.createdAt,
                updatedAt: t.updatedAt,
                expiresAt: t.expiresAt ?? null,
                autoDelete: t.autoDelete ?? false
            }
        }
    }
    
    return null
}
