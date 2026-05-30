import {
  THEME_CHANGE_EVENT,
  THEME_COLOR_OPTIONS,
  THEME_MODE_OPTIONS,
  applyThemeToDocument,
  dispatchThemeChange,
  formatThemeModeLabel,
  formatThemeSummary,
  loadThemePreference,
  persistThemePreference,
} from './theme-system.js?v=2';

(function () {
  const BRAND_NAME = 'SUNDOWNER';
  const LOGO_PATH = '/logo-sundowner.png';
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

  let themePreference = loadThemePreference();
  const systemThemeQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  function getCurrentThemePreference() {
    return themePreference;
  }

  function commitThemePreference(nextPreference, { dispatch = true } = {}) {
    const persisted = persistThemePreference(nextPreference);
    themePreference = applyThemeToDocument(persisted);
    if (dispatch) {
      dispatchThemeChange(themePreference);
    }
    syncThemeControls();
    return themePreference;
  }

  function closeThemeMenus(except) {
    document.querySelectorAll('.codex-theme-switcher.is-open').forEach((menu) => {
      if (except && menu === except) {
        return;
      }
      menu.classList.remove('is-open');
      const trigger = menu.querySelector('.codex-theme-switcher__button');
      if (trigger instanceof HTMLElement) {
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function syncThemeControls() {
    const activeTheme = getCurrentThemePreference();
    document.querySelectorAll('.codex-theme-switcher').forEach((switcher) => {
      switcher.querySelectorAll('.codex-theme-option').forEach((option) => {
        const themeColor = option.getAttribute('data-theme-color');
        const themeMode = option.getAttribute('data-theme-mode');
        const isActive = themeColor
          ? themeColor === activeTheme.themeColor
          : themeMode === activeTheme.themeMode;
        option.classList.toggle('is-active', isActive);
        option.setAttribute('aria-checked', isActive ? 'true' : 'false');
      });
      const currentLabel = switcher.querySelector('.codex-theme-switcher__current');
      if (currentLabel instanceof HTMLElement) {
        currentLabel.textContent = formatThemeSummary(activeTheme.themeColor, activeTheme.themeMode, activeTheme.resolvedThemeMode);
      }
    });
  }

  function toggleUiThemeModeQuick() {
    const currentTheme = getCurrentThemePreference();
    const nextMode = currentTheme.resolvedThemeMode === 'dark' ? 'light' : 'dark';
    commitThemePreference({
      themeColor: currentTheme.themeColor,
      themeMode: nextMode
    });
  }

  function buildThemeSwitcherMarkup() {
    const currentTheme = getCurrentThemePreference();
    const colorOptions = THEME_COLOR_OPTIONS.map((theme) => `
      <button type="button" class="codex-theme-option ${currentTheme.themeColor === theme.key ? 'is-active' : ''}" data-action="theme-color-select" data-theme-color="${theme.key}" role="menuitemradio" aria-checked="${currentTheme.themeColor === theme.key ? 'true' : 'false'}">
        <span class="codex-theme-option__swatch" style="--codex-theme-swatch:${theme.swatch}" aria-hidden="true"></span>
        <span class="codex-theme-option__label">${theme.label}</span>
      </button>`).join('');
    const modeOptions = THEME_MODE_OPTIONS.map((mode) => `
      <button type="button" class="codex-theme-option ${currentTheme.themeMode === mode.key ? 'is-active' : ''}" data-action="theme-mode-select" data-theme-mode="${mode.key}" role="menuitemradio" aria-checked="${currentTheme.themeMode === mode.key ? 'true' : 'false'}">
        <span class="codex-theme-option__mode">${mode.key === 'auto' ? 'A' : mode.label.charAt(0)}</span>
        <span class="codex-theme-option__label">${mode.label}</span>
        ${mode.key === 'auto' ? `<span class="codex-theme-option__meta">${formatThemeModeLabel(currentTheme.themeMode, currentTheme.resolvedThemeMode)}</span>` : ''}
      </button>`).join('');
    return `
      <div class="codex-theme-switcher" data-codex-theme-switcher>
        <button type="button" class="codex-theme-switcher__button" data-action="theme-toggle" aria-expanded="false" aria-haspopup="true">
          <span class="codex-theme-switcher__label">Theme</span>
          <span class="codex-theme-switcher__current">${formatThemeSummary(currentTheme.themeColor, currentTheme.themeMode, currentTheme.resolvedThemeMode)}</span>
        </button>
        <div class="codex-theme-switcher__menu" role="menu">
          <div class="codex-theme-switcher__section" role="none">
            <p class="codex-theme-switcher__section-label" role="presentation">Theme color</p>
            ${colorOptions}
          </div>
          <div class="codex-theme-switcher__section" role="none">
            <p class="codex-theme-switcher__section-label" role="presentation">Mode</p>
            ${modeOptions}
          </div>
        </div>
      </div>`;
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

  function normalizeExternalHref(rawValue) {
    const value = typeof rawValue === 'string' ? rawValue.trim() : '';
    if (!value) {
      return '';
    }
    if (/^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(value)) {
      return value;
    }
    if (/^(?:www\.)?(?:feishu\.cn|larksuite\.com)\b/i.test(value) || /^[\w.-]+\.[a-z]{2,}(?:\/|$)/i.test(value)) {
      return `https://${value}`;
    }
    return value;
  }

  function patchExternalLinks(root) {
    if (!(root instanceof Element || root instanceof Document)) {
      return;
    }
    root.querySelectorAll('a[href]').forEach((link) => {
      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }
      const rawHref = link.getAttribute('href');
      const normalizedHref = normalizeExternalHref(rawHref);
      if (normalizedHref && rawHref !== normalizedHref) {
        link.setAttribute('href', normalizedHref);
      }
    });
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

    const openUpload = () => {
      home.classList.add('codex-home-upload-open');
      const target = home.querySelector('.upload[data-v-66491cac], .upload');
      if (target instanceof HTMLElement) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    let shell = home.querySelector('.codex-home-shell');
    if (!(shell instanceof HTMLElement)) {
      const brandMarkup = buildBrandLockup({ className: 'codex-home-brand', compact: true }).outerHTML;
      const themeMarkup = buildThemeSwitcherMarkup();
      shell = document.createElement('section');
      shell.className = 'codex-home-shell';
      shell.innerHTML = `
        <aside class="codex-home-rail">
          ${brandMarkup}
          <nav class="codex-home-nav">
            <button type="button" class="codex-home-nav__item is-active">Photos</button>
            <button type="button" class="codex-home-nav__item" data-href="/dashboard">Albums</button>
            <button type="button" class="codex-home-nav__item" data-href="/dashboard">Browse Files</button>
            <button type="button" class="codex-home-nav__item" data-action="upload">Upload</button>
            <button type="button" class="codex-home-nav__item" data-action="settings">Settings</button>
          </nav>
          <div class="codex-home-rail__section">Collections</div>
          <div class="codex-home-rail__list">
            <span>Screenshots</span>
            <span>Favourites</span>
            <span>People and pets</span>
            <span>Places</span>
          </div>
          <div class="codex-home-rail__footer">
            <span class="codex-home-rail__storage">SUNDOWNER archive</span>
            <span class="codex-home-rail__copy">Photo-first home</span>
          </div>
        </aside>
        <div class="codex-home-main">
          <header class="codex-home-topbar">
            <button type="button" class="codex-home-search" data-href="/dashboard" aria-label="Search library">
              <span class="codex-home-search__icon">⌕</span>
              <span class="codex-home-search__text">Search your library</span>
            </button>
            <div class="codex-home-actions">
              <button type="button" class="codex-home-action" data-action="upload" aria-label="Upload" title="Upload">+</button>
              <button type="button" class="codex-home-action" data-href="/dashboard" aria-label="Browse files" title="Browse files">□</button>
              <button type="button" class="codex-home-action" data-action="theme" aria-label="Toggle theme" title="Toggle theme">◐</button>
              <button type="button" class="codex-home-action" data-action="more" aria-label="More" title="More">⋮</button>
            </div>
          </header>
          <section class="codex-home-stream">
            <div class="codex-home-stream__header">
              <div>
                <span class="codex-home-stream__eyebrow">Photos</span>
                <h1 class="codex-home-stream__title">Recent media</h1>
              </div>
              <button type="button" class="codex-home-stream__upload" data-action="upload">Upload</button>
            </div>
            <div class="codex-home-gallery"></div>
          </section>
          <section class="codex-home-empty">
            <div class="codex-home-empty__inner">
              ${brandMarkup}
              <h2 class="codex-home-empty__title">Start your photo library</h2>
              <p class="codex-home-empty__copy">Upload from the rail or top bar. The home route stays focused on media instead of the upstream upload workbench.</p>
              <div class="codex-home-empty__actions">
                <button type="button" class="codex-home-nav__item" data-action="upload">Upload now</button>
                <button type="button" class="codex-home-nav__item" data-href="/dashboard">Browse files</button>
              </div>
            </div>
          </section>
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
        if (action === 'upload') {
          openUpload();
          return;
        }
        if (action === 'theme') {
          toggleUiThemeModeQuick();
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

    const gallery = shell.querySelector('.codex-home-gallery');
    const stream = shell.querySelector('.codex-home-stream');
    const empty = shell.querySelector('.codex-home-empty');
    if (!(gallery instanceof HTMLElement) || !(stream instanceof HTMLElement) || !(empty instanceof HTMLElement)) {
      return;
    }

    if (!media.length) {
      home.dataset.codexHasMedia = 'false';
      gallery.innerHTML = '';
      stream.hidden = true;
      empty.hidden = false;
      shell.classList.add('is-empty');
      return;
    }

    home.dataset.codexHasMedia = 'true';
    shell.classList.remove('is-empty');
    stream.hidden = false;
    empty.hidden = true;

    gallery.innerHTML = media.map((item, index) => {
      const cardClass = index === 0
        ? 'codex-home-media-card is-featured'
        : ((index % 7 === 0 || index % 7 === 4)
          ? 'codex-home-media-card is-wide'
          : ((index % 5 === 0 || index % 5 === 3)
            ? 'codex-home-media-card is-tall'
            : 'codex-home-media-card'));
      const alt = item.label || `Photo ${index + 1}`;
      return `<article class="${cardClass}"><div class="codex-home-media-card__media"><img class="codex-home-media-card__asset" src="${escapeHtml(item.src)}" alt="${escapeHtml(alt)}"></div></article>`;
    }).join('');
  }


  function patchUploadHomeV2(root) {
    if (!(root instanceof Element || root instanceof Document)) {
      return;
    }
    const home = root instanceof Element && root.matches('.upload-home') ? root : root.querySelector('.upload-home');
    if (!(home instanceof HTMLElement)) {
      return;
    }

    const escapeHtml = (value) => String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const inferDateLabel = (node) => {
      const candidates = [];
      let current = node instanceof Element ? node : null;
      for (let depth = 0; current && depth < 6; depth += 1, current = current.parentElement) {
        const prev = current.previousElementSibling;
        if (prev instanceof HTMLElement) {
          candidates.push(prev.textContent || '');
        }
        candidates.push(current.getAttribute('title') || '');
        candidates.push(current.getAttribute('aria-label') || '');
        candidates.push(current.textContent || '');
      }

      for (const value of candidates.map((item) => replaceBrandingInText(String(item || '')).replace(/\s+/g, ' ').trim()).filter(Boolean)) {
        const absolute = value.match(/((?:20)?\d{2}[-/.]\d{1,2}[-/.]\d{1,2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/);
        if (absolute) {
          return absolute[1].replace(/[/.]/g, '-');
        }
        if (/today/i.test(value)) {
          return 'Today';
        }
        if (/yesterday/i.test(value)) {
          return 'Yesterday';
        }
      }
      return 'Recent';
    };

    const openUpload = () => {
      home.classList.add('codex-home-upload-open');
      const target = home.querySelector('.upload[data-v-66491cac], .upload');
      if (target instanceof HTMLElement) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    let shell = home.querySelector('.codex-home-shell-v2');
    if (!(shell instanceof HTMLElement)) {
      const themeMarkup = buildThemeSwitcherMarkup();
      const brandMarkup = buildBrandLockup({ className: 'codex-home-brand', compact: true }).outerHTML;
      shell = document.createElement('section');
      shell.className = 'codex-home-shell codex-home-shell-v2';
      shell.innerHTML = `
        <div class="codex-home-googlebar">
          <div class="codex-home-googlebar__brand">${brandMarkup}</div>
          <button type="button" class="codex-home-googlebar__search" data-href="/dashboard" aria-label="Search photos">
            <span class="codex-home-googlebar__search-icon">⌕</span>
            <span class="codex-home-googlebar__search-text">Search photos</span>
          </button>
          <div class="codex-home-googlebar__actions">
            ${themeMarkup}
            <button type="button" class="codex-home-googlebar__upload" data-action="upload" aria-label="Upload" title="Upload">
              <span class="codex-home-googlebar__upload-plus">+</span>
              <span>Upload</span>
            </button>
            <button type="button" class="codex-home-googlebar__icon" data-action="more" aria-label="Library options" title="Library options">⋮</button>
          </div>
        </div>
        <section class="codex-home-stream codex-home-stream-v2">
          <div class="codex-home-stream__groups"></div>
        </section>
        <section class="codex-home-empty codex-home-empty-v2">
          <div class="codex-home-empty__inner">
            ${brandMarkup}
            <h2 class="codex-home-empty__title">Your photos will appear here</h2>
            <p class="codex-home-empty__copy">Use the upload button in the top right to add photos, then browse them in a day-based timeline.</p>
            <div class="codex-home-empty__actions">
              <button type="button" class="codex-home-googlebar__upload" data-action="upload">
                <span class="codex-home-googlebar__upload-plus">+</span>
                <span>Upload</span>
              </button>
            </div>
          </div>
        </section>`;
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
          closeThemeMenus();
          window.location.assign(target.dataset.href);
          return;
        }
        if (target.dataset.action === 'theme-toggle') {
          const switcher = target.closest('.codex-theme-switcher');
          if (!(switcher instanceof HTMLElement)) {
            return;
          }
          const willOpen = !switcher.classList.contains('is-open');
          closeThemeMenus(willOpen ? switcher : null);
          switcher.classList.toggle('is-open', willOpen);
          target.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
          return;
        }
        if (target.dataset.action === 'theme-color-select') {
          const currentTheme = getCurrentThemePreference();
          commitThemePreference({
            themeColor: target.getAttribute('data-theme-color') || currentTheme.themeColor,
            themeMode: currentTheme.themeMode
          });
          closeThemeMenus();
          return;
        }
        if (target.dataset.action === 'theme-mode-select') {
          const currentTheme = getCurrentThemePreference();
          commitThemePreference({
            themeColor: currentTheme.themeColor,
            themeMode: target.getAttribute('data-theme-mode') || currentTheme.themeMode
          });
          closeThemeMenus();
          return;
        }
        if (target.dataset.action === 'upload') {
          closeThemeMenus();
          openUpload();
          return;
        }
        if (target.dataset.action === 'more') {
          closeThemeMenus();
          const more = home.querySelector('.more-dropdown .more-button[data-v-66491cac], .mobile-more-button[data-v-66491cac], .more-dropdown .more-button, .mobile-more-button');
          if (more instanceof HTMLElement) {
            more.click();
          }
        }
      });
    }

    home.querySelectorAll('.upload-list-item .file-index, .upload-list-item .index, .upload-list-item .order, .list-view .file-index, .history-container .file-index, .upload-list-item .el-badge, .upload-list-item .el-tag, .upload-list-item .file-name, .upload-list-item .file-title, .upload-list-item .file-meta, .history-container .file-name, .history-container .file-meta').forEach(hideElement);

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
      media.push({
        src,
        label: node.getAttribute('alt') || node.getAttribute('title') || '',
        dateLabel: inferDateLabel(node)
      });
    });

    const groups = shell.querySelector('.codex-home-stream__groups');
    const stream = shell.querySelector('.codex-home-stream');
    const empty = shell.querySelector('.codex-home-empty');
    if (!(groups instanceof HTMLElement) || !(stream instanceof HTMLElement) || !(empty instanceof HTMLElement)) {
      return;
    }

    if (!media.length) {
      groups.innerHTML = '';
      stream.hidden = true;
      empty.hidden = false;
      home.dataset.codexHasMedia = 'false';
      return;
    }

    home.dataset.codexHasMedia = 'true';
    stream.hidden = false;
    empty.hidden = true;

    const groupedMedia = [];
    for (const item of media) {
      const lastGroup = groupedMedia[groupedMedia.length - 1];
      if (!lastGroup || lastGroup.label !== item.dateLabel) {
        groupedMedia.push({ label: item.dateLabel, items: [item] });
      } else {
        lastGroup.items.push(item);
      }
    }

    groups.innerHTML = groupedMedia.map((group) => {
      const cards = group.items.map((item, index) => {
        const cardClass = index === 0 && group.items.length > 2
          ? 'codex-home-media-card is-featured'
          : ((index % 8 === 2 || index % 8 === 5)
            ? 'codex-home-media-card is-wide'
            : ((index % 6 === 3 || index % 6 === 4)
              ? 'codex-home-media-card is-tall'
              : 'codex-home-media-card'));
        const alt = item.label || 'Photo';
        return `<article class="${cardClass}"><div class="codex-home-media-card__media"><img class="codex-home-media-card__asset" src="${escapeHtml(item.src)}" alt="${escapeHtml(alt)}" loading="lazy"></div></article>`;
      }).join('');

      return `
        <section class="codex-home-day-group">
          <header class="codex-home-day-group__header">
            <h2 class="codex-home-day-group__title">${escapeHtml(group.label)}</h2>
          </header>
          <div class="codex-home-gallery">${cards}</div>
        </section>`;
    }).join('');
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

    const escapeHtml = (value) => String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const inferDateLabel = (node) => {
      const candidates = [];
      let current = node instanceof Element ? node : null;
      for (let depth = 0; current && depth < 6; depth += 1, current = current.parentElement) {
        const prev = current.previousElementSibling;
        if (prev instanceof HTMLElement) {
          candidates.push(prev.textContent || '');
        }
        candidates.push(current.getAttribute('title') || '');
        candidates.push(current.getAttribute('aria-label') || '');
        candidates.push(current.textContent || '');
      }
      for (const value of candidates.map((item) => replaceBrandingInText(String(item || '')).replace(/\s+/g, ' ').trim()).filter(Boolean)) {
        const absolute = value.match(/((?:20)?\d{2}[-/.]\d{1,2}[-/.]\d{1,2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/);
        if (absolute) {
          return absolute[1].replace(/[/.]/g, '-');
        }
        if (/today/i.test(value)) {
          return 'Today';
        }
        if (/yesterday/i.test(value)) {
          return 'Yesterday';
        }
      }
      return 'Recent';
    };

    const header = view.querySelector('.header-content');
    if (header instanceof HTMLElement) {
      header.classList.add('codex-photos-topbar');
      hideElement(header);
    }

    const originalList = view.querySelector('.list-view');
    if (originalList instanceof HTMLElement) {
      originalList.classList.add('codex-dashboard-source-list');
      hideElement(originalList);
    }

    view.querySelectorAll('.search-card, .empty-state, .mobile-drawer, .bottom-sheet, .move-drawer, .floating-page-indicator, .pagination-container, .page-turn-button, .page-turn').forEach((card) => {
      if (card instanceof HTMLElement) {
        hideElement(card);
      }
    });

    let shell = view.querySelector('.codex-dashboard-shell-v2');
    if (!(shell instanceof HTMLElement)) {
      const brandMarkup = buildBrandLockup({ className: 'codex-dashboard-brand-v2', compact: true }).outerHTML;
      const themeMarkup = buildThemeSwitcherMarkup();
      shell = document.createElement('section');
      shell.className = 'codex-dashboard-shell-v2';
      shell.innerHTML = `
        <div class="codex-dashboard-googlebar">
          <div class="codex-dashboard-googlebar__brand">${brandMarkup}</div>
          <button type="button" class="codex-dashboard-googlebar__search" data-href="/dashboard" aria-label="Search photos">
            <span class="codex-dashboard-googlebar__search-icon">⌕</span>
            <span class="codex-dashboard-googlebar__search-text">Search photos</span>
          </button>
          <div class="codex-dashboard-googlebar__actions">
            ${themeMarkup}
            <button type="button" class="codex-dashboard-googlebar__upload" data-href="/?cmlUpload=1" aria-label="Upload" title="Upload">
              <span class="codex-dashboard-googlebar__upload-plus">+</span>
              <span>Upload</span>
            </button>
          </div>
        </div>
        <div class="codex-dashboard-stream"></div>
        <section class="codex-dashboard-empty" hidden>
          <div class="codex-dashboard-empty__inner">
            ${brandMarkup}
            <h2 class="codex-dashboard-empty__title">Your photos will appear here</h2>
            <p class="codex-dashboard-empty__copy">Upload from the top right, then browse everything in a day-based timeline.</p>
          </div>
        </section>`;
      view.insertBefore(shell, view.firstChild);
    }

    if (!shell.dataset.codexBound) {
      shell.dataset.codexBound = 'true';
      shell.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target.closest('[data-action], [data-href]') : null;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        if (target.dataset.href) {
          closeThemeMenus();
          window.location.assign(target.dataset.href);
          return;
        }
        if (target.dataset.action === 'theme-toggle') {
          const switcher = target.closest('.codex-theme-switcher');
          if (!(switcher instanceof HTMLElement)) {
            return;
          }
          const willOpen = !switcher.classList.contains('is-open');
          closeThemeMenus(willOpen ? switcher : null);
          switcher.classList.toggle('is-open', willOpen);
          target.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
          return;
        }
        if (target.dataset.action === 'theme-color-select') {
          const currentTheme = getCurrentThemePreference();
          commitThemePreference({
            themeColor: target.getAttribute('data-theme-color') || currentTheme.themeColor,
            themeMode: currentTheme.themeMode
          });
          closeThemeMenus();
          return;
        }
        if (target.dataset.action === 'theme-mode-select') {
          const currentTheme = getCurrentThemePreference();
          commitThemePreference({
            themeColor: currentTheme.themeColor,
            themeMode: target.getAttribute('data-theme-mode') || currentTheme.themeMode
          });
          closeThemeMenus();
          return;
        }
      });
    }

    const media = [];
    const seen = new Set();
    view.querySelectorAll('.list-view img[src], .el-image__inner[src], .image-wrapper img[src]').forEach((node) => {
      if (!(node instanceof HTMLImageElement)) {
        return;
      }
      const src = node.getAttribute('src');
      if (!src || src === LOGO_PATH || seen.has(src)) {
        return;
      }
      if (node.closest('.codex-dashboard-shell-v2, .codex-brand-lockup, .el-empty')) {
        return;
      }
      const width = node.naturalWidth || node.width;
      const height = node.naturalHeight || node.height;
      if (width && height && (width < 80 || height < 80)) {
        return;
      }
      seen.add(src);
      media.push({
        src,
        label: node.getAttribute('alt') || node.getAttribute('title') || '',
        dateLabel: inferDateLabel(node)
      });
    });

    const stream = shell.querySelector('.codex-dashboard-stream');
    const empty = shell.querySelector('.codex-dashboard-empty');
    if (!(stream instanceof HTMLElement) || !(empty instanceof HTMLElement)) {
      return;
    }

    if (!media.length) {
      stream.innerHTML = '';
      stream.hidden = true;
      empty.hidden = false;
      return;
    }

    stream.hidden = false;
    empty.hidden = true;

    const groupedMedia = [];
    for (const item of media) {
      const lastGroup = groupedMedia[groupedMedia.length - 1];
      if (!lastGroup || lastGroup.label !== item.dateLabel) {
        groupedMedia.push({ label: item.dateLabel, items: [item] });
      } else {
        lastGroup.items.push(item);
      }
    }

    stream.innerHTML = groupedMedia.map((group) => {
      const cards = group.items.map((item, index) => {
        const cardClass = index === 0 && group.items.length > 2
          ? 'codex-dashboard-media-card is-featured'
          : ((index % 8 === 2 || index % 8 === 5)
            ? 'codex-dashboard-media-card is-wide'
            : ((index % 6 === 3 || index % 6 === 4)
              ? 'codex-dashboard-media-card is-tall'
              : 'codex-dashboard-media-card'));
        const alt = item.label || 'Photo';
        return `<article class="${cardClass}"><img class="codex-dashboard-media-card__asset" src="${escapeHtml(item.src)}" alt="${escapeHtml(alt)}" loading="lazy"></article>`;
      }).join('');

      return `
        <section class="codex-dashboard-day-group">
          <header class="codex-dashboard-day-group__header">
            <h2 class="codex-dashboard-day-group__title">${escapeHtml(group.label)}</h2>
          </header>
          <div class="codex-dashboard-gallery">${cards}</div>
        </section>`;
    }).join('');
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
    if (path.startsWith('/login') || path.startsWith('/adminLogin')) {
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
    patchExternalLinks(root);
    neutralizeElementText(root);
    patchDialogTitles(root);
    root.querySelectorAll('a[href]').forEach(markBlockedLink);
    patchLogin(root);
    patchUploadHomeV2(root);
    patchDashboard(root);
    patchPublicBrowse(root);
    patchEmptyStates(root);
    pruneCredits(root);
    simplifyShareTabs(root);
    syncThemeControls();
  }

  const rawWindowOpen = window.open;
  window.open = function patchedOpen(url, ...args) {
    if (typeof url === 'string' && BLOCKED_URL_PATTERNS.some((pattern) => pattern.test(url))) {
      return null;
    }
    return rawWindowOpen.call(this, url, ...args);
  };

  function boot() {
    commitThemePreference(themePreference, { dispatch: false });
    patchRoot(document);
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('.codex-theme-switcher') : null;
      if (!(target instanceof HTMLElement)) {
        closeThemeMenus();
      }
    });
    window.addEventListener(THEME_CHANGE_EVENT, (event) => {
      if (!event.detail) {
        return;
      }
      themePreference = event.detail;
      syncThemeControls();
    });
    if (systemThemeQuery?.addEventListener) {
      systemThemeQuery.addEventListener('change', () => {
        if (getCurrentThemePreference().themeMode === 'auto') {
          commitThemePreference(getCurrentThemePreference());
        }
      });
    } else if (systemThemeQuery?.addListener) {
      systemThemeQuery.addListener(() => {
        if (getCurrentThemePreference().themeMode === 'auto') {
          commitThemePreference(getCurrentThemePreference());
        }
      });
    }
    const observer = new MutationObserver((records) => {
      applyRouteClass();
      records.forEach((record) => {
        record.addedNodes.forEach((node) => patchRoot(node));
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    syncThemeControls();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
