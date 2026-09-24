import { readFile } from 'node:fs/promises';
import { join, normalize, sep } from 'node:path';
import { HttpError } from './http.ts';
import type { Context } from './http.ts';
import { ICON_PATHS } from './routes/appicon.ts';

type Page = { file: string; type: string };

const ASSET_TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

/**
 * Serves the handful of top-level pages by an explicit allowlist, and anything
 * under /assets/ from the assets folder with a path check so nothing outside
 * it can ever be read.
 */
export class StaticFiles {
  readonly publicDir: string;
  readonly assetsDir: string;
  private readonly pages: Record<string, Page>;

  constructor(publicDir: string, pages: Record<string, Page>) {
    this.publicDir = publicDir;
    this.assetsDir = join(publicDir, 'assets');
    this.pages = pages;
  }

  isPage(pathname: string): boolean {
    return pathname in this.pages;
  }

  isAsset(pathname: string): boolean {
    return pathname.startsWith('/assets/');
  }

  /** Static requests are noise in the access log. */
  isStatic(pathname: string): boolean {
    return this.isPage(pathname) || this.isAsset(pathname) || pathname === '/favicon.ico' || ICON_PATHS.has(pathname);
  }

  /** Absolute file path for an /assets/ request, or null if it escapes the folder or has an unknown type. */
  resolveAsset(pathname: string): { file: string; type: string } | null {
    let rel: string;
    try {
      rel = decodeURIComponent(pathname.slice('/assets/'.length));
    } catch {
      return null;
    }
    const file = normalize(join(this.assetsDir, rel));
    const type = ASSET_TYPES[file.slice(file.lastIndexOf('.'))];
    if (!file.startsWith(this.assetsDir + sep) || !type) return null;
    return { file, type };
  }

  async serve(ctx: Context): Promise<boolean> {
    const page = this.pages[ctx.pathname];
    if (page) {
      const body = await readFile(join(this.publicDir, page.file));
      ctx.bytes(200, body, page.type, { 'cache-control': 'no-cache' });
      return true;
    }
    if (this.isAsset(ctx.pathname)) {
      const asset = this.resolveAsset(ctx.pathname);
      if (!asset) throw new HttpError(404, 'Not found.');
      let body: Buffer;
      try {
        body = await readFile(asset.file);
      } catch {
        throw new HttpError(404, 'Not found.');
      }
      ctx.bytes(200, body, asset.type, { 'cache-control': 'no-cache' });
      return true;
    }
    if (ctx.pathname === '/favicon.ico') {
      ctx.empty(204);
      return true;
    }
    return false;
  }
}
