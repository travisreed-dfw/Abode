import type { Router } from '../router.ts';
import { targetUrl } from '../bookmarks.ts';
import type { BookmarkRepository } from '../bookmarks.ts';
import type { AliasRepository } from '../aliases.ts';
import type { UserRepository } from '../users.ts';
import type { CookieSession } from '../session.ts';
import type { StatusMonitor } from '../status.ts';
import { HttpError } from '../http.ts';
import type { Context } from '../http.ts';
import type { Bookmark, User } from '../../shared/types.ts';

const BODY_LIMIT = 256 * 1024;

export function bookmarkRoutes(
  router: Router,
  bookmarks: BookmarkRepository,
  aliases: AliasRepository,
  users: UserRepository,
  session: CookieSession,
  monitor: StatusMonitor,
): void {
  const currentUser = (ctx: Context): User => {
    const user = users.get(session.read(ctx.req));
    if (!user) throw new HttpError(401, 'Not logged in.');
    return user;
  };

  const viewFor = (user: User) => {
    const status = (b: Bookmark): ReturnType<StatusMonitor['statusOf']> => {
      const url = targetUrl(b, aliases);
      return url ? monitor.statusOf(url) : null;
    };
    const view = bookmarks.forUser(user, status);
    monitor.ensure(view.map((b) => targetUrl(b, aliases)).filter((u): u is string => u !== null));
    return view;
  };

  router.get('/api/bookmarks', (ctx) => ctx.json(200, viewFor(currentUser(ctx))));

  router.put('/api/bookmarks', async (ctx) => {
    const user = currentUser(ctx);
    await bookmarks.save(user, await ctx.object(BODY_LIMIT));
    ctx.json(200, viewFor(user));
  });
}
