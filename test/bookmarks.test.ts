import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/server/store.ts';
import { UserRepository } from '../src/server/users.ts';
import { BookmarkRepository } from '../src/server/bookmarks.ts';
import { HttpError } from '../src/server/http.ts';

const dir = await mkdtemp(join(tmpdir(), 'alias-bookmarks-test-'));
const store = await Store.open(join(dir, 'db.json'));
const users = new UserRepository(store);
const bookmarks = new BookmarkRepository(store);
const mom = await users.register('mom');
const kid = await users.register('kid');
after(() => rm(dir, { recursive: true, force: true }));

const names = (u: typeof mom): string[] => bookmarks.forUser(u).map((b) => b.label);

test('personal bookmarks show only for their owner; shared ones for everyone', async () => {
  await bookmarks.save(mom, { bookmarks: [
    { label: 'Router', url: 'http://10.0.0.1', shared: true },
    { label: 'Diary', url: 'https://diary.example', shared: false },
  ] });
  assert.deepEqual(names(mom), ['Router', 'Diary']);
  assert.deepEqual(names(kid), ['Router']);
  const kidView = bookmarks.forUser(kid)[0];
  assert.equal(kidView.owner, 'mom');
  assert.equal(kidView.editable, true, 'shared bookmarks are editable by anyone');
  assert.equal(bookmarks.countOwnedBy('mom'), 2);
});

test('hidden and order are per profile and never touch the bookmark itself', async () => {
  const router = bookmarks.forUser(kid)[0];
  await bookmarks.save(kid, { bookmarks: [{ label: 'Games', url: 'https://games.example', shared: false }], hidden: [router.id] });
  const kidView = bookmarks.forUser(kid);
  // Kid's own new bookmark is in kid's order; the shared Router isn't yet, so it follows.
  assert.deepEqual(kidView.map((b) => [b.label, b.hidden]), [['Games', false], ['Router', true]]);
  assert.equal(bookmarks.forUser(mom).find((b) => b.id === router.id)!.hidden, false, "mom's view is unaffected");

  const games = kidView[0];
  await bookmarks.save(kid, { order: [router.id, games.id] });
  assert.deepEqual(names(kid), ['Games', 'Router'], 'hidden bookmarks sort after visible ones regardless of order');
  await bookmarks.save(kid, { hidden: [] });
  assert.deepEqual(names(kid), ['Router', 'Games'], 'unhiding restores the saved order');
  assert.deepEqual(names(mom), ['Router', 'Diary'], "mom's order is unaffected");
});

test('nothing is deleted by omission; removal is explicit and limited to what you may edit', async () => {
  const momView = bookmarks.forUser(mom);
  const router = momView.find((b) => b.label === 'Router')!;
  const diary = momView.find((b) => b.label === 'Diary')!;
  // A partial save (only Diary sent back) leaves Router alone.
  await bookmarks.save(mom, { bookmarks: [{ id: diary.id, label: 'Diary', url: diary.url, shared: false }] });
  assert.deepEqual(names(mom), ['Router', 'Diary']);
  // Explicit removal of the shared Router removes it for everyone and prunes stale hidden ids.
  await bookmarks.save(mom, { remove: [router.id] });
  assert.deepEqual(names(mom), ['Diary']);
  assert.deepEqual(names(kid), ['Games'], "kid's own bookmark survived");
  await bookmarks.save(kid, { hidden: [] });
  assert.deepEqual(users.get('kid')!.hidden, []);
  assert.deepEqual(users.get('kid')!.order.filter((id) => id === router.id), [], 'stale order ids are pruned');
});

test('anyone may edit a shared bookmark, but only its owner may change the Shared flag', async () => {
  await bookmarks.save(mom, { bookmarks: [{ label: 'Printer', url: 'http://printer.local', shared: true }] });
  const printer = bookmarks.forUser(kid).find((b) => b.label === 'Printer')!;
  await bookmarks.save(kid, { bookmarks: [{ id: printer.id, label: 'Printer (2nd floor)', url: printer.url, shared: true }] });
  assert.equal(bookmarks.get(printer.id)!.label, 'Printer (2nd floor)');
  await assert.rejects(
    bookmarks.save(kid, { bookmarks: [{ id: printer.id, label: 'Printer', url: printer.url, shared: false }] }),
    (err: unknown) => err instanceof HttpError && err.status === 403 && /only mom/.test(err.message),
  );
  await bookmarks.save(mom, { remove: [printer.id] });
});

