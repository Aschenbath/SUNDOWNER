const badJsonWarnedKeys = new Set();

export function loadJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    if (!badJsonWarnedKeys.has(key)) {
      badJsonWarnedKeys.add(key);
      console.warn('[media-library] invalid localStorage JSON cleared', key, error);
    }
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore localStorage cleanup failures and keep fallback behavior.
    }
    return fallback;
  }
}

export function saveJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Ignore local persistence failures and keep the UI responsive.
  }
}
