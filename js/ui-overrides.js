(function () {
  const BRAND_REPLACEMENTS = [
    [/Sanyue ImgHub/gi, 'Moments Drive'],
    [/Sanyue 鍥惧簥/gi, 'Moments Drive'],
    [/SanyueQi/gi, 'Aschenbath'],
    [/sanyue_imghub/gi, 'moments_drive'],
    [/Sanyue/gi, 'Moments']
  ];

  const BLOCKED_URL_PATTERNS = [
    /cfbed\.sanyue\.de/i,
    /github\.com\/MarSeventh\/CloudFlare-ImgBed/i
  ];

  function replaceBrandingInText(text) {
    let value = text;
    for (const [pattern, replacement] of BRAND_REPLACEMENTS) {
      value = value.replace(pattern, replacement);
    }
    return value;
  }

  function neutralizeTextNode(node) {
    if (!node || !node.nodeValue) {
      return;
    }
    const replaced = replaceBrandingInText(node.nodeValue);
    if (replaced !== node.nodeValue) {
      node.nodeValue = replaced;
    }
  }

  function neutralizeElementText(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const touched = [];
    while (walker.nextNode()) {
      touched.push(walker.currentNode);
    }
    touched.forEach(neutralizeTextNode);
  }

  function markBlockedLink(link) {
    if (!link || !link.href) {
      return;
    }
    if (BLOCKED_URL_PATTERNS.some((pattern) => pattern.test(link.href))) {
      link.dataset.codexHidden = 'true';
      link.setAttribute('aria-hidden', 'true');
    }
  }

  function hidePersonalCredits(root) {
    root.querySelectorAll('a[href]').forEach(markBlockedLink);

    root.querySelectorAll('p,span,div,strong,small').forEach((el) => {
      const text = (el.textContent || '').trim();
      if (!text || text.length > 120) {
        return;
      }
      if (/Designed by/i.test(text) || /Powered By/i.test(text) || /CloudFlare-ImgBed/i.test(text)) {
        el.dataset.codexHidden = 'true';
      }
    });
  }

  function patchTitle() {
    if (document.title) {
      document.title = replaceBrandingInText(document.title);
    }
  }

  function patchMeta() {
    document.querySelectorAll('meta[name="description"], meta[name="keywords"], meta[name="author"]').forEach((meta) => {
      if (meta.content) {
        meta.content = replaceBrandingInText(meta.content);
      }
    });
  }

  function optimizeMedia(root) {
    root.querySelectorAll('img').forEach((img) => {
      if (!img.hasAttribute('loading')) {
        img.loading = 'lazy';
      }
      img.decoding = 'async';
    });

    root.querySelectorAll('video').forEach((video) => {
      if (!video.getAttribute('preload')) {
        video.setAttribute('preload', 'metadata');
      }
      if (!video.hasAttribute('playsinline')) {
        video.setAttribute('playsinline', '');
      }
    });
  }

  function simplifyShareTabs(root) {
    root.querySelectorAll('[role="tab"], .el-tabs__item').forEach((tab) => {
      const text = (tab.textContent || '').trim().toLowerCase();
      if (text === 'bbcode' || text === 'html') {
        tab.dataset.codexHidden = 'true';
      }
    });
  }

  function patchRoot(root) {
    if (!root || !(root instanceof Element || root instanceof Document)) {
      return;
    }
    patchTitle();
    patchMeta();
    neutralizeElementText(root);
    hidePersonalCredits(root);
    optimizeMedia(root);
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
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            neutralizeTextNode(node);
            return;
          }
          if (node.nodeType === Node.ELEMENT_NODE) {
            patchRoot(node);
          }
        });
      });
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();