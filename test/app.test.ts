import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { App } from '../src/server/app.ts';
import { loadConfig } from '../src/server/config.ts';

/** Boots the real HTTP stack on a random port against a scratch database. */
const dir = await mkdtemp(join(tmpdir(), 'alias-app-test-'));
const app = await App.create(loadConfig({ PORT: '0', HOST: '127.0.0.1', DB_PATH: join(dir, 'db.json') }));
const log = console.log;
before(async () => {
  console.log = () => {};
  await app.listen({ background: false });
});
after(async () => {
  await app.close();
  console.log = log;
  await rm(dir, { recursive: true, force: true });
});

const base = (): string => `http://127.0.0.1:${app.port}`;
const json = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  fetch(base() + path, {
    method,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });

test('config rejects nonsense ports', () => {
  assert.throws(() => loadConfig({ PORT: 'eighty' }), /PORT must be/);
  assert.throws(() => loadConfig({ PORT: '70000' }), /PORT must be/);
  assert.equal(loadConfig({ PORT: '8080' }).port, 8080);
});

test('health reports whether docker discovery is on', async () => {
  const h = await (await fetch(base() + '/api/health')).json();
  assert.equal(h.docker, false, 'no socket in the test environment');
});

test('pages and assets are served; unknown API paths are JSON 404s', async () => {
  assert.equal((await fetch(base() + '/')).status, 200);
  assert.equal((await fetch(base() + '/aliases')).headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal((await fetch(base() + '/assets/style.css')).status, 200);
  const missing = await fetch(base() + '/api/nope');
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: 'Not found.' });
});

test('icons and manifest are served per theme and their names are reserved', async () => {
  const m = await fetch(base() + '/manifest.webmanifest?theme=tokyo-night');
  assert.equal(m.headers.get('content-type'), 'application/manifest+json');
  assert.equal((await m.json()).theme_color, '#16161e');
  const png = await fetch(base() + '/icon-192.png?theme=nord');
  assert.equal(png.headers.get('content-type'), 'image/png');
  assert.equal((await png.arrayBuffer()).byteLength > 100, true);
  assert.equal((await fetch(base() + '/favicon.svg')).headers.get('content-type'), 'image/svg+xml');
  assert.equal((await json('POST', '/api/aliases', { name: 'icon-512.png', url: 'https://x.example' })).status, 400);
});

test('alias lifecycle over HTTP, including CSRF and method checks', async () => {
  assert.equal((await json('POST', '/api/aliases', { name: 'plex', url: 'https://plex.example/%s' })).status, 201);
  const form = await fetch(base() + '/api/aliases', { method: 'POST', body: 'name=x&url=https://x', headers: { 'content-type': 'text/plain' } });
  assert.equal(form.status, 415);
  const patch = await json('PATCH', '/api/aliases/plex');
  assert.equal(patch.status, 405);
  assert.equal(patch.headers.get('allow'), 'GET, PUT, DELETE');
  assert.equal((await json('POST', '/api/aliases', { name: 'gh', url: 'https://x.example' })).status, 400, 'bang names are reserved');
  assert.equal((await json('POST', '/api/aliases', { name: 'documentation', url: 'https://x.example' })).status, 400, 'page names are reserved');
});

test('redirects: alias with %s, built-in bang path, unknown name, and HEAD does not count as a hit', async () => {
  const get = await fetch(base() + '/plex/movie%20night', { redirect: 'manual' });
  assert.equal(get.status, 302);
  assert.equal(get.headers.get('location'), 'https://plex.example/movie%20night');
  const head = await fetch(base() + '/plex', { method: 'HEAD', redirect: 'manual' });
  assert.equal(head.status, 302);
  const alias = await (await fetch(base() + '/api/aliases/plex')).json();
  assert.equal(alias.hits, 1, 'GET counted, HEAD did not');

  const yt = await fetch(base() + '/yt/kitty%20cats', { redirect: 'manual' });
  assert.equal(yt.headers.get('location'), 'https://www.youtube.com/results?search_query=kitty%20cats');
  assert.equal((await fetch(base() + '/yt', { redirect: 'manual' })).headers.get('location'), 'https://www.youtube.com/');
  assert.equal((await fetch(base() + '/nope', { redirect: 'manual' })).headers.get('location'), '/aliases?new=nope');
  assert.equal((await fetch(base() + '/assets', { redirect: 'manual' })).status, 404, 'reserved names never redirect');
});

