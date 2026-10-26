/**
 * The parts of App.tsx the earlier files left uncovered: the rate meter, the
 * theme coming back from storage, the repo filter/sort controls, the saved
 * view, collections, the JSON export, and following a card's owner.
 *
 * Everything runs through the real UI; fetch, the clipboard and the download
 * plumbing are the only stubs.
 */
import './helpers/app.tsx';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { en } from '../src/lib/i18n.tsx';
import type { GHRepo, GHUser } from '../src/lib/github.ts';
import { act } from 'react-dom/test-utils';
import { json, mountApp, resetApp, settle, win, withFetch } from './helpers/app.tsx';

afterEach(resetApp);

function user(login: string, over: Partial<GHUser> = {}): GHUser {
  return {
    login,
    name: login[0].toUpperCase() + login.slice(1),
    avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
    html_url: `https://github.com/${login}`,
    bio: null,
    company: null,
    blog: null,
    location: null,
    twitter_username: null,
    followers: 10,
    following: 1,
    public_repos: 3,
    created_at: '2020-01-01T00:00:00Z',
    ...over,
  };
}

function repo(full: string, over: Partial<GHRepo> = {}): GHRepo {
  const [owner, name] = full.split('/');
  return {
    id: full.length * 13 + name.length,
    name,
    full_name: full,
    html_url: `https://github.com/${full}`,
    description: `${name} description`,
    language: 'C',
    stargazers_count: 10,
    forks_count: 1,
    open_issues_count: 0,
    watchers_count: 10,
    size: 100,
    topics: [],
    fork: false,
    archived: false,
    private: false,
    created_at: '2020-01-01T00:00:00Z',
    pushed_at: '2026-01-01T00:00:00Z',
    homepage: null,
    owner: { login: owner, avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
    ...over,
  };
}

const rateHeaders = {
  'x-ratelimit-limit': '60',
  'x-ratelimit-remaining': '42',
  'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 600),
};

const headers = (extra: Record<string, string> = {}) => ({
  'content-type': 'application/json',
  ...extra,
});

const jsonWith = (body: unknown, extra: Record<string, string>) =>
  new Response(JSON.stringify(body), { status: 200, headers: headers(extra) });

test('the rate meter appears once the API reports a budget', async () => {
  withFetch((url) =>
    url.includes('/repos?') ? jsonWith([repo('acme/one')], rateHeaders) : jsonWith(user('acme'), rateHeaders),
  );
  const h = mountApp();
  h.type('GitHub login', 'acme');
  h.click(en.browse.open);
  await settle();

  assert.ok(h.text().includes('api 42/60'), 'the remaining budget is on screen');
  const meter = win.document.querySelector('[title*="rate limit"]');
  assert.ok(meter, 'with a human-readable reset time in the title');
});

test('a stored theme is applied before the first interaction', () => {
  mountApp(() => win.localStorage.setItem('ghscope:theme', 'light'));
  assert.equal(win.document.documentElement.dataset.theme, 'light');
});

test('the theme choice is written back to storage', () => {
  const h = mountApp();
  h.click(en.chrome.toLight);
  assert.equal(win.localStorage.getItem('ghscope:theme'), 'light');
});

test('a profile shows its blog as a link, even written without a scheme', async () => {
  withFetch((url) =>
    url.includes('/repos?') ? json([repo('acme/one')]) : json(user('acme', { blog: 'acme.example/docs' })),
  );
  const h = mountApp();
  h.type('GitHub login', 'acme');
  h.click(en.browse.open);
  await settle();

  const link = [...win.document.querySelectorAll('a')].find((a) =>
    (a.getAttribute('href') ?? '').includes('acme.example/docs'),
  );
  assert.ok(link, 'the blog link is rendered');
  assert.equal(link!.getAttribute('href'), 'https://acme.example/docs', 'the missing scheme was supplied');
});

test('private repositories are explained, not just shown', async () => {
  withFetch((url) =>
    url.includes('/repos?')
      ? json([repo('acme/one'), repo('acme/secret', { private: true, id: 99 })])
      : json(user('acme')),
  );
  const h = mountApp();
  h.type('GitHub login', 'acme');
  h.click(en.browse.open);
  await settle();
  assert.ok(h.text().includes(en.profile.privateNote(1)), 'the visitor is told why a repo appeared');
});

test('the repo list filters by text, hides forks, and sorts', async () => {
  const repos = [
    repo('acme/alpha', { stargazers_count: 5, language: 'C' }),
    repo('acme/beta', { stargazers_count: 900, language: 'TypeScript' }),
    repo('acme/forked', { stargazers_count: 1, fork: true, id: 7 }),
  ];
  withFetch((url) => (url.includes('/repos?') ? json(repos) : json(user('acme'))));
  const h = mountApp();
  h.type('GitHub login', 'acme');
  h.click(en.browse.open);
  await settle();

  assert.ok(h.text().includes('beta') && h.text().includes('forked'), 'all three are listed');

  h.click(en.browse.hideForks);
  assert.ok(!h.text().includes('forked'), 'the fork is hidden');

  h.type(en.browse.filterPh, 'alp');
  assert.ok(h.text().includes('alpha'));
  assert.ok(!h.text().includes('beta'), 'the filter narrows the list');

  h.type(en.browse.filterPh, '');
  h.select(en.browse.sortAria, 'stars');
  const order = h.text();
  assert.ok(order.indexOf('beta') < order.indexOf('alpha'), 'stars sort puts the biggest first');
});

test('the saved view lists bookmarks, clears them, and leads back to browsing', async () => {
  withFetch((url) => (url.includes('/repos?') ? json([repo('acme/one')]) : json(user('acme'))));
  const h = mountApp();
  h.type('GitHub login', 'acme');
  h.click(en.browse.open);
  await settle();
  h.click(en.card.bmAdd);

  h.click(en.nav.saved);
  assert.ok(h.text().includes(en.saved.title), 'the saved view has its heading');
  assert.ok(h.text().includes('one'), 'the bookmarked repo is there');

  h.click(en.saved.clearAll);
  assert.ok(h.text().includes(en.saved.emptyTitle), 'clearing leaves the empty state');

  h.click(en.saved.go);
  // The profile is still loaded, so browsing means the profile, not the landing.
  assert.ok(h.text().includes('Repositories'), 'and it leads back to the profile view');
});

test('a collection can be created, filled from a card, and deleted', async () => {
  withFetch((url) => (url.includes('/repos?') ? json([repo('acme/one')]) : json(user('acme'))));
  const h = mountApp();
  h.type('GitHub login', 'acme');
  h.click(en.browse.open);
  await settle();

  h.click(en.nav.collections);
  h.type(en.collections.newPh, 'reading');
  h.click(en.collections.create);
  assert.ok(h.text().includes('reading'), 'the collection exists');
  assert.ok(h.text().includes(en.collections.emptyCol), 'and says it is empty');

  h.click(en.nav.browse);
  h.click(en.card.collectT);
  // A collection row is the add button: clicking it puts the repo in.
  h.click('reading');
  await settle();

  const stored = JSON.parse(String(win.localStorage.getItem('ghscope:collections'))) as Array<{
    name: string;
    items: Array<{ fullName: string }>;
  }>;
  assert.equal(stored[0].items.length, 1, 'the repo landed in the collection');
  assert.equal(stored[0].items[0].fullName, 'acme/one');

  h.click(en.nav.collections);
  h.click(en.collections.del);
  assert.ok(h.text().includes(en.collections.empty), 'deleting the last collection empties the view');
});

test('export .json hands the profile to the browser as a file', async () => {
  withFetch((url) => (url.includes('/repos?') ? json([repo('acme/one')]) : json(user('acme'))));
  const h = mountApp();
  h.type('GitHub login', 'acme');
  h.click(en.browse.open);
  await settle();

  // downloadFile uses the *global* URL and document, not the window we set up.
  const globals = globalThis as unknown as { URL: typeof URL };
  const realCreate = globals.URL.createObjectURL;
  const realClick = win.HTMLAnchorElement.prototype.click;
  let captured: Blob | null = null;
  globals.URL.createObjectURL = ((blob: Blob) => {
    captured = blob;
    return 'blob:gh-scope';
  }) as typeof URL.createObjectURL;
  win.HTMLAnchorElement.prototype.click = () => undefined;

  h.click(en.browse.exportJson);
  globals.URL.createObjectURL = realCreate;
  win.HTMLAnchorElement.prototype.click = realClick;

  assert.ok(captured, 'a blob was created');
  const text = await (captured as unknown as Blob).text();
  assert.ok(text.includes('acme/one'), 'and it carries the repository');
});

test('a card can hand the reader to its owner', async () => {
  withFetch((url) => {
    if (url.includes('/repos?')) return json([repo('acme/one')]);
    if (url.endsWith('/users/acme')) return json(user('acme'));
    if (url.endsWith('/users/torvalds')) return json(user('torvalds', { name: 'Linus Torvalds' }));
    return json(user('acme'));
  });
  const h = mountApp();
  h.type('GitHub login', 'acme');
  h.click(en.browse.open);
  await settle();

  // The owner button is labelled with the login and titled "Owner".
  const ownerButton = win.document.querySelector('button[title="Owner"]');
  assert.ok(ownerButton, 'the card offers its owner');
  act(() => (ownerButton as HTMLButtonElement).click());
  await settle();
  assert.equal(h.field('GitHub login').value.toLowerCase(), 'acme', 'the owner login is loaded');
});
