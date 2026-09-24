import { HttpError } from './http.ts';
import type { Context, Handler, Params } from './http.ts';

type Route = { method: string; pattern: RegExp; keys: string[]; handler: Handler };

/**
 * Minimal method + path router. Paths may contain `:param` segments; matched
 * values land in `ctx.params`. A path that matches with the wrong method gets
 * a 405 with an Allow header, as the HTTP spec asks.
 */
export class Router {
  private routes: Route[] = [];

  add(method: string, path: string, handler: Handler): this {
    const keys: string[] = [];
    const source = path
      .split('/')
      .map((seg) => {
        if (seg.startsWith(':')) {
          keys.push(seg.slice(1));
          return '([^/]+)';
        }
        return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/');
    this.routes.push({ method, pattern: new RegExp(`^${source}$`), keys, handler });
    return this;
  }

  get(path: string, handler: Handler): this { return this.add('GET', path, handler); }
  post(path: string, handler: Handler): this { return this.add('POST', path, handler); }
  put(path: string, handler: Handler): this { return this.add('PUT', path, handler); }
  delete(path: string, handler: Handler): this { return this.add('DELETE', path, handler); }

  /** Finds the handler for a request, or undefined when no route matches the path. */
  match(method: string, pathname: string): { handler: Handler; params: Params } | undefined {
    const allowed: string[] = [];
    for (const route of this.routes) {
      const m = route.pattern.exec(pathname);
      if (!m) continue;
      // HEAD is served by GET handlers; Node discards the body.
      if (route.method === method || (method === 'HEAD' && route.method === 'GET')) {
        const params: Params = {};
        route.keys.forEach((key, i) => {
          try {
            params[key] = decodeURIComponent(m[i + 1]);
          } catch {
            params[key] = m[i + 1];
          }
        });
        return { handler: route.handler, params };
      }
      allowed.push(route.method);
    }
    if (allowed.length > 0) {
      const err = new HttpError(405, 'Method not allowed.');
      (err as HttpError & { allow?: string }).allow = allowed.join(', ');
      throw err;
    }
    return undefined;
  }

  /** Runs the matching route. Returns false when nothing matched. */
  async dispatch(ctx: Context): Promise<boolean> {
    const found = this.match(ctx.method, ctx.pathname);
    if (!found) return false;
    ctx.params = found.params;
    await found.handler(ctx);
    return true;
  }
}
