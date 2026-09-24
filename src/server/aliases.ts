import { HttpError } from './http.ts';
import type { Store } from './store.ts';
import { normalizeDescription, normalizeName, normalizeUrl } from './validation.ts';
import type { Alias, AliasInput, ImportCounts } from '../shared/types.ts';

/** All reads and writes of aliases go through here. */
export class AliasRepository {
  private readonly store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  private get rows(): Alias[] {
    return this.store.data.aliases;
  }

  list(): Alias[] {
    return [...this.rows].sort((a, b) => a.name.localeCompare(b.name));
  }

  count(): number {
    return this.rows.length;
  }

  get(name: string): Alias | undefined {
    const key = name.toLowerCase();
    return this.rows.find((a) => a.name === key);
  }

  /** Like get(), but a missing alias is a 404. */
  require(name: string): Alias {
    const alias = this.get(name);
    if (!alias) throw new HttpError(404, `"${name}" not found.`);
    return alias;
  }

  async create(input: AliasInput): Promise<Alias> {
    const name = normalizeName(input.name);
    const url = normalizeUrl(input.url);
    const description = normalizeDescription(input.description);
    if (this.get(name)) throw new HttpError(409, `"${name}" already exists.`);
    const now = new Date().toISOString();
    const alias: Alias = { name, url, description, hits: 0, lastUsedAt: null, createdAt: now, updatedAt: now };
    this.rows.push(alias);
    await this.store.write();
    return alias;
  }

  async update(currentName: string, input: AliasInput): Promise<Alias> {
    const alias = this.require(currentName);
    const name = input.name === undefined ? alias.name : normalizeName(input.name);
    const url = input.url === undefined ? alias.url : normalizeUrl(input.url);
    const description = input.description === undefined ? alias.description : normalizeDescription(input.description);
    if (name !== alias.name && this.get(name)) throw new HttpError(409, `"${name}" already exists.`);
    alias.name = name;
    alias.url = url;
    alias.description = description;
    alias.updatedAt = new Date().toISOString();
    await this.store.write();
    return alias;
  }

  async remove(name: string): Promise<void> {
    const key = name.toLowerCase();
    const index = this.rows.findIndex((a) => a.name === key);
    if (index === -1) throw new HttpError(404, `"${key}" not found.`);
    this.rows.splice(index, 1);
    await this.store.write();
  }

  /** Records a redirect. The write is not awaited so redirects stay fast. */
  recordHit(alias: Alias): void {
    alias.hits += 1;
    alias.lastUsedAt = new Date().toISOString();
    this.store.write().catch((err: unknown) => console.error('failed to record hit', err));
  }

  /**
   * Upserts aliases from a backup. Existing aliases keep their hit counts; new
   * ones take counts from the file when present (restore).
   */
  async import(entries: unknown[]): Promise<ImportCounts> {
    const now = new Date().toISOString();
    const result: ImportCounts = { added: 0, updated: 0 };
    const seen = new Set<string>();

    for (const [i, entry] of entries.entries()) {
      if (!entry || typeof entry !== 'object') throw new HttpError(400, `Entry ${i + 1} is not an object.`);
      const e = entry as Record<string, unknown>;
      let name: string, url: string, description: string;
      try {
        name = normalizeName(e.name);
        url = normalizeUrl(e.url);
        description = normalizeDescription(e.description);
      } catch (err) {
        const reason = err instanceof HttpError ? err.message : String(err);
        throw new HttpError(400, `Entry ${i + 1}: ${reason}`);
      }
      if (seen.has(name)) throw new HttpError(400, `Entry ${i + 1}: "${name}" appears more than once.`);
      seen.add(name);

      const existing = this.get(name);
      if (existing) {
        existing.url = url;
        existing.description = description;
        existing.updatedAt = now;
        result.updated += 1;
      } else {
        const hits = Number.isInteger(e.hits) && (e.hits as number) >= 0 ? (e.hits as number) : 0;
        const lastUsedAt = typeof e.lastUsedAt === 'string' ? e.lastUsedAt : null;
        const createdAt = typeof e.createdAt === 'string' ? e.createdAt : now;
        this.rows.push({ name, url, description, hits, lastUsedAt, createdAt, updatedAt: now });
        result.added += 1;
      }
    }

    await this.store.write();
    return result;
  }
}
