export const THEME_COLOR_STORAGE_KEY = 'sundowner-theme-color';
export const THEME_MODE_STORAGE_KEY = 'sundowner-theme-mode';
export const LEGACY_UI_THEME_STORAGE_KEY = 'sundowner-ui-theme';
export const LEGACY_MEDIA_LIBRARY_THEME_STORAGE_KEY = 'codex-media-library-theme';
export const THEME_CHANGE_EVENT = 'sundowner:theme-change';

export const DEFAULT_THEME_COLOR = 'horizon';
export const DEFAULT_THEME_MODE = 'auto';

export const THEME_COLOR_OPTIONS = [
  { key: 'editorial', label: 'Editorial', swatch: '#8ea2ff' },
  { key: 'clover', label: 'Clover', swatch: '#63c98a' },
  { key: 'horizon', label: 'Horizon', swatch: '#8ea2ff' },
  { key: 'lily', label: 'Lily', swatch: '#ca4f9f' },
  { key: 'marigold', label: 'Marigold', swatch: '#db8f1a' },
  { key: 'royal', label: 'Royal', swatch: '#2f7ed4' },
  { key: 'violet', label: 'Violet', swatch: '#9b65ff' }
];

export const THEME_MODE_OPTIONS = [
  { key: 'auto', label: 'Auto' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' }
];

const LIGHT_LEGACY_THEME_COLORS = new Set(['lily', 'marigold']);
const META_THEME_COLORS = {
  editorial: { light: '#eff1f6', dark: '#181a20' },
  clover: { light: '#edf6ef', dark: '#15201b' },
  horizon: { light: '#eef3fb', dark: '#171d2a' },
  lily: { light: '#f8eff6', dark: '#201722' },
  marigold: { light: '#faf4e9', dark: '#21180d' },
  royal: { light: '#eef4fb', dark: '#171a2b' },
  violet: { light: '#f3eefb', dark: '#181226' }
};

export function normalizeThemeColor(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return THEME_COLOR_OPTIONS.some((theme) => theme.key === normalized) ? normalized : DEFAULT_THEME_COLOR;
}

export function normalizeThemeMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return THEME_MODE_OPTIONS.some((mode) => mode.key === normalized) ? normalized : DEFAULT_THEME_MODE;
}

export function normalizeLegacyThemeColor(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'editorial-dark') {
    return 'editorial';
  }
  return normalizeThemeColor(normalized);
}

export function inferLegacyThemeMode(value) {
  const color = normalizeLegacyThemeColor(value);
  return LIGHT_LEGACY_THEME_COLORS.has(color) ? 'light' : 'dark';
}