test('a profile cannot edit or delete another profile\'s personal bookmark', async () => {
  const games = bookmarks.forUser(kid)[0];
  await assert.rejects(
    bookmarks.save(mom, { bookmarks: [{ id: games.id, label: 'Hijack', url: 'https://x.example', shared: true }] }),
    (err: unknown) => err instanceof HttpError && err.status === 403,
  );
  await assert.rejects(bookmarks.save(mom, { remove: [games.id] }), (err: unknown) => err instanceof HttpError && err.status === 403);
  await bookmarks.save(mom, { remove: ['nope'] });
  await assert.rejects(bookmarks.save(mom, { bookmarks: [{ id: 'nope', label: 'x', url: 'https://x.example' }] }), /no bookmark with id/);
  await assert.rejects(bookmarks.save(mom, { bookmarks: [{ label: '', url: 'https://x.example' }] }), /label is required/);
  await assert.rejects(bookmarks.save(mom, { bookmarks: 'nope' }), /must be a list/);
  await assert.rejects(bookmarks.save(mom, { hidden: [1] }), /list of ids/);
});

test('deleting a profile removes its personal bookmarks and keeps its shared ones', async () => {
  await bookmarks.save(kid, { bookmarks: [
    { id: bookmarks.forUser(kid)[0].id, label: 'Games', url: 'https://games.example', shared: false },
    { label: 'Printer', url: 'http://printer.local', shared: true },
  ] });
  await bookmarks.removeOwnedBy('kid');
  assert.deepEqual(bookmarks.all().map((b) => [b.label, b.owner]), [['Diary', 'mom'], ['Printer', 'kid']]);
});

test('import upserts by id and keeps the owner from the file', async () => {
  const printer = bookmarks.all().find((b) => b.label === 'Printer')!;
  const r = await bookmarks.import([
    { id: printer.id, label: 'Printer (new)', url: 'http://printer.local/', owner: 'kid', shared: true },
    { label: 'Restored', url: 'https://r.example', owner: 'ghost', shared: false, createdAt: '2026-01-01T00:00:00.000Z' },
  ]);
  assert.deepEqual(r, { added: 1, updated: 1 });
  assert.equal(bookmarks.get(printer.id)!.label, 'Printer (new)');
  await assert.rejects(bookmarks.import([{ label: 'x', url: 'https://x.example' }]), /owner is required/);
});

test('groups are validated and per-profile collapsed state lives on the profile', async () => {
  await bookmarks.save(mom, { bookmarks: [{ label: 'Jelly', url: 'https://j.example', group: '  Media  ', shared: true }] });
  const jelly = bookmarks.forUser(mom).find((b) => b.label === 'Jelly')!;
  assert.equal(jelly.group, 'Media');
  await assert.rejects(bookmarks.save(mom, { bookmarks: [{ id: jelly.id, label: 'Jelly', url: jelly.url, group: 'x'.repeat(41), shared: true }] }), /group must be at most/);
  await users.update('mom', { collapsed: ['Media', 'Media', ''] });
  assert.deepEqual(users.get('mom')!.collapsed, ['Media']);
  assert.deepEqual(users.get('kid')!.collapsed, [], "kid's collapsed groups are separate");
  await assert.rejects(users.update('mom', { collapsed: 'Media' }), /list of group names/);
});

test('discovered containers join the view as read-only shared bookmarks and can be hidden and ordered', async () => {
  const docker = [{ id: 'docker:plex', label: 'Plex', url: 'http://a:32400', group: 'Media', owner: 'docker', shared: true, createdAt: '', updatedAt: '' }];
  const view = bookmarks.forUser(kid, () => null, docker);
  const plex = view.find((b) => b.id === 'docker:plex')!;
  assert.equal(plex.editable, false);
  assert.equal(plex.shared, true);
  await bookmarks.save(kid, { hidden: ['docker:plex'], order: ['docker:plex'] }, ['docker:plex']);
  assert.deepEqual(users.get('kid')!.hidden, ['docker:plex']);
  assert.deepEqual(users.get('kid')!.order[0], 'docker:plex');
  await assert.rejects(bookmarks.save(kid, { bookmarks: [{ id: 'docker:plex', label: 'Plex', url: 'http://a:32400', shared: true }] }, ['docker:plex']), /comes from Docker/);
  await bookmarks.save(kid, { remove: ['docker:plex'] }, ['docker:plex']);
  assert.ok(bookmarks.forUser(kid, () => null, docker).some((b) => b.id === 'docker:plex'), 'remove is a no-op for discovered entries; they live in Docker, not the database');
});
