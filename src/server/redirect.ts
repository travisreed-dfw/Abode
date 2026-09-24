/**
 * Builds the final redirect URL for an alias.
 *
 * - If the target contains `%s`, the part of the path after the alias name is
 *   URL-encoded and substituted there (search-style aliases).
 * - Otherwise that part is appended to the target's path.
 * - Any query string on the request is appended either way.
 */
export function buildTarget(target: string, suffix: string, query: string): string {
  let out: string;
  if (target.includes('%s')) {
    let term = suffix;
    try {
      term = decodeURIComponent(suffix);
    } catch {
      // keep the raw suffix if it isn't valid percent-encoding
    }
    out = target.replaceAll('%s', encodeURIComponent(term));
  } else if (suffix) {
    out = target.replace(/\/+$/, '') + '/' + suffix;
  } else {
    out = target;
  }
  if (query) out += (out.includes('?') ? '&' : '?') + query;
  return out;
}

/** Splits a request path like `/gh/foo/bar` into the alias name and the remainder. */
export function splitPath(pathname: string): { name: string; suffix: string } {
  const [, rawName = '', ...rest] = pathname.split('/');
  let name = rawName;
  try {
    name = decodeURIComponent(rawName);
  } catch {
    // leave undecodable names as-is; lookup will simply fail
  }
  return { name: name.toLowerCase(), suffix: rest.join('/') };
}
