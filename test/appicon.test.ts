import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iconPng, iconSvg, manifest } from '../src/server/appicon.ts';
import { getTheme } from '../src/shared/themes.ts';

test('svg favicon uses the theme colors', () => {
  const svg = iconSvg('night-owl');
  const t = getTheme('night-owl')!;
  assert.ok(svg.includes(t.bg) && svg.includes(t.accent) && svg.includes(t.hint));
  assert.ok(iconSvg('not-a-theme').includes(getTheme('midnight')!.bg), 'unknown themes fall back to the default');
});

test('png icons are valid PNGs of the requested size and are cached', () => {
  const png = iconPng(64, 'dracula');
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.readUInt32BE(16), 64, 'IHDR width');
  assert.equal(png.readUInt32BE(20), 64, 'IHDR height');
  assert.equal(iconPng(64, 'dracula'), png, 'same buffer from cache');
  assert.notEqual(iconPng(64, 'midnight').equals(png), true, 'different theme, different pixels');
});

test('manifest names the app and points icons at the themed versions', () => {
  const m = manifest('gruvbox') as { name: string; theme_color: string; icons: { src: string }[] };
  assert.equal(m.name, 'Abode');
  assert.equal(m.theme_color, getTheme('gruvbox')!.bg);
  assert.ok(m.icons.every((i) => i.src.endsWith('?theme=gruvbox')));
  assert.ok((manifest() as { icons: { src: string }[] }).icons.every((i) => !i.src.includes('?')), 'default theme needs no query');
});
