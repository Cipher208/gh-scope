#!/usr/bin/env node
/**
 * Line endings, checked the same way on every machine.
 *
 * `.gitattributes` says `* text=auto eol=lf`, but attributes only apply to
 * checkouts made after the file exists — a clone that still holds CRLF files
 * from before will keep showing an equal number of insertions and deletions
 * that change nothing. This guard reads what git itself reports:
 *
 *   i/…  how the file is stored in the index (what history gets)
 *   w/…  how the file sits in the working tree (what editors see)
 *
 * Both must be LF for text files. Binary files report `-text` and are skipped.
 */
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const result = spawnSync('git', ['ls-files', '--eol'], { encoding: 'utf8' });
if (result.status !== 0) {
  console.error('git ls-files --eol failed:', result.stderr.trim());
  process.exit(1);
}

const problems = [];
let checked = 0;
for (const line of result.stdout.split('\n')) {
  // Format: `i/lf  w/crlf  attr/text=auto eol=lf<TAB>path`. Split on the tab
  // first: the attributes column is space-separated and may be empty.
  const tab = line.indexOf('\t');
  if (tab === -1) continue;
  const meta = line.slice(0, tab);
  const file = line.slice(tab + 1);
  const match = /^i\/(\S+)\s+w\/(\S+)\s+attr\/(.*)$/.exec(meta);
  if (!match) continue;
  const [, index, worktree, attr] = match;
  // Binary files carry the marker in the i/w columns with an empty attr column;
  // empty files report `none`. Neither has line endings to police.
  if (index === '-text' || worktree === '-text' || index === 'none' || attr.trim() === '-text') continue;
  checked += 1;
  if (index !== 'lf') problems.push(`${file}: stored in the index as ${index}`);
  else if (worktree !== 'lf') problems.push(`${file}: checked out as ${worktree}`);
}

if (problems.length) {
  console.error(`${problems.length} file(s) with the wrong line endings:\n`);
  for (const problem of problems.slice(0, 20)) console.error(`  ${problem}`);
  if (problems.length > 20) console.error(`  … and ${problems.length - 20} more`);
  console.error('\nFix: git add --renormalize . (and git checkout -- . if the tree is stale)');
  process.exit(1);
}

console.log(`line endings ok: ${checked} text files, all lf`);
