import type { ServiceStatus } from '../shared/types.ts';

export type StatusMonitorOptions = {
  fetch?: typeof fetch;
  now?: () => number;
  intervalMs?: number;
  timeoutMs?: number;
};

/**
 * Pings home-network URLs so bookmark tiles can show whether a service is up.
 * Only private addresses and local names are ever checked; public sites get
 * no dot, so the home page never generates internet traffic on its own.
 * Any HTTP response (even 401 or 500) counts as up: the service answered.
 */
export class StatusMonitor {
  private readonly fetch: typeof fetch;
  private readonly now: () => number;
  private readonly interval: number;
  private readonly timeout: number;
  private source: () => Iterable<string> = () => [];
  private readonly results = new Map<string, { status: ServiceStatus; checkedAt: number }>();
  private timer: NodeJS.Timeout | null = null;

  constructor(options: StatusMonitorOptions = {}) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.now = options.now ?? Date.now;
    this.interval = options.intervalMs ?? 60_000;
    this.timeout = options.timeoutMs ?? 4_000;
  }

  /** True for addresses that live on the LAN rather than the internet. */
  static isLocal(url: string): boolean {
    let host: string;
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      return false;
    }
    if (host === 'localhost' || !host.includes('.')) return true;
    if (/\.(local|lan|home|internal|home\.arpa)$/.test(host)) return true;
    const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
    if (!m) return false;
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }

  /** Where the URLs to keep checking come from; evaluated on every cycle, so removed bookmarks stop being pinged. */
  setSource(source: () => Iterable<string>): void {
    this.source = source;
  }

  /** Checks any local URLs that have no result yet, so a new bookmark gets its dot without waiting a minute. */
  ensure(urls: Iterable<string>): void {
    for (const url of new Set(urls)) {
      if (StatusMonitor.isLocal(url) && !this.results.has(url)) void this.check(url);
    }
  }

  statusOf(url: string): ServiceStatus {
    if (!StatusMonitor.isLocal(url)) return null;
    return this.results.get(url)?.status ?? null;
  }

  async check(url: string): Promise<ServiceStatus> {
    let status: ServiceStatus;
    try {
      await this.fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(this.timeout) });
      status = 'up';
    } catch {
      status = 'down';
    }
    this.results.set(url, { status, checkedAt: this.now() });
    return status;
  }

  async checkAll(): Promise<void> {
    const urls = new Set([...this.source()].filter((u) => StatusMonitor.isLocal(u)));
    for (const known of this.results.keys()) if (!urls.has(known)) this.results.delete(known);
    await Promise.all([...urls].map((url) => this.check(url)));
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.checkAll(), this.interval);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
