/* ======== 文件读取工具函数 ======== */

// 判断请求域名是否在允许的域名列表中
export function isDomainAllowed(context) {
    const { Referer, securityConfig, url } = context;

    const allowedDomains = securityConfig.access.allowedDomains;
    const hasAllowlist = Boolean(allowedDomains && allowedDomains.trim() !== '');

    if (!Referer) {
        return !hasAllowlist;
    }

    if (Referer) {
        try {
            const refererUrl = new URL(Referer);
            if (hasAllowlist) {
                const domains = allowedDomains.split(',');
                domains.push(url.hostname);// 把自身域名加入白名单

                let isAllowed = domains.some(domain => {
                    const escapedDomain = String(domain).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    let domainPattern = new RegExp(`(^|\\.)${escapedDomain}$`); // Escape full domain safely
                    return domainPattern.test(refererUrl.hostname);
                });

                if (!isAllowed) {
                    return false;
                }
            }
        } catch (e) {
            return false;
        }
    }

    return true;
}

// 判断请求是否来自公开图库页面 (/browse 或 /browse/*)
export function isFromPublicBrowse(Referer, origin) {
    if (!Referer) return false;
    try {
        const refererUrl = new URL(Referer);
        // 检查是否来自同源的 /browse 或 /browse/* 路径
        if (refererUrl.origin === origin) {
            const pathname = refererUrl.pathname;
            if (pathname === '/browse' || pathname.startsWith('/browse/')) {
                return true;
            }
        }
    } catch (e) {
        return false;
    }
    return false;
}

