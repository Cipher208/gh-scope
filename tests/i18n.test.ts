/**
 * `en` and `ru` are hand-kept dictionaries, and TypeScript only checks them
 * against the shape of `en` — a key added to one language and forgotten in the
 * other shows up as a blank string in the UI, not as a compile error. That is
 * exactly how `nav.saved` was missing until the h1 needed it.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { en, ru } from '../src/lib/i18n.tsx';
import { loadTranslateConfig, saveTranslateConfig } from '../src/lib/translate.ts';

type Node = Record<string, unknown>;

function walk(node: Node, prefix = ''): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') out.push(...walk(value as Node, path));
    else out.push(`${path}:${typeof value}`);
  }
  return out.sort();
}

test('both languages carry exactly the same keys', () => {
  const english = walk(en as unknown as Node);
  const russian = walk(ru as unknown as Node);
  const missingInRu = english.filter((k) => !russian.includes(k));
  const missingInEn = russian.filter((k) => !english.includes(k));
  assert.deepEqual(missingInRu, [], 'keys present in en but not ru');
  assert.deepEqual(missingInEn, [], 'keys present in ru but not en');
});

test('no visible string is left empty in either language', () => {
  for (const [name, dict] of [
    ['en', en],
    ['ru', ru],
  ] as const) {
    for (const entry of walk(dict as unknown as Node)) {
      if (!entry.endsWith(':string')) continue;
      const path = entry.slice(0, entry.lastIndexOf(':'));
      const value = path.split('.').reduce<unknown>((acc, part) => (acc as Node)[part], dict);
      assert.notEqual(String(value).trim(), '', `${name}.${path} is empty`);
    }
  }
});

test('the translation endpoint reads as empty rather than throwing without storage', () => {
  assert.deepEqual(loadTranslateConfig(), { endpoint: '', apiKey: '' });
  assert.doesNotThrow(() => saveTranslateConfig({ endpoint: 'https://x', apiKey: 'k' }));
});
