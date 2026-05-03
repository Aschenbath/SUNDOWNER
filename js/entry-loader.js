(function () {
  var path = window.location.pathname || '/';
  if (path === '/dashboard' || path.indexOf('/dashboard/') === 0) {
    return;
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

  if (path === '/login') {
    loadScript('/js/login-app.js?v=1', null, null, 'module');
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
        console.warn('[legacy-locale] JSON.parse candidate', {
          type: typeof value,
          length: length,
          preview: isString ? value.slice(0, 120) : value,
          hasLogin: hasLogin,
          hasUpload: hasUpload,
          hasPassword: hasPassword,
          hasChineseLogin: hasChineseLogin
        });
        var isLegacyLocalePayload = isString && length > 1000 && hasLogin && (hasPassword || hasUpload || hasChineseLogin);
        if (isLegacyLocalePayload) {
          console.warn('[legacy-locale] corrupted built-in locale payload ignored', error);
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