// 公共响应头设置函数
export function setCommonHeaders(headers, encodedFileName, fileType, Referer, url, options = {}) {
    headers.set('Content-Disposition', `inline; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Vary', 'Range');

    if (fileType) {
        headers.set('Content-Type', fileType);
    }

    // 根据Referer设置CDN缓存策略（排除公开图库页面的请求）
    let cacheControl;
    if (Referer && Referer.includes(url.origin) && !isFromPublicBrowse(Referer, url.origin)) {
        cacheControl = 'private, max-age=86400'; // 本地缓存 1天
    } else {
        cacheControl = 'public, max-age=2592000'; // CDN缓存 30天
    }

    // 内容寻址的 /file/{id} 路径写入后不可变（同一 id 永远指向同一比特流），
    // 加上 immutable 后浏览器在 max-age 窗口内不会触发 revalidation 请求，
    // 显著减少回源跟 TG getFile 调用。
    if (options.immutable) {
        cacheControl = `${cacheControl}, immutable`;
    }
    headers.set('Cache-Control', cacheControl);

    if (options.etag) {
        headers.set('ETag', options.etag);
    }
}

// 内容寻址的 /file/{id} 响应头封装：从 context 上取 Referer/url/responseEtag，
// 默认带 immutable，所有 channel handler 共用同一缓存契约。
export function applyFileResponseHeaders(context, headers, encodedFileName, fileType) {
    setCommonHeaders(headers, encodedFileName, fileType, context?.Referer, context?.url, {
        immutable: true,
        etag: context?.responseEtag || null,
    });
}

// Cloudflare Worker 默认缓存的安全访问器：测试环境 / 本地 dev 没有全局 caches 时
// 退化成 no-op，让上层逻辑可以无脑调用 match/put 不需要在每处加 typeof 判断。
export function getWorkerEdgeCache() {
    if (typeof caches !== 'undefined' && caches?.default) {
        return caches.default;
    }
    return {
        async match() { return undefined; },
        async put() {},
    };
}

// 设置Range请求相关头部
export function setRangeHeaders(headers, rangeStart, rangeEnd, totalSize) {
    const contentLength = rangeEnd - rangeStart + 1;
    headers.set('Content-Length', contentLength.toString());
    headers.set('Content-Range', `bytes ${rangeStart}-${rangeEnd}/${totalSize}`);
}

// 处理HEAD请求的公共函数
export function handleHeadRequest(headers, etag = null) {
    const responseHeaders = new Headers();

    // 复制关键头部
    responseHeaders.set('Content-Length', headers.get('Content-Length') || '0');
    responseHeaders.set('Content-Type', headers.get('Content-Type') || 'application/octet-stream');
    responseHeaders.set('Content-Disposition', headers.get('Content-Disposition') || 'inline');
    responseHeaders.set('Access-Control-Allow-Origin', headers.get('Access-Control-Allow-Origin') || '*');
    responseHeaders.set('Accept-Ranges', headers.get('Accept-Ranges') || 'bytes');
    responseHeaders.set('Cache-Control', headers.get('Cache-Control') || 'public, max-age=2592000');

    if (etag) {
        responseHeaders.set('ETag', etag);
    }

    return new Response(null, {
        status: 200,
        headers: responseHeaders,
    });
}

// 转发给第三方（telegra.ph / api.telegram.org / 自建代理 / Discord CDN）时只放行
// 与内容协商相关的安全 header。绝不转发入站请求的 Authorization / Cookie / authCode：
// WebDAV GET 代理路径会注入 `Authorization: Basic <admin 凭据>`，verbatim 透传会把
// 管理员凭据泄露到外部主机。
const FORWARDABLE_FETCH_HEADERS = ['range', 'if-none-match', 'if-modified-since', 'accept-encoding', 'accept'];

function buildForwardHeaders(sourceHeaders) {
    const forwarded = new Headers();
    if (!sourceHeaders || typeof sourceHeaders.get !== 'function') {
        return forwarded;
    }
    for (const name of FORWARDABLE_FETCH_HEADERS) {
        const value = sourceHeaders.get(name);
        if (value !== null && value !== undefined) {
            forwarded.set(name, value);
        }
    }
    return forwarded;
}

export async function getFileContent(request, targetUrl, max_retries = 2) {
    let retries = 0;
    const forwardHeaders = buildForwardHeaders(request.headers);
    while (retries <= max_retries) {
        try {
            const response = await fetch(targetUrl, {
                method: request.method,
                headers: forwardHeaders,
                body: request.body,
            });
            if (response.ok || response.status === 304) {
                return response;
            } else if (response.status === 404) {
                return new Response('Error: Image Not Found', { status: 404 });
            } else {
                retries++;
            }
        } catch (error) {
            retries++;
        }
    }
    return null;
}

export function isTgChannel(imgRecord) {
    return imgRecord.metadata?.Channel === 'Telegram' || imgRecord.metadata?.Channel === 'TelegramNew';
}

// 图片可访问性检查
export async function returnWithCheck(context, imgRecord) {
    const { url, securityConfig } = context;
    const whiteListMode = securityConfig.access.whiteListMode;

    const response = new Response('success', { status: 200 });

    // 访问控制只依赖内容访问规则，不依赖 Referer 放行
    const record = imgRecord;
    if (record.metadata === null) {
    } else {
        if (record.metadata.ListType == "White") {
            return response;
        } else if (record.metadata.ListType == "Block") {
            return await returnBlockImg(url);
        } else if (record.metadata.Label == "adult") {
            return await returnBlockImg(url);
        }
        if (whiteListMode) {
            return await returnWhiteListImg(url);
        } else {
            return response;
        }
    }

    return response;
}


export async function return404(url) {
    const Img404 = await fetch(url.origin + "/static/404.png");
    if (!Img404.ok) {
        return new Response('Error: Image Not Found',
            {
                status: 404,
                headers: {
                    "Cache-Control": "public, max-age=86400"
                }
            }
        );
    } else {
        return new Response(Img404.body, {
            status: 404,
            headers: {
                "Content-Type": "image/png",
                "Content-Disposition": "inline",
                "Cache-Control": "public, max-age=86400",
            },
        });
    }
}

export async function returnBlockImg(url) {
    const blockImg = await fetch(url.origin + "/static/BlockImg.png");
    if (!blockImg.ok) {
        return new Response(null, {
            status: 302,
            headers: {
                "Location": url.origin + "/blockimg",
                "Cache-Control": "public, max-age=86400"
            }
        })
    } else {
        return new Response(blockImg.body, {
            status: 403,
            headers: {
                "Content-Type": "image/png",
                "Content-Disposition": "inline",
                "Cache-Control": "public, max-age=86400",
            },
        });
    }
}

export async function returnWhiteListImg(url) {
    const WhiteListImg = await fetch(url.origin + "/static/WhiteListOn.png");
    if (!WhiteListImg.ok) {
        return new Response(null, {
            status: 302,
            headers: {
                "Location": url.origin + "/whiteliston",
                "Cache-Control": "public, max-age=86400"
            }
        })
    } else {
        return new Response(WhiteListImg.body, {
            status: 403,
            headers: {
                "Content-Type": "image/png",
                "Content-Disposition": "inline",
                "Cache-Control": "public, max-age=86400",
            },
        });
    }
}
