/**
 * The short name (`a` in http://a/) exists only as a DNS record, so the server
 * can't know it. The browser does: it's the host the page was loaded from.
 * These helpers turn that into what the pages show. Pure, so they're testable.
 */

/** Brand name for a hostname: single-label names (`a`, `go`, `b`) are used as-is; IPs and dotted hosts fall back to `a`. */
export function shortNameFor(hostname: string): string {
  return /^[a-z0-9-]+$/i.test(hostname) ? hostname.toLowerCase() : 'a';
}

/**
 * Rewrites the canonical examples in page text for the host actually in use:
 * `http://a/...` becomes `http://<host>/...` and a leading `a/` becomes `<name>/`.
 */
export function localizeExample(text: string, host: string, name: string): string {
  return text.replace(/http:\/\/a\//g, `http://${host}/`).replace(/^a\//, `${name}/`);
}

/** Strips `a/`, `http://a/`, `<host>/` or `http://<host>/` if someone pastes a full short link as a name. */
export function stripShortLink(raw: string, host: string, name: string): string {
  const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const prefixes = [...new Set(['a', name, host])].map(escape).join('|');
  return raw.trim().replace(new RegExp(`^(https?:\\/\\/)?(${prefixes})\\/`, 'i'), '');
}
