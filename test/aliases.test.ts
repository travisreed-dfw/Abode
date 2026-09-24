import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/server/store.ts';
import { AliasRepository } from '../src/server/aliases.ts';
import { HttpError } from '../src/server/http.ts';
import { normalizeDescription, normalizeName, normalizeUrl } from '../src/server/validation.ts';

const dir = await mkdtemp(join(tmpdir(), 'alias-test-'));
const store = await Store.open(join(dir, 'db.json'));
const repo = new AliasRepository(store);

after(() => rm(dir, { recursive: true, force: true }));

test('normalizeName lowercases, trims and validates', () => {
  assert.equal(normalizeName('  PLEX '), 'plex');
  assert.equal(normalizeName('my.alias-1_x'), 'my.alias-1_x');
  for (const bad of ['', ' ', 'bad name', '-lead', 'ünïcode', 'a'.repeat(65), 42, null, undefined]) {
    assert.throws(() => normalizeName(bad), HttpError, `expected ${String(bad)} to be rejected`);
  }
});

test('every served page path is a reserved alias name', async () => {
  const { PAGES } = await import('../src/server/pages.ts');
  const { RESERVED_NAMES } = await import('../src/server/validation.ts');
  for (const path of Object.keys(PAGES)) {
    if (path === '/') continue;
    assert.ok(RESERVED_NAMES.has(path.slice(1)), `${path} must be reserved`);
  }
});

test('reserved names and built-in bang names are rejected', () => {
  for (const name of ['api', 'aliases', 'assets', 'documentation', 'favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'manifest.webmanifest']) {
    assert.throws(() => normalizeName(name), /reserved/);
  }
  for (const name of ['gh', 'GH', 'yt', 'maps', 'a', 'w']) {
    assert.throws(() => normalizeName(name), /built-in !/);
  }
  assert.throws(() => normalizeName('gh'), /GitHub/, 'error names the engine');
});

test('normalizeUrl requires http(s) and keeps %s placeholders', () => {
  assert.equal(normalizeUrl(' https://example.com '), 'https://example.com/');
  assert.equal(normalizeUrl('https://g.com/search?q=%s'), 'https://g.com/search?q=%s');
  for (const bad of ['', 'example.com', 'ftp://x', 'javascript:alert(1)', 'file:///etc/passwd', 7]) {
    assert.throws(() => normalizeUrl(bad), HttpError);
  }
});

test('normalizeDescription trims, collapses whitespace and caps length', () => {
  assert.equal(normalizeDescription(undefined), '');
  assert.equal(normalizeDescription('  a   b \n c '), 'a b c');
  assert.throws(() => normalizeDescription('x'.repeat(201)), /200/);
  assert.throws(() => normalizeDescription(['no']), HttpError);
});

test('create, get, update, remove round trip and persist to disk', async () => {
  const created = await repo.create({ name: 'PLEX', url: 'https://plex.example', description: ' Plex ' });
  assert.equal(created.name, 'plex');
  assert.equal(created.description, 'Plex');
  assert.equal(created.hits, 0);
  assert.equal(created.lastUsedAt, null);

  await assert.rejects(repo.create({ name: 'plex', url: 'https://x.com' }), /already exists/);

  const updated = await repo.update('plex', { name: 'plexweb', url: 'https://plex.example/web' });
  assert.equal(updated.name, 'plexweb');
  assert.equal(updated.description, 'Plex', 'omitted fields are kept');
  assert.equal(repo.get('plex'), undefined);
  assert.ok(repo.get('PLEXWEB'), 'lookup is case-insensitive');

  await repo.create({ name: 'other', url: 'https://o.com' });
  await assert.rejects(repo.update('plexweb', { name: 'other' }), /already exists/);
  await assert.rejects(repo.update('missing', { url: 'https://x.com' }), /not found/);

  const onDisk = JSON.parse(await readFile(store.path, 'utf8'));
  assert.deepEqual(onDisk.aliases.map((a: { name: string }) => a.name).sort(), ['other', 'plexweb']);

  await repo.remove('other');
  await assert.rejects(repo.remove('other'), /not found/);
  assert.deepEqual(repo.list().map((a) => a.name), ['plexweb']);
});

test('recordHit increments the counter and stamps lastUsedAt', () => {
  const alias = repo.get('plexweb')!;
  repo.recordHit(alias);
  repo.recordHit(alias);
  assert.equal(alias.hits, 2);
  assert.ok(alias.lastUsedAt);
});

test('import upserts, keeps live hit counts and validates entries', async () => {
  const result = await repo.import([
    { name: 'plexweb', url: 'https://plex.example/', hits: 99 },
    { name: 'new', url: 'https://new.example', description: 'd', hits: 5, lastUsedAt: '2026-01-01T00:00:00.000Z' },
  ]);
  assert.deepEqual(result, { added: 1, updated: 1 });
  assert.equal(repo.get('plexweb')!.hits, 2, 'existing counts are preserved');
  assert.equal(repo.get('plexweb')!.url, 'https://plex.example/');
  assert.equal(repo.get('new')!.hits, 5, 'restored counts are taken from the file');

  assert.deepEqual(await repo.import([{ name: 'arr', url: 'https://a.example' }]), { added: 1, updated: 0 });
  await assert.rejects(repo.import([{ name: 'bad name', url: 'https://x.com' }]), /Entry 1/);
  await assert.rejects(repo.import([{ name: 'dup', url: 'https://x.com' }, { name: 'dup', url: 'https://y.com' }]), /more than once/);
});

test('Store migrates old files that lack newer fields', async () => {
  const { writeFile } = await import('node:fs/promises');
  const path = join(dir, 'old.json');
  await writeFile(path, JSON.stringify({
    aliases: [{ name: 'x', url: 'https://x.example', createdAt: 't', updatedAt: 't' }],
    users: [{ name: 'old', searchEngine: 'google', bookmarks: [{ label: 'One', url: 'https://one.example' }, { label: 'Two', url: '/x' }], createdAt: 't', updatedAt: 't' }],
  }));
  const old = await Store.open(path);
  assert.equal(old.data.users.length, 1);
  const u = old.data.users[0] as typeof old.data.users[0] & { bookmarks?: unknown };
  assert.equal(u.bookmarks, undefined, 'embedded bookmarks are lifted out of the profile');
  assert.equal(u.theme, 'midnight');
  assert.deepEqual(u.hidden, []);
  assert.equal(u.order.length, 2, 'order preserves the old list');
  assert.deepEqual(old.data.bookmarks.map((b) => [b.label, b.owner, b.shared]), [['One', 'old', false], ['Two', 'old', false]]);
  assert.deepEqual(old.data.bookmarks.map((b) => b.id), u.order);
  assert.equal(old.data.aliases[0].description, '');
  assert.equal(old.data.aliases[0].hits, 0);
  assert.equal(old.data.aliases[0].lastUsedAt, null);
  const onDisk = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(onDisk.aliases[0].hits, 0, 'migration is written back');
});
