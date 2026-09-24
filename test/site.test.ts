import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localizeExample, shortNameFor, stripShortLink } from '../src/shared/site.ts';

test('single-label hostnames become the brand; IPs and dotted hosts fall back to a', () => {
  assert.equal(shortNameFor('a'), 'a');
  assert.equal(shortNameFor('B'), 'b');
  assert.equal(shortNameFor('go'), 'go');
  assert.equal(shortNameFor('10.0.0.5'), 'a');
  assert.equal(shortNameFor('alias.home.arpa'), 'a');
  assert.equal(shortNameFor('localhost'), 'localhost');
});

test('examples are rewritten for the host in use', () => {
  assert.equal(localizeExample('http://a/yt/kittens', 'b', 'b'), 'http://b/yt/kittens');
  assert.equal(localizeExample('a/g/cats', '10.0.0.5', 'a'), 'a/g/cats');
  assert.equal(localizeExample('a/g/cats', 'go', 'go'), 'go/g/cats');
  assert.equal(localizeExample('http://a/ and http://a/x', 'localhost:8080', 'localhost'), 'http://localhost:8080/ and http://localhost:8080/x');
  assert.equal(localizeExample('nothing to do', 'b', 'b'), 'nothing to do');
  assert.equal(localizeExample('a', 'b', 'b'), 'a', 'a bare a is not a prefix');
});

test('pasted short links are stripped whatever the host is', () => {
  assert.equal(stripShortLink('a/plex', 'b', 'b'), 'plex');
  assert.equal(stripShortLink('http://b/plex', 'b', 'b'), 'plex');
  assert.equal(stripShortLink('HTTP://10.0.0.5/plex', '10.0.0.5', 'a'), 'plex');
  assert.equal(stripShortLink('  localhost:8080/plex ', 'localhost:8080', 'localhost'), 'plex');
  assert.equal(stripShortLink('plex', 'b', 'b'), 'plex');
  assert.equal(stripShortLink('a.plex', 'b', 'b'), 'a.plex', 'dots in the host are not wildcards');
});
