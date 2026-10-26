/**
 * Search engines and link previews read the head, not the app. Two things were
 * missing there: a canonical (which page is the one true address) and an
 * og:title (what a chat client shows when someone pastes the link).
 *
 * The markup wraps attributes across lines, so the assertions flatten whitespace
 * first — otherwise they test formatting, not tags.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const html = readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8').replace(/\s+/g, ' ');

test('the page declares one absolute canonical address', () => {
  const match = html.match(/<link rel="canonical" href="([^"]+)"/i);
  assert.ok(match, 'a canonical link is required');
  assert.equal(match[1], 'https://cipher208.github.io/gh-scope/', 'canonical must be absolute');
});

test('a pasted link has a title and a description to show', () => {
  assert.match(html, /<meta property="og:title" content="[^"]+"/i);
  assert.match(html, /<meta property="og:description" content="[^"]+"/i);
  assert.match(html, /<meta property="og:url" content="https:\/\/cipher208\.github\.io\/gh-scope\/"/i);
});
