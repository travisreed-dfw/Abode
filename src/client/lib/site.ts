import { localizeExample, shortNameFor, stripShortLink } from '../../shared/site.js';

/** What this browser calls the server: `a`, `b`, `10.0.0.5`, `localhost:8080`. */
export const SITE = {
  host: location.host,
  name: shortNameFor(location.hostname),
  /** `a/plex` style label for an alias name. */
  label(aliasName: string): string {
    return `${this.name}/${aliasName}`;
  },
  cleanAliasName(raw: string): string {
    return stripShortLink(raw, this.host, this.name);
  },
};

/**
 * Rewrites the static examples on a page for the host in use. Touches the
 * brand mark, the `a/` input prefixes, and `<code>` samples such as
 * `http://a/yt/kittens` or `a/g/cats`.
 */
export function localizePage(root: ParentNode = document): void {
  for (const brand of root.querySelectorAll<HTMLElement>('h1 a, .name-field .prefix')) {
    if (brand.textContent?.trim() === 'a/') brand.textContent = `${SITE.name}/`;
  }
  for (const code of root.querySelectorAll<HTMLElement>('code')) {
    const text = code.textContent ?? '';
    const next = localizeExample(text, SITE.host, SITE.name);
    if (next !== text) code.textContent = next;
  }
  for (const node of root.querySelectorAll<HTMLElement>('.tagline, .search-hint, .docs p, .docs li, .login-card p')) {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE && child.textContent?.includes('http://a/')) {
        child.textContent = child.textContent.replace(/http:\/\/a\//g, `http://${SITE.host}/`);
      }
    }
  }
}
