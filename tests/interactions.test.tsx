/**
 * The shell's interactive half: what a click does. happy-dom provides the
 * window, React's act keeps the updates deterministic, and a stubbed fetch
 * stands in for the API.
 *
 * The DOM must exist before react-dom is imported — see helpers/dom.ts — so the
 * import order here is load-bearing. One window is shared; every mount resets
 * storage, hash and body, so no test inherits state from the previous one.
 */
import './helpers/dom.ts';
import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import App from '../src/App.tsx';
import { en, ru } from '../src/lib/i18n.tsx';
import type { GHRepo, GHUser } from '../src/lib/github.ts';
import { win } from './helpers/dom.ts';

const user: GHUser = {
  login: 'torvalds',
  name: 'Linus Torvalds',
  avatar_url: 'https://avatars.githubusercontent.com/u/1024025?v=4',
  html_url: 'https://github.com/torvalds',
  bio: null,
  company: 'Linux Foundation',
  blog: null,
  location: 'Portland, OR',
  twitter_username: null,
  followers: 329_452,
  following: 0,
  public_repos: 12,
  created_at: '2011-09-04T00:00:00Z',
};

const repo: GHRepo = {
  id: 1,
  name: 'linux',
  full_name: 'torvalds/linux',
  html_url: 'https://github.com/torvalds/linux',
  description: 'Linux kernel source tree',
  language: 'C',
  stargazers_count: 253_500,
  forks_count: 67_400,
  open_issues_count: 0,
  watchers_count: 253_500,
  size: 6_100_000,
  topics: [],
  fork: false,
  archived: false,
  private: false,
  created_at: '2011-09-04T00:00:00Z',
  pushed_at: '2026-10-20T00:00:00Z',
  homepage: null,
};

interface Handle {
  root: Root;
  /** Click the first button whose accessible name matches exactly. */
  click: (label: string) => void;
  /** The button element itself, for typing into inputs etc. */
  button: (label: string) => HTMLButtonElement;
  input: (ariaLabel: string) => HTMLInputElement;
  /** Set a controlled input the way a keyboard would: native setter + input event. */
  type: (ariaLabel: string, value: string) => void;
  text: () => string;
  /** Do what the browser does on a hash link or Back: change it, then notify. */
  hashTo: (hash: string) => Promise<void>;
}

let cleanup: Array<() => void> = [];

function mount(): Handle {
  win.localStorage.clear();
  win.sessionStorage.clear();
  win.location.hash = '';
  win.document.body.innerHTML = '';

  const container = win.document.createElement('div');
  win.document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(createElement(App));
  });

  const click = (label: string) => {
    const el = button(label);
    act(() => {
      el.click();
    });
  };
  const button = (label: string): HTMLButtonElement => {
    const el = [...win.document.querySelectorAll('button')].find((b) => {
      const aria = (b.getAttribute('aria-label') ?? '').trim();
      const text = (b.textContent ?? '').trim();
      return aria === label || text.startsWith(label);
    });
    assert.ok(el, `no button labelled "${label}"`);
    return el as unknown as HTMLButtonElement;
  };
  const input = (ariaLabel: string): HTMLInputElement => {
    const el = [...win.document.querySelectorAll('input')].find((i) => i.getAttribute('aria-label') === ariaLabel);
    assert.ok(el, `no input labelled "${ariaLabel}"`);
    return el as unknown as HTMLInputElement;
  };
  const text = () => container.textContent ?? '';
  const type = (ariaLabel: string, value: string) => {
    const el = input(ariaLabel);
    const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(el, value);
      el.dispatchEvent(new win.Event('input', { bubbles: true }));
    });
  };

  const hashTo = async (hash: string) => {
    win.location.hash = hash;
    win.dispatchEvent(new win.Event('hashchange'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
  };

  cleanup.push(() => {
    act(() => root.unmount());
    container.remove();
  });

  return { root, click, button, input, type, text, hashTo };
}

function withFetch(impl: (url: string) => Response | Promise<Response>): void {
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) =>
    impl(String(input))) as unknown as typeof fetch;
  cleanup.push(() => {
    globalThis.fetch = real;
  });
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

