/**
 * App.tsx is the one file without component tests: it is a ~1200-line shell
 * whose state can only be reached by clicking. Static rendering still covers
 * the part every visitor sees first — the frame, the navigation, the landing —
 * and it pins the promises the UI makes in words (one h1, where data comes
 * from, what stays in the browser).
 *
 * Interaction (views, modals, keyboard, theme flip) needs a DOM and is not
 * covered here; that is the honest gap this file leaves open.
 */
import './helpers/browser-globals.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import App from '../src/App.tsx';
import { en } from '../src/lib/i18n.tsx';

const html = renderToStaticMarkup(createElement(App));

test('the shell renders with its three landmarks', () => {
  assert.match(html, /<header/);
  assert.match(html, /<main/);
  assert.match(html, /<footer/);
});

test('there is exactly one h1, and it names the landing', () => {
  const matches = html.match(/<h1[^>]*>(.*?)<\/h1>/g) ?? [];
  assert.equal(matches.length, 1, 'one h1 per document');
  assert.match(html, /gh-scope — browse/);
});

test('all nine destinations are reachable from the header', () => {
  // The radar view is labelled "watchtower" on its tab, and the saved view was
  // hardcoded in English until this test caught it — every label now comes
  // from the dictionary, so a Russian visitor gets «сохранённые».
  const tabs = [en.nav.browse, en.nav.search, en.nav.discover, en.nav.orgs, en.nav.compare, en.nav.duel, en.nav.collections, en.nav.watchtower, en.nav.saved];
  for (const label of tabs) {
    assert.ok(html.includes(`>${label}</`), `nav tab missing: ${label}`);
  }
  assert.ok(!html.includes('>$ saved</'), 'no hardcoded English label may come back');
});

test('the header chrome is labelled for a screen reader', () => {
  for (const label of [en.chrome.langNote, en.settings.title, en.chrome.toLight]) {
    assert.ok(html.includes(label), `missing chrome control: ${label}`);
  }
});

test('the landing asks for a login and offers the quick profiles', () => {
  assert.match(html, /aria-label="GitHub login"/);
  for (const login of ['torvalds', 'gaearon', 'sindresorhus']) {
    assert.match(html, new RegExp(`>@${login}</`), `quick link missing: @${login}`);
  }
  assert.ok(html.includes(en.browse.open));
});

test('the footer tells the truth about data and storage', () => {
  assert.ok(html.includes('api.github.com'), 'the data source is named, not hidden');
  // `&` arrives as `&amp;` in markup; compare on the part after it.
  assert.ok(html.includes('stay in this browser'), 'the visitor is told what stays in the browser');
  assert.match(html, /<kbd>\/<\/kbd>/, 'the search shortcut is advertised');
  assert.match(html, /<kbd>esc<\/kbd>/);
});

test('no token UI is rendered while nobody asked for it', () => {
  assert.ok(!html.includes(en.settings.tokenPlaceholder), 'the settings modal stays closed');
  assert.ok(!html.includes(en.readme.loading), 'no README modal without a request');
});
