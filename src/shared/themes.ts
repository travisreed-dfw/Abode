/**
 * Color themes. Each theme is a handful of base colors; everything else the
 * stylesheet needs (glows, tints, backings) is derived here so the table stays
 * short. `midnight` must match the :root block in style.css, which is what a
 * page shows before any theme is applied (a test guards that).
 *
 * Palettes are inspired by well-known editor themes and named after them.
 */
export type Theme = {
  id: string;
  label: string;
  scheme: 'dark' | 'light';
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  borderStrong: string;
  fg: string;
  muted: string;
  accent: string;
  accentStrong: string;
  accentFg: string;
  danger: string;
  hint: string;
};

export const DEFAULT_THEME_ID = 'midnight';

export const THEMES: readonly Theme[] = [
  { id: 'midnight', label: 'Midnight (default)', scheme: 'dark', bg: '#0c0e12', surface: '#14171e', surface2: '#1a1e27', border: '#262b37', borderStrong: '#343b4a', fg: '#e8eaf0', muted: '#8f97aa', accent: '#7c9cff', accentStrong: '#5b7fff', accentFg: '#0b1020', danger: '#ff6b7a', hint: '#ffc452' },
  { id: 'dracula', label: 'Dracula', scheme: 'dark', bg: '#1e1f29', surface: '#282a36', surface2: '#2f313f', border: '#3b3d4d', borderStrong: '#44475a', fg: '#f8f8f2', muted: '#8b93b7', accent: '#bd93f9', accentStrong: '#a97ff0', accentFg: '#1e1f29', danger: '#ff5555', hint: '#f1fa8c' },
  { id: 'monokai', label: 'Monokai', scheme: 'dark', bg: '#1e1f1c', surface: '#272822', surface2: '#2e2f29', border: '#3a3b34', borderStrong: '#49483e', fg: '#f8f8f2', muted: '#9a9788', accent: '#a6e22e', accentStrong: '#8fd118', accentFg: '#1e1f1c', danger: '#f92672', hint: '#e6db74' },
  { id: 'one-dark', label: 'One Dark', scheme: 'dark', bg: '#21252b', surface: '#282c34', surface2: '#2c313a', border: '#3a3f4b', borderStrong: '#4b5263', fg: '#abb2bf', muted: '#7f8794', accent: '#61afef', accentStrong: '#4d9fe6', accentFg: '#1b1f24', danger: '#e06c75', hint: '#e5c07b' },
  { id: 'solarized-dark', label: 'Solarized Dark', scheme: 'dark', bg: '#00212b', surface: '#002b36', surface2: '#073642', border: '#0e4452', borderStrong: '#1d5563', fg: '#eee8d5', muted: '#839496', accent: '#268bd2', accentStrong: '#1f7bbd', accentFg: '#fdf6e3', danger: '#dc322f', hint: '#b58900' },
  { id: 'nord', label: 'Nord', scheme: 'dark', bg: '#242933', surface: '#2e3440', surface2: '#353c4a', border: '#3b4252', borderStrong: '#4c566a', fg: '#eceff4', muted: '#9aa5bd', accent: '#88c0d0', accentStrong: '#6fb0c4', accentFg: '#242933', danger: '#bf616a', hint: '#ebcb8b' },
  { id: 'gruvbox', label: 'Gruvbox Dark', scheme: 'dark', bg: '#1d2021', surface: '#282828', surface2: '#32302f', border: '#3c3836', borderStrong: '#504945', fg: '#ebdbb2', muted: '#a89984', accent: '#83a598', accentStrong: '#6f9488', accentFg: '#1d2021', danger: '#fb4934', hint: '#fabd2f' },
  { id: 'tokyo-night', label: 'Tokyo Night', scheme: 'dark', bg: '#16161e', surface: '#1a1b26', surface2: '#24283b', border: '#292e42', borderStrong: '#3b4261', fg: '#c0caf5', muted: '#7982a9', accent: '#7aa2f7', accentStrong: '#5d8cf0', accentFg: '#16161e', danger: '#f7768e', hint: '#e0af68' },
  { id: 'catppuccin', label: 'Catppuccin Mocha', scheme: 'dark', bg: '#181825', surface: '#1e1e2e', surface2: '#252538', border: '#313244', borderStrong: '#45475a', fg: '#cdd6f4', muted: '#9399b2', accent: '#89b4fa', accentStrong: '#6fa3f8', accentFg: '#181825', danger: '#f38ba8', hint: '#f9e2af' },
  { id: 'github-dark', label: 'GitHub Dark', scheme: 'dark', bg: '#0d1117', surface: '#161b22', surface2: '#1c2129', border: '#30363d', borderStrong: '#444c56', fg: '#e6edf3', muted: '#8b949e', accent: '#58a6ff', accentStrong: '#3f92f5', accentFg: '#0d1117', danger: '#f85149', hint: '#d29922' },
  // SynthWave '84 (Robb Owen): sidebar/editor purples, neon pink accent, yellow keywords.
  { id: 'synthwave', label: "SynthWave '84", scheme: 'dark', bg: '#241b2f', surface: '#262335', surface2: '#2a2139', border: '#3a2f4d', borderStrong: '#4d3f66', fg: '#f4effb', muted: '#848bbd', accent: '#ff7edb', accentStrong: '#f65fcf', accentFg: '#241b2f', danger: '#fe4450', hint: '#fede5d' },
  // Pink Cat Boo (ftsamoyed): navy surfaces, salmon-pink accent, lavender-white text.
  { id: 'pink-cat-boo', label: 'Pink Cat Boo', scheme: 'dark', bg: '#202330', surface: '#2d2f42', surface2: '#353850', border: '#3d4057', borderStrong: '#4f5273', fg: '#fff0f5', muted: '#a09dba', accent: '#fe7c8e', accentStrong: '#f5657a', accentFg: '#202330', danger: '#ff62a5', hint: '#ffc85b' },
  // Doki Theme, Nekopara Chocola (Unthrottled): cocoa browns with a pink accent.
  { id: 'chocola', label: 'Doki: Nekopara Chocola', scheme: 'dark', bg: '#282023', surface: '#30292c', surface2: '#382f33', border: '#3f3639', borderStrong: '#514549', fg: '#e6dfe1', muted: '#a3969a', accent: '#f771a3', accentStrong: '#ef5c95', accentFg: '#282023', danger: '#ff6b75', hint: '#f8a35f' },
  { id: 'night-owl', label: 'Night Owl', scheme: 'dark', bg: '#011627', surface: '#0b2942', surface2: '#12314d', border: '#1d3b53', borderStrong: '#2a4a63', fg: '#d6deeb', muted: '#7e97ae', accent: '#82aaff', accentStrong: '#6a99ff', accentFg: '#011627', danger: '#ef5350', hint: '#ecc48d' },
  { id: 'solarized-light', label: 'Solarized Light', scheme: 'light', bg: '#fdf6e3', surface: '#f5eedb', surface2: '#eee8d5', border: '#dcd5c0', borderStrong: '#c9c2ad', fg: '#586e75', muted: '#839496', accent: '#268bd2', accentStrong: '#1f7bbd', accentFg: '#fdf6e3', danger: '#dc322f', hint: '#b58900' },
  { id: 'github-light', label: 'GitHub Light', scheme: 'light', bg: '#ffffff', surface: '#f6f8fa', surface2: '#eef1f4', border: '#d0d7de', borderStrong: '#afb8c1', fg: '#1f2328', muted: '#656d76', accent: '#0969da', accentStrong: '#0757b8', accentFg: '#ffffff', danger: '#cf222e', hint: '#9a6700' },
];

