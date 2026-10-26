/**
 * The components were the uncovered layer: every rule in lib/ had tests, and
 * the screens that show those rules had none. These render each screen to
 * static markup — no DOM, no framework, same runner as the rest — and assert
 * the things a user would notice: the labels, the empty states, the fact that
 * an action button appears only when someone is listening to it.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, type ComponentType, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Icons from '../src/components/Icons.tsx';
import { RepoCard } from '../src/components/RepoCard.tsx';
import { CollectionsView } from '../src/components/CollectionsView.tsx';
import { WatchtowerView } from '../src/components/WatchtowerView.tsx';
import { SettingsModal } from '../src/components/SettingsModal.tsx';
import { ReadmeModal } from '../src/components/ReadmeModal.tsx';
import { CompareView } from '../src/components/CompareView.tsx';
import { SearchView } from '../src/components/SearchView.tsx';
import { DiscoverView } from '../src/components/DiscoverView.tsx';
import { OrgView } from '../src/components/OrgView.tsx';
import { RepoDuelView } from '../src/components/RepoDuelView.tsx';
import { compactNum, type GHRepo } from '../src/lib/github.ts';
import { en } from '../src/lib/i18n.tsx';
import { watchEntry } from '../src/lib/saved.ts';

const render = (el: ReactElement): string => renderToStaticMarkup(el);
const noop = () => undefined;

function repo(over: Partial<GHRepo> = {}): GHRepo {
  return {
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
    topics: ['kernel', 'linux'],
    fork: false,
    archived: false,
    private: false,
    created_at: '2011-09-04T00:00:00Z',
    pushed_at: '2026-10-20T00:00:00Z',
    homepage: null,
    owner: { login: 'torvalds', avatar_url: 'https://avatars.githubusercontent.com/u/1024025?v=4' },
    ...over,
  };
}

test('every icon is one decorative svg', () => {
  const exported = Icons as unknown as Record<string, ComponentType<{ size?: number }>>;
  const names = Object.keys(exported).filter((k) => typeof exported[k] === 'function');
  assert.ok(names.length >= 10, `expected an icon set, found ${names.length}`);
  for (const name of names) {
    const html = render(createElement(exported[name]));
    assert.match(html, /^<svg/, `${name} should render an svg`);
    assert.match(html, /aria-hidden="true"/, `${name} is decorative, so a screen reader must skip it`);
  }
});

test('a repo card shows what the API said and offers its actions', () => {
  const html = render(
    createElement(RepoCard, {
      repo: repo(),
      onReadme: noop,
      onToggleBookmark: noop,
      onCollect: noop,
      onWatch: noop,
      onOpenOwner: noop,
      onOpenDetail: noop,
    }),
  );
  assert.match(html, />linux</);
  assert.match(html, /Linux kernel source tree/);
  assert.ok(html.includes(compactNum(253_500)), 'stars are shown compact, not raw');
  for (const label of [en.card.bmAdd, en.card.watchAdd, en.card.readmeT, en.card.collectT, en.card.copyAria]) {
    assert.ok(html.includes(label), `missing action: ${label}`);
  }
});

test('the card remembers state: saved and watched say remove', () => {
  const html = render(
    createElement(RepoCard, {
      repo: repo(),
      onReadme: noop,
      bookmarked: true,
      watched: true,
      onToggleBookmark: noop,
      onWatch: noop,
    }),
  );
  assert.ok(html.includes(en.card.bmDel));
  assert.ok(html.includes(en.card.watchDel));
  assert.ok(!html.includes(en.card.bmAdd));
});

test('badges follow the data, and a missing description says so', () => {
  const html = render(
    createElement(RepoCard, {
      repo: repo({ fork: true, archived: true, description: null }),
      onReadme: noop,
    }),
  );
  assert.ok(html.includes(en.card.fork));
  assert.ok(html.includes(en.card.archived));
  assert.ok(html.includes(en.card.noDesc));
});

test('a card without listeners shows no buttons for actions nobody handles', () => {
  const html = render(createElement(RepoCard, { repo: repo(), onReadme: noop }));
  assert.ok(html.includes(en.card.readmeT), 'reading is always available');
  assert.ok(!html.includes(en.card.bmAdd), 'no bookmark handler, no bookmark button');
  assert.ok(!html.includes(en.card.watchAdd));
  assert.ok(!html.includes(en.card.collectT));
});

test('collections explain an empty list, and show one that is not', () => {
  const props = { onCreate: noop, onDelete: noop, onRemoveItem: noop, onOpenDetail: noop };
  const empty = render(createElement(CollectionsView, { collections: [], ...props }));
  assert.ok(empty.includes(en.collections.empty), 'an empty screen has to say what to do');

  const filled = render(
    createElement(CollectionsView, {
      collections: [
        {
          id: 'c1',
          name: 'reading',
          createdAt: '2026-10-01T00:00:00.000Z',
          items: [{ fullName: 'torvalds/linux', repo: repo(), addedAt: '2026-10-01T00:00:00.000Z' }],
        },
      ],
      ...props,
    }),
  );
  assert.ok(filled.includes('reading'));
  assert.ok(filled.includes('torvalds/linux'));
  assert.ok(filled.includes(en.collections.exportMd), 'a collection can leave as markdown');
  assert.ok(filled.includes(en.collections.del), 'and can be deleted');
});

test('the watchtower explains an empty list, and shows one entry', () => {
  const props = { onPersist: noop, onRemove: noop, onOpenDetail: noop, onOpenOwner: noop };
  const empty = render(createElement(WatchtowerView, { entries: [], ...props }));
  assert.ok(empty.includes(en.watchtower.empty));

  const withEntry = render(
    createElement(WatchtowerView, { entries: [watchEntry(repo(), '2026-10-26T09:00:00.000Z')], ...props }),
  );
  assert.ok(withEntry.includes('torvalds/linux'));
  assert.ok(withEntry.includes(en.watchtower.remove));
});

test('settings say where the token lives, because that changed', () => {
  const html = render(createElement(SettingsModal, { token: '', onTokenChange: noop, onClose: noop }));
  assert.ok(html.includes(en.settings.title));
  assert.ok(html.includes(en.settings.tokenPlaceholder));
  assert.ok(html.includes('close the tab'), 'the token is session-scoped and the copy has to say so');
  assert.ok(html.includes(en.settings.close));
});

test('the README modal names the repository and says it is loading', () => {
  const html = render(createElement(ReadmeModal, { repo: repo(), token: null, onClose: noop }));
  assert.match(html, /aria-label="README — torvalds\/linux/);
  assert.ok(html.includes(en.readme.loading));
});

test('compare asks for two logins before it can compare anything', () => {
  const html = render(createElement(CompareView, { onOpenOwner: noop }));
  assert.ok(html.includes(en.compare.window));
  assert.ok(html.includes(en.compare.phA));
  assert.ok(html.includes(en.compare.phB));
  assert.ok(html.includes(en.compare.run));
});

test('search renders its filters, not just a box', () => {
  const html = render(
    createElement(SearchView, {
      token: null,
      onOpenDetail: noop,
      onOpenOwner: noop,
      bookmarkedIds: new Set<number>(),
      onToggleBookmark: noop,
      onReadme: noop,
    }),
  );
  assert.ok(html.includes(en.search.textLbl));
  assert.ok(html.includes(en.search.langLbl));
  assert.ok(html.includes(en.search.starsLbl));
});

test('discover offers both modes and a language filter', () => {
  const html = render(
    createElement(DiscoverView, {
      onOpenDetail: noop,
      onOpenOwner: noop,
      bookmarkedIds: new Set<number>(),
      onToggleBookmark: noop,
      onReadme: noop,
    }),
  );
  assert.ok(html.includes(en.discover.modeRising));
  assert.ok(html.includes(en.discover.modeHot));
  assert.ok(html.includes(en.discover.minStars));
});

test('organizations ask for a login', () => {
  const html = render(
    createElement(OrgView, {
      token: null,
      bookmarkedIds: new Set<number>(),
      onToggleBookmark: noop,
      onReadme: noop,
      onOpenOwner: noop,
      onOpenDetail: noop,
    }),
  );
  assert.ok(html.includes('Organization login'));
});

test('the duel asks for two repositories', () => {
  const html = render(createElement(RepoDuelView));
  assert.ok(html.includes(en.duel.window));
  assert.ok(html.includes(en.duel.phA));
  assert.ok(html.includes(en.duel.phB));
  assert.ok(html.includes(en.duel.run));
});