test('profile flow: register sets a cookie that /api/me honours; logout clears it', async () => {
  const reg = await json('POST', '/api/register', { username: 'Travis' });
  assert.equal(reg.status, 201);
  const cookie = reg.headers.get('set-cookie') ?? '';
  assert.match(cookie, /^user=travis; Path=\/; Max-Age=\d+; SameSite=Lax; HttpOnly$/);
  assert.equal((await json('GET', '/api/me')).status, 401);
  const me = await json('GET', '/api/me', undefined, { cookie: 'user=travis' });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).name, 'travis');
  assert.equal((await json('POST', '/api/register', { username: 'travis' })).status, 409);
  const out = await json('POST', '/api/logout', undefined, { cookie: 'user=travis' });
  assert.equal(out.status, 204);
  assert.match(out.headers.get('set-cookie') ?? '', /Max-Age=0/);
});

test('bookmarks over HTTP: personal vs shared, hidden, order, status only for local targets', async () => {
  const mine = { cookie: 'user=travis' };
  const saved = await json('PUT', '/api/bookmarks', {
    bookmarks: [
      { label: 'Plex', url: '/plex', shared: true },
      { label: 'GitHub', url: 'https://github.com', shared: false },
    ],
  }, mine);
  assert.equal(saved.status, 200);
  const list = await saved.json();
  assert.deepEqual(list.map((b: { label: string; shared: boolean; editable: boolean }) => [b.label, b.shared, b.editable]), [['Plex', true, true], ['GitHub', false, true]]);
  assert.equal(list[1].status, null, 'internet sites get no status');
  assert.equal((await json('GET', '/api/bookmarks')).status, 401);

  await json('POST', '/api/register', { username: 'guest' });
  const guestList = await (await json('GET', '/api/bookmarks', undefined, { cookie: 'user=guest' })).json();
  assert.deepEqual(guestList.map((b: { label: string; owner: string }) => [b.label, b.owner]), [['Plex', 'travis']]);
  const hide = await json('PUT', '/api/bookmarks', { hidden: [list[0].id] }, { cookie: 'user=guest' });
  assert.equal((await hide.json())[0].hidden, true);
  const stillMine = await (await json('GET', '/api/bookmarks', undefined, mine)).json();
  assert.equal(stillMine[0].hidden, false, "guest hiding a shared bookmark doesn't hide it for its owner");
});

test('profiles can be listed and deleted; deleting your own profile clears the cookie', async () => {
  await json('POST', '/api/register', { username: 'oops' });
  const list = await (await json('GET', '/api/users')).json();
  assert.deepEqual(list.map((u: { name: string; bookmarks: number }) => [u.name, u.bookmarks]), [['guest', 0], ['oops', 0], ['travis', 2]]);

  const gone = await json('DELETE', '/api/users/oops', undefined, { cookie: 'user=oops' });
  assert.equal(gone.status, 204);
  assert.match(gone.headers.get('set-cookie') ?? '', /Max-Age=0/, 'own profile deletion logs out');
  assert.equal((await json('DELETE', '/api/users/oops')).status, 404);
  const other = await json('DELETE', '/api/users/zzz', undefined, { cookie: 'user=travis' });
  assert.equal(other.status, 404);
  assert.equal(other.headers.get('set-cookie'), null, 'someone else\'s failed delete leaves your cookie alone');
});

test('export includes profiles and bookmarks; import accepts backups, partial objects, legacy arrays and legacy embedded bookmarks', async () => {
  const backup = await (await fetch(base() + '/api/export')).json();
  assert.ok(Array.isArray(backup.aliases) && Array.isArray(backup.users) && Array.isArray(backup.bookmarks));
  assert.equal(backup.bookmarks.length, 2);
  assert.equal(backup.users.find((u: { name: string }) => u.name === 'travis').bookmarks, undefined, 'profiles no longer embed bookmarks');

  const full = await (await json('POST', '/api/import', backup)).json();
  assert.deepEqual(full, { added: 0, updated: 1, users: { added: 0, updated: 2 }, bookmarks: { added: 0, updated: 2 } });
  const legacy = await (await json('POST', '/api/import', [{ name: 'legacy', url: 'https://legacy.example' }])).json();
  assert.deepEqual(legacy, { added: 1, updated: 0, users: { added: 0, updated: 0 }, bookmarks: { added: 0, updated: 0 } });
  const oldStyle = await (await json('POST', '/api/import', { users: [{ name: 'newbie', bookmarks: [{ label: 'Old', url: 'https://old.example' }] }] })).json();
  assert.deepEqual(oldStyle, { added: 0, updated: 0, users: { added: 1, updated: 0 }, bookmarks: { added: 1, updated: 0 } });
  const newbie = await (await json('GET', '/api/bookmarks', undefined, { cookie: 'user=newbie' })).json();
  assert.deepEqual(newbie.map((b: { label: string; owner: string }) => [b.label, b.owner]), [['Plex', 'travis'], ['Old', 'newbie']]);
  assert.equal((await json('POST', '/api/import', { nothing: true })).status, 400);
});
