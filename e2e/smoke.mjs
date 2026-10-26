#!/usr/bin/env node
/**
 * One smoke run in a real browser.
 *
 * Everything the node:test suite does happens on happy-dom. This file exists
 * for the things only Chromium can answer: does the page paint, does the CSP
 * allow what the app actually does, does a click still work after a real layout,
 * and are there console errors. The API is intercepted, so the run is
 * deterministic and does not spend the shared 60-requests-per-hour budget.
 *
 *   npm run e2e            # builds nothing; expects dist/ to exist
 *   npm run e2e -- --url https://cipher208.github.io/gh-scope/   # against live
 */
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const SHOTS = path.join(ROOT, 'artifacts');
const PORT = 4173;

const arg = process.argv.indexOf('--url');
const external = arg === -1 ? null : process.argv[arg + 1];
const base = external ?? `http://localhost:${PORT}/`;

const user = {
  login: 'torvalds',
  name: 'Linus Torvalds',
  avatar_url: 'https://avatars.githubusercontent.com/u/1024025?v=4',
  html_url: 'https://github.com/torvalds',
  bio: null,
  company: 'Linux Foundation',
  blog: null,
  location: 'Portland, OR',
  twitter_username: null,
  followers: 329452,
  following: 0,
  public_repos: 1,
  created_at: '2011-09-04T00:00:00Z',
};

const repo = {
  id: 1,
  name: 'linux',
  full_name: 'torvalds/linux',
  html_url: 'https://github.com/torvalds/linux',
  description: 'Linux kernel source tree',
  language: 'C',
  stargazers_count: 253500,
  forks_count: 67400,
  open_issues_count: 0,
  watchers_count: 253500,
  size: 6100000,
  topics: [],
  fork: false,
  archived: false,
  private: false,
  created_at: '2011-09-04T00:00:00Z',
  pushed_at: '2026-10-20T00:00:00Z',
  homepage: null,
  owner: { login: 'torvalds', avatar_url: user.avatar_url },
};

const failures = [];
const check = (ok, message) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`);
  if (!ok) failures.push(message);
};

let preview = null;
async function startPreview() {
  preview = spawn(
    process.execPath,
    [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--strictPort'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  preview.stderr.on('data', (chunk) => {
    const text = String(chunk);
    if (!text.includes('already in use')) process.stderr.write(chunk);
  });
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(base);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`the preview server did not answer on ${base}`);
}

function stopPreview() {
  if (preview && !preview.killed) preview.kill();
}

try {
  if (!external) await startPreview();
  await mkdir(SHOTS, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));

  await page.route('https://api.github.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/search/repositories')) {
      return route.fulfill({ json: { total_count: 1, incomplete_results: false, items: [repo] } });
    }
    if (url.includes('/repos?')) return route.fulfill({ json: [repo] });
    if (url.includes('/readme')) return route.fulfill({ body: '# Linux\n\nA kernel lives here.', contentType: 'text/plain' });
    if (url.includes('/users/')) return route.fulfill({ json: user });
    return route.fulfill({ status: 404, body: '{}' });
  });

  await page.goto(base, { waitUntil: 'networkidle' });
  check((await page.locator('h1').count()) === 1, 'exactly one h1');
  check((await page.locator('meta[http-equiv="Content-Security-Policy"]').count()) === 1, 'CSP meta present');
  check(await page.getByText('Scope out any public GitHub profile').isVisible(), 'landing rendered');

  // A hash link in a running tab: the bug that started all of this.
  await page.evaluate(() => {
    location.hash = '#/torvalds';
  });
  // Two nodes carry that text: the sr-only h1 and the visible card heading.
  const profileHeading = page.getByRole('heading', { name: 'Linus Torvalds', exact: true });
  await profileHeading.waitFor({ timeout: 15000 });
  check(await profileHeading.isVisible(), 'hash link loads the profile');

  await page.getByRole('button', { name: 'Open README' }).first().click();
  await page.getByText('A kernel lives here.').waitFor({ timeout: 15000 });
  check(await page.getByText('A kernel lives here.').isVisible(), 'README opens with its body');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'trending' }).click();
  await page.waitForTimeout(1500);
  check((await page.locator('article').count()) > 0, 'trending renders cards');

  await page.screenshot({ path: path.join(SHOTS, 'smoke.png'), fullPage: false });
  check(consoleErrors.length === 0, `no console errors${consoleErrors.length ? `: ${consoleErrors[0]}` : ''}`);

  await browser.close();
} catch (error) {
  failures.push(String(error));
  console.error(error);
} finally {
  stopPreview();
}

if (failures.length) {
  console.error(`\n${failures.length} browser check(s) failed`);
  process.exit(1);
}
console.log('\nbrowser smoke passed');
