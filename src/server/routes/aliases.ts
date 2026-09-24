import type { Router } from '../router.ts';
import type { AliasRepository } from '../aliases.ts';
import type { UserRepository } from '../users.ts';
import type { BookmarkRepository } from '../bookmarks.ts';
import { Store } from '../store.ts';
import { HttpError } from '../http.ts';
import type { Backup, ImportResult } from '../../shared/types.ts';

const IMPORT_LIMIT = 4 * 1024 * 1024;

export function aliasRoutes(router: Router, aliases: AliasRepository, users: UserRepository, bookmarks: BookmarkRepository): void {
  router.get('/api/aliases', (ctx) => ctx.json(200, aliases.list()));

  router.post('/api/aliases', async (ctx) => {
    ctx.json(201, await aliases.create(await ctx.object()));
  });

  router.get('/api/aliases/:name', (ctx) => ctx.json(200, aliases.require(ctx.params.name)));

  router.put('/api/aliases/:name', async (ctx) => {
    ctx.json(200, await aliases.update(ctx.params.name, await ctx.object()));
  });

  router.delete('/api/aliases/:name', async (ctx) => {
    await aliases.remove(ctx.params.name);
    ctx.empty(204);
  });

  router.get('/api/export', (ctx) => {
    const date = new Date().toISOString().slice(0, 10);
    const backup: Backup = { exportedAt: new Date().toISOString(), aliases: aliases.list(), users: users.list(), bookmarks: bookmarks.all() };
    ctx.json(200, backup, { 'content-disposition': `attachment; filename="alias-backup-${date}.json"` });
  });

  /** Accepts a full backup, any of `{aliases}`, `{users}`, `{bookmarks}`, or a bare array of aliases. */
  router.post('/api/import', async (ctx) => {
    const payload = await ctx.body(IMPORT_LIMIT);
    const obj = Array.isArray(payload) ? { aliases: payload } : payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
    if (!obj || (!Array.isArray(obj.aliases) && !Array.isArray(obj.users) && !Array.isArray(obj.bookmarks))) {
      throw new HttpError(400, 'Expected a backup file with "aliases", "users" and/or "bookmarks" lists.');
    }
    const none = { added: 0, updated: 0 };
    // Older backups embedded each profile's bookmarks; lift them into the collection first.
    const bookmarkEntries: unknown[] = Array.isArray(obj.bookmarks) ? [...obj.bookmarks] : [];
    if (Array.isArray(obj.users)) {
      for (const u of obj.users) {
        if (u && typeof u === 'object' && typeof (u as { name?: unknown }).name === 'string') {
          bookmarkEntries.push(...Store.legacyBookmarksOf(u as { name: string; bookmarks?: unknown }));
        }
      }
    }
    const result: ImportResult = {
      ...(Array.isArray(obj.aliases) ? await aliases.import(obj.aliases) : none),
      users: Array.isArray(obj.users) ? await users.import(obj.users) : none,
      bookmarks: bookmarkEntries.length ? await bookmarks.import(bookmarkEntries) : none,
    };
    ctx.json(200, result);
  });
}
