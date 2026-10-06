/**
 * The README renderer runs on text written by strangers.
 *
 * These tests exist because the renderer used to put any URL a README carried
 * straight into an `href` — including `javascript:` — which is a token-stealing
 * vector, not a cosmetic bug: the reader's GitHub token lives in localStorage
 * on the same origin. CodeQL flagged the sanitiser; the trap was one step
 * later, at the sink.
 *
 * The assertions are deliberately in two directions. It is easy to make the
 * dangerous cases pass by refusing every URL, so each blocked case here is
 * paired with an allowed one — a normal link that must still be a link.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from '../src/lib/markdown.tsx';

/** Render a README and return its markup. */
const render = (source: string): string => renderToStaticMarkup(createElement(Markdown, { source }));

/** Every URL that a browser would treat as executable. */
const EXECUTABLE = /(?:href|src)\s*=\s*"[^"]*?(?:javascript|vbscript|data:text\/html)/i;

const DANGEROUS: Array<[string, string]> = [
  ['raw anchor', '<a href="javascript:window.__pwned=1">click</a>'],
  ['markdown link', '[click](javascript:window.__pwned=1)'],
  ['mixed case scheme', '[click](JavaScript:window.__pwned=1)'],
  ['leading whitespace', '[click](   javascript:window.__pwned=1)'],
  ['html entity in scheme', '[click](jav&#x61;script:window.__pwned=1)'],
  ['entity in anchor href', '<a href="java&#115;cript:alert(1)">x</a>'],
  ['vbscript', '<a href="vbscript:msgbox(1)">vbs</a>'],
  ['data:text/html', '[click](data:text/html,<script>alert(1)</script>)'],
  ['autolink javascript', '<javascript:alert(1)>'],
  ['autolink data uri', '<data:text/html,<script>alert(1)</script>>'],
  ['image with data:text/html', '![x](data:text/html,<script>alert(1)</script>)'],
  ['image with javascript scheme', '![x](javascript:alert(1))'],
];

test('a README cannot produce an executable link', () => {
  for (const [name, source] of DANGEROUS) {
    const html = render(source);
    assert.ok(
      !EXECUTABLE.test(html),
      `${name}: rendered executable URL — ${html.slice(0, 160)}`,
    );
  }
});

test('a refused link is still shown as text, not silently dropped', () => {
  const html = render('[Installation guide](javascript:alert(1))');
  assert.match(html, /Installation guide/, 'the label should survive as text');
  assert.ok(!/<a\b/.test(html), 'but it must not become an anchor');
});

test('ordinary links still work', () => {
  const cases: Array<[string, string]> = [
    ['https', '[docs](https://example.com/docs)', 'href="https://example.com/docs"'],
    ['http', '[docs](http://example.com)', 'href="http://example.com"'],
    ['mailto', '[mail](mailto:a@b.c)', 'href="mailto:a@b.c"'],
    ['relative', '[about](./docs/about.md)', 'href="./docs/about.md"'],
    ['anchor', '[top](#top)', 'href="#top"'],
  ];
  for (const [name, source, expected] of cases) {
    const html = render(source);
    assert.ok(html.includes(expected), `${name}: expected ${expected}, got ${html.slice(0, 160)}`);
  }
});

test('ordinary autolinks still work', () => {
  // The renderer's autolink branch matches a bare URL, not the CommonMark
  // `<https://…>` form — angle brackets are stripped as leftover HTML earlier,
  // so the bracketed spelling never reaches this code. Test what exists.
  const html = render('see https://example.com/repo for details');
  assert.ok(html.includes('href="https://example.com/repo"'), html.slice(0, 200));
});

test('a scheme in an angle-bracket autolink does not become a link', () => {
  // `<javascript:…>` is not a URL to this renderer, but it must not turn into
  // one on the way through the tag stripper either.
  const html = render('see <javascript:alert(1)> here');
  assert.ok(!/<a\b/.test(html), html.slice(0, 200));
});

test('images from ordinary hosts still render', () => {
  const html = render('![badge](https://img.shields.io/badge/x-y.svg)');
  assert.match(html, /<img\b/, html.slice(0, 160));
  assert.ok(html.includes('https://img.shields.io/badge/x-y.svg'));
});

test('an inline data:image still renders, it is an image not a document', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  const html = render(`![dot](${png})`);
  assert.ok(html.includes(png), html.slice(0, 160));
});

test('a data: URL is refused in a link even when it looks like an image href', () => {
  const html = render('[x](data:image/svg+xml,<svg onload=alert(1)>)');
  assert.ok(!/<a\b/.test(html), 'data: must not become an anchor');
});

test('raw HTML in a README never reaches the output as a tag', () => {
  const html = render('<script>alert(1)</script><iframe src="https://evil.test"></iframe>');
  assert.ok(!/<script/i.test(html), 'no script tag');
  assert.ok(!/<iframe/i.test(html), 'no iframe tag');
});

test('a tag nested inside a tag does not survive as a tag', () => {
  // `<scr<script>ipt>` is the classic shape for a stripper that removes one
  // pattern and thereby assembles another. It does not break this one — the
  // test locks the property in rather than reproducing a bug.
  const html = render('<scr<script>ipt>alert(1)</scr</script>ipt>');
  assert.ok(!/<script/i.test(html), `nested tag survived: ${html.slice(0, 200)}`);
});

test('a nested HTML comment does not survive as a comment', () => {
  const html = render('before <!--<!-->--> after');
  assert.ok(!/<!--/.test(html), `comment survived: ${html.slice(0, 200)}`);
});

test('a hostile README cannot break out of its own text node', () => {
  const html = render('"><img src=x onerror=alert(1)>');
  assert.ok(!/onerror/i.test(html), 'no event handler attribute');
});
