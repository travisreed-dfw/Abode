import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BackupScheduler } from '../src/server/backups.ts';

const dir = await mkdtemp(join(tmpdir(), 'alias-backups-test-'));
after(() => rm(dir, { recursive: true, force: true }));

test('writes one file per day, skips repeats, and prunes to the keep count', async () => {
  let day = new Date('2026-09-24T10:00:00Z');
  let counter = 0;
  const s = new BackupScheduler(join(dir, 'backups'), () => ({ n: ++counter }), { now: () => day, keep: 3 });

  assert.equal(await s.run(), 'alias-backup-2026-09-24.json');
  assert.equal(await s.run(), null, 'same day: nothing new');
  assert.deepEqual(JSON.parse(await readFile(join(dir, 'backups', 'alias-backup-2026-09-24.json'), 'utf8')), { n: 1 });

  for (const d of ['2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28']) {
    day = new Date(`${d}T10:00:00Z`);
    await s.run();
  }
  const files = (await readdir(join(dir, 'backups'))).sort();
  assert.deepEqual(files, ['alias-backup-2026-09-26.json', 'alias-backup-2026-09-27.json', 'alias-backup-2026-09-28.json']);
});
