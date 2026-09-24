import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENGINES, resolveSearch, isEngineId } from '../src/shared/search.ts';

const aliases = ['book', 'plex', 'Docs'];

test('empty input resolves to nothing', () => {
  assert.equal(resolveSearch('', 'google', aliases), null);
  assert.equal(resolveSearch('   ', 'google', aliases), null);
});

test('plain words never jump to an alias or engine, even when they match one', () => {
  assert.equal(resolveSearch('book', 'google', aliases), 'https://www.google.com/search?q=book');
  assert.equal(resolveSearch('book jackson', 'google', aliases), 'https://www.google.com/search?q=book%20jackson');
  assert.equal(resolveSearch('yt kitty cats', 'google', aliases), 'https://www.google.com/search?q=yt%20kitty%20cats');
  assert.equal(resolveSearch('plex/web', 'duckduckgo', aliases), 'https://duckduckgo.com/?q=plex%2Fweb');
});

test('every alias is also a bang', () => {
  assert.equal(resolveSearch('!book jackson', 'google', aliases), '/book/jackson');
  assert.equal(resolveSearch('jackson !BOOK', 'google', aliases), '/book/jackson');
  assert.equal(resolveSearch('!docs', 'google', aliases), '/docs');
  assert.equal(resolveSearch('!gh cli', 'google', aliases), 'https://github.com/search?q=cli', 'built-in bangs are unaffected');
});

test('default engine is used for ordinary queries', () => {
  assert.equal(resolveSearch('red pandas', 'duckduckgo', aliases), 'https://duckduckgo.com/?q=red%20pandas');
  assert.equal(resolveSearch('x', 'not-an-engine', aliases), 'https://www.google.com/search?q=x', 'unknown default falls back to Google');
});

test('known bangs pick the engine wherever they appear', () => {
  assert.equal(resolveSearch('!w cats', 'google', aliases), 'https://en.wikipedia.org/w/index.php?search=cats');
  assert.equal(resolveSearch('cats !yt', 'google', aliases), 'https://www.youtube.com/results?search_query=cats');
  assert.equal(resolveSearch('!A lego set', 'google', aliases), 'https://www.amazon.com/s?k=lego%20set');
  assert.equal(resolveSearch('!gh', 'google', aliases), 'https://github.com/search?q=', 'bang alone searches the empty string');
});

test('unknown bangs are handed to DuckDuckGo untouched', () => {
  assert.equal(resolveSearch('!hn rust', 'google', aliases), 'https://duckduckgo.com/?q=!hn%20rust');
});

test('engine table is well formed', () => {
  const ids = new Set<string>();
  const bangs = new Set<string>();
  for (const e of ENGINES) {
    assert.ok(e.url.includes('%s'), `${e.id} has no %s`);
    assert.ok(/^https:\/\//.test(e.home), `${e.id} has no home URL`);
    assert.ok(!ids.has(e.id) && !bangs.has(e.bang), `${e.id} duplicates an id or bang`);
    ids.add(e.id);
    bangs.add(e.bang);
  }
  assert.ok(isEngineId('google'));
  assert.ok(!isEngineId('askjeeves'));
  assert.ok(!isEngineId(42));
});
