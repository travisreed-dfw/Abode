import { HttpError } from './http.ts';
import type { Store } from './store.ts';
import { normalizeUsername } from './validation.ts';
import { DEFAULT_ENGINE_ID, isEngineId } from '../shared/search.ts';
import { DEFAULT_THEME_ID, isThemeId } from '../shared/themes.ts';
import type { ImportCounts, ProfileSummary, User, UserInput } from '../shared/types.ts';

/** Profiles: a username, a preferred search engine and up to eight bookmarks. */
export class UserRepository {
  private readonly store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  private get rows(): User[] {
    return this.store.data.users;
  }

  list(): User[] {
    return [...this.rows].sort((a, b) => a.name.localeCompare(b.name));
  }

  count(): number {
    return this.rows.length;
  }

  get(name: string | undefined): User | undefined {
    if (!name) return undefined;
    const key = name.toLowerCase();
    return this.rows.find((u) => u.name === key);
  }

  async register(raw: unknown): Promise<User> {
    const name = normalizeUsername(raw);
    if (this.get(name)) throw new HttpError(409, `"${name}" is not available.`);
    const now = new Date().toISOString();
    const user: User = { name, searchEngine: DEFAULT_ENGINE_ID, theme: DEFAULT_THEME_ID, hidden: [], order: [], createdAt: now, updatedAt: now };
    this.rows.push(user);
    await this.store.write();
    return user;
  }

  login(raw: unknown): User {
    const name = normalizeUsername(raw);
    const user = this.get(name);
    if (!user) throw new HttpError(404, `No user named "${name}". Register to create it.`);
    return user;
  }

  summaries(ownedBookmarks: (owner: string) => number): ProfileSummary[] {
    return this.list().map((u) => ({ name: u.name, searchEngine: u.searchEngine, theme: u.theme, bookmarks: ownedBookmarks(u.name), createdAt: u.createdAt }));
  }

  async remove(name: string): Promise<void> {
    const key = name.toLowerCase();
    const index = this.rows.findIndex((u) => u.name === key);
    if (index === -1) throw new HttpError(404, `No user named "${key}".`);
    this.rows.splice(index, 1);
    await this.store.write();
  }

  /** Upserts profiles from a backup. Existing profiles take the file's engine, theme, hidden ids and order. */
  async import(entries: unknown[]): Promise<ImportCounts> {
    const now = new Date().toISOString();
    const counts: ImportCounts = { added: 0, updated: 0 };
    const seen = new Set<string>();
    for (const [i, entry] of entries.entries()) {
      if (!entry || typeof entry !== 'object') throw new HttpError(400, `Profile ${i + 1} is not an object.`);
      const e = entry as Record<string, unknown>;
      let name: string;
      try {
        name = normalizeUsername(e.name);
      } catch (err) {
        throw new HttpError(400, `Profile ${i + 1}: ${err instanceof HttpError ? err.message : String(err)}`);
      }
      const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
      const hidden = ids(e.hidden), order = ids(e.order);
      const searchEngine = isEngineId(e.searchEngine) ? e.searchEngine : DEFAULT_ENGINE_ID;
      const theme = isThemeId(e.theme) ? e.theme : DEFAULT_THEME_ID;
      if (seen.has(name)) throw new HttpError(400, `Profile ${i + 1}: "${name}" appears more than once.`);
      seen.add(name);
      const existing = this.get(name);
      if (existing) {
        existing.searchEngine = searchEngine;
        existing.theme = theme;
        existing.hidden = hidden;
        existing.order = order;
        existing.updatedAt = now;
        counts.updated += 1;
      } else {
        const createdAt = typeof e.createdAt === 'string' ? e.createdAt : now;
        this.rows.push({ name, searchEngine, theme, hidden, order, createdAt, updatedAt: now });
        counts.added += 1;
      }
    }
    await this.store.write();
    return counts;
  }

  async update(name: string, input: UserInput): Promise<User> {
    const user = this.get(name);
    if (!user) throw new HttpError(404, `No user named "${name}".`);
    if (input.searchEngine !== undefined) {
      if (!isEngineId(input.searchEngine)) throw new HttpError(400, 'Unknown search engine.');
      user.searchEngine = input.searchEngine;
    }
    if (input.theme !== undefined) {
      if (!isThemeId(input.theme)) throw new HttpError(400, 'Unknown theme.');
      user.theme = input.theme;
    }
    user.updatedAt = new Date().toISOString();
    await this.store.write();
    return user;
  }
}
