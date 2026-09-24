/**
 * Search engines, !bang shortcuts and the query resolver for the home page.
 * Pure module: used by the browser, by server-side validation and by tests.
 */
export type Engine = { id: string; label: string; bang: string; url: string; home: string };

export const ENGINES: readonly Engine[] = [
  { id: 'google', label: 'Google', bang: 'g', url: 'https://www.google.com/search?q=%s', home: 'https://www.google.com/' },
  { id: 'duckduckgo', label: 'DuckDuckGo', bang: 'ddg', url: 'https://duckduckgo.com/?q=%s', home: 'https://duckduckgo.com/' },
  { id: 'bing', label: 'Bing', bang: 'b', url: 'https://www.bing.com/search?q=%s', home: 'https://www.bing.com/' },
  { id: 'amazon', label: 'Amazon', bang: 'a', url: 'https://www.amazon.com/s?k=%s', home: 'https://www.amazon.com/' },
  { id: 'wikipedia', label: 'Wikipedia', bang: 'w', url: 'https://en.wikipedia.org/w/index.php?search=%s', home: 'https://en.wikipedia.org/' },
  { id: 'youtube', label: 'YouTube', bang: 'yt', url: 'https://www.youtube.com/results?search_query=%s', home: 'https://www.youtube.com/' },
  { id: 'github', label: 'GitHub', bang: 'gh', url: 'https://github.com/search?q=%s', home: 'https://github.com/' },
  { id: 'reddit', label: 'Reddit', bang: 'r', url: 'https://www.reddit.com/search/?q=%s', home: 'https://www.reddit.com/' },
  { id: 'maps', label: 'Google Maps', bang: 'maps', url: 'https://www.google.com/maps/search/%s', home: 'https://www.google.com/maps' },
  { id: 'imdb', label: 'IMDb', bang: 'imdb', url: 'https://www.imdb.com/find/?q=%s', home: 'https://www.imdb.com/' },
  { id: 'stackoverflow', label: 'Stack Overflow', bang: 'so', url: 'https://stackoverflow.com/search?q=%s', home: 'https://stackoverflow.com/' },
  { id: 'npm', label: 'npm', bang: 'npm', url: 'https://www.npmjs.com/search?q=%s', home: 'https://www.npmjs.com/' },
];

export const DEFAULT_ENGINE_ID = 'google';
const BANG_FALLBACK_ID = 'duckduckgo';

export function getEngine(id: string): Engine | undefined {
  return ENGINES.find((e) => e.id === id);
}

export function isEngineId(id: unknown): id is string {
  return typeof id === 'string' && getEngine(id) !== undefined;
}

/** The engine whose bang is `name` (without the `!`), if any. Case-insensitive. */
export function engineForBang(name: string): Engine | undefined {
  const key = name.toLowerCase();
  return ENGINES.find((e) => e.bang === key);
}

function fill(engine: Engine, term: string): string {
  return engine.url.replace('%s', encodeURIComponent(term));
}

/**
 * Turns what the user typed into a URL to navigate to, or null for empty input.
 *
 * 1. A `!bang` token anywhere → an alias of that name (`jackson !book` →
 *    `/book/jackson`, `!book` → `/book`), else the built-in engine, with the
 *    bang removed from the query. Unknown bangs go to DuckDuckGo with the
 *    query untouched, because DuckDuckGo resolves thousands of bangs itself.
 * 2. Otherwise the user's default engine. Plain words never jump to an alias,
 *    so "book jackson" is a normal search even if a `book` alias exists.
 */
export function resolveSearch(query: string, defaultEngineId: string, aliasNames: readonly string[]): string | null {
  const q = query.trim();
  if (!q) return null;

  const tokens = q.split(/\s+/);
  const bangIndex = tokens.findIndex((t) => /^![a-z0-9]+$/i.test(t));
  if (bangIndex !== -1) {
    const bang = tokens[bangIndex].slice(1).toLowerCase();
    const rest = tokens.filter((_, i) => i !== bangIndex).join(' ');
    // Every alias is also a bang. Built-in bang names can't be used as alias
    // names (see normalizeName in db.ts), so the two never collide.
    if (aliasNames.some((n) => n.toLowerCase() === bang)) {
      return '/' + bang + (rest ? '/' + encodeURIComponent(rest) : '');
    }
    const engine = ENGINES.find((e) => e.bang === bang);
    if (engine) return fill(engine, rest);
    return fill(getEngine(BANG_FALLBACK_ID)!, q);
  }

  const engine = getEngine(defaultEngineId) ?? getEngine(DEFAULT_ENGINE_ID)!;
  return fill(engine, q);
}
