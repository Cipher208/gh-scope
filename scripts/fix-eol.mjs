#!/usr/bin/env node
/**
 * Rewrite working-tree text files to LF, one file at a time.
 *
 * Needed when `.gitattributes` arrives after a checkout: git only applies the
 * attribute to files it writes, and a stat-cache hit makes `checkout-index -f`
 * skip them. This touches nothing that git does not already report as CRLF in
 * the working tree, and never touches binary files (`attr/-text`).
 *
 *   npm run fix:eol
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';

const result = spawnSync('git', ['ls-files', '--eol'], { encoding: 'utf8' });
if (result.status !== 0) {
  console.error('git ls-files --eol failed:', result.stderr.trim());
  process.exit(1);
}

const targets = [];
for (const line of result.stdout.split('\n')) {
  const tab = line.indexOf('\t');
  if (tab === -1) continue;
  const meta = line.slice(0, tab);
  const file = line.slice(tab + 1);
  const match = /^i\/(\S+)\s+w\/(\S+)\s+attr\/(.*)$/.exec(meta);
  if (!match) continue;
  const [, index, worktree, attr] = match;
  // Binary files mark themselves in the i/w columns, not in attr; empty files
  // report `none`.
  if (index === '-text' || worktree === '-text' || index === 'none' || attr.trim() === '-text') continue;
  if (index !== 'lf' || worktree !== 'lf') targets.push({ file, index, worktree });
}

if (targets.length === 0) {
  console.log('nothing to fix: every text file is already lf');
  process.exit(0);
}

for (const { file, index } of targets) {
  if (index !== 'lf') {
    // The index itself holds CRLF, which means the file was added before the
    // attributes existed. That one is for `git add --renormalize .`, not for a
    // byte rewrite here.
    console.error(`skip ${file}: the index holds CRLF; run git add --renormalize .`);
    continue;
  }
  const before = readFileSync(file, 'utf8');
  const after = before.replace(/\r\n/g, '\n');
  if (after !== before) {
    writeFileSync(file, after, 'utf8');
    console.log(`fixed ${file}`);
  }
}

const after = spawnSync('git', ['ls-files', '--eol'], { encoding: 'utf8' }).stdout;
const stillCrlf = after.split('\n').filter((line) => /^i\/lf\s+w\/crlf\s/.test(line)).length;
console.log(`\nremaining worktree CRLF files: ${stillCrlf}`);
process.exit(stillCrlf === 0 ? 0 : 1);
