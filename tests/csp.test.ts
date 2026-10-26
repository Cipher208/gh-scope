/**
 * The policy is markup, and markup is the easiest thing to weaken by accident:
 * one `'unsafe-eval'` added while debugging, one inline script pasted back into
 * the head, and the CSP stops covering the part that matters. These tests read
 * index.html and refuse a weakened policy.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const html = readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

function policy(): string {
  const match = html.match(/http-equiv="Content-Security-Policy"[\s\S]*?content="([^"]+)"/i);
  assert.ok(match, 'index.html must carry a Content-Security-Policy meta tag');
  return match[1];
}

test('the page denies everything it does not name', () => {
  assert.match(policy(), /default-src 'none'/);
});

test('scripts are same-origin only: no eval, no inline blocks', () => {
  const p = policy();
  assert.match(p, /script-src 'self'(;|$)/);
  assert.ok(!/script-src[^;]*'unsafe-eval'/.test(p), 'eval re-opens the hole the policy exists to close');
  assert.ok(!/script-src[^;]*'unsafe-inline'/.test(p), 'inline scripts should be files, not exceptions');
});

test('the app can still reach the API, the fonts and README images', () => {
  const p = policy();
  assert.match(p, /connect-src[^;]*https:\/\/api\.github\.com/);
  assert.match(p, /style-src[^;]*https:\/\/fonts\.googleapis\.com/);
  assert.match(p, /font-src[^;]*https:\/\/fonts\.gstatic\.com/);
  assert.match(p, /img-src[^;]*https:/, 'README images come from arbitrary hosts');
});

test('no inline script blocks are left in the document', () => {
  const inline = html.match(/<script(?![^>]*\bsrc=)[^>]*>/gi);
  assert.equal(inline, null, `inline script found: ${inline?.join(', ')}`);
});
