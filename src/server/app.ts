import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { join } from 'node:path';
import type { Config } from './config.ts';
import { Context, HttpError } from './http.ts';
import { Router } from './router.ts';
import { Store } from './store.ts';
import { AliasRepository } from './aliases.ts';
import { UserRepository } from './users.ts';
import { BookmarkRepository, targetUrl } from './bookmarks.ts';
import { StatusMonitor } from './status.ts';
import { BackupScheduler } from './backups.ts';
import { DockerDiscovery } from './docker.ts';
import { CookieSession } from './session.ts';
import { IconCache } from './icons.ts';
import { StaticFiles } from './static.ts';
import { PAGES } from './pages.ts';
import { aliasRoutes } from './routes/aliases.ts';
import { profileRoutes } from './routes/profiles.ts';
import { bookmarkRoutes } from './routes/bookmarks.ts';
import { iconRoutes } from './routes/icons.ts';
import { healthRoute } from './routes/health.ts';
import { redirectHandler } from './routes/redirects.ts';
import { serveAppIcon } from './routes/appicon.ts';

/** Wires the store, repositories, routes and static files into one HTTP server. */
export class App {
  readonly config: Config;
  readonly store: Store;
  readonly aliases: AliasRepository;
  readonly users: UserRepository;
  readonly bookmarks: BookmarkRepository;
  readonly monitor: StatusMonitor;
  readonly backups: BackupScheduler;
  readonly docker: DockerDiscovery;
  readonly session: CookieSession;
  readonly icons: IconCache;
  readonly files: StaticFiles;
  readonly router: Router;
  readonly server: Server;
  private readonly redirect: (ctx: Context) => void;
  private readonly startedAt = Date.now();

  private constructor(config: Config, store: Store) {
    this.config = config;
    this.store = store;
    this.aliases = new AliasRepository(store);
    this.users = new UserRepository(store);
    this.bookmarks = new BookmarkRepository(store);
    this.monitor = new StatusMonitor();
    this.monitor.setSource(() => this.bookmarks.all().map((b) => targetUrl(b, this.aliases)).filter((u): u is string => u !== null));
    this.backups = new BackupScheduler(join(store.dir, 'backups'), () => ({
      exportedAt: new Date().toISOString(),
      aliases: this.aliases.list(),
      users: this.users.list(),
      bookmarks: this.bookmarks.all(),
    }));
    this.docker = new DockerDiscovery({ socketPath: config.dockerSocket });
    this.session = new CookieSession();
    this.icons = new IconCache(join(store.dir, 'icons'));
    this.files = new StaticFiles(config.publicDir, PAGES);
    this.router = new Router();
    aliasRoutes(this.router, this.aliases, this.users, this.bookmarks);
    profileRoutes(this.router, this.users, this.bookmarks, this.session);
    bookmarkRoutes(this.router, this.bookmarks, this.aliases, this.users, this.session, this.monitor, this.docker);
    iconRoutes(this.router, this.icons);
    healthRoute(this.router, this.aliases, this.users, this.docker, this.startedAt);
    this.redirect = redirectHandler(this.aliases);
    this.server = createServer((req, res) => this.handle(req, res));
  }

  static async create(config: Config): Promise<App> {
    return new App(config, await Store.open(config.dbPath));
  }

  private handle(req: IncomingMessage, res: ServerResponse): void {
    const ctx = new Context(req, res);
    res.on('finish', () => this.log(ctx));
    this.route(ctx).catch((err: unknown) => this.fail(ctx, err));
  }

  private async route(ctx: Context): Promise<void> {
    if (ctx.pathname === '/api' || ctx.pathname.startsWith('/api/')) {
      if (!(await this.router.dispatch(ctx))) throw new HttpError(404, 'Not found.');
      return;
    }
    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') throw new HttpError(405, 'Method not allowed.');
    if (serveAppIcon(ctx)) return;
    if (await this.files.serve(ctx)) return;
    this.redirect(ctx);
  }

  private fail(ctx: Context, err: unknown): void {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof HttpError ? err.message : 'Internal server error.';
    if (status === 500) console.error(err);
    if (ctx.res.headersSent) {
      ctx.res.end();
      return;
    }
    const allow = (err as { allow?: string }).allow;
    ctx.json(status, { error: message }, allow ? { allow } : {});
  }

  /**
   * One line per redirect, change or error. Static files, icon lookups and
   * successful API reads (including the home page's status poll) are skipped.
   */
  private log(ctx: Context): void {
    if (this.files.isStatic(ctx.pathname) || ctx.pathname === '/api/icon') return;
    const isApiRead = ctx.pathname.startsWith('/api/') && (ctx.method === 'GET' || ctx.method === 'HEAD');
    if (isApiRead && ctx.res.statusCode < 400) return;
    const ip = ctx.req.socket.remoteAddress ?? '-';
    const location = ctx.res.getHeader('location');
    const target = typeof location === 'string' ? ` -> ${location}` : '';
    console.log(`${new Date().toISOString()} ${ip} ${ctx.method} ${ctx.req.url ?? '/'} ${ctx.res.statusCode}${target}`);
  }

  /** Port actually bound (differs from config when config.port is 0). */
  get port(): number {
    const address = this.server.address();
    return address && typeof address === 'object' ? address.port : this.config.port;
  }

  /** Starts listening plus the background jobs (status pings, daily backups). */
  listen(options: { background?: boolean } = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.config.port, this.config.host, () => {
        this.server.off('error', reject);
        if (options.background !== false) {
          this.monitor.start();
          this.backups.start();
          this.docker.start();
        }
        const docker = this.docker.enabled ? ', docker discovery on' : '';
        console.log(`abode listening on http://${this.config.host}:${this.port}/ (db: ${this.store.path}${docker})`);
        resolve();
      });
    });
  }

  close(): Promise<void> {
    this.monitor.stop();
    this.backups.stop();
    this.docker.stop();
    return new Promise((resolve) => this.server.close(() => resolve()));
  }
}
