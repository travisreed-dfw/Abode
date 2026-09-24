import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StatusMonitor } from '../src/server/status.ts';

test('only home-network addresses are considered local', () => {
  for (const url of ['http://10.0.0.5:32400', 'http://192.168.1.1', 'http://172.16.4.4', 'http://plex', 'http://nas.local', 'http://printer.lan', 'http://localhost:8080', 'http://127.0.0.1']) {
    assert.ok(StatusMonitor.isLocal(url), `${url} should be local`);
  }
  for (const url of ['https://github.com', 'http://172.32.0.1', 'http://8.8.8.8', 'https://plex.tv', 'not a url']) {
    assert.ok(!StatusMonitor.isLocal(url), `${url} should not be local`);
  }
});

test('checks report up for any HTTP response and down for network failures; public URLs are never fetched', async () => {
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith('http://10.0.0.9')) throw new Error('ECONNREFUSED');
    return new Response('nope', { status: 401 });
  }) as typeof fetch;
  const m = new StatusMonitor({ fetch: fetchImpl, now: () => 1 });
  let urls = ['http://10.0.0.5:32400/web', 'http://10.0.0.9', 'https://github.com'];
  m.setSource(() => urls);
  await m.checkAll();
  assert.equal(m.statusOf('http://10.0.0.5:32400/web'), 'up', '401 still means the service answered');
  assert.equal(m.statusOf('http://10.0.0.9'), 'down');
  assert.equal(m.statusOf('https://github.com'), null);
  assert.ok(!calls.some((c) => c.includes('github.com')), 'public sites are never pinged');
  assert.equal(m.statusOf('http://10.0.0.77'), null, 'unknown URLs have no status');

  urls = ['http://10.0.0.5:32400/web'];
  await m.checkAll();
  assert.equal(m.statusOf('http://10.0.0.9'), null, 'a URL that is no longer bookmarked is forgotten');
  assert.equal(calls.filter((c) => c.startsWith('http://10.0.0.9')).length, 1, 'and no longer pinged');
});
