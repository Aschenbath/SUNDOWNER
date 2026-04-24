import assert from 'node:assert/strict';

import {
  THEME_COLOR_STORAGE_KEY,
  THEME_MODE_STORAGE_KEY,
  applyThemeToDocument,
  loadThemePreference,
  normalizeThemeColor,
  normalizeThemeMode,
  resolveThemeMode,
} from '../js/theme-system.js';

class MemoryStorage {
  constructor(initial = {}) {
    this.map = new Map(Object.entries(initial));
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    this.map.set(key, String(value));
  }
}

function createFakeDocument() {
  const attrs = new Map();
  const meta = {
    content: '',
    setAttribute(name, value) {
      this[name] = value;
    }
  };
  return {
    documentElement: {
      style: {},
      setAttribute(name, value) {
        attrs.set(name, value);
      },
      getAttribute(name) {
        return attrs.get(name);
      }
    },
    querySelector(selector) {
      return selector === 'meta[name="theme-color"]' ? meta : null;
    },
    meta
  };
}

describe('theme system', () => {
  it('migrates legacy theme keys into the new color and mode storage keys', () => {
    const storage = new MemoryStorage({
      'codex-media-library-theme': 'lily'
    });

    const preference = loadThemePreference({
      storage,
      matchMedia: () => ({ matches: false })
    });

    assert.equal(preference.themeColor, 'lily');
    assert.equal(preference.themeMode, 'light');
    assert.equal(preference.resolvedThemeMode, 'light');
    assert.equal(storage.getItem(THEME_COLOR_STORAGE_KEY), 'lily');
    assert.equal(storage.getItem(THEME_MODE_STORAGE_KEY), 'light');
  });

  it('resolves auto mode from the current system color scheme', () => {
    assert.equal(resolveThemeMode('auto', () => ({ matches: true })), 'dark');
    assert.equal(resolveThemeMode('auto', () => ({ matches: false })), 'light');
  });

  it('falls back to safe defaults for invalid color and mode values', () => {
    assert.equal(normalizeThemeColor('???'), 'horizon');
    assert.equal(normalizeThemeMode('???'), 'auto');
  });

  it('applies resolved theme attributes and meta theme-color to the document root', () => {
    const fakeDocument = createFakeDocument();

    const applied = applyThemeToDocument(
      { themeColor: 'royal', themeMode: 'dark' },
      { document: fakeDocument }
    );

    assert.equal(applied.themeColor, 'royal');
    assert.equal(applied.resolvedThemeMode, 'dark');
    assert.equal(fakeDocument.documentElement.getAttribute('data-ui-theme-color'), 'royal');
    assert.equal(fakeDocument.documentElement.getAttribute('data-ui-theme-mode'), 'dark');
    assert.equal(fakeDocument.documentElement.getAttribute('data-ui-theme-mode-preference'), 'dark');
    assert.equal(fakeDocument.documentElement.style.colorScheme, 'dark');
    assert.equal(fakeDocument.meta.content, '#171a2b');
  });
});
