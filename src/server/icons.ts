import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type Icon = { body: Buffer; contentType: string };
type Meta = { ok: boolean; contentType?: string; ext?: string; fetchedAt: number };

export type IconCacheOptions = {
  fetch?: typeof fetch;
  now?: () => number;
  hitTtlMs?: number;
  missTtlMs?: number;
  maxIconBytes?: number;
  maxHtmlBytes?: number;
  timeoutMs?: number;
};

/**
 * Fetches a site's favicon once and keeps it on disk next to the database, so
 * the home page never makes the browser call out to other sites. A failed
 * lookup is remembered too (negative cache) so the same site isn't retried on
 * every page load. `fetch` and `now` are injectable for tests.
 */
export class IconCache {
  private readonly dir: string;
  private readonly fetch: typeof fetch;
  private readonly now: () => number;
  private readonly hitTtl: number;
  private readonly missTtl: number;
  private readonly maxIcon: number;
  private readonly maxHtml: number;
  private readonly timeout: number;
  private readonly inflight = new Map<string, Promise<Icon | null>>();

  constructor(dir: string, options: IconCacheOptions = {}) {
    this.dir = dir;
    this.fetch = options.fetch ?? globalThis.fetch;
    this.now = options.now ?? Date.now;
    this.hitTtl = options.hitTtlMs ?? 7 * 24 * 60 * 60 * 1000;
    this.missTtl = options.missTtlMs ?? 24 * 60 * 60 * 1000;
    this.maxIcon = options.maxIconBytes ?? 256 * 1024;
    this.maxHtml = options.maxHtmlBytes ?? 256 * 1024;
    this.timeout = options.timeoutMs ?? 5000;
  }

  /** Reduces a bookmark URL to the origin whose icon we want, or null if not fetchable. */
  static originOf(raw: string | null): string | null {
    if (!raw) return null;
    try {
      const url = new URL(raw);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      return url.origin;
    } catch {
      return null;
    }
  }

  async get(origin: string): Promise<Icon | null> {
    const key = createHash('sha1').update(origin).digest('hex');
    const cached = await this.readCached(key);
    if (cached !== undefined) return cached;

    let pending = this.inflight.get(key);
    if (!pending) {
      pending = this.lookup(origin)
        .then(async (icon) => {
          await this.writeCached(key, icon);
          return icon;
        })
        .catch(() => null)
        .finally(() => this.inflight.delete(key));
      this.inflight.set(key, pending);
    }
    return pending;
  }

  private async readCached(key: string): Promise<Icon | null | undefined> {
    let meta: Meta;
    try {
      meta = JSON.parse(await readFile(join(this.dir, `${key}.json`), 'utf8')) as Meta;
    } catch {
      return undefined;
    }
    const age = this.now() - meta.fetchedAt;
    if (!meta.ok) return age < this.missTtl ? null : undefined;
    if (age >= this.hitTtl) return undefined;
    try {
      const body = await readFile(join(this.dir, `${key}.${meta.ext}`));
      return { body, contentType: meta.contentType ?? 'image/x-icon' };
    } catch {
      return undefined;
    }
  }

  private async writeCached(key: string, icon: Icon | null): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const meta: Meta = icon
      ? { ok: true, contentType: icon.contentType, ext: IconCache.extensionFor(icon.contentType), fetchedAt: this.now() }
      : { ok: false, fetchedAt: this.now() };
    if (icon) await writeFile(join(this.dir, `${key}.${meta.ext}`), icon.body);
    await writeFile(join(this.dir, `${key}.json`), JSON.stringify(meta));
  }

  static extensionFor(contentType: string): string {
    const type = contentType.split(';')[0].trim().toLowerCase();
    const map: Record<string, string> = {
      'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico', 'image/png': 'png', 'image/svg+xml': 'svg',
      'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif',
    };
    return map[type] ?? 'img';
  }

  private async lookup(origin: string): Promise<Icon | null> {
    const direct = await this.fetchImage(`${origin}/favicon.ico`);
    if (direct) return direct;

    const html = await this.fetchText(`${origin}/`);
    if (!html) return null;
    for (const href of IconCache.iconLinks(html)) {
      let resolved: URL;
      try {
        resolved = new URL(href, `${origin}/`);
      } catch {
        continue;
      }
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') continue;
      const icon = await this.fetchImage(resolved.toString());
      if (icon) return icon;
    }
    return null;
  }

  /** Yields href values of <link rel="...icon..."> tags, in document order. */
  static *iconLinks(html: string): Generator<string> {
    for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
      if (!/\brel\s*=\s*["']?[^"'>]*icon/i.test(tag)) continue;
      const href = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(tag);
      const value = href?.[1] ?? href?.[2] ?? href?.[3];
      if (value) yield value.trim();
    }
  }

  private async fetchLimited(url: string, maxBytes: number): Promise<{ body: Buffer; contentType: string } | null> {
    try {
      const res = await this.fetch(url, { signal: AbortSignal.timeout(this.timeout), headers: { accept: '*/*' } });
      if (!res.ok) return null;
      const length = Number(res.headers.get('content-length') ?? 0);
      if (length > maxBytes || !res.body) return null;
      // Read incrementally so a site that omits content-length can't hand us a huge body.
      const chunks: Uint8Array[] = [];
      let size = 0;
      const reader = res.body.getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) {
          await reader.cancel();
          return null;
        }
        chunks.push(value);
      }
      const body = Buffer.concat(chunks);
      if (body.length === 0) return null;
      return { body, contentType: res.headers.get('content-type') ?? '' };
    } catch {
      return null;
    }
  }

  private async fetchImage(url: string): Promise<Icon | null> {
    const result = await this.fetchLimited(url, this.maxIcon);
    if (!result) return null;
    const type = result.contentType.split(';')[0].trim().toLowerCase();
    if (type.startsWith('image/')) return { body: result.body, contentType: type };
    // Some servers send .ico files as a generic binary type.
    if (url.toLowerCase().endsWith('.ico') && (type === 'application/octet-stream' || type === '')) {
      return { body: result.body, contentType: 'image/x-icon' };
    }
    return null;
  }

  private async fetchText(url: string): Promise<string | null> {
    const result = await this.fetchLimited(url, this.maxHtml);
    if (!result) return null;
    if (!result.contentType.toLowerCase().includes('text/html')) return null;
    return result.body.toString('utf8');
  }
}
