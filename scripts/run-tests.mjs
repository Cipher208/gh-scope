/**
 * The test runner.
 *
 * Why this exists instead of a framework: the project has no runtime
 * dependencies and a test suite that needs Vitest, Jest and a config file is
 * a bigger surface than the app it tests. Node ships a test runner and a
 * coverage reporter; all that is missing is a way to run `.tsx` through it,
 * and esbuild — already in the tree as part of Vite — does that in one call.
 *
 * The bundle step is not a formality. It is what makes `node --test` able to
 * import the real `Markdown` component, so the security tests attack the code
 * that actually ships rather than a copy of it.
 */
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, '.test-build');

const files = [];
for await (const f of glob('tests/**/*.test.{ts,tsx}')) files.push(f);

if (files.length === 0) {
  console.error('no test files found under tests/');
  process.exit(1);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

try {
  await build({
    entryPoints: files.map((f) => path.join(ROOT, f)),
    outdir: OUT,
    // Without outbase the output path mirrors the absolute entry path, and the
    // bundles land in folders named after every directory above the project.
    outbase: 'tests',
    bundle: true,
    format: 'cjs',
    // The project is `"type": "module"`, so a plain `.js` file is ESM to Node
    // and the CommonJS bundle would fail to load. `.cjs` is what makes the
    // extension say what the contents actually are.
    outExtension: { '.js': '.cjs' },
    platform: 'node',
    target: 'node22',
    jsx: 'automatic',
    sourcemap: 'inline',
    logLevel: 'error',
  });
} catch {
  process.exit(1);
}

const built = [];
for await (const f of glob('**/*.cjs', { cwd: OUT })) built.push(f);
built.sort();
if (built.length === 0) {
  console.error('esbuild produced no test bundles');
  process.exit(1);
}

const child = spawn(
  process.execPath,
  // Files are listed explicitly rather than handing `node --test` the directory:
  // the directory form makes this Node treat the folder itself as one test on
  // some versions, which reports a single failure and hides everything inside.
  ['--test', ...built.map((f) => path.join(OUT, f))],
  { stdio: 'inherit' },
);
child.on('exit', (code) => process.exit(code ?? 1));
