(function () {
  var path = window.location.pathname || '/';
  var search = window.location.search || '';
  var hash = window.location.hash || '';
  var mediaPreloadHrefs = [
    '/js/media-library/app.js?v=355',
    '/js/media-library/components.js?v=121',
    '/js/media-library/films-components.js?v=81',
    '/js/theme-system.js?v=2'
  ];

  function safeDecodeQueryPart(value) {
    try {
      return decodeURIComponent(String(value || '').replace(/\+/g, ' '));
    } catch (error) {
      return String(value || '');
    }
  }

  function hasSearchParam(name, expectedValue) {
    var query = search.charAt(0) === '?' ? search.slice(1) : search;
    if (!query) {
      return false;
    }
    return query.split('&').some(function (part) {
      var pair = part.split('=');
      var key = safeDecodeQueryPart(pair[0]);
      var value = safeDecodeQueryPart(pair.slice(1).join('='));
      return key === name && (expectedValue === undefined || value === expectedValue);
    });
  }

  function hasPendingUploadRequest() {
    return hasSearchParam('cmlUpload', '1') || hash === '#upload';
  }

  function shouldLoadMediaLibrary() {
    if (path === '/dashboard' || path.indexOf('/dashboard/') === 0) {
      return true;
    }
    if (path !== '/') {
      return false;
    }
    if (hasSearchParam('cmlNative', '1') || hasPendingUploadRequest()) {
      return false;
    }
    return true;
  }

  function appendLink(rel, href) {
    var link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    document.head.appendChild(link);
    return link;
  }

  function moveLinkAfterParserStyles(link) {
    function move() {
      if (link && link.parentNode === document.head && document.head.lastChild !== link) {
        document.head.appendChild(link);
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', move);
    } else {
      move();
    }
  }

  function loadScript(src, next, cleanup, type) {
    var script = document.createElement('script');
    script.defer = true;
    script.src = src;
    if (type) {
      script.type = type;
    }
    script.onload = function () {
      if (next) {
        next();
      } else if (cleanup) {
        cleanup();
      }
    };
    script.onerror = function () {
      if (cleanup) {
        cleanup();
      }
    };
    document.head.appendChild(script);
  }

  function loadMediaLibrary() {
    var mediaStyle = appendLink('stylesheet', '/css/media-library.css?v=293');
    moveLinkAfterParserStyles(mediaStyle);
    mediaPreloadHrefs.forEach(function (href) {
      appendLink('modulepreload', href);
    });
    loadScript('/js/media-library/app.js?v=355', null, null, 'module');
  }

  if (shouldLoadMediaLibrary()) {
    loadMediaLibrary();
    return;
  }

  if (path === '/login') {
    loadScript('/js/login-app.js?v=3', null, null, 'module');
    return;
  }

  var nativeJsonParse = JSON.parse;
  var guardInstalled = false;
  var legacyLocaleFallback = {
    login: {
      title: 'Login to SUNDOWNER',
      adminTitle: 'Admin Login',
      password: 'Password',
      username: 'Username',
      passwordPlaceholder: 'Enter auth code',
      usernamePlaceholder: 'Enter username',
      adminPasswordPlaceholder: 'Enter password',
      submit: 'Login',
      success: 'Login successful',
      failed: 'Login failed',
      adminFailed: 'Invalid username or password',
      serverError: 'Server error',
      systemError: 'System error',
      authRequired: 'Please authenticate first!',
      authFailed: 'Authentication failed!'
    },
    upload: {}
  };

  function restoreJsonParse() {
    if (guardInstalled) {
      JSON.parse = nativeJsonParse;
      guardInstalled = false;
    }
  }

  function installJsonParseGuard() {
    if (guardInstalled) {
      return;
    }
    JSON.parse = function (value, reviver) {
      try {
        return nativeJsonParse.call(JSON, value, reviver);
      } catch (error) {
        var isString = typeof value === 'string';
        var hasLogin = isString && value.indexOf('"login"') !== -1;
        var hasUpload = isString && value.indexOf('"upload"') !== -1;
        var hasPassword = isString && value.indexOf('"password"') !== -1;
        var hasChineseLogin = isString && value.indexOf('登录') !== -1;
        var length = isString ? value.length : 0;
        var isLegacyLocalePayload = isString && length > 1000 && hasLogin && (hasPassword || hasUpload || hasChineseLogin);
        if (isLegacyLocalePayload) {
          return legacyLocaleFallback;
        }
        throw error;
      }
    };
    guardInstalled = true;
  }

  installJsonParseGuard();
  loadScript('/js/chunk-vendors.8dadfdfd.js', function () {
    loadScript('/js/app.f0825045.js?v=2', null, restoreJsonParse);
  }, null);
})();
