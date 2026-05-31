function ensureLoginStyles(doc) {
  if (doc.querySelector('[data-login-app-style="1"]')) {
    return;
  }
  const style = doc.createElement('style');
  style.setAttribute('data-login-app-style', '1');
  style.textContent = [
    ':root{color-scheme:light;}',
    'body{margin:0;background:linear-gradient(180deg,#eef5ff 0%,#f8fbff 45%,#edf2f7 100%);color:#152033;font-family:"Segoe UI",Arial,sans-serif;}',
    '#app{min-height:100vh;}',
    '.sla-login{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(circle at 12% 14%,rgba(165,194,255,0.45),transparent 28%),radial-gradient(circle at 88% 18%,rgba(194,226,255,0.5),transparent 26%),linear-gradient(180deg,#eef5ff 0%,#f9fbff 44%,#edf2f7 100%);}',
    '.sla-login__shell{width:min(100%,430px);padding:34px 30px;border:1px solid rgba(171,188,211,0.42);border-radius:28px;background:rgba(255,255,255,0.96);box-shadow:0 26px 64px rgba(118,145,182,0.18);}',
    '.sla-login__eyebrow{margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#7185a6;}',
    '.sla-login__title{margin:0 0 8px;font-size:31px;line-height:1.08;font-weight:700;color:#182536;}',
    '.sla-login__copy{margin:0 0 24px;color:#5b6e87;font-size:14px;line-height:1.55;}',
    '.sla-login__form{display:grid;gap:16px;}',
    '.sla-login__field{display:grid;gap:8px;}',
    '.sla-login__label{font-size:13px;font-weight:600;color:#43556f;}',
    '.sla-login__input{width:100%;box-sizing:border-box;padding:14px 15px;border-radius:16px;border:1px solid rgba(174,190,212,0.75);background:rgba(249,251,255,0.96);color:#182433;font-size:15px;line-height:1.4;outline:none;appearance:none;-webkit-appearance:none;box-shadow:inset 0 1px 0 rgba(255,255,255,0.72);}',
    '.sla-login__input::placeholder{color:#8d9cb1;}',
    '.sla-login__input:focus{border-color:#88abff;box-shadow:0 0 0 4px rgba(136,171,255,0.18);background:#ffffff;}',
    '.sla-login__error{min-height:20px;margin:0;color:#c1556a;font-size:13px;line-height:1.45;}',
    '.sla-login__submit{width:100%;padding:14px 16px;border:0;border-radius:16px;background:linear-gradient(180deg,#7ca5ff 0%,#5d87ff 100%);color:#ffffff;font-size:15px;font-weight:700;letter-spacing:.01em;cursor:pointer;box-shadow:0 14px 28px rgba(93,135,255,0.22);}',
    '.sla-login__submit:hover{filter:brightness(1.02);}',
    '.sla-login__submit[disabled]{opacity:.64;cursor:wait;box-shadow:none;}',
    '.sla-login__hint{margin:16px 0 0;font-size:12px;color:#7e8fa7;text-align:center;}',
    '@media (max-width: 640px){.sla-login{padding:20px;}.sla-login__shell{width:min(100%,460px);padding:28px 22px;border-radius:24px;}.sla-login__title{font-size:28px;}.sla-login__input,.sla-login__submit{padding:15px 16px;}}'
  ].join('');
  doc.head.appendChild(style);
}

export function createLoginMarkup(state) {
  const buttonLabel = state.isCheckingSession ? 'Checking session...' : state.isLoading ? 'Logging in...' : 'Login';
  const errorMarkup = state.error ? state.error : '';
  return `
    <main class="sla-login">
      <section class="sla-login__shell" aria-label="Login shell">
        <p class="sla-login__eyebrow">SUNDOWNER</p>
        <h1 class="sla-login__title">Admin Login</h1>
        <p class="sla-login__copy">Sign in to manage your photo library.</p>
        <form class="sla-login__form" data-login-form="1">
          <label class="sla-login__field">
            <span class="sla-login__label">Username</span>
            <input class="sla-login__input" data-login-field="username" name="username" type="text" autocomplete="username" value="${state.username}">
          </label>
          <label class="sla-login__field">
            <span class="sla-login__label">Password</span>
            <input class="sla-login__input" data-login-field="password" name="password" type="password" autocomplete="current-password" value="${state.password}">
          </label>
          <p class="sla-login__error" data-login-error="1" aria-live="polite">${errorMarkup}</p>
          <button class="sla-login__submit" data-login-submit="1" type="submit" ${state.isLoading || state.isCheckingSession ? 'disabled' : ''}>${buttonLabel}</button>
        </form>
        <p class="sla-login__hint">You will be redirected to your library after a successful sign in.</p>
      </section>
    </main>
  `.trim();
}

