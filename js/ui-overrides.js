(function () {
  const BRAND_NAME = 'SUNDOWNER';
  const LOGO_PATH = '/logo-sundowner.svg';
  const BLOCKED_URL_PATTERNS = [
    /cfbed\.sanyue\.de/i,
    /github\.com\/MarSeventh\/CloudFlare-ImgBed/i,
    /afdian\.com\/a\/marseventh/i,
    /trendshift\.io\/repositories\/14324/i,
    /star-history\.com\/#MarSeventh/i
  ];
  const HIDE_TEXT_PATTERNS = [
    /图床/i,
    /Designed by/i,
    /Moments Drive/i,
    /CloudFlare-ImgBed/i,
    /Sanyue/i,
    /ImgHub/i,
    /for You/i,
    /Gallery code contributed by LinJiang/i,
    /^LinJiang$/i
  ];
  const BRAND_REPLACEMENTS = [
    [/登录到\s*.*?图床/gi, BRAND_NAME],
    [/登录到\s*.*?archive/gi, BRAND_NAME],
    [/登录到\s*SUNDOWNER\s*图床/gi, BRAND_NAME],
    [/登录到\s*SUNDOWNER/gi, BRAND_NAME],
    [/SUNDOWNER\s*图床/gi, BRAND_NAME],
    [/CloudFlare-ImgBed/gi, BRAND_NAME],
    [/Moments Drive/gi, BRAND_NAME],
    [/Sanyue ImgHub/gi, BRAND_NAME],
    [/ImgHub/gi, ''],
    [/SanyueQi/gi, BRAND_NAME],
    [/sanyue_imghub/gi, 'sundowner'],
    [/Sanyue/gi, BRAND_NAME],
    [/图床/gi, ''],
    [/Designed by\s*.*?for You!?/gi, ''],
    [/for You!?/gi, '']
  ];
  const ROUTE_CLASSES = ['codex-route-login', 'codex-route-home', 'codex-route-dashboard', 'codex-route-browse'];

  function replaceBrandingInText(text) {
    let value = text || '';
    for (const [pattern, replacement] of BRAND_REPLACEMENTS) {
      value = value.replace(pattern, replacement);
    }
    return value.replace(/\s{2,}/g, ' ').trim();
  }

  function normalizedText(el) {
    return replaceBrandingInText((el && el.textContent) || '');
  }

  function hideElement(el) {
    if (!(el instanceof HTMLElement)) {
      return;
    }
    el.dataset.codexHidden = 'true';
    el.setAttribute('aria-hidden', 'true');
  }

  function neutralizeTextNode(node) {
    if (!node || !node.nodeValue) {
      return;
    }
    const raw = node.nodeValue;
    const trimmed = raw.trim();
    if (!trimmed) {
      return;
    }
    const replaced = replaceBrandingInText(trimmed);
    if (replaced !== trimmed) {
      node.nodeValue = raw.replace(trimmed, replaced);
    }
  }

  function neutralizeElementText(root) {
    if (!(root instanceof Element || root instanceof Document)) {
      return;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }
    nodes.forEach(neutralizeTextNode);
  }

  function markBlockedLink(link) {
    if (!(link instanceof HTMLAnchorElement) || !link.href) {
      return;
    }
    if (BLOCKED_URL_PATTERNS.some((pattern) => pattern.test(link.href))) {
      hideElement(link);
    }
  }

  function patchTitle() {
    document.title = BRAND_NAME;
  }

  function patchMeta() {
    document.querySelectorAll('meta[name="description"], meta[name="keywords"], meta[name="author"]').forEach((meta) => {
      if (meta.content) {
        meta.content = replaceBrandingInText(meta.content) || BRAND_NAME;
      }
    });
  }

  function patchLogos(root) {
    if (!(root instanceof Element || root instanceof Document)) {
      return;
    }
    root.querySelectorAll('img[src], source[srcset]').forEach((node) => {
      const value = node.tagName === 'SOURCE' ? node.getAttribute('srcset') : node.getAttribute('src');
      if (!value) {
        return;
      }
      if (/logo(\.|-)|sanyue|imghub/i.test(value)) {
        if (node.tagName === 'SOURCE') {
          node.setAttribute('srcset', LOGO_PATH);
        } else {
          node.setAttribute('src', LOGO_PATH);
          node.setAttribute('alt', BRAND_NAME);
        }
      }
    });

    document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="mask-icon"]').forEach((link) => {
      link.setAttribute('href', LOGO_PATH);
    });
  }

  function buildBrandLockup(options) {
    const settings = Object.assign({ compact: false, className: '', wordmark: true }, options || {});
    const wrap = document.createElement('div');
    wrap.className = ['codex-brand-lockup', settings.compact ? 'codex-brand-lockup--compact' : '', settings.className || '']
      .filter(Boolean)
      .join(' ');

    const logo = document.createElement('img');
    logo.className = 'codex-brand-lockup__logo';
    logo.src = LOGO_PATH;
    logo.alt = BRAND_NAME;
    wrap.appendChild(logo);

    if (settings.wordmark) {
      const wordmark = document.createElement('span');
      wordmark.className = 'codex-brand-lockup__wordmark';
      wordmark.textContent = BRAND_NAME;
      wrap.appendChild(wordmark);
    }

    return wrap;
  }

  function ensureLockup(container, options) {
    if (!(container instanceof HTMLElement)) {
      return null;
    }
    const existing = container.querySelector('.codex-brand-lockup');
    if (existing) {
      return existing;
    }
    const lockup = buildBrandLockup(options);
    container.insertBefore(lockup, container.firstChild);
    return lockup;
  }

  function patchDialogTitles(root) {
    if (!(root instanceof Element || root instanceof Document)) {
      return;
    }
    root.querySelectorAll('.el-dialog__title, .el-drawer__title').forEach((title) => {
      const text = normalizedText(title);
      if (!text) {
        return;
      }
      if (/Sanyue|ImgHub|CloudFlare-ImgBed|图床|Moments Drive/i.test(text)) {
        title.textContent = BRAND_NAME;
      }
    });
  }

  function patchLogin(root) {
    if (!(root instanceof Element || root instanceof Document)) {
      return;
    }
    root.querySelectorAll('.login').forEach((login) => {
      if (!(login instanceof HTMLElement)) {
        return;
      }
      login.classList.add('codex-login-shell');
      const surface = login.querySelector('.login-container');
      if (surface instanceof HTMLElement) {
        surface.classList.add('codex-login-surface');
        if (!login.querySelector('.codex-login-brand')) {
          const brand = buildBrandLockup({ className: 'codex-login-brand', wordmark: true });
          login.insertBefore(brand, surface);
        }
      }
      login.querySelectorAll('.login-title, .footer-name, .footer-link-icon').forEach((el) => {
        const text = normalizedText(el);
        if (/图床|ImgHub|Sanyue|Designed by|for You/i.test(text)) {
          hideElement(el);
        }
      });
    });
  }

  function patchUploadHome(root) {
    if (!(root instanceof Element || root instanceof Document)) {
      return;
    }
    const home = root instanceof Element && root.matches('.upload-home') ? root : root.querySelector('.upload-home');
    if (!(home instanceof HTMLElement)) {
      return;
    }
    home.classList.add('codex-photos-home');

    const hero = home.querySelector('.header');
    if (hero instanceof HTMLElement) {
      hero.classList.add('codex-home-rail');
      ensureLockup(hero, { className: 'codex-home-brand', wordmark: true });
      hero.querySelectorAll('.title').forEach(hideElement);
    }

    const topbar = home.querySelector('.upload-list-dashboard');
    if (topbar instanceof HTMLElement) {
      topbar.classList.add('codex-photos-topbar');
    }

    const stage = home.querySelector('.upload');
    if (stage instanceof HTMLElement) {
      stage.classList.add('codex-photos-stage');
    }

    home.querySelectorAll('.upload-card, .paste-card, .upload-list-item, .history-container .grid-item, .history-container .list-item').forEach((card) => {
      if (card instanceof HTMLElement) {
        card.classList.add('codex-photos-card');
      }
    });
  }

  function patchDashboard(root) {
    if (!(root instanceof Element || root instanceof Document)) {
      return;
    }
    const view = root instanceof Element && root.matches('.container[data-v-ad54b28c]')
      ? root
      : root.querySelector('.container[data-v-ad54b28c]');
    if (!(view instanceof HTMLElement)) {
      return;
    }
    view.classList.add('codex-photos-dashboard');

    const header = view.querySelector('.header-content');
    if (header instanceof HTMLElement) {
      header.classList.add('codex-photos-topbar');
      ensureLockup(header, { className: 'codex-dashboard-brand', compact: true, wordmark: true });
    }

    const main = view.querySelector('.main-container');
    if (main instanceof HTMLElement) {
      main.classList.add('codex-photos-stage');
    }

    view.querySelectorAll('.search-card, .list-view, .empty-state, .mobile-drawer, .bottom-sheet, .move-drawer').forEach((card) => {
      if (card instanceof HTMLElement) {
        card.classList.add('codex-photos-card');
      }
    });
  }

  function patchPublicBrowse(root) {
    if (!(root instanceof Element || root instanceof Document)) {
      return;
    }
    const browse = root instanceof Element && root.matches('.public-browse') ? root : root.querySelector('.public-browse');
    if (!(browse instanceof HTMLElement)) {
      return;
    }
    browse.classList.add('codex-photos-browse');

    const header = browse.querySelector('.header');
    if (header instanceof HTMLElement) {
      header.classList.add('codex-photos-topbar');
    }

    const brandHost = browse.querySelector('.header-center') || header;
    if (brandHost instanceof HTMLElement) {
      ensureLockup(brandHost, { className: 'codex-browse-brand', compact: true, wordmark: true });
      brandHost.querySelectorAll('.logo').forEach(hideElement);
    }

    const gallery = browse.querySelector('.gallery-container');
    if (gallery instanceof HTMLElement) {
      gallery.classList.add('codex-photos-stage');
    }

    browse.querySelectorAll('.folder-card, .image-wrapper, .floating-page-indicator, .preview-close, .preview-prev, .preview-next, .rotate-btn').forEach((card) => {
      if (card instanceof HTMLElement) {
        card.classList.add('codex-photos-card');
      }
    });
  }

  function patchEmptyStates(root) {
    if (!(root instanceof Element || root instanceof Document)) {
      return;
    }
    root.querySelectorAll('.empty-state, .el-empty, .error-container, .loading-container').forEach((box) => {
      if (!(box instanceof HTMLElement) || box.querySelector('.codex-empty-brand')) {
        return;
      }
      const brand = buildBrandLockup({ className: 'codex-empty-brand', compact: true, wordmark: true });
      box.insertBefore(brand, box.firstChild);
    });
  }

  function pruneCredits(root) {
    if (!(root instanceof Element || root instanceof Document)) {
      return;
    }
    root.querySelectorAll('a, p, span, strong, small, div').forEach((el) => {
      if (!(el instanceof HTMLElement) || el.children.length > 0) {
        return;
      }
      const text = normalizedText(el);
      if (!text || text.length > 180) {
        return;
      }
      if (HIDE_TEXT_PATTERNS.some((pattern) => pattern.test(text))) {
        hideElement(el);
      }
    });
  }

  function simplifyShareTabs(root) {
    if (!(root instanceof Element || root instanceof Document)) {
      return;
    }
    root.querySelectorAll('[role="tab"], .el-tabs__item').forEach((tab) => {
      const text = normalizedText(tab).toLowerCase();
      if (text === 'bbcode' || text === 'html') {
        hideElement(tab);
      }
    });
  }

  function applyRouteClass() {
    const body = document.body;
    if (!body) {
      return;
    }
    ROUTE_CLASSES.forEach((name) => body.classList.remove(name));
    const path = window.location.pathname || '/';
    if (path.startsWith('/login')) {
      body.classList.add('codex-route-login');
    } else if (path.startsWith('/dashboard')) {
      body.classList.add('codex-route-dashboard');
    } else if (path.startsWith('/browse')) {
      body.classList.add('codex-route-browse');
    } else {
      body.classList.add('codex-route-home');
    }
  }

  function patchRoot(root) {
    if (root && root.nodeType === Node.TEXT_NODE) {
      neutralizeTextNode(root);
      return;
    }
    if (!(root instanceof Element || root instanceof Document)) {
      return;
    }
    applyRouteClass();
    patchTitle();
    patchMeta();
    patchLogos(root);
    neutralizeElementText(root);
    patchDialogTitles(root);
    root.querySelectorAll('a[href]').forEach(markBlockedLink);
    patchLogin(root);
    patchUploadHome(root);
    patchDashboard(root);
    patchPublicBrowse(root);
    patchEmptyStates(root);
    pruneCredits(root);
    simplifyShareTabs(root);
  }

  const rawWindowOpen = window.open;
  window.open = function patchedOpen(url, ...args) {
    if (typeof url === 'string' && BLOCKED_URL_PATTERNS.some((pattern) => pattern.test(url))) {
      return null;
    }
    return rawWindowOpen.call(this, url, ...args);
  };

  function boot() {
    patchRoot(document);
    const observer = new MutationObserver((records) => {
      applyRouteClass();
      records.forEach((record) => {
        record.addedNodes.forEach((node) => patchRoot(node));
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
