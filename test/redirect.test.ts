import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTarget, splitPath } from '../src/server/redirect.ts';

test('plain target with no suffix or query is returned unchanged', () => {
  assert.equal(buildTarget('https://github.com/', '', ''), 'https://github.com/');
});

test('suffix is appended to the path with a single slash', () => {
  assert.equal(buildTarget('https://github.com', 'travisreed', ''), 'https://github.com/travisreed');
  assert.equal(buildTarget('https://github.com/', 'travisreed', ''), 'https://github.com/travisreed');
  assert.equal(buildTarget('https://github.com//', 'a/b', ''), 'https://github.com/a/b');
});

test('query string is appended with ? or & as appropriate', () => {
  assert.equal(buildTarget('https://example.com/', '', 'x=1'), 'https://example.com/?x=1');
  assert.equal(buildTarget('https://example.com/?a=1', '', 'x=1'), 'https://example.com/?a=1&x=1');
  assert.equal(buildTarget('https://github.com', 'foo', 'tab=repos'), 'https://github.com/foo?tab=repos');
});

test('%s placeholder receives the URL-encoded suffix', () => {
  const t = 'https://www.google.com/search?q=%s';
  assert.equal(buildTarget(t, 'cats', ''), 'https://www.google.com/search?q=cats');
  assert.equal(buildTarget(t, 'hello%20world', ''), 'https://www.google.com/search?q=hello%20world');
  assert.equal(buildTarget(t, 'a/b', ''), 'https://www.google.com/search?q=a%2Fb');
  assert.equal(buildTarget(t, '', ''), 'https://www.google.com/search?q=');
  assert.equal(buildTarget(t, 'cats', 'lang=en'), 'https://www.google.com/search?q=cats&lang=en');
});

test('%s can appear more than once and in the path', () => {
  assert.equal(buildTarget('https://x.com/%s/%s', 'v', ''), 'https://x.com/v/v');
});

test('splitPath separates the alias name from the remainder', () => {
  assert.deepEqual(splitPath('/gh'), { name: 'gh', suffix: '' });
  assert.deepEqual(splitPath('/GH/a/b'), { name: 'gh', suffix: 'a/b' });
  assert.deepEqual(splitPath('/'), { name: '', suffix: '' });
  assert.deepEqual(splitPath('/caf%C3%A9'), { name: 'café', suffix: '' });
});
