import type { Context } from '../http.ts';
import { ICON_SIZES, iconPng, iconSvg, manifest } from '../appicon.ts';
import { isThemeId } from '../../shared/themes.ts';
import { DEFAULT_THEME_ID } from '../../shared/themes.ts';

export const ICON_PATHS = new Set(['/favicon.svg', '/manifest.webmanifest', ...Object.keys(ICON_SIZES)]);

/** Favicon, app icons and the manifest, rendered in the theme named by `?theme=`. */
export function serveAppIcon(ctx: Context): boolean {
  if (!ICON_PATHS.has(ctx.pathname)) return false;
  const wanted = ctx.url.searchParams.get('theme');
  const theme = isThemeId(wanted) ? wanted : DEFAULT_THEME_ID;
  const cache = { 'cache-control': 'public, max-age=86400' };
  if (ctx.pathname === '/favicon.svg') {
    ctx.bytes(200, Buffer.from(iconSvg(theme)), 'image/svg+xml', cache);
  } else if (ctx.pathname === '/manifest.webmanifest') {
    ctx.json(200, manifest(theme), { 'content-type': 'application/manifest+json', ...cache });
  } else {
    ctx.bytes(200, iconPng(ICON_SIZES[ctx.pathname], theme), 'image/png', cache);
  }
  return true;
}
