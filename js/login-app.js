function ensureLoginStyles(doc) {
  if (doc.querySelector('[data-login-app-style="1"]')) {
    return;
  }
  const style = doc.createElement('style');
  style.setAttribute('data-login-app-style', '1');
  style.textContent = [
    'body{margin:0;background:#101113;color:#f3f6fb;font-family:"Segoe UI",Arial,sans-serif;}',
    '#app{min-height:100vh;}',
    '.sla-login{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(circle at top,rgba(72,96,140,0.22),transparent 42%),#101113;}',
    '.sla-login__shell{width:min(100%,420px);padding:32px 28px;border:1px solid rgba(255,255,255,0.1);border-radius:24px;background:rgba(17,19,23,0.92);box-shadow:0 24px 80px rgba(0,0,0,0.45);}',
    '.sla-login__eyebrow{margin:0 0 10px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#a8b4c7;}',
    '.sla-login__title{margin:0 0 8px;font-size:30px;line-height:1.1;font-weight:700;}',
    '.sla-login__copy{margin:0 0 24px;color:#c7d0de;font-size:14px;line-height:1.5;}',
    '.sla-login__form{display:grid;gap:16px;}',
    '.sla-login__field{display:grid;gap:8px;}',
    '.sla-login__label{font-size:13px;font-weight:600;color:#d6deea;}',
    '.sla-login__input{width:100%;box-sizing:border-box;padding:14px 15px;border-radius:14px;border:1px solid rgba(255,255,255,0.12);background:#171a21;color:#f5f7fb;font-size:15px;outline:none;}',
    '.sla-login__input:focus{border-color:#5d87ff;box-shadow:0 0 0 3px rgba(93,135,255,0.18);}',
    '.sla-login__error{min-height:20px;margin:0;color:#ff9b9b;font-size:13px;}',
    '.sla-login__submit{width:100%;padding:14px 16px;border:0;border-radius:14px;background:linear-gradient(180deg,#5d87ff 0%,#3c67f0 100%);color:#fff;font-size:15px;font-weight:700;cursor:pointer;}',
    '.sla-login__submit[disabled]{opacity:.65;cursor:wait;}',
    '.sla-login__hint{margin:16px 0 0;font-size:12px;color:#95a2b5;text-align:center;}'
  ].join('');
  doc.head.appendChild(style);
}

export function createLoginMarkup(state) {
  const buttonLabel = state.isLoading ? 'Logging in…' : 'Login';
  const errorMarkup = state.error ? state.error : '';
  return `
    <main class="sla-login">
      <section class="sla-login__shell" aria-label="Login shell">
        <p class="sla-login__eyebrow">SUNDOWNER</p>
        <h1 class="sla-login__title">Admin Login</h1>
        <p class="sla-login__copy">Sign in to manage your photo library and archive.</p>
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
          <button class="sla-login__submit" data-login-submit="1" type="submit" ${state.isLoading ? 'disabled' : ''}>${buttonLabel}</button>
        </form>
        <p class="sla-login__hint">You’ll be redirected to /dashboard after a successful sign in.</p>
      </section>
    </main>
  `.trim();
}

export async function submitAdminLogin(state, deps) {
  const { fetchImpl, redirectImpl } = deps;
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
      redirectImpl('/dashboard');
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
  };

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
          render,
        });
      });
    }

    if (!state.isLoading && submitButton) {
      submitButton.disabled = false;
    }

    if (!state.username && usernameInput && typeof usernameInput.focus === 'function') {
      usernameInput.focus();
    }
  };

  render();
  return { state, render };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  mountLoginApp();
}
