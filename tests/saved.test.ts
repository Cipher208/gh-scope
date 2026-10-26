/**
 * Bookmarks, collections and the watchtower are the app's only stored state,
 * and the rules are small but easy to break: new items go to the front, a
 * toggle removes on the second click, the bookmark list is capped, and none of
 * it may mutate the list it was handed.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GHRepo } from '../src/lib/github.ts';
import type { Collection } from '../src/components/CollectionsView.tsx';
import {
  BOOKMARKS_LIMIT,
  createCollection,
  createCollectionWith,
  deleteCollection,
  readList,
  removeFromCollection,
  toggleBookmark,
  toggleInCollection,
  toggleWatch,
  watchEntry,
  writeList,
} from '../src/lib/saved.ts';

function repo(over: Partial<GHRepo> = {}): GHRepo {
  return {
    id: 1,
    name: 'a-memory',
    full_name: 'Cipher208/a-memory',
    html_url: 'https://github.com/Cipher208/a-memory',
    description: null,
    language: 'Python',
    stargazers_count: 12,
    forks_count: 1,
    open_issues_count: 0,
    watchers_count: 12,
    size: 100,
    topics: [],
    fork: false,
    archived: false,
    private: false,
    created_at: '2026-01-01T00:00:00Z',
    pushed_at: '2026-10-01T00:00:00Z',
    homepage: null,
    ...over,
  };
}

const collection = (id: string, items: string[] = []): Collection => ({
  id,
  name: `name-${id}`,
  createdAt: '2026-10-01T00:00:00.000Z',
  items: items.map((fullName) => ({ fullName, repo: repo({ full_name: fullName }), addedAt: '2026-10-01T00:00:00.000Z' })),
});

test('a stored list survives garbage, but not quietly as something else', () => {
  const store = (value: string | null) => ({ getItem: () => value, setItem: () => {} });
  assert.deepEqual(readList(store(null), 'k'), []);
  assert.deepEqual(readList(store('{not json'), 'k'), []);
  assert.deepEqual(readList(store('{"a":1}'), 'k'), []);
  assert.deepEqual(readList(store('[1,"two",3]'), 'k', (x) => typeof x === 'number'), [1, 3]);
});

test('a disabled store is survivable on write', () => {
  assert.doesNotThrow(() =>
    writeList(
      {
        getItem: () => null,
        setItem: () => {
          throw new Error('denied');
        },
      },
      'k',
      [1],
    ),
  );
});

test('a bookmark toggles, goes to the front, and the list is capped', () => {
  const a = repo({ id: 1, full_name: 'o/a' });
  const b = repo({ id: 2, full_name: 'o/b' });
  assert.deepEqual(toggleBookmark([], a).map((r) => r.id), [1]);
  assert.deepEqual(toggleBookmark([b], a).map((r) => r.id), [1, 2], 'newest first');
  assert.deepEqual(toggleBookmark([a, b], a).map((r) => r.id), [2], 'second click removes');
  const many = Array.from({ length: BOOKMARKS_LIMIT }, (_, i) => repo({ id: i }));
  const fresh = repo({ id: 9999, full_name: 'o/fresh' });
  assert.equal(toggleBookmark(many, fresh).length, BOOKMARKS_LIMIT, 'the cap holds');
  assert.equal(toggleBookmark(many, fresh, 3).length, 3, 'the cap is a parameter, not a magic number in App');
});

test('a new collection is first, empty, and does not mutate the old list', () => {
  const before = [collection('c1')];
  const now = '2026-10-26T09:00:00.000Z';
  const after = createCollection(before, 'reading', now);
  assert.equal(after.length, 2);
  assert.equal(after[0].name, 'reading');
  assert.deepEqual(after[0].items, []);
  assert.equal(after[0].createdAt, now);
  assert.equal(before.length, 1, 'input list untouched');
});

test('a collection can be deleted by id only', () => {
  assert.deepEqual(deleteCollection([collection('c1'), collection('c2')], 'c1').map((c) => c.id), ['c2']);
});

test('adding to a collection is a toggle and leaves the other collections alone', () => {
  const before = [collection('c1'), collection('c2', ['o/x'])];
  const added = toggleInCollection(before, 'c1', repo(), '2026-10-26T09:00:00.000Z');
  assert.deepEqual(added[0].items.map((i) => i.fullName), ['Cipher208/a-memory']);
  assert.equal(added[1], before[1], 'the untouched collection is the same object');
  assert.equal(before[0].items.length, 0, 'input untouched');
  assert.deepEqual(toggleInCollection(added, 'c1', repo(), '2026-10-26T09:01:00.000Z')[0].items, []);
});

test('an item can be removed from one collection without disturbing another', () => {
  const before = [collection('c1', ['o/a', 'o/b']), collection('c2', ['o/a'])];
  const after = removeFromCollection(before, 'c1', 'o/a');
  assert.deepEqual(after[0].items.map((i) => i.fullName), ['o/b']);
  assert.deepEqual(after[1].items.map((i) => i.fullName), ['o/a']);
});

test('creating a collection with a repo puts that repo inside it', () => {
  const after = createCollectionWith([], 'starred', repo(), '2026-10-26T09:00:00.000Z');
  assert.equal(after[0].name, 'starred');
  assert.deepEqual(after[0].items.map((i) => i.fullName), ['Cipher208/a-memory']);
});

test('watching records a first data point and unwatches on the second click', () => {
  const now = '2026-10-26T09:00:00.000Z';
  const one = toggleWatch([], repo(), now);
  assert.equal(one.length, 1);
  assert.equal(one[0].owner, 'Cipher208');
  assert.deepEqual(one[0].history, [{ t: now, stars: 12 }]);
  assert.equal(one[0].dStars, null, 'no delta until there is a second reading');
  assert.deepEqual(toggleWatch(one, repo(), now), []);
  assert.equal(watchEntry(repo(), now).fullName, 'Cipher208/a-memory');
});
