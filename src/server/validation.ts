import { HttpError } from './http.ts';
import { PAGES } from './pages.ts';
import { ICON_PATHS } from './routes/appicon.ts';
import { engineForBang } from '../shared/search.ts';
import type { Bookmark } from '../shared/types.ts';

/** Paths the server handles itself, so they can never be aliases: API, assets, favicon and every page. */
export const RESERVED_NAMES: ReadonlySet<string> = new Set([
  'api',
  'assets',
  'favicon.ico',
  ...[...Object.keys(PAGES), ...ICON_PATHS].map((path) => path.slice(1)).filter((name) => name !== ''),
]);

const ALIAS_NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const USERNAME = /^[a-z0-9][a-z0-9._-]{0,31}$/;
export const MAX_DESCRIPTION = 200;
/** A generous ceiling so a runaway client can't fill the file; not a UI limit. */
export const MAX_BOOKMARKS = 200;
export const MAX_LABEL = 40;
export const MAX_GROUP = 40;

export function normalizeName(raw: unknown): string {
  if (typeof raw !== 'string') throw new HttpError(400, 'Name is required.');
  const name = raw.trim().toLowerCase();
  if (!ALIAS_NAME.test(name)) {
    throw new HttpError(
      400,
      'Name must be 1-64 characters: letters, numbers, dots, dashes or underscores, starting with a letter or number.',
    );
  }
  if (RESERVED_NAMES.has(name)) throw new HttpError(400, `"${name}" is reserved.`);
  const engine = engineForBang(name);
  if (engine) throw new HttpError(400, `"${name}" is the built-in !${engine.bang} bang for ${engine.label}. Pick another name.`);
  return name;
}

export function normalizeUrl(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim() === '') throw new HttpError(400, 'URL is required.');
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new HttpError(400, 'URL must be a full address, e.g. https://example.com');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new HttpError(400, 'URL must start with http:// or https://');
  }
  return parsed.toString();
}

export function normalizeDescription(raw: unknown): string {
  if (raw === undefined || raw === null) return '';
  if (typeof raw !== 'string') throw new HttpError(400, 'Description must be text.');
  const description = raw.trim().replace(/\s+/g, ' ');
  if (description.length > MAX_DESCRIPTION) {
    throw new HttpError(400, `Description must be at most ${MAX_DESCRIPTION} characters.`);
  }
  return description;
}

export function normalizeUsername(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim() === '') throw new HttpError(400, 'Username is required.');
  const name = raw.trim().toLowerCase();
  if (!USERNAME.test(name)) {
    throw new HttpError(
      400,
      'Username must be 1-32 characters: letters, numbers, dots, dashes or underscores, starting with a letter or number.',
    );
  }
  return name;
}

function normalizeBookmarkUrl(raw: unknown, index: number): string {
  if (typeof raw !== 'string' || raw.trim() === '') throw new HttpError(400, `Bookmark ${index}: URL is required.`);
  const value = raw.trim();
  // Site-relative links such as /plex let a button point at an alias.
  if (value.startsWith('/')) {
    if (/\s/.test(value) || value.startsWith('//')) throw new HttpError(400, `Bookmark ${index}: invalid link.`);
    return value;
  }
  try {
    return normalizeUrl(value);
  } catch (err) {
    const reason = err instanceof HttpError ? err.message : String(err);
    throw new HttpError(400, `Bookmark ${index}: ${reason}`);
  }
}

export function normalizeGroup(raw: unknown, index: number): string {
  if (raw === undefined || raw === null) return '';
  if (typeof raw !== 'string') throw new HttpError(400, `Bookmark ${index}: group must be text.`);
  const group = raw.trim().replace(/\s+/g, ' ');
  if (group.length > MAX_GROUP) throw new HttpError(400, `Bookmark ${index}: group must be at most ${MAX_GROUP} characters.`);
  return group;
}

/** Validates one bookmark's label, URL and group. `index` is used in error messages. */
export function normalizeBookmarkFields(raw: unknown, index: number): Pick<Bookmark, 'label' | 'url' | 'group'> {
  if (!raw || typeof raw !== 'object') throw new HttpError(400, `Bookmark ${index} is not an object.`);
  const e = raw as Record<string, unknown>;
  if (typeof e.label !== 'string' || e.label.trim() === '') throw new HttpError(400, `Bookmark ${index}: label is required.`);
  const label = e.label.trim().replace(/\s+/g, ' ');
  if (label.length > MAX_LABEL) throw new HttpError(400, `Bookmark ${index}: label must be at most ${MAX_LABEL} characters.`);
  return { label, url: normalizeBookmarkUrl(e.url, index), group: normalizeGroup(e.group, index) };
}

export function normalizeNameList(raw: unknown, what: string): string[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.some((g) => typeof g !== 'string' || g.length > MAX_GROUP)) throw new HttpError(400, `${what} must be a list of group names.`);
  return [...new Set((raw as string[]).map((g) => g.trim()).filter((g) => g !== ''))];
}

export function normalizeIdList(raw: unknown, what: string): string[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.some((id) => typeof id !== 'string')) throw new HttpError(400, `${what} must be a list of ids.`);
  return [...new Set(raw as string[])];
}
