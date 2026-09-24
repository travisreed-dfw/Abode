import { HttpError } from './http.ts';
import { newId } from './store.ts';
import type { Store } from './store.ts';
import type { AliasRepository } from './aliases.ts';
import { MAX_BOOKMARKS, normalizeBookmarkFields, normalizeIdList } from './validation.ts';
import type { Bookmark, BookmarkView, BookmarksUpdate, ImportCounts, ServiceStatus, User } from '../shared/types.ts';

export type StatusLookup = (bookmark: Bookmark) => ServiceStatus;

/** Resolves a bookmark's URL to something the status monitor can ping: `/plex` follows the alias. */
export function targetUrl(bookmark: Pick<Bookmark, 'url'>, aliases: Pick<AliasRepository, 'get'>): string | null {
  if (/^https?:\/\//i.test(bookmark.url)) return bookmark.url;
  const name = bookmark.url.replace(/^\//, '').split(/[/?#]/)[0];
  return aliases.get(name)?.url ?? null;
}

/**
 * Bookmarks live in one collection. A profile sees its own plus every shared
 * one, minus the ids it has hidden, in its own order. Shared bookmarks may be
 * edited by anyone, but only the owner decides whether one is shared;
 * personal ones are the owner's alone.
 */
export class BookmarkRepository {
  private readonly store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  private get rows(): Bookmark[] {
    return this.store.data.bookmarks;
  }

  all(): Bookmark[] {
    return [...this.rows];
  }

  get(id: string): Bookmark | undefined {
    return this.rows.find((b) => b.id === id);
  }

  countOwnedBy(owner: string): number {
    return this.rows.filter((b) => b.owner === owner).length;
  }

  static canEdit(bookmark: Bookmark, user: User): boolean {
    return bookmark.shared || bookmark.owner === user.name;
  }

  /**
   * Everything this profile can see, in its display order, with hidden ones
   * sorted after visible ones so the editor doesn't make you scroll past them.
   * Unhiding restores a bookmark to its place in the profile's order.
   */
  forUser(user: User, status: StatusLookup = () => null): BookmarkView[] {
    const visible = this.rows.filter((b) => b.shared || b.owner === user.name);
    const rank = new Map(user.order.map((id, i) => [id, i]));
    const byCreated = (a: Bookmark, b: Bookmark): number => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
    visible.sort((a, b) => {
      const ra = rank.get(a.id), rb = rank.get(b.id);
      if (ra !== undefined && rb !== undefined) return ra - rb;
      if (ra !== undefined) return -1;
      if (rb !== undefined) return 1;
      return byCreated(a, b);
    });
    const hidden = new Set(user.hidden);
    const views = visible.map((b) => ({ ...b, hidden: hidden.has(b.id), status: status(b), editable: BookmarkRepository.canEdit(b, user) }));
    return [...views.filter((b) => !b.hidden), ...views.filter((b) => b.hidden)];
  }

  /**
   * Applies an editor save for one profile: entries with an id are updated,
   * entries without one are created as this profile's, and ids in `remove`
   * are deleted (only ones this profile may edit). Nothing is deleted by
   * omission, so a partial save such as "hide this" can never remove a
   * shared bookmark for everyone. Hidden ids and order are stored on the
   * profile so they never affect anyone else.
   */
  async save(user: User, input: BookmarksUpdate): Promise<void> {
    if (input.bookmarks !== undefined && !Array.isArray(input.bookmarks)) throw new HttpError(400, 'Bookmarks must be a list.');
    const entries = (input.bookmarks ?? []) as unknown[];
    if (entries.length > MAX_BOOKMARKS) throw new HttpError(400, `Too many bookmarks (limit ${MAX_BOOKMARKS}).`);
    const now = new Date().toISOString();
    const keep = new Set<string>();
    const created: string[] = [];

    for (const [i, entry] of entries.entries()) {
      const n = i + 1;
      const fields = normalizeBookmarkFields(entry, n);
      const e = entry as Record<string, unknown>;
      const shared = e.shared === true;
      if (typeof e.id === 'string' && e.id !== '') {
        const existing = this.get(e.id);
        if (!existing) throw new HttpError(404, `Bookmark ${n}: no bookmark with id "${e.id}".`);
        if (!BookmarkRepository.canEdit(existing, user)) throw new HttpError(403, `Bookmark ${n}: "${existing.label}" belongs to ${existing.owner}.`);
        if (keep.has(existing.id)) throw new HttpError(400, `Bookmark ${n}: listed twice.`);
        if (shared !== existing.shared && existing.owner !== user.name) {
          throw new HttpError(403, `Bookmark ${n}: only ${existing.owner} can change whether "${existing.label}" is shared.`);
        }
        Object.assign(existing, fields, { shared, updatedAt: now });
        keep.add(existing.id);
      } else {
        const id = newId();
        this.rows.push({ id, ...fields, owner: user.name, shared, createdAt: now, updatedAt: now });
        keep.add(id);
        created.push(id);
      }
    }

    for (const id of normalizeIdList(input.remove, 'remove')) {
      const index = this.rows.findIndex((b) => b.id === id);
      if (index === -1) continue;
      if (!BookmarkRepository.canEdit(this.rows[index], user)) throw new HttpError(403, `"${this.rows[index].label}" belongs to ${this.rows[index].owner}.`);
      this.rows.splice(index, 1);
    }

    const known = new Set(this.rows.map((b) => b.id));
    if (input.hidden !== undefined) user.hidden = normalizeIdList(input.hidden, 'hidden').filter((id) => known.has(id));
    if (input.order !== undefined) {
      const order = normalizeIdList(input.order, 'order').filter((id) => known.has(id));
      user.order = [...order, ...created.filter((id) => !order.includes(id))];
    } else {
      user.order = [...user.order.filter((id) => known.has(id)), ...created];
    }
    user.updatedAt = now;
    await this.store.write();
  }

  /** When a profile is deleted its personal bookmarks go with it; shared ones stay for everyone. */
  async removeOwnedBy(owner: string): Promise<void> {
    for (let i = this.rows.length - 1; i >= 0; i--) {
      if (this.rows[i].owner === owner && !this.rows[i].shared) this.rows.splice(i, 1);
    }
    await this.store.write();
  }

  /** Upserts bookmarks from a backup by id. Owners that no longer exist are kept as written. */
  async import(entries: unknown[]): Promise<ImportCounts> {
    const counts: ImportCounts = { added: 0, updated: 0 };
    const now = new Date().toISOString();
    for (const [i, entry] of entries.entries()) {
      const fields = normalizeBookmarkFields(entry, i + 1);
      const e = entry as Record<string, unknown>;
      if (typeof e.owner !== 'string' || e.owner === '') throw new HttpError(400, `Bookmark ${i + 1}: owner is required.`);
      const shared = e.shared === true;
      const id = typeof e.id === 'string' && e.id !== '' ? e.id : newId();
      const existing = this.get(id);
      if (existing) {
        Object.assign(existing, fields, { owner: e.owner, shared, updatedAt: now });
        counts.updated += 1;
      } else {
        const createdAt = typeof e.createdAt === 'string' ? e.createdAt : now;
        this.rows.push({ id, ...fields, owner: e.owner, shared, createdAt, updatedAt: now });
        counts.added += 1;
      }
    }
    await this.store.write();
    return counts;
  }
}
