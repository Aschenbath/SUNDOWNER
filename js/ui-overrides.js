(function () {
  const BRAND_NAME = 'SUNDOWNER';
  const LOGO_PATH = '/logo-sundowner.svg';
  const ROUTE_CLASSES = ['codex-route-login', 'codex-route-home', 'codex-route-dashboard', 'codex-route-browse'];
  const BLOCKED_URL_PATTERNS = [
    /cfbed\.sanyue\.de/i,
    /github\.com\/MarSeventh\/CloudFlare-ImgBed/i,
    /afdian\.com\/a\/marseventh/i,
    /trendshift\.io\/repositories\/14324/i,
    /star-history\.com\/#MarSeventh/i
  ];
  const HIDE_TEXT_PATTERNS = [
    /\u56fe\u5e8a/iu,
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
    [/\u767b\u5f55\u5230\s*.*?\u56fe\u5e8a/giu, BRAND_NAME],
    [/\u767b\u5f55\u5230\s*.*?archive/giu, BRAND_NAME],
    [/SUNDOWNER\s*\u56fe\u5e8a/giu, BRAND_NAME],
    [/CloudFlare-ImgBed/gi, BRAND_NAME],
    [/Moments Drive/gi, BRAND_NAME],
    [/Sanyue ImgHub/gi, BRAND_NAME],
    [/SanyueQi/gi, BRAND_NAME],
    [/sanyue_imghub/gi, 'sundowner'],
    [/ImgHub/gi, ''],
    [/Sanyue/gi, BRAND_NAME],
    [/\u56fe\u5e8a/giu, ''],
    [/Designed by\s*.*?for You!?/gi, ''],
    [/for You!?/gi, '']
  ];

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

  function markBlockedLink(link) {
    if (!(link instanceof HTMLAnchorElement) || !link.href) {
      return;
    }
    if (BLOCKED_URL_PATTERNS.some((pattern) => pattern.test(link.href))) {
      hideElement(link);
    }
  }

  function patchLogos(root) {
    if (!(root instanceof Element || root instanceof Document)) {
      return;
    }

    root.querySelectorAll('img[src], source[srcset]').forEach((node) => {
      const attrName = node.tagName === 'SOURCE' ? 'srcset' : 'src';
      const value = node.getAttribute(attrName);
      if (!value) {
        return;
      }
      if (/logo(\.|-)|sanyue|imghub/i.test(value)) {
        node.setAttribute(attrName, LOGO_PATH);
        if (node.tagName !== 'SOURCE') {
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
      if (/Sanyue|ImgHub|CloudFlare-ImgBed|Moments Drive|\u56fe\u5e8a/i.test(text)) {
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
        if (/ImgHub|Sanyue|Designed by|for You|\u56fe\u5e8a/i.test(text)) {
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

    const sourceHeader = home.querySelector('.header[data-v-66491cac], .header');
    if (sourceHeader instanceof HTMLElement) {
      sourceHeader.classList.add('codex-home-source-header');
      sourceHeader.querySelectorAll('.title').forEach(hideElement);
    }

    const upload = home.querySelector('.upload[data-v-66491cac], .upload');
    if (upload instanceof HTMLElement) {
      upload.classList.add('codex-home-workbench');
    }

    home.querySelectorAll('.footer[data-v-66491cac], .page-footer, .footer-name, .footer-link-icon').forEach(hideElement);
    home.querySelectorAll('.upload-list-card:not(.upload-list-busy)').forEach((card) => {
      if (card instanceof HTMLElement) {
        card.classList.add('codex-home-empty-list');
      }
    });

    const escapeHtml = (value) => String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const syncView = () => {
      const shell = home.querySelector('.codex-home-shell');
      if (!(shell instanceof HTMLElement)) {
        return;
      }
      const view = home.dataset.codexView || 'photos';
      shell.querySelectorAll('.codex-home-nav__item[data-view]').forEach((item) => {
        item.classList.toggle('is-active', item.getAttribute('data-view') === view);
      });
      shell.classList.toggle('is-albums-view', view === 'albums');
      shell.classList.toggle('is-empty', home.dataset.codexHasMedia !== 'true');
    };

    const openUpload = () => {
      home.classList.add('codex-home-upload-open');
      const target = home.querySelector('.upload[data-v-66491cac], .upload');
      if (target instanceof HTMLElement) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    let shell = home.querySelector('.codex-home-shell');
    if (!(shell instanceof HTMLElement)) {
      const brandMarkup = buildBrandLockup({ className: 'codex-home-brand' }).outerHTML;
      const emptyBrandMarkup = buildBrandLockup({ className: 'codex-home-empty__brand', compact: true }).outerHTML;
      shell = document.createElement('section');
      shell.className = 'codex-home-shell';
      shell.innerHTML = `
        <aside class="codex-home-rail">
          ${brandMarkup}
          <p class="codex-home-rail__meta">Your archive, arranged like a photo library.</p>
          <nav class="codex-home-nav">
            <button type="button" class="codex-home-nav__item" data-action="view" data-view="photos">Photos</button>
            <button type="button" class="codex-home-nav__item" data-action="view" data-view="albums">Albums</button>
            <button type="button" class="codex-home-nav__item" data-href="/dashboard">Browse Files</button>
            <button type="button" class="codex-home-nav__item" data-action="upload">Upload</button>
            <button type="button" class="codex-home-nav__item" data-action="settings">Settings</button>
          </nav>
          <div class="codex-home-rail__footer">
            <span class="codex-home-rail__eyebrow">${BRAND_NAME}</span>
            <p class="codex-home-rail__copy">Neutral controls, warm ambient backgrounds, and a stable homepage shell.</p>
          </div>
        </aside>
        <div class="codex-home-main">
          <header class="codex-home-topbar">
            <button type="button" class="codex-home-search" data-action="browse" aria-label="Search library">
              <span class="codex-home-search__icon">O</span>
              <span class="codex-home-search__text">Search your library</span>
            </button>
            <div class="codex-home-actions">
              <button type="button" class="codex-home-action" data-action="upload" aria-label="Open upload workspace" title="Open upload workspace">+</button>
              <button type="button" class="codex-home-action" data-action="browse" aria-label="Browse files" title="Browse files">F</button>
              <button type="button" class="codex-home-action" data-action="theme" aria-label="Toggle theme" title="Toggle theme">T</button>
              <button type="button" class="codex-home-action" data-action="more" aria-label="More actions" title="More actions">...</button>
            </div>
          </header>
          <div class="codex-home-content">
            <section class="codex-home-hero">
              <span class="codex-home-eyebrow">Google Photos direction</span>
              <h1 class="codex-home-title">A photo-first homepage for SUNDOWNER.</h1>
              <p class="codex-home-summary">The home route now favors albums, recent media, and explicit upload entry points instead of a floating upload workbench.</p>
              <div class="codex-home-hero__actions">
                <button type="button" class="codex-home-nav__item" data-action="upload">Open Upload</button>
                <button type="button" class="codex-home-nav__item" data-href="/dashboard">Browse Library</button>
              </div>
            </section>
            <section class="codex-home-section codex-home-section--albums">
              <div class="codex-home-section__header">
                <span class="codex-home-section__eyebrow">Albums</span>
                <h2 class="codex-home-section__title">Featured collections</h2>
              </div>
              <div class="codex-home-albums"></div>
            </section>
            <section class="codex-home-section codex-home-section--photos">
              <div class="codex-home-section__header">
                <span class="codex-home-section__eyebrow">Photos</span>
                <h2 class="codex-home-section__title">Recent media</h2>
              </div>
              <div class="codex-home-gallery"></div>
            </section>
            <section class="codex-home-empty">
              ${emptyBrandMarkup}
              <h2 class="codex-home-empty__title">Build your library from explicit upload entry points.</h2>
              <p class="codex-home-empty__copy">When your media feed is empty, the homepage stays clean and points you to upload instead of rendering the upstream workbench as the default view.</p>
              <div class="codex-home-empty__actions">
                <button type="button" class="codex-home-nav__item" data-action="upload">Upload now</button>
                <button type="button" class="codex-home-nav__item" data-href="/dashboard">Browse files</button>
              </div>
            </section>
          </div>
        </div>`;
      home.insertBefore(shell, home.firstChild);
    }

    if (!shell.dataset.codexBound) {
      shell.dataset.codexBound = 'true';
      shell.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target.closest('[data-action], [data-href]') : null;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        if (target.dataset.href) {
          window.location.assign(target.dataset.href);
          return;
        }
        const action = target.dataset.action;
        if (action === 'view') {
          home.dataset.codexView = target.dataset.view || 'photos';
          syncView();
          return;
        }
        if (action === 'upload') {
          openUpload();
          return;
        }
        if (action === 'browse') {
          window.location.assign('/dashboard');
          return;
        }
        if (action === 'theme') {
          const toggle = home.querySelector('.toggle-dark-button[data-v-66491cac], .toggle-dark-button');
          if (toggle instanceof HTMLElement) {
            toggle.click();
          }
          return;
        }
        if (action === 'settings') {
          const config = home.querySelector('.config-button[data-v-66491cac], .config-button');
          const more = home.querySelector('.more-dropdown .more-button[data-v-66491cac], .mobile-more-button[data-v-66491cac], .more-dropdown .more-button, .mobile-more-button');
          if (config instanceof HTMLElement) {
            config.click();
          } else if (more instanceof HTMLElement) {
            more.click();
          }
          return;
        }
        if (action === 'more') {
          const more = home.querySelector('.more-dropdown .more-button[data-v-66491cac], .mobile-more-button[data-v-66491cac], .more-dropdown .more-button, .mobile-more-button');
          if (more instanceof HTMLElement) {
            more.click();
          }
        }
      });
    }

    const media = [];
    const seen = new Set();
    home.querySelectorAll('.history-container img[src], .upload-list-item img[src], .list-view img[src], .el-image__inner[src], .image-wrapper img[src]').forEach((node) => {
      if (!(node instanceof HTMLImageElement)) {
        return;
      }
      const src = node.getAttribute('src');
      if (!src || src === LOGO_PATH || seen.has(src)) {
        return;
      }
      if (node.closest('.codex-home-shell, .codex-brand-lockup, .empty-state, .el-empty')) {
        return;
      }
      const width = node.naturalWidth || node.width;
      const height = node.naturalHeight || node.height;
      if (width && height && (width < 80 || height < 80)) {
        return;
      }
      seen.add(src);
      media.push({ src, label: node.getAttribute('alt') || node.getAttribute('title') || '' });
    });

    const albums = shell.querySelector('.codex-home-albums');
    const gallery = shell.querySelector('.codex-home-gallery');
    const empty = shell.querySelector('.codex-home-empty');
    if (!(albums instanceof HTMLElement) || !(gallery instanceof HTMLElement) || !(empty instanceof HTMLElement)) {
      return;
    }

    if (!home.dataset.codexView) {
      home.dataset.codexView = 'photos';
    }

    if (!media.length) {
      home.dataset.codexHasMedia = 'false';
      albums.innerHTML = '';
      gallery.innerHTML = '';
      empty.hidden = false;
      syncView();
      return;
    }

    home.dataset.codexHasMedia = 'true';
    empty.hidden = true;

    const albumDeck = [
      { title: 'Recent Uploads', subtitle: 'Newest additions', item: media[0] },
      { title: 'Quiet Selections', subtitle: 'Photo-first browsing', item: media[1] || media[0] },
      { title: 'Shared Library', subtitle: 'Files ready to reuse', item: media[2] || media[0] }
    ];

    albums.innerHTML = albumDeck.map((entry) => {
      if (!entry.item) {
        return '';
      }
      return `<article class="codex-home-album"><article class="codex-home-album-card"><div class="codex-home-album-card__media"><img class="codex-home-album-card__asset" src="${escapeHtml(entry.item.src)}" alt="${escapeHtml(entry.title)}"></div><div class="codex-home-album-card__body"><h3 class="codex-home-album-card__title">${escapeHtml(entry.title)}</h3><p class="codex-home-album-card__subtitle">${escapeHtml(entry.subtitle)}</p></div></article></article>`;
    }).join('');

    gallery.innerHTML = media.map((item, index) => {
      const title = index === 0 ? 'Latest capture' : `Recent item ${String(index + 1).padStart(2, '0')}`;
      const meta = item.label ? `<p class="codex-home-media-card__meta">${escapeHtml(item.label)}</p>` : '';
      return `<article class="codex-home-media-card"><div class="codex-home-media-card__media"><img class="codex-home-media-card__asset" src="${escapeHtml(item.src)}" alt="${escapeHtml(title)}"></div><div class="codex-home-media-card__body"><h3 class="codex-home-media-card__title">${escapeHtml(title)}</h3>${meta}</div></article>`;
    }).join('');

    syncView();
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
      const brandHost = browse.querySelector('.header-left') || browse.querySelector('.header-center') || header;
      if (brandHost instanceof HTMLElement) {
        ensureLockup(brandHost, { className: 'codex-browse-brand', compact: true, wordmark: true });
        brandHost.querySelectorAll('.logo').forEach(hideElement);
      }
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