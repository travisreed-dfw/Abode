import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IconCache } from '../src/server/icons.ts';

const dir = await mkdtemp(join(tmpdir(), 'alias-icons-test-'));
after(() => rm(dir, { recursive: true, force: true }));

/** A fake network: maps URLs to responses and counts calls. */
function fakeFetch(routes: Record<string, { status?: number; type?: string; body?: string | Buffer }>) {
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    const r = routes[url];
    if (!r) return new Response(null, { status: 404 });
    const body = r.body === undefined ? '' : typeof r.body === 'string' ? r.body : new Uint8Array(r.body);
    return new Response(body, { status: r.status ?? 200, headers: { 'content-type': r.type ?? '' } });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

test('originOf accepts only absolute http(s) URLs', () => {
  assert.equal(IconCache.originOf('https://github.com/travisreed?x=1'), 'https://github.com');
  assert.equal(IconCache.originOf('/plex'), null);
  assert.equal(IconCache.originOf('ftp://x.example'), null);
  assert.equal(IconCache.originOf(null), null);
});

test('favicon.ico is fetched once, then served from disk', async () => {
  const net = fakeFetch({ 'https://a.example/favicon.ico': { type: 'image/x-icon', body: 'ICON' } });
  let now = 1_000_000;
  const cache = new IconCache(join(dir, 'a'), { fetch: net.fetchImpl, now: () => now });

  const first = await cache.get('https://a.example');
  assert.equal(first?.contentType, 'image/x-icon');
  assert.equal(first?.body.toString(), 'ICON');
  const second = await cache.get('https://a.example');
  assert.equal(second?.body.toString(), 'ICON');
  assert.equal(net.calls.length, 1, 'second call hits the cache');
  assert.ok((await readdir(join(dir, 'a'))).some((f) => f.endsWith('.ico')));

  now += 8 * 24 * 60 * 60 * 1000;
  await cache.get('https://a.example');
  assert.equal(net.calls.length, 2, 'refetched after the TTL');
});

test('falls back to <link rel=icon> in the page, and rejects non-images', async () => {
  const net = fakeFetch({
    'https://b.example/favicon.ico': { type: 'text/html', body: '<html>not an icon</html>' },
    'https://b.example/': { type: 'text/html; charset=utf-8', body: '<head><link rel="stylesheet" href="x.css"><link rel="shortcut icon" href="/static/fav.png"></head>' },
    'https://b.example/static/fav.png': { type: 'image/png', body: 'PNG' },
  });
  const cache = new IconCache(join(dir, 'b'), { fetch: net.fetchImpl });
  const icon = await cache.get('https://b.example');
  assert.equal(icon?.contentType, 'image/png');
  assert.deepEqual(net.calls, ['https://b.example/favicon.ico', 'https://b.example/', 'https://b.example/static/fav.png']);
});

test('misses are remembered for a day, and concurrent lookups are deduplicated', async () => {
  const net = fakeFetch({});
  let now = 5_000_000;
  const cache = new IconCache(join(dir, 'c'), { fetch: net.fetchImpl, now: () => now });
  const [x, y] = await Promise.all([cache.get('https://c.example'), cache.get('https://c.example')]);
  assert.equal(x, null);
  assert.equal(y, null);
  assert.equal(net.calls.length, 2, 'one favicon.ico probe plus one page fetch, not doubled');
  await cache.get('https://c.example');
  assert.equal(net.calls.length, 2, 'negative cache prevents a retry');
  now += 25 * 60 * 60 * 1000;
  await cache.get('https://c.example');
  assert.equal(net.calls.length, 4, 'retried after the miss TTL');
});

test('oversized icons are refused', async () => {
  const net = fakeFetch({ 'https://d.example/favicon.ico': { type: 'image/png', body: Buffer.alloc(1000) } });
  const cache = new IconCache(join(dir, 'd'), { fetch: net.fetchImpl, maxIconBytes: 500, maxHtmlBytes: 500 });
  assert.equal(await cache.get('https://d.example'), null);
});