export function resolveThemeMode(themeMode, matchMedia = globalThis?.matchMedia) {
  const normalizedMode = normalizeThemeMode(themeMode);
  if (normalizedMode !== 'auto') {
    return normalizedMode;
  }
  try {
    return matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function getThemeColorConfig(themeColor) {
  return THEME_COLOR_OPTIONS.find((theme) => theme.key === themeColor) || THEME_COLOR_OPTIONS.find((theme) => theme.key === DEFAULT_THEME_COLOR) || THEME_COLOR_OPTIONS[0];
}

export function getThemeModeConfig(themeMode) {
  return THEME_MODE_OPTIONS.find((mode) => mode.key === themeMode) || THEME_MODE_OPTIONS.find((mode) => mode.key === DEFAULT_THEME_MODE) || THEME_MODE_OPTIONS[0];
}

export function formatThemeModeLabel(themeMode, resolvedThemeMode) {
  const mode = normalizeThemeMode(themeMode);
  if (mode === 'auto') {
    return `Auto · ${getThemeModeConfig(resolveThemeMode(resolvedThemeMode)).label}`;
  }
  return getThemeModeConfig(mode).label;
}

export function formatThemeSummary(themeColor, themeMode, resolvedThemeMode) {
  const colorLabel = getThemeColorConfig(normalizeThemeColor(themeColor)).label;
  return `${colorLabel} · ${formatThemeModeLabel(themeMode, resolvedThemeMode)}`;
}

function safeStorageGet(storage, key) {
  try {
    return storage?.getItem?.(key) ?? null;
  } catch {
    return null;
  }
}

function safeStorageSet(storage, key, value) {
  try {
    storage?.setItem?.(key, value);
  } catch {
    // Ignore storage failures and keep the UI responsive.
  }
}

export function loadThemePreference({
  storage = globalThis?.localStorage,
  matchMedia = globalThis?.matchMedia
} = {}) {
  const storedColor = safeStorageGet(storage, THEME_COLOR_STORAGE_KEY);
  const storedMode = safeStorageGet(storage, THEME_MODE_STORAGE_KEY);
  const legacyUiTheme = safeStorageGet(storage, LEGACY_UI_THEME_STORAGE_KEY);
  const legacyMediaTheme = safeStorageGet(storage, LEGACY_MEDIA_LIBRARY_THEME_STORAGE_KEY);
  const legacyTheme = legacyUiTheme || legacyMediaTheme || '';

  const hasStoredColor = !!storedColor;
  const hasStoredMode = !!storedMode;
  const hasLegacyTheme = !!legacyTheme;

  const themeColor = hasStoredColor
    ? normalizeThemeColor(storedColor)
    : hasLegacyTheme
      ? normalizeLegacyThemeColor(legacyTheme)
      : DEFAULT_THEME_COLOR;

  const themeMode = hasStoredMode
    ? normalizeThemeMode(storedMode)
    : hasLegacyTheme
      ? inferLegacyThemeMode(legacyTheme)
      : DEFAULT_THEME_MODE;

  const resolvedThemeMode = resolveThemeMode(themeMode, matchMedia);

  if (!hasStoredColor || !hasStoredMode) {
    persistThemePreference({ themeColor, themeMode }, { storage });
  }

  return { themeColor, themeMode, resolvedThemeMode };
}

export function persistThemePreference(preference, { storage = globalThis?.localStorage } = {}) {
  const themeColor = normalizeThemeColor(preference?.themeColor);
  const themeMode = normalizeThemeMode(preference?.themeMode);
  safeStorageSet(storage, THEME_COLOR_STORAGE_KEY, themeColor);
  safeStorageSet(storage, THEME_MODE_STORAGE_KEY, themeMode);
  return { themeColor, themeMode, resolvedThemeMode: resolveThemeMode(themeMode) };
}

export function getMetaThemeColor(themeColor, resolvedThemeMode) {
  const normalizedColor = normalizeThemeColor(themeColor);
  const normalizedMode = resolveThemeMode(resolvedThemeMode);
  return META_THEME_COLORS[normalizedColor]?.[normalizedMode] || META_THEME_COLORS[DEFAULT_THEME_COLOR][normalizedMode];
}

export function applyThemeToDocument(preference, { document = globalThis?.document } = {}) {
  if (!document?.documentElement) {
    return preference;
  }
  const html = document.documentElement;
  const themeColor = normalizeThemeColor(preference?.themeColor);
  const themeMode = normalizeThemeMode(preference?.themeMode);
  const resolvedThemeMode = resolveThemeMode(preference?.themeMode);
  html.setAttribute('data-ui-theme-color', themeColor);
  html.setAttribute('data-ui-theme-mode', resolvedThemeMode);
  html.setAttribute('data-ui-theme-mode-preference', themeMode);
  html.style.colorScheme = resolvedThemeMode;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', getMetaThemeColor(themeColor, resolvedThemeMode));
  }
  return { themeColor, themeMode, resolvedThemeMode };
}

export function applyThemeToElement(element, preference, { attributePrefix = 'cml' } = {}) {
  if (!(element instanceof HTMLElement)) {
    return preference;
  }
  const themeColor = normalizeThemeColor(preference?.themeColor);
  const themeMode = normalizeThemeMode(preference?.themeMode);
  const resolvedThemeMode = resolveThemeMode(preference?.themeMode);
  element.setAttribute(`data-${attributePrefix}-theme-color`, themeColor);
  element.setAttribute(`data-${attributePrefix}-theme-mode`, resolvedThemeMode);
  element.setAttribute(`data-${attributePrefix}-theme-mode-preference`, themeMode);
  element.style.colorScheme = resolvedThemeMode;
  return { themeColor, themeMode, resolvedThemeMode };
}

export function dispatchThemeChange(preference, { target = globalThis } = {}) {
  if (!target?.dispatchEvent || typeof CustomEvent !== 'function') {
    return;
  }
  target.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: preference }));
}
