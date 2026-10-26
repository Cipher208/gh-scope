/**
 * The README renderer is the largest untested surface in the project (67% of
 * statements) and the one that consumes text written by strangers. The security
 * cases already live in markdown.test.tsx; this file covers the rest of what a
 * README can contain: every block type, every inline form, entities, the HTML
 * that gets normalised, and the limits that keep a hostile file from freezing
 * the tab.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from '../src/lib/markdown.tsx';

const md = (source: string, props: Record<string, unknown> = {}): string =>
  renderToStaticMarkup(createElement(Markdown, { source, ...props }));

test('headings keep their level, and a closing run of hashes is dropped', () => {
  const html = md('# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six');
  assert.match(html, /<h1>One<\/h1>/);
  assert.match(html, /<h2>Two<\/h2>/);
  assert.match(html, /<h3>Three<\/h3>/);
  assert.match(html, /<h4>Four<\/h4>/, 'h5 and h6 collapse into h4, the deepest style there is');
  assert.match(md('## Closed ##'), /<h2>Closed<\/h2>/);
});

test('lists, quotes, rules and paragraphs are separate blocks', () => {
  const html = md('- one\n- two\n\n1. first\n2. second\n\n> quoted\n> lines\n\n---\n\nplain');
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.match(html, /<ol><li>first<\/li><li>second<\/li><\/ol>/);
  assert.match(html, /<blockquote>quoted lines<\/blockquote>/, 'consecutive quote lines join');
  assert.match(html, /<hr\/>/);
  assert.match(html, /<p>plain<\/p>/);
});

test('a table keeps its header, its rows, and says when it was cut', () => {
  const rows = Array.from({ length: 205 }, (_, i) => `| r${i} | ${i} |`).join('\n');
  const html = md(`| name | stars |\n| --- | ---: |\n| alpha | **10** |\n${rows}`);
  assert.match(html, /<th>name<\/th><th>stars<\/th>/);
  assert.match(html, /<td>alpha<\/td><td><strong>10<\/strong><\/td>/);
  // 206 rows in the source: 200 kept, 6 counted.
  assert.match(html, /… \+6/, 'rows past the cap are counted, not silently dropped');
});

test('a fenced block is code, not markup', () => {
  const html = md('```html\n<b>not bold</b>\n```');
  assert.match(html, /<pre><code>&lt;b&gt;not bold&lt;\/b&gt;/);
  assert.ok(!html.includes('<b>'), 'the tag inside the fence is text');
});

test('a very long fence is cut with a count of what remains', () => {
  const body = Array.from({ length: 405 }, (_, i) => `line ${i}`).join('\n');
  assert.match(md('```\n' + body + '\n```'), /… \(5 more lines\)/);
});

test('inline forms render as inline forms, and nest up to a limit', () => {
  const html = md('`code` **bold** *italic* ~~gone~~ **a *b* c**');
  assert.match(html, /<code>code<\/code>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<del>gone<\/del>/);
  // The inline parser is deliberately one-pass: mixed nesting such as
  // `**a *b* c**` is not a supported form, and the test does not pretend it is.

  const deep = `${'*'.repeat(1)}${'**'.repeat(6)}x${'**'.repeat(6)}${'*'.repeat(1)}`;
  assert.doesNotThrow(() => md(deep), 'deep nesting stops at the depth limit instead of recursing forever');
});

test('links are vetted by scheme; a refused one still shows its label', () => {
  const html = md('[ok](https://example.com) [mail](mailto:a@b.c) [rel](./docs) [bad](javascript:alert(1))');
  assert.match(html, /href="https:\/\/example.com"/);
  assert.match(html, /href="mailto:a@b.c"/);
  assert.match(html, /href="\.\/docs"/, 'a relative link is same-origin by construction');
  assert.ok(!/href="javascript/.test(html));
  assert.match(html, /Link blocked/, 'the refused link explains itself');
});

test('images are read, not run: pictures yes, documents no', () => {
  const html = md(
    '![shot](https://example.com/a.png)\n\n![badge](https://img.shields.io/badge/x-y-green)\n\n![doc](data:text/html,<b>x</b>)\n\n![inline](data:image/png;base64,AAA)',
  );
  assert.match(html, /src="https:\/\/example.com\/a.png"[^>]*loading="lazy"/);
  assert.match(html, /class="badge-img"/, 'badge hosts get the flat style');
  assert.ok(!html.includes('data:text/html'), 'a document is not an image');
  assert.match(html, /src="data:image\/png;base64,AAA"/);
});

test('a github blob link becomes the raw file, and a relative path uses the base', () => {
  assert.match(
    md('![x](https://github.com/acme/rocket/blob/main/docs/x.png)'),
    /src="https:\/\/raw.githubusercontent.com\/acme\/rocket\/main\/docs\/x.png"/,
  );
  assert.match(md('![x](./img/x.png)', { imageBase: 'https://raw.example/acme' }), /src="https:\/\/raw.example\/acme\/img\/x.png"/);
});

test('an absolute URL on its own line becomes a link, an image URL becomes a picture', () => {
  assert.match(md('https://example.com/page'), /<a href="https:\/\/example.com\/page"/);
  assert.match(md('https://example.com/pic.png'), /<img src="https:\/\/example.com\/pic.png"/);
});

test('entities are decoded: named, decimal, hex, and the ones that are not', () => {
  const html = md('&middot; &amp; &#65; &#x41; &bogus; &#x110000;');
  assert.match(html, /·/);
  assert.match(html, /&amp;/, 'the decoded ampersand is escaped again by React');
  assert.ok(html.includes('A'));
  assert.ok(html.includes('&amp;bogus;'), 'an unknown name is left alone');
  assert.ok(html.includes('&amp;#x110000;'), 'an impossible code point is left alone');
});

test('common README HTML is normalised into markdown, then into elements', () => {
  const html = md(
    '<b>bold</b> <i>it</i> <s>gone</s> <kbd>Ctrl</kbd> <sup>2</sup> <sub>n</sub> <br> <hr> <div>wrapped</div>',
  );
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>it<\/em>/);
  assert.match(html, /<del>gone<\/del>/);
  assert.match(html, /<code>Ctrl<\/code>/);
  assert.match(html, /\^2\^/);
  assert.match(html, /_n_/);
  assert.match(html, /<hr\/>/);
  assert.match(html, /wrapped/);
});

test('an <img> tag, an <a> tag and a <details> summary survive as content', () => {
  const html = md(
    '<p><a href="https://example.com">site</a> <img src="https://example.com/i.png" alt="pic"></p>\n\n<details><summary>More</summary>body</details>',
  );
  assert.match(html, /<a href="https:\/\/example.com"[^>]*>site<\/a>/);
  assert.match(html, /<img src="https:\/\/example.com\/i.png" alt="pic"/);
  assert.match(html, /<strong>More<\/strong>/, 'a summary becomes a bold line');
  assert.match(html, /body/);
});

test('a clickable badge keeps the image, not the link around it', () => {
  const html = md('<a href="https://ci.example"><img src="https://img.shields.io/badge/a-b-c"></a>');
  assert.match(html, /<img/);
  assert.ok(!/<a href="https:\/\/ci.example"/.test(html), 'the wrapping link is dropped');
});

test('comments and script-ish markup never reach the page', () => {
  const html = md('before <!-- tracking --> after <script>alert(1)</script>');
  assert.ok(!html.includes('<!--'), 'the comment is gone');
  assert.ok(!/<script/i.test(html), 'the script tag never reaches the page');
  // The script's *text* survives as text — harmless, because React escapes it,
  // and honest, because the README did say it.
  assert.ok(html.includes('alert(1)'));
  assert.match(html, /before\s+after/);
});

test('a YouTube link becomes a privacy-friendly embed, in both URL shapes', () => {
  assert.match(md('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
  assert.match(md('https://youtu.be/dQw4w9WgXcQ'), /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
});

test('a huge document stops at the block cap and says so', () => {
  const source = Array.from({ length: 905 }, (_, i) => `line ${i}`).join('\n\n');
  const custom = md(source, { truncatedNotice: 'cut here' });
  assert.match(custom, /cut here/, 'a caller-supplied notice wins');
  assert.match(md(source), /too large to render fully/);
});

test('a single absurdly long line is clipped, not rendered whole', () => {
  const html = md('a'.repeat(2500));
  assert.ok(html.includes('…'));
  assert.ok(html.length < 2400, `the line was clipped: ${html.length} chars`);
});
