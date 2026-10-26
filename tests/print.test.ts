/**
 * Two small contracts about how the page looks when it is not being clicked:
 * a card must not promise a click it does not accept, and paper must get a
 * palette that works in ink, with the sticky header left behind in the window.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const css = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
const PRINT_BLOCK = '@media print';
const print = css.slice(css.indexOf(PRINT_BLOCK));

test('a print sheet exists and repaints the palette for ink', () => {
  assert.ok(css.includes(PRINT_BLOCK), 'no @media print block in the stylesheet');
  assert.match(print, /--color-bg:\s*#ffffff/);
  assert.match(print, /--color-ink:\s*#111111/);
});

test('the sticky header is left in the window, and cards stay whole', () => {
  assert.match(print, /header\s*{\s*display:\s*none/, 'a sticky header on paper covers the first rows');
  assert.match(print, /\.card-hover\s*{[^}]*break-inside:\s*avoid/, 'a split card reads as two broken ones');
});

test('a card hover changes colour, never position', () => {
  assert.ok(!/\.card-lift/.test(css), 'the old lift class is gone');
  assert.ok(!/\.card-hover:hover\s*{[^}]*transform/s.test(css), 'hover may change colour, not position');
});