export function getTheme(id: string): Theme | undefined {
  return THEMES.find((t) => t.id === id);
}

export function isThemeId(id: unknown): id is string {
  return typeof id === 'string' && getTheme(id) !== undefined;
}

export function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** The CSS custom properties (and color-scheme) a theme sets on <html>. */
export function themeVars(t: Theme): Record<string, string> {
  const light = t.scheme === 'light';
  return {
    'color-scheme': t.scheme,
    '--bg': t.bg,
    '--glow': rgba(t.accent, light ? 0.12 : 0.16),
    '--surface': t.surface,
    '--surface-2': t.surface2,
    '--border': t.border,
    '--border-strong': t.borderStrong,
    '--fg': t.fg,
    '--muted': t.muted,
    '--accent': t.accent,
    '--accent-strong': t.accentStrong,
    '--accent-fg': t.accentFg,
    '--accent-glow': rgba(t.accent, 0.35),
    '--danger': t.danger,
    '--danger-glow': rgba(t.danger, 0.2),
    '--on-danger': '#ffffff',
    '--hint-bg': rgba(t.hint, light ? 0.14 : 0.1),
    '--hint-border': rgba(t.hint, 0.35),
    '--hint-fg': light ? t.hint : lighten(t.hint),
    '--icon-backing': light ? '#ffffff' : '#f3f4f8',
    '--tile-ring': light ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.06)',
    '--tile-fg': '#ffffff',
    '--shadow': light
      ? '0 1px 0 rgba(255, 255, 255, 0.6) inset, 0 8px 24px rgba(0, 0, 0, 0.08)'
      : '0 1px 0 rgba(255, 255, 255, 0.03) inset, 0 8px 24px rgba(0, 0, 0, 0.35)',
  };
}

/** Hint text on dark themes is the hint color pushed 23% toward white (#ffc452 → #ffd27a, the default). */
function lighten(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number): number => Math.round(c + (255 - c) * 0.23);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
