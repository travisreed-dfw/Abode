import { deflateSync } from 'node:zlib';
import { DEFAULT_THEME_ID, getTheme } from '../shared/themes.ts';
import type { Theme } from '../shared/themes.ts';

/**
 * Abode's mark: a door ajar with light spilling out, drawn in the colors of a
 * theme so the installed app icon and the tab favicon match what's on screen.
 * The SVG and the PNG rasterizer share one geometry (a 64-unit grid).
 */
type Pt = [number, number];
type Shape = { poly: Pt[]; color: string };

function shapes(t: Theme): Shape[] {
  const light = t.hint;
  return [
    { poly: [[18, 10], [46, 10], [46, 56], [18, 56]], color: t.accent },      // frame, outer
    { poly: [[22, 14], [42, 14], [42, 52], [22, 52]], color: t.bg },          // frame, inner
    { poly: [[24, 16], [36, 20], [36, 54], [24, 50]], color: t.accent },      // door leaf, ajar
    { poly: [[36, 20], [46, 24], [46, 50], [36, 54]], color: light },         // light through the gap
  ];
}
const KNOB: { c: Pt; r: number } = { c: [33, 36], r: 1.8 };

export function iconSvg(themeId = DEFAULT_THEME_ID): string {
  const t = getTheme(themeId) ?? getTheme(DEFAULT_THEME_ID)!;
  const polys = shapes(t).map((s) => `<path d="M${s.poly.map((p) => p.join(' ')).join('L')}z" fill="${s.color}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${t.bg}"/>${polys}<circle cx="${KNOB.c[0]}" cy="${KNOB.c[1]}" r="${KNOB.r}" fill="${t.bg}"/></svg>\n`;
}

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Point-in-convex-polygon by consistent cross-product sign. */
function inside(poly: Pt[], x: number, y: number): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (cross === 0) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

const cache = new Map<string, Buffer>();

/** Renders the mark as a square PNG of `size` pixels, 4x supersampled for smooth edges. */
export function iconPng(size: number, themeId = DEFAULT_THEME_ID): Buffer {
  const t = getTheme(themeId) ?? getTheme(DEFAULT_THEME_ID)!;
  const key = `${t.id}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const SS = 4;
  const layers = shapes(t).map((s) => ({ poly: s.poly, rgb: hex(s.color) }));
  const bg = hex(t.bg);
  const knobR2 = KNOB.r ** 2;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 3 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = ((px + (sx + 0.5) / SS) / size) * 64, y = ((py + (sy + 0.5) / SS) / size) * 64;
          let c = bg;
          for (const layer of layers) if (inside(layer.poly, x, y)) c = layer.rgb;
          if ((x - KNOB.c[0]) ** 2 + (y - KNOB.c[1]) ** 2 <= knobR2) c = bg;
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const n = SS * SS, o = py * (size * 3 + 1) + 1 + px * 3;
      raw[o] = Math.round(r / n); raw[o + 1] = Math.round(g / n); raw[o + 2] = Math.round(b / n);
    }
  }
  const png = encodePng(size, raw);
  cache.set(key, png);
  return png;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function encodePng(size: number, raw: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

export const ICON_SIZES: Record<string, number> = { '/apple-touch-icon.png': 180, '/icon-192.png': 192, '/icon-512.png': 512 };

export function manifest(themeId = DEFAULT_THEME_ID): Record<string, unknown> {
  const t = getTheme(themeId) ?? getTheme(DEFAULT_THEME_ID)!;
  const q = t.id === DEFAULT_THEME_ID ? '' : `?theme=${t.id}`;
  return {
    id: '/',
    name: 'Abode',
    short_name: 'Abode',
    description: 'Home page and short links for your network',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: t.bg,
    theme_color: t.bg,
    icons: [
      { src: `/icon-192.png${q}`, sizes: '192x192', type: 'image/png' },
      { src: `/icon-512.png${q}`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
}
