#!/usr/bin/env node
/**
 * Coverage, reported over the files that matter.
 *
 * Tests are bundled to test-build/*.cjs with inline source maps, so V8 knows
 * only about the bundles. c8 remaps them back to the original .ts/.tsx through
 * those maps — but its own `--include` / `--exclude` filters run before the
 * remap, when every path still says `test-build/…`. Passing `--include 'src/**'`
 * therefore yields 0%, and `--exclude 'node_modules/**'` does not remove
 * happy-dom. So the filtering happens here, on c8's JSON, after the remap.
 *
 *   npm run coverage
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const RAW = path.join(ROOT, 'coverage', 'raw');

rmSync(path.join(ROOT, 'coverage'), { recursive: true, force: true });
await mkdir(RAW, { recursive: true });

const tests = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'run-tests.mjs')], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, NODE_V8_COVERAGE: RAW },
});
if (tests.status !== 0) process.exit(tests.status ?? 1);

// Calling c8's entry script directly avoids `npx` (and the shell that a
// .cmd shim would need on Windows). The two --exclude flags *replace* c8's
// defaults: the default set drops `*.test.cjs`, which is every bundle here.
const report = spawnSync(
  process.execPath,
  [
    path.join(ROOT, 'node_modules', 'c8', 'bin', 'c8.js'),
    'report',
    '--temp-directory',
    RAW,
    '--exclude',
    'node_modules/**',
    '--exclude',
    'dist/**',
    '--reporter=json',
  ],
  { cwd: ROOT, stdio: 'inherit' },
);
if (report.status !== 0) process.exit(report.status ?? 1);

const final = JSON.parse(readFileSync(path.join(ROOT, 'coverage', 'coverage-final.json'), 'utf8'));

/** Istanbul keys look like C:\…\src\lib\token.ts — normalise to src/… */
function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

const rows = [];
for (const [file, data] of Object.entries(final)) {
  const name = rel(file);
  if (!name.startsWith('src/')) continue;
  const counted = (map) => {
    const values = Object.values(map);
    return { total: values.length, hit: values.filter((v) => (typeof v === 'number' ? v > 0 : v.count > 0)).length };
  };
  const statements = counted(data.s);
  const functions = counted(data.f);
  const branches = Object.values(data.b).flat().length
    ? { total: Object.values(data.b).flat().length, hit: Object.values(data.b).flat().filter((v) => v > 0).length }
    : { total: 0, hit: 0 };
  const pct = (c) => (c.total === 0 ? 100 : (c.hit / c.total) * 100);
  rows.push({
    name,
    stmts: pct(statements),
    branches: pct(branches),
    funcs: pct(functions),
  });
}

rows.sort((a, b) => a.stmts - b.stmts || a.name.localeCompare(b.name));

const pad = (value, width) => String(value).padStart(width);
const fmt = (value) => `${value.toFixed(1)}%`;
console.log('\nCoverage over src/ (remapped from the test bundles)\n');
console.log(`${'File'.padEnd(42)}${pad('Stmts', 8)}${pad('Branch', 8)}${pad('Funcs', 8)}`);
console.log('-'.repeat(66));
for (const row of rows) {
  console.log(`${row.name.padEnd(42)}${pad(fmt(row.stmts), 8)}${pad(fmt(row.branches), 8)}${pad(fmt(row.funcs), 8)}`);
}
const avg = (key) => rows.reduce((sum, row) => sum + row[key], 0) / Math.max(1, rows.length);
console.log('-'.repeat(66));
console.log(`${'All src files'.padEnd(42)}${pad(fmt(avg('stmts')), 8)}${pad(fmt(avg('branches')), 8)}${pad(fmt(avg('funcs')), 8)}`);

// A machine-readable total, for a badge or a threshold later.
const lowest = rows[0];
if (lowest) console.log(`\nLowest: ${lowest.name} at ${fmt(lowest.stmts)} statements.`);
const files = await readdir(path.join(ROOT, 'coverage'));
void files;
