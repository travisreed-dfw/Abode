import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Router } from '../src/server/router.ts';
import { HttpError } from '../src/server/http.ts';
import { CookieSession } from '../src/server/session.ts';

const noop = (): void => {};

test('routes match by method and path, with decoded params', () => {
  const r = new Router().get('/api/aliases', noop).get('/api/aliases/:name', noop).post('/api/aliases', noop);
  assert.ok(r.match('GET', '/api/aliases'));
  assert.deepEqual(r.match('GET', '/api/aliases/caf%C3%A9')?.params, { name: 'café' });
  assert.equal(r.match('GET', '/api/nope'), undefined);
  assert.equal(r.match('GET', '/api/aliases/a/b'), undefined, 'params never span slashes');
});

test('HEAD is served by GET routes', () => {
  const r = new Router().get('/api/health', noop);
  assert.ok(r.match('HEAD', '/api/health'));
});

test('a known path with the wrong method is a 405 listing the allowed methods', () => {
  const r = new Router().get('/api/aliases/:name', noop).delete('/api/aliases/:name', noop);
  assert.throws(
    () => r.match('PATCH', '/api/aliases/x'),
    (err: unknown) => err instanceof HttpError && err.status === 405 && (err as { allow?: string }).allow === 'GET, DELETE',
  );
});

test('cookie parsing tolerates odd input', () => {
  assert.deepEqual(CookieSession.parse(undefined), {});
  assert.deepEqual(CookieSession.parse('user=travis; other=1'), { user: 'travis', other: '1' });
  assert.deepEqual(CookieSession.parse('user=tr%C3%A9; bad=%E0%A4%A'), { user: 'tré', bad: '%E0%A4%A' });
});
