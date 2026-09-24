import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { StaticFiles } from '../src/server/static.ts';

const files = new StaticFiles('/srv/public', { '/': { file: 'index.html', type: 'text/html' } });

test('assets resolve inside the assets folder only', () => {
  assert.equal(files.resolveAsset('/assets/style.css')?.file, join('/srv/public/assets', 'style.css'));
  assert.equal(files.resolveAsset('/assets/client/home.js')?.type, 'text/javascript; charset=utf-8');
  assert.equal(files.resolveAsset('/assets/../package.json'), null, 'dot-dot escapes are refused');
  assert.equal(files.resolveAsset('/assets/..%2f..%2fpackage.json'), null, 'encoded escapes are refused');
  assert.equal(files.resolveAsset('/assets/notes.txt'), null, 'unknown types are refused');
  assert.equal(files.resolveAsset('/assets/%E0%A4%A'), null, 'undecodable paths are refused');
});

test('static detection covers pages, assets and the favicon', () => {
  assert.ok(files.isStatic('/'));
  assert.ok(files.isStatic('/assets/x.css'));
  assert.ok(files.isStatic('/favicon.ico'));
  assert.ok(!files.isStatic('/gh'));
  assert.ok(!files.isStatic('/api/aliases'));
});
