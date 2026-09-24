import type { AliasRepository } from '../aliases.ts';
import { HttpError } from '../http.ts';
import type { Context } from '../http.ts';
import { RESERVED_NAMES } from '../validation.ts';
import { buildTarget, splitPath } from '../redirect.ts';
import { engineForBang } from '../../shared/search.ts';

/**
 * The catch-all: /<name>[/<suffix>][?<query>] redirects to an alias, or to a
 * built-in search bang used as a path, or to the aliases page so the name can
 * be created on the spot.
 */
export function redirectHandler(aliases: AliasRepository): (ctx: Context) => void {
  return (ctx) => {
    const { name, suffix } = splitPath(ctx.pathname);
    if (RESERVED_NAMES.has(name)) throw new HttpError(404, 'Not found.');
    const query = ctx.url.search.startsWith('?') ? ctx.url.search.slice(1) : '';

    const alias = aliases.get(name);
    if (alias) {
      // HEAD probes (health checks, link previews) are not visits.
      if (ctx.method === 'GET') aliases.recordHit(alias);
      ctx.redirect(buildTarget(alias.url, suffix, query));
      return;
    }

    // Built-in search bangs work as paths too: /yt/kitty cats searches YouTube,
    // /yt alone opens YouTube.
    const engine = engineForBang(name);
    if (engine) {
      ctx.redirect(suffix || query ? buildTarget(engine.url, suffix, query) : engine.home);
      return;
    }

    ctx.redirect(`/aliases?new=${encodeURIComponent(name)}`);
  };
}
