/**
 * What the visitor keeps: bookmarks, collections, the watchtower.
 *
 * The rules live here rather than inside App's callbacks so they can be tested
 * without a browser: which end new additions go to, what a toggle does, how the
 * bookmark list is capped, what happens when localStorage holds garbage. Every
 * function is pure — it takes a list and returns a new one, and storage is a
 * separate two-line concern.
 */
import type { GHRepo } from './github';
import type { Collection } from '../components/CollectionsView';
import type { WatchEntry } from '../components/WatchtowerView';

export interface SavedStore {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export const BOOKMARKS_LIMIT = 300;

export function readList<T>(store: SavedStore, key: string, valid?: (value: unknown) => boolean): T[] {
  try {
    const raw = store.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return (valid ? parsed.filter(valid) : parsed) as T[];
  } catch {
    return [];
  }
}

export function writeList<T>(store: SavedStore, key: string, list: T[]): void {
  try {
    store.setItem(key, JSON.stringify(list));
  } catch {
    /* private mode: the list lives for this page only */
  }
}

export function toggleBookmark(list: GHRepo[], repo: GHRepo, limit = BOOKMARKS_LIMIT): GHRepo[] {
  return list.some((r) => r.id === repo.id)
    ? list.filter((r) => r.id !== repo.id)
    : [repo, ...list].slice(0, limit);
}

function newCollection(name: string, now: string): Collection {
  return { id: `c${Date.parse(now)}`, name, items: [], createdAt: now };
}

export function createCollection(list: Collection[], name: string, now: string): Collection[] {
  return [newCollection(name, now), ...list];
}

export function deleteCollection(list: Collection[], id: string): Collection[] {
  return list.filter((c) => c.id !== id);
}

export function toggleInCollection(list: Collection[], colId: string, repo: GHRepo, now: string): Collection[] {
  return list.map((c) => {
    if (c.id !== colId) return c;
    const exists = c.items.some((it) => it.fullName === repo.full_name);
    return {
      ...c,
      items: exists
        ? c.items.filter((it) => it.fullName !== repo.full_name)
        : [{ fullName: repo.full_name, repo, addedAt: now }, ...c.items],
    };
  });
}

export function removeFromCollection(list: Collection[], colId: string, fullName: string): Collection[] {
  return list.map((c) =>
    c.id === colId ? { ...c, items: c.items.filter((it) => it.fullName !== fullName) } : c,
  );
}

export function createCollectionWith(list: Collection[], name: string, repo: GHRepo, now: string): Collection[] {
  const collection = newCollection(name, now);
  return [{ ...collection, items: [{ fullName: repo.full_name, repo, addedAt: now }] }, ...list];
}

export function watchEntry(repo: GHRepo, now: string): WatchEntry {
  return {
    fullName: repo.full_name,
    name: repo.name,
    owner: repo.full_name.split('/')[0],
    language: repo.language,
    htmlUrl: repo.html_url,
    addedAt: now,
    capturedAt: now,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    pushedAt: repo.pushed_at,
    dStars: null,
    dForks: null,
    newPush: false,
    history: [{ t: now, stars: repo.stargazers_count }],
  };
}

export function toggleWatch(list: WatchEntry[], repo: GHRepo, now: string): WatchEntry[] {
  return list.some((w) => w.fullName === repo.full_name)
    ? list.filter((w) => w.fullName !== repo.full_name)
    : [watchEntry(repo, now), ...list];
}
