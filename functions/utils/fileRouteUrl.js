/**
 * /file/ 路由 URL 构造helpers。
 *
 * fileId 里可以合法出现空格、? 、# 、& ，直接插进模板字符串会让这些字符被当成
 * query/fragment 分隔符解析，导致 CDN 清缓存打偏、内部代理请求指向错误的对象。
 * 统一走这里，保证逐段编码且不破坏路径分隔符（AGENTS.md 约束 8）。
 */

/**
 * 逐段编码 fileId，保留 `/` 分隔符
 * @param {string} fileId - 形如 `photos/2026 trip/a.jpg`
 * @returns {string}
 */
export function encodeFileRoutePath(fileId) {
    return String(fileId ?? '')
        .split('/')
        .map(encodeURIComponent)
        .join('/');
}

/**
 * 构造站内相对路径
 * @param {string} fileId
 * @returns {string} 形如 `/file/photos/a%3Fb.jpg`
 */
export function buildFileRoutePath(fileId) {
    return `/file/${encodeFileRoutePath(fileId)}`;
}

/**
 * 基于 origin 构造绝对 URL
 * @param {string} origin - 形如 `https://example.com`，允许带尾部斜杠
 * @param {string} fileId
 * @returns {string}
 */
export function buildFileRouteUrl(origin, fileId) {
    const normalizedOrigin = String(origin ?? '').replace(/\/+$/, '');
    return `${normalizedOrigin}${buildFileRoutePath(fileId)}`;
}

/**
 * 基于 hostname 构造 HTTPS URL
 * @param {string} hostname - 形如 `cdn.example.com`
 * @param {string} fileId
 * @returns {string}
 */
export function buildHttpsFileRouteUrl(hostname, fileId) {
    return `https://${String(hostname ?? '')}${buildFileRoutePath(fileId)}`;
}
