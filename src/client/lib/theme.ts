import { DEFAULT_THEME_ID, THEMES, getTheme, themeVars } from '../../shared/themes.js';
import type { Theme } from '../../shared/themes.js';

const CACHE_KEY = 'alias.theme';

/**
 * Sets a theme's variables on <html> and caches them so every page (and the
 * next load, before paint) shows the same colors. The default theme clears
 * the overrides so the stylesheet's own :root values show.
 */
/** Points the favicon, home-screen icon and manifest at versions drawn in this theme's colors. */
export function themeIconLinks(themeId: string): void {
  const q = themeId === DEFAULT_THEME_ID ? '' : `?theme=${themeId}`;
  for (const [selector, path] of [
    ['link[rel="icon"]', '/favicon.svg'],
    ['link[rel="apple-touch-icon"]', '/apple-touch-icon.png'],
    ['link[rel="manifest"]', '/manifest.webmanifest'],
  ] as const) {
    const link = document.querySelector<HTMLLinkElement>(selector);
    if (link) link.href = path + q;
  }
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = (getTheme(themeId) ?? getTheme(DEFAULT_THEME_ID)!).bg;
}

export function applyTheme(id: string): void {
  const theme = getTheme(id) ?? getTheme(DEFAULT_THEME_ID)!;
  const root = document.documentElement;
  const vars = themeVars(theme);
  for (const name of Object.keys(vars)) root.style.removeProperty(name);
  themeIconLinks(theme.id);
  try {
    if (theme.id === DEFAULT_THEME_ID) {
      localStorage.removeItem(CACHE_KEY);
      return;
    }
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
    localStorage.setItem(CACHE_KEY, JSON.stringify({ id: theme.id, vars }));
  } catch {
    // private mode or storage blocked: the theme still applies to this page
  }
}

export function clearTheme(): void {
  applyTheme(DEFAULT_THEME_ID);
}

/** Default first, then dark themes and light themes, each alphabetical. */
export function themeOptions(): Theme[] {
  const rest = THEMES.filter((t) => t.id !== DEFAULT_THEME_ID);
  const byLabel = (a: Theme, b: Theme): number => a.label.localeCompare(b.label);
  return [
    getTheme(DEFAULT_THEME_ID)!,
    ...rest.filter((t) => t.scheme === 'dark').sort(byLabel),
    ...rest.filter((t) => t.scheme === 'light').sort(byLabel),
  ];
}
