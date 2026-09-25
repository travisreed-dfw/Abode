import { existsSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import type { Bookmark } from '../shared/types.ts';
import { normalizeGroup } from './validation.ts';

/** What Abode reads from a labelled container. */
export type DiscoveredContainer = {
  /** Container name without the leading slash; also the stable id suffix. */
  name: string;
  label: string;
  url: string | null;
  port: number | null;
  group: string;
  running: boolean;
  state: string;
};

type ContainerJson = {
  Names?: string[];
  State?: string;
  Labels?: Record<string, string>;
  Ports?: { PrivatePort: number; PublicPort?: number; Type: string }[];
};

export type Fetcher = (path: string) => Promise<unknown>;

/**
 * Where to reach the Docker Engine: a Unix socket path, or `tcp://host:port`
 * for a socket proxy such as tecnativa/docker-socket-proxy.
 */
export type DockerTarget = { socketPath: string } | { host: string; port: number };

export function parseDockerTarget(value: string): DockerTarget {
  const m = /^(?:tcp|http):\/\/([^/:]+)(?::(\d+))?\/?$/i.exec(value.trim());
  if (m) return { host: m[1], port: m[2] ? Number(m[2]) : 2375 };
  return { socketPath: value };
}

/** Speaks the Docker Engine API with Node's own HTTP client, over a socket or a TCP proxy. */
export function socketFetcher(target: DockerTarget, timeoutMs = 3000): Fetcher {
  return (path) =>
    new Promise((resolve, reject) => {
      const req = httpRequest({ ...target, path, method: 'GET', headers: { host: 'docker' }, timeout: timeoutMs }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if ((res.statusCode ?? 500) >= 400) return reject(new Error(`docker ${res.statusCode}: ${text.slice(0, 200)}`));
          try {
            resolve(JSON.parse(text));
          } catch (err) {
            reject(err);
          }
        });
      });
      req.on('timeout', () => req.destroy(new Error('docker socket timeout')));
      req.on('error', reject);
      req.end();
    });
}

/** Turns one container's API record into a discovered entry, or null if it isn't ours. */
export function parseContainer(c: ContainerJson): DiscoveredContainer | null {
  const labels = c.Labels ?? {};
  const label = (labels['abode.name'] ?? '').trim();
  if (!label) return null;
  const name = (c.Names?.[0] ?? '').replace(/^\//, '');
  if (!name) return null;
  const rawUrl = (labels['abode.url'] ?? '').trim();
  const url = /^https?:\/\/\S+$/i.test(rawUrl) || rawUrl.startsWith('/') ? rawUrl : null;
  const published = (c.Ports ?? [])
    .filter((p) => p.Type === 'tcp' && p.PublicPort)
    .map((p) => p.PublicPort as number)
    .sort((a, b) => a - b);
  let group = '';
  try {
    group = normalizeGroup(labels['abode.group'], 0);
  } catch {
    group = '';
  }
  const state = c.State ?? 'unknown';
  return { name, label: label.slice(0, 40), url, port: published[0] ?? null, group, running: state === 'running', state };
}

/**
 * Finds containers labelled `abode.name` and offers them as shared bookmarks.
 * Opt-in: only active when the Docker socket is mounted into the container
 * (or DOCKER_SOCKET names a tcp:// proxy).
 * Every labelled container is listed whatever its state, so a stopped service
 * shows a red dot rather than vanishing; only a removed container disappears.
 */
export class DockerDiscovery {
  private readonly fetcher: Fetcher | null;
  private readonly interval: number;
  private containers: DiscoveredContainer[] = [];
  private timer: NodeJS.Timeout | null = null;
  private lastError: string | null = null;

  constructor(options: { socketPath?: string; fetcher?: Fetcher; intervalMs?: number } = {}) {
    const target = parseDockerTarget(options.socketPath ?? '/var/run/docker.sock');
    // A socket file must exist to count as configured; a TCP proxy is taken on faith and errors surface via `error`.
    const configured = 'host' in target || existsSync(target.socketPath);
    this.fetcher = options.fetcher ?? (configured ? socketFetcher(target) : null);
    this.interval = options.intervalMs ?? 30_000;
  }

  /** True when a Docker socket (or a test fetcher) is available. */
  get enabled(): boolean {
    return this.fetcher !== null;
  }

  get error(): string | null {
    return this.lastError;
  }

  list(): DiscoveredContainer[] {
    return this.containers;
  }

  async refresh(): Promise<void> {
    if (!this.fetcher) return;
    try {
      const filters = encodeURIComponent(JSON.stringify({ label: ['abode.name'] }));
      const raw = (await this.fetcher(`/containers/json?all=true&filters=${filters}`)) as ContainerJson[];
      const found = raw.map(parseContainer).filter((c): c is DiscoveredContainer => c !== null);
      // Docker lists no ports for a container that isn't running, but its
      // configured bindings are still there; read them so a stopped service
      // keeps its button (with a red dot) instead of vanishing.
      for (const c of found) {
        if (c.running || c.url || c.port) continue;
        c.port = await this.configuredPort(c.name);
      }
      this.containers = found.sort((a, b) => a.name.localeCompare(b.name));
      this.lastError = null;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
    }
  }

  private async configuredPort(name: string): Promise<number | null> {
    try {
      const info = (await this.fetcher!(`/containers/${encodeURIComponent(name)}/json`)) as { HostConfig?: { PortBindings?: Record<string, { HostPort?: string }[] | null> } };
      const ports: number[] = [];
      for (const [spec, bindings] of Object.entries(info.HostConfig?.PortBindings ?? {})) {
        if (!spec.endsWith('/tcp')) continue;
        for (const b of bindings ?? []) {
          const n = Number(b.HostPort);
          if (Number.isInteger(n) && n > 0) ports.push(n);
        }
      }
      return ports.sort((a, b) => a - b)[0] ?? null;
    } catch {
      return null;
    }
  }

  /**
   * The discovered containers as bookmark records for one page view. The URL
   * defaults to the host the page was opened at plus the first published
   * port, so it works whether people use the DNS name or the IP.
   */
  asBookmarks(requestHost: string): Bookmark[] {
    const hostname = requestHost.replace(/:\d+$/, '');
    const out: Bookmark[] = [];
    for (const c of this.containers) {
      const url = c.url ?? (c.port ? `http://${hostname}:${c.port}` : null);
      if (!url) continue;
      out.push({ id: `docker:${c.name}`, label: c.label, url, group: c.group, owner: 'docker', shared: true, createdAt: '', updatedAt: '' });
    }
    return out;
  }

  /** Docker's own view of a container: not running means down, no ping needed. */
  statusOf(id: string): 'up' | 'down' | null {
    const c = this.containers.find((x) => `docker:${x.name}` === id);
    return c ? (c.running ? 'up' : 'down') : null;
  }

  start(): void {
    if (!this.fetcher || this.timer) return;
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), this.interval);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
