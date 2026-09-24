import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { JSONFilePreset } from 'lowdb/node';
import type { Low } from 'lowdb';
import type { Alias, Bookmark, User } from '../shared/types.ts';
import { DEFAULT_THEME_ID } from '../shared/themes.ts';

export type Data = { aliases: Alias[]; users: User[]; bookmarks: Bookmark[] };

/** A short random id for bookmarks. */
export function newId(): string {
  return randomUUID().replaceAll('-', '').slice(0, 12);
}

/**
 * The single JSON file everything lives in, wrapped so repositories share one
 * lowdb instance and so old files are upgraded in place when new fields appear.
 */
export class Store {
  readonly path: string;
  private readonly db: Low<Data>;

  private constructor(path: string, db: Low<Data>) {
    this.path = path;
    this.db = db;
  }

  static async open(path: string): Promise<Store> {
    const resolved = resolve(path);
    mkdirSync(dirname(resolved), { recursive: true });
    const db = await JSONFilePreset<Data>(resolved, { aliases: [], users: [], bookmarks: [] });
    const store = new Store(resolved, db);
    if (store.migrate()) await store.write();
    return store;
  }

  /** Folder the data file lives in; caches and backups go beside it. */
  get dir(): string {
    return dirname(this.path);
  }

  get data(): Data {
    return this.db.data;
  }

  write(): Promise<void> {
    return this.db.write();
  }

  /**
   * Converts a profile entry's legacy embedded bookmarks (pre bookmark-sharing)
   * into personal bookmark records owned by that profile, in their old order.
   * Returns [] when the entry has none.
   */
  static legacyBookmarksOf(entry: { name: string; bookmarks?: unknown }): Bookmark[] {
    if (!Array.isArray(entry.bookmarks)) return [];
    const now = new Date().toISOString();
    const out: Bookmark[] = [];
    for (const b of entry.bookmarks as { label?: unknown; url?: unknown }[]) {
      if (!b || typeof b.label !== 'string' || typeof b.url !== 'string') continue;
      out.push({ id: newId(), label: b.label, url: b.url, owner: entry.name.toLowerCase(), shared: false, createdAt: now, updatedAt: now });
    }
    return out;
  }

  /** Fills in fields added after the first release. Returns true if anything changed. */
  private migrate(): boolean {
    const d = this.db.data;
    let changed = false;
    if (!Array.isArray(d.users)) { d.users = []; changed = true; }
    if (!Array.isArray(d.aliases)) { d.aliases = []; changed = true; }
    if (!Array.isArray(d.bookmarks)) { d.bookmarks = []; changed = true; }
    for (const u of d.users) {
      if (typeof u.theme !== 'string') { u.theme = DEFAULT_THEME_ID; changed = true; }
      if (!Array.isArray(u.hidden)) { u.hidden = []; changed = true; }
      if (!Array.isArray(u.order)) { u.order = []; changed = true; }
      const legacy = u as User & { bookmarks?: unknown };
      if (legacy.bookmarks !== undefined) {
        const lifted = Store.legacyBookmarksOf(legacy);
        d.bookmarks.push(...lifted);
        u.order = [...u.order, ...lifted.map((b) => b.id)];
        delete legacy.bookmarks;
        changed = true;
      }
    }
    for (const a of d.aliases) {
      if (typeof a.description !== 'string') { a.description = ''; changed = true; }
      if (!Number.isInteger(a.hits) || a.hits < 0) { a.hits = 0; changed = true; }
      if (a.lastUsedAt === undefined || (a.lastUsedAt !== null && typeof a.lastUsedAt !== 'string')) { a.lastUsedAt = null; changed = true; }
    }
    return changed;
  }
}
