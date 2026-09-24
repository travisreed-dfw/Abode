import type { Router } from '../router.ts';
import type { UserRepository } from '../users.ts';
import type { BookmarkRepository } from '../bookmarks.ts';
import type { CookieSession } from '../session.ts';
import { HttpError } from '../http.ts';
import type { Context } from '../http.ts';
import type { User } from '../../shared/types.ts';


/** Profiles without passwords: register, log in, log out, read and update "me". */
export function profileRoutes(router: Router, users: UserRepository, bookmarks: BookmarkRepository, session: CookieSession): void {
  const currentUser = (ctx: Context): User => {
    const user = users.get(session.read(ctx.req));
    if (!user) throw new HttpError(401, 'Not logged in.');
    return user;
  };

  router.get('/api/me', (ctx) => ctx.json(200, currentUser(ctx)));

  router.put('/api/me', async (ctx) => {
    const user = currentUser(ctx);
    ctx.json(200, await users.update(user.name, await ctx.object()));
  });

  router.post('/api/register', async (ctx) => {
    const body = await ctx.object();
    const user = await users.register(body.username);
    session.set(ctx.res, user.name);
    ctx.json(201, user);
  });

  router.post('/api/login', async (ctx) => {
    const body = await ctx.object();
    const user = users.login(body.username);
    session.set(ctx.res, user.name);
    ctx.json(200, user);
  });

  router.post('/api/logout', (ctx) => {
    session.clear(ctx.res);
    ctx.empty(204);
  });

  // Managing profiles is open like the rest of the app; there are no passwords to protect.
  router.get('/api/users', (ctx) => ctx.json(200, users.summaries((owner) => bookmarks.countOwnedBy(owner))));

  router.delete('/api/users/:name', async (ctx) => {
    await users.remove(ctx.params.name);
    await bookmarks.removeOwnedBy(ctx.params.name.toLowerCase());
    if (session.read(ctx.req)?.toLowerCase() === ctx.params.name.toLowerCase()) session.clear(ctx.res);
    ctx.empty(204);
  });
}
