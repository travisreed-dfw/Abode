import { mkdir, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type BackupSchedulerOptions = {
  now?: () => Date;
  keep?: number;
  checkEveryMs?: number;
};

/**
 * Writes one backup file per day into `<dir>` and keeps the most recent ones.
 * Runs at startup and then re-checks hourly, so a machine that is only on
 * during the day still gets its daily file.
 */
export class BackupScheduler {
  private readonly dir: string;
  private readonly makeBackup: () => unknown;
  private readonly now: () => Date;
  private readonly keep: number;
  private readonly every: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(dir: string, makeBackup: () => unknown, options: BackupSchedulerOptions = {}) {
    this.dir = dir;
    this.makeBackup = makeBackup;
    this.now = options.now ?? (() => new Date());
    this.keep = options.keep ?? 30;
    this.every = options.checkEveryMs ?? 60 * 60 * 1000;
  }

  static fileFor(date: Date): string {
    return `alias-backup-${date.toISOString().slice(0, 10)}.json`;
  }

  /** Writes today's file if it doesn't exist yet, then prunes. Returns the file written, if any. */
  async run(): Promise<string | null> {
    await mkdir(this.dir, { recursive: true });
    const name = BackupScheduler.fileFor(this.now());
    const existing = await this.list();
    let written: string | null = null;
    if (!existing.includes(name)) {
      const tmp = join(this.dir, `${name}.tmp`);
      await writeFile(tmp, JSON.stringify(this.makeBackup(), null, 2));
      await rename(tmp, join(this.dir, name));
      written = name;
    }
    const all = (await this.list()).sort();
    for (const old of all.slice(0, Math.max(0, all.length - this.keep))) await unlink(join(this.dir, old));
    return written;
  }

  async list(): Promise<string[]> {
    try {
      return (await readdir(this.dir)).filter((f) => /^alias-backup-\d{4}-\d{2}-\d{2}\.json$/.test(f));
    } catch {
      return [];
    }
  }

  start(): void {
    if (this.timer) return;
    void this.run().catch((err: unknown) => console.error('backup failed', err));
    this.timer = setInterval(() => void this.run().catch((err: unknown) => console.error('backup failed', err)), this.every);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