afterEach(() => {
  for (const fn of cleanup) fn();
  cleanup = [];
});

// happy-dom keeps timers and observers alive; without this the test process
// finishes its assertions and then never exits.
after(() => {
  // React's scheduler keeps a MessagePort open, and happy-dom keeps timers;
  // neither is unref'd, so the child process would finish its assertions and
  // then sit there until the runner kills it. Close the window, then unref what
  // is left — the assertions are already done by the time this hook runs.
  try {
    win.happyDOM.close();
  } catch {
    /* older happy-dom builds have no happyDOM handle */
  }
  const handles = (process as unknown as { _getActiveHandles: () => unknown[] })._getActiveHandles();
  for (const h of handles) {
    const port = h as { unref?: () => void };
    if (typeof port.unref === 'function') port.unref();
  }
});
test('the tabs switch views, and browse comes back', () => {
  const h = mount();
  h.click(en.nav.search);
  assert.ok(h.text().includes(en.search.textLbl), 'search form appears');
  h.click(en.nav.collections);
  assert.ok(h.text().includes(en.collections.empty), 'collections empty state appears');
  h.click(en.nav.browse);
  assert.ok(h.text().includes('Scope out any public GitHub profile'), 'landing returns');
});

test('the theme toggle flips the document and its own label', () => {
  const h = mount();
  const doc = win.document;
  assert.equal(doc.documentElement.dataset.theme, 'dark', 'the app starts dark');
  h.click(en.chrome.toLight);
  assert.equal(doc.documentElement.dataset.theme, 'light');
  assert.ok(h.button(en.chrome.toDark), 'the label promises the way back');
});

test('the language switch translates the navigation in place', () => {
  const h = mount();
  h.click(en.chrome.langNote);
  assert.ok(h.text().includes('обзор'), 'the first tab is Russian now');
  h.click(ru.nav.search);
  assert.ok(h.text().includes('поиск'), 'and the views follow');
});

test('a login renders the profile, and a bookmark persists', async () => {
  withFetch((url) => (url.includes('/repos?') ? json([repo]) : json(user)));
  const h = mount();
  h.type('GitHub login', 'torvalds');
  h.click(en.browse.open);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
  assert.ok(h.text().includes('Linus Torvalds'), 'the profile is on screen');

  h.click(en.card.bmAdd);
  const saved = JSON.parse(String(win.localStorage.getItem('ghscope:bookmarks'))) as GHRepo[];
  assert.equal(saved.length, 1);
  assert.equal(saved[0].full_name, 'torvalds/linux');
  assert.ok(h.button(en.card.bmDel), 'the card now offers removal');
});

test('a hash link opened in a running tab loads that profile, and Back returns', async () => {
  withFetch((url) => (url.includes('/repos?') ? json([repo]) : json(user)));
  const h = mount();
  await h.hashTo('#/gaearon');
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
  assert.ok(h.text().includes('Linus Torvalds'), 'the watcher drove the same load');

  // happy-dom's history.back() does not dispatch hashchange, so hashTo() does
  // what the browser does on Back: empty the hash, then notify the watcher.
  await h.hashTo('');
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
  assert.ok(h.text().includes('Scope out any public GitHub profile'), 'an empty hash is the landing');
});

test('settings: a token goes to the session store, Escape closes', async () => {
  const h = mount();
  h.click(en.settings.title);
  h.type(en.settings.tokenTitle, 'ghp_test');
  h.click(en.settings.tokenSave);
  assert.equal(String(win.sessionStorage.getItem('ghscope:token')), 'ghp_test');
  assert.equal(String(win.localStorage.getItem('ghscope:token')), 'null', 'nothing lands in localStorage');

  win.document.body.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await act(async () => {
    await new Promise((r) => setTimeout(r, 10));
  });
  assert.ok(!h.text().includes(en.settings.tokenPlaceholder), 'the modal is gone');
});