export function getSafeLoginRedirect(locationImpl = window.location) {
  let params;
  try {
    params = new URLSearchParams(locationImpl.search || '');
  } catch {
    return '/dashboard';
  }

  const rawNext = params.get('next') || '';
  if (!rawNext || rawNext.startsWith('//')) {
    return '/dashboard';
  }

  try {
    const origin = locationImpl.origin || 'http://localhost';
    const target = new URL(rawNext, origin);
    if (target.origin !== origin || !target.pathname.startsWith('/dashboard')) {
      return '/dashboard';
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return '/dashboard';
  }
}

export async function submitAdminLogin(state, deps) {
  const { fetchImpl, redirectImpl, getRedirectTarget = () => '/dashboard' } = deps;
  if (state.isLoading) {
    return { redirected: false };
  }

  state.isLoading = true;
  state.error = '';
  deps.render();

  try {
    const response = await fetchImpl('/api/manage/auth-session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: state.username, password: state.password }),
    });

    if (response.status === 401) {
      state.error = 'Invalid username or password';
    } else if (response.ok) {
      redirectImpl(getRedirectTarget());
      return { redirected: true };
    } else {
      state.error = 'Login failed, please try again';
    }
  } catch {
    state.error = 'Network error, please try again';
  }

  state.isLoading = false;
  deps.render();
  return { redirected: false };
}

export async function redirectIfAlreadySignedIn({ fetchImpl, redirectImpl, getRedirectTarget }) {
  try {
    const response = await fetchImpl('/api/manage/me', {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      return false;
    }
    const data = await response.json();
    if (data?.username) {
      redirectImpl(getRedirectTarget());
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function mountLoginApp({ document = window.document, fetchImpl = window.fetch.bind(window), locationImpl = window.location } = {}) {
  const root = document.getElementById('app');
  if (!root) {
    return null;
  }

  ensureLoginStyles(document);

  const state = {
    username: '',
    password: '',
    error: '',
    isLoading: false,
    isCheckingSession: true,
  };

  const getRedirectTarget = () => getSafeLoginRedirect(locationImpl);

  const render = () => {
    root.innerHTML = createLoginMarkup(state);
    const form = root.querySelector('[data-login-form="1"]');
    const usernameInput = root.querySelector('[data-login-field="username"]');
    const passwordInput = root.querySelector('[data-login-field="password"]');
    const submitButton = root.querySelector('[data-login-submit="1"]');

    if (usernameInput) {
      usernameInput.addEventListener('input', (event) => {
        state.username = event.target.value;
      });
    }

    if (passwordInput) {
      passwordInput.addEventListener('input', (event) => {
        state.password = event.target.value;
      });
    }

    if (form) {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        state.username = usernameInput ? usernameInput.value : state.username;
        state.password = passwordInput ? passwordInput.value : state.password;
        await submitAdminLogin(state, {
          fetchImpl,
          redirectImpl: (href) => locationImpl.assign(href),
          getRedirectTarget,
          render,
        });
      });
    }

    if (!state.isLoading && !state.isCheckingSession && submitButton) {
      submitButton.disabled = false;
    }

    if (!state.isCheckingSession && !state.username && usernameInput && typeof usernameInput.focus === 'function') {
      usernameInput.focus();
    }
  };

  render();
  void redirectIfAlreadySignedIn({
    fetchImpl,
    redirectImpl: (href) => locationImpl.assign(href),
    getRedirectTarget,
  }).finally(() => {
    state.isCheckingSession = false;
    render();
  });
  return { state, render };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  mountLoginApp();
}
