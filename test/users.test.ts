import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/server/store.ts';
import { UserRepository } from '../src/server/users.ts';
import { HttpError } from '../src/server/http.ts';
import { normalizeUsername } from '../src/server/validation.ts';

const dir = await mkdtemp(join(tmpdir(), 'alias-users-test-'));
const users = new UserRepository(await Store.open(join(dir, 'db.json')));

after(() => rm(dir, { recursive: true, force: true }));

test('usernames are lowercased, trimmed and validated', () => {
  assert.equal(normalizeUsername('  Travis '), 'travis');
  for (const bad of ['', 'two words', '-x', 'a'.repeat(33), 'ünïcode', 5, null]) {
    assert.throws(() => normalizeUsername(bad), HttpError, `expected ${String(bad)} to be rejected`);
  }
});

test('register creates a profile with defaults; taken names are rejected', async () => {
  const u = await users.register('Travis');
  assert.equal(u.name, 'travis');
  assert.equal(u.searchEngine, 'google');
  assert.deepEqual(u.hidden, []);
  assert.deepEqual(u.order, []);
  await assert.rejects(users.register('travis'), (err: unknown) => err instanceof HttpError && err.status === 409 && /not available/.test(err.message));
});

test('login finds existing profiles case-insensitively and rejects unknown ones', () => {
  assert.equal(users.login('TRAVIS').name, 'travis');
  assert.throws(() => users.login('nobody'), (err: unknown) => err instanceof HttpError && err.status === 404 && /Register/.test(err.message));
});

test('search engine must be a known id', async () => {
  assert.equal((await users.update('travis', { searchEngine: 'duckduckgo' })).searchEngine, 'duckduckgo');
  await assert.rejects(users.update('travis', { searchEngine: 'altavista' }), /Unknown search engine/);
  await assert.rejects(users.update('ghost', { searchEngine: 'google' }), /No user/);
});

test('summaries, remove and import', async () => {
  assert.deepEqual(users.summaries((o) => (o === 'travis' ? 2 : 0)).map((u) => [u.name, u.bookmarks]), [['travis', 2]]);

  const imported = await users.import([
    { name: 'Travis', searchEngine: 'imdb', hidden: ['x'], order: ['y', 'x'] },
    { name: 'kid', searchEngine: 'not-an-engine', createdAt: '2026-01-01T00:00:00.000Z' },
  ]);
  assert.deepEqual(imported, { added: 1, updated: 1 });
  assert.equal(users.get('travis')!.searchEngine, 'imdb');
  assert.deepEqual(users.get('travis')!.order, ['y', 'x'], 'existing profile takes the file\'s order');
  assert.equal(users.get('kid')!.searchEngine, 'google', 'unknown engine falls back to the default');
  assert.equal(users.get('kid')!.createdAt, '2026-01-01T00:00:00.000Z');
  await assert.rejects(users.import([{ name: 'bad name' }]), /Profile 1/);
  await assert.rejects(users.import([{ name: 'x' }, { name: 'X' }]), /more than once/);

  await users.remove('KID');
  assert.equal(users.get('kid'), undefined);
  await assert.rejects(users.remove('kid'), /No user/);
});
