import type { Router } from '../router.ts';
import { IconCache } from '../icons.ts';
import { HttpError } from '../http.ts';

/** Cached favicons for bookmark buttons. */
export function iconRoutes(router: Router, icons: IconCache): void {
  router.get('/api/icon', async (ctx) => {
    const origin = IconCache.originOf(ctx.url.searchParams.get('url'));
    if (!origin) throw new HttpError(400, 'url must be an absolute http(s) URL.');
    const icon = await icons.get(origin);
    if (!icon) {
      ctx.empty(404, { 'cache-control': 'public, max-age=3600' });
      return;
    }
    ctx.bytes(200, icon.body, icon.contentType, { 'cache-control': 'public, max-age=86400' });
  });
}
