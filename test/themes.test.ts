import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_THEME_ID, THEMES, getTheme, isThemeId, rgba, themeVars } from '../src/shared/themes.ts';

const HEX = /^#[0-9a-f]{6}$/;

test('theme table is well formed', () => {
  const ids = new Set<string>();
  for (const t of THEMES) {
    assert.ok(!ids.has(t.id), `duplicate id ${t.id}`);
    ids.add(t.id);
    for (const key of ['bg', 'surface', 'surface2', 'border', 'borderStrong', 'fg', 'muted', 'accent', 'accentStrong', 'accentFg', 'danger', 'hint'] as const) {
      assert.match(t[key], HEX, `${t.id}.${key} must be a 6-digit hex color`);
    }
  }
  assert.ok(isThemeId('dracula'));
  assert.ok(!isThemeId('vaporwave'));
  assert.ok(!isThemeId(3));
  assert.equal(rgba('#7c9cff', 0.35), 'rgba(124, 156, 255, 0.35)');
});

test('the default theme matches the stylesheet :root block, so pages look the same with or without JS', async () => {
  const css = await readFile(new URL('../public/assets/style.css', import.meta.url), 'utf8');
  const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
  const fromCss: Record<string, string> = {};
  for (const m of root.matchAll(/^\s*(--[\w-]+|color-scheme):\s*(.+?);\s*$/gm)) fromCss[m[1]] = m[2];

  const vars = themeVars(getTheme(DEFAULT_THEME_ID)!);
  for (const [name, value] of Object.entries(vars)) {
    if (!(name in fromCss)) continue; // helpers such as --mono or --radius are not theme values
    assert.equal(fromCss[name], value, `${name} differs between style.css and the ${DEFAULT_THEME_ID} theme`);
  }
  assert.ok(Object.keys(vars).length > 15);
});
