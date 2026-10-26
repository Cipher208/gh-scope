/**
 * The network flows. Each screen here does its own fetching, and until now only
 * the landing and profile paths had tests — the four views below were the least
 * covered files in the project (41–65% statements).
 *
 * Every test drives the real UI: click the tab, type into the field the app
 * gives you, press the button, and assert on what appears. fetch is stubbed at
 * the URL level, so the assertions are about the screen, not the client.
 */
import './helpers/app.tsx';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { en } from '../src/lib/i18n.tsx';
import type { GHOrg, GHRelease, GHRepo, GHUser } from '../src/lib/github.ts';
import { failing, json, mountApp, resetApp, settle, win, withFetch } from './helpers/app.tsx';

afterEach(resetApp);

function user(login: string, over: Partial<GHUser> = {}): GHUser {
  return {
    login,
    name: login[0].toUpperCase() + login.slice(1),
    avatar_url: `https://avatars.githubusercontent.com/u/1?v=4`,
    html_url: `https://github.com/${login}`,
    bio: null,
    company: null,
    blog: null,
    location: null,
    twitter_username: null,
    followers: 10,
    following: 1,
    public_repos: 1,
    created_at: '2020-01-01T00:00:00Z',
    ...over,
  };
}

function repo(full: string, over: Partial<GHRepo> = {}): GHRepo {
  const [owner, name] = full.split('/');
  return {
    id: full.length * 7,
    name,
    full_name: full,
    html_url: `https://github.com/${full}`,
    description: `${name} description`,
    language: 'TypeScript',
    stargazers_count: 120,
    forks_count: 8,
    open_issues_count: 0,
    watchers_count: 120,
    size: 1024,
    topics: [],
    fork: false,
    archived: false,
    private: false,
    created_at: '2020-01-01T00:00:00Z',
    pushed_at: '2026-10-01T00:00:00Z',
    homepage: null,
    owner: { login: owner, avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
    ...over,
  };
}

const detail = (r: GHRepo) => ({ ...r, license: null, default_branch: 'main', subscribers_count: 3 });
const release = (full: string): GHRelease => ({
  id: 1,
  tag_name: 'v1.0.0',
  name: 'v1.0.0',
  published_at: '2026-09-01T00:00:00Z',
  prerelease: false,
  draft: false,
  html_url: `https://github.com/${full}/releases/tag/v1.0.0`,
});

test('search runs a query and shows the hits', async () => {
  withFetch((url) =>
    url.includes('/search/repositories')
      ? json({ total_count: 2, incomplete_results: false, items: [repo('acme/rocket'), repo('acme/satellite')] })
      : json({}),
  );
  const h = mountApp();
  h.click(en.nav.search);
  h.type(en.search.textPh, 'rocket');
  h.submit(en.search.textPh);
  await settle();

  assert.ok(h.text().includes('rocket'), 'the hit is on screen');
  assert.ok(h.text().includes('satellite'));
  assert.ok(h.text().includes(en.search.results), 'the result count is labelled');
});

test('search reports an empty result set instead of an empty screen', async () => {
  withFetch(() => json({ total_count: 0, incomplete_results: false, items: [] }));
  const h = mountApp();
  h.click(en.nav.search);
  h.type(en.search.textPh, 'zzzz');
  h.submit(en.search.textPh);
  await settle();
  assert.ok(h.text().includes(en.search.none) || h.text().includes(en.search.emptyBody), 'an empty search says so');
});

test('compare loads two people and lays their numbers side by side', async () => {
  withFetch((url) => {
    if (url.endsWith('/users/alice')) return json(user('alice'));
    if (url.endsWith('/users/bob')) return json(user('bob', { followers: 99 }));
    if (url.includes('/users/alice/repos')) return json([repo('alice/one')]);
    if (url.includes('/users/bob/repos')) return json([repo('bob/two')]);
    return failing(404);
  });
  const h = mountApp();
  h.click(en.nav.compare);
  h.type(en.compare.phA, 'alice');
  h.type(en.compare.phB, 'bob');
  h.click(en.compare.run);
  await settle();

  assert.ok(h.text().includes('Alice'), 'left side rendered');
  assert.ok(h.text().includes('Bob'), 'right side rendered');
  assert.ok(h.text().includes(en.compare.mStars), 'the metric rows are there');
});

test('the duel fetches both repositories and their latest releases', async () => {
  withFetch((url) => {
    if (url.includes('/releases/latest')) return json(release('acme/rocket'));
    if (url.endsWith('/repos/acme/rocket')) return json(detail(repo('acme/rocket')));
    if (url.endsWith('/repos/acme/satellite')) return json(detail(repo('acme/satellite')));
    return failing(404);
  });
  const h = mountApp();
  h.click(en.nav.duel);
  h.type(en.duel.phA, 'acme/rocket');
  h.type(en.duel.phB, 'acme/satellite');
  h.click(en.duel.run);
  await settle();

  assert.ok(h.text().includes('acme/rocket'), 'left repository shown');
  assert.ok(h.text().includes('acme/satellite'), 'right repository shown');
  assert.ok(h.text().includes('v1.0.0'), 'the release tag is shown');
});

test('an organization loads with its fleet', async () => {
  const org: GHOrg = {
    login: 'acme',
    name: 'Acme Corp',
    avatar_url: 'https://avatars.githubusercontent.com/u/2?v=4',
    html_url: 'https://github.com/acme',
    description: 'We make rockets',
    blog: null,
    email: null,
    location: null,
    twitter_username: null,
    public_repos: 1,
    followers: 5,
    is_verified: true,
    created_at: '2015-01-01T00:00:00Z',
  };
  withFetch((url) => {
    if (url.endsWith('/orgs/acme')) return json(org);
    if (url.includes('/orgs/acme/repos')) return json([repo('acme/rocket')]);
    return failing(404);
  });
  const h = mountApp();
  h.click(en.nav.orgs);
  h.type('Organization login', 'acme');
  h.submit('Organization login');
  await settle();

  assert.ok(h.text().includes('@acme'), 'the organization header is on screen');
  assert.ok(h.text().includes('on GitHub since'), 'its metadata is loaded');
  assert.ok(h.text().includes('rocket'), 'its repositories are listed');
});

test('a failed load explains itself and offers a retry that works', async () => {
  withFetch(() => failing(404));
  const h = mountApp();
  h.type('GitHub login', 'ghost');
  h.click(en.browse.open);
  await settle();
  assert.ok(h.text().includes(en.browse.errTitle), 'the error state is shown');

  withFetch((url) => (url.includes('/repos?') ? json([repo('ghost/one')]) : json(user('ghost'))));
  h.click(en.browse.retry);
  await settle();
  assert.ok(h.text().includes('Ghost'), 'the retry loaded the profile');
});

test('pressing / puts the cursor in the search box', () => {
  const h = mountApp();
  const input = h.field('GitHub login');
  // A previous test may have left an input focused, and the shortcut politely
  // does nothing while someone is typing.
  (win.document.activeElement as HTMLElement | null)?.blur();
  win.dispatchEvent(new win.KeyboardEvent('keydown', { key: '/' }));
  const active = win.document.activeElement as HTMLElement | null;
  assert.equal(active, input, `focus went to ${active?.tagName}#${active?.id ?? ''} instead`);
});

test('the watchtower arms a repository and re-scans it', async () => {
  withFetch((url) => {
    if (url.includes('/releases/latest')) return json(release('acme/rocket'));
    if (url.endsWith('/repos/acme/rocket')) return json(detail(repo('acme/rocket')));
    return failing(404);
  });
  const h = mountApp();
  h.click(en.nav.watchtower);
  h.type(en.watchtower.ph, 'acme/rocket');
  h.submit(en.watchtower.ph);
  await settle();

  assert.ok(h.text().includes('rocket'), 'the repository is on the radar');
  assert.ok(h.text().includes('@acme'), 'with its owner');
  assert.ok(h.button(en.watchtower.scan), 'and can be re-scanned');

  h.click(en.watchtower.scan);
  await settle();
  assert.ok(h.text().includes('v1.0.0'), 'the scan picked up the release');
});

test('trending loads a page, and load-more appends the next one', async () => {
  const page = (n: number) => Array.from({ length: 18 }, (_, i) => repo(`acme/rising-${n}-${i}`));
  withFetch(() => json({ total_count: 200, incomplete_results: false, items: page(1) }));
  const h = mountApp();
  h.click(en.nav.discover);
  await settle();

  const first = h.count('article');
  assert.equal(first, 18, 'a full page arrives on its own');

  h.click(en.discover.more);
  await settle();
  assert.equal(h.count('article'), 36, 'the next page is appended, not replaced');
});

test('a README opens in a dialog and loads its text', async () => {
  withFetch((url) => {
    if (url.includes('/repos?') ) return json([repo('acme/rocket')]);
    if (url.includes('/readme')) {
      return new Response(`# Rocket

A very fast rocket.`, { status: 200 });
    }
    return json(user('acme'));
  });
  const h = mountApp();
  h.type('GitHub login', 'acme');
  h.click(en.browse.open);
  await settle();

  h.click(en.card.readmeT);
  await settle();
  assert.ok(h.text().includes('A very fast rocket'), 'the README body is rendered');
  assert.match(h.text(), /Rocket/, 'with its heading');
});
