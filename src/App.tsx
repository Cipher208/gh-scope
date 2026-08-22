import { Component, useCallback, useEffect, useMemo, useState, type ErrorInfo, type FormEvent, type ReactNode } from 'react';
import type { GHRepo, GHUser, RateInfo } from './lib/github';
import {
  GHError,
  fetchRepos,
  fetchUser,
  langColor,
  fullNum,
  monthYear,
  onRateLimit,
  prefersReducedMotion,
} from './lib/github';
import { LangProvider, useLang, useLocale, useT } from './lib/i18n';
import { RepoCard } from './components/RepoCard';
import { ReadmeModal } from './components/ReadmeModal';
import { SearchView } from './components/SearchView';
import { CompareView } from './components/CompareView';
import { RepoDuelView } from './components/RepoDuelView';
import { CollectionsView, CollectionPicker, type Collection } from './components/CollectionsView';
import { WatchtowerView, type WatchEntry } from './components/WatchtowerView';
import { DiscoverView } from './components/DiscoverView';
import { OrgView } from './components/OrgView';
import {
  IconAlert,
  IconAt,
  IconBook,
  IconBookmark,
  IconBuilding,
  IconCalendar,
  IconChevronDown,
  IconDownload,
  IconFlame,
  IconFolder,
  IconLink,
  IconMoon,
  IconPin,
  IconRadar,
  IconRepoCompare,
  IconScale,
  IconSearch,
  IconSun,
  IconTerminal,
  IconTrash,
  IconUsers,
} from './components/Icons';

const THEME_KEY = 'ghscope:theme';
const HISTORY_KEY = 'ghscope:history';
const BOOKMARKS_KEY = 'ghscope:bookmarks';
const COLLECTIONS_KEY = 'ghscope:collections';
const WATCH_KEY = 'ghscope:watch';

type View = 'browse' | 'search' | 'orgs' | 'compare' | 'duel' | 'collections' | 'radar' | 'discover' | 'saved';

interface Profile {
  user: GHUser;
  repos: GHRepo[];
}

function readHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string').slice(0, 6) : [];
  } catch {
    return [];
  }
}

function readBookmarks(): GHRepo[] {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr)
      ? arr.filter((x): x is GHRepo => typeof x === 'object' && x !== null && typeof (x as GHRepo).id === 'number').slice(0, 300)
      : [];
  } catch {
    return [];
  }
}

/** Terminal-style crash screen — catches any runtime error honestly. */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('gh-scope crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg p-4">
          <div className="bg-grid" aria-hidden="true" />
          <div className="glow glow-a" aria-hidden="true" />
          <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-coral/40 bg-panel shadow-soft">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-coral/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-mint/70" />
              <span className="ml-2 font-mono text-[11px] text-coral">gh-scope — kernel panic</span>
            </div>
            <div className="p-6 font-mono text-sm leading-relaxed">
              <p className="text-coral">✗ something crashed while rendering</p>
              <p className="mt-3 break-all text-xs text-mut">{this.state.error.message}</p>
              <p className="mt-4 text-xs text-mut/70">This is a client-side bug, not your data. Reloading usually fixes it.</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-5 rounded-lg border border-amber/50 bg-amber/10 px-4 py-2 text-xs font-semibold text-amber transition-colors hover:bg-amber/20"
              >
                reboot ↻
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <LangProvider>
        <Shell />
      </LangProvider>
    </ErrorBoundary>
  );
}

function RateMeter({ rate }: { rate: RateInfo }) {
  const t = useT();
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 30000);
    return () => window.clearInterval(id);
  }, []);
  const pct = rate.limit > 0 ? rate.remaining / rate.limit : 0;
  const color = pct > 0.25 ? 'var(--color-mint)' : pct > 0.08 ? 'var(--color-amber)' : 'var(--color-coral)';
  const mins = Math.max(0, Math.round((rate.reset * 1000 - Date.now()) / 60000));
  return (
    <div className="hidden items-center gap-1.5 lg:flex" title={t.chrome.rateTitle(mins, rate.authenticated)}>
      <span className="font-mono text-[10px] text-mut tnum">
        api {rate.remaining}/{rate.limit}
      </span>
      <span className="h-1 w-14 overflow-hidden rounded-full bg-raise">
        <span
          className="block h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max(4, pct * 100)}%`, background: color }}
        />
      </span>
    </div>
  );
}

function Shell() {
  const t = useT();
  const locale = useLocale();
  const { lang, setLang } = useLang();

  /* theme */
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* private mode */
    }
  }, [theme]);

  /* bookmarks */
  const [bookmarks, setBookmarks] = useState<GHRepo[]>(readBookmarks);
  const persistBookmarks = useCallback((next: GHRepo[]) => {
    setBookmarks(next);
    try {
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  }, []);
  const toggleBookmark = useCallback(
    (repo: GHRepo) => {
      setBookmarks((prev) => {
        const exists = prev.some((r) => r.id === repo.id);
        const next = exists ? prev.filter((r) => r.id !== repo.id) : [repo, ...prev].slice(0, 300);
        try {
          localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
        } catch {
          /* private mode */
        }
        return next;
      });
    },
    [],
  );
  const bookmarkedIds = useMemo(() => new Set(bookmarks.map((r) => r.id)), [bookmarks]);

  /* collections */
  const [collections, setCollections] = useState<Collection[]>(() => {
    try {
      const raw = localStorage.getItem(COLLECTIONS_KEY);
      const arr = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(arr) ? (arr as Collection[]) : [];
    } catch {
      return [];
    }
  });
  const persistCollections = useCallback((next: Collection[]) => {
    setCollections(next);
    try {
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  }, []);
  const createCollection = useCallback(
    (name: string) => {
      const now = new Date().toISOString();
      persistCollections([{ id: `c${Date.now()}`, name, items: [], createdAt: now }, ...collections]);
    },
    [collections, persistCollections],
  );
  const deleteCollection = useCallback(
    (id: string) => persistCollections(collections.filter((c) => c.id !== id)),
    [collections, persistCollections],
  );
  const toggleInCollection = useCallback(
    (colId: string, repo: GHRepo) => {
      const now = new Date().toISOString();
      persistCollections(
        collections.map((c) => {
          if (c.id !== colId) return c;
          const exists = c.items.some((it) => it.fullName === repo.full_name);
          return {
            ...c,
            items: exists
              ? c.items.filter((it) => it.fullName !== repo.full_name)
              : [{ fullName: repo.full_name, repo, addedAt: now }, ...c.items],
          };
        }),
      );
    },
    [collections, persistCollections],
  );
  const removeCollectionItem = useCallback(
    (id: string, fullName: string) => {
      persistCollections(
        collections.map((c) => (c.id === id ? { ...c, items: c.items.filter((it) => it.fullName !== fullName) } : c)),
      );
    },
    [collections, persistCollections],
  );
  const createAndAdd = useCallback(
    (name: string, repo: GHRepo) => {
      const now = new Date().toISOString();
      persistCollections([
        { id: `c${Date.now()}`, name, items: [{ fullName: repo.full_name, repo, addedAt: now }], createdAt: now },
        ...collections,
      ]);
      setPickFor(null);
    },
    [collections, persistCollections],
  );
  const [pickFor, setPickFor] = useState<GHRepo | null>(null);

  /* watchtower */
  const [watchEntries, setWatchEntries] = useState<WatchEntry[]>(() => {
    try {
      const raw = localStorage.getItem(WATCH_KEY);
      const arr = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(arr) ? (arr as WatchEntry[]) : [];
    } catch {
      return [];
    }
  });
  const persistWatch = useCallback((next: WatchEntry[]) => {
    setWatchEntries(next);
    try {
      localStorage.setItem(WATCH_KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  }, []);
  const toggleWatch = useCallback(
    (repo: GHRepo) => {
      const exists = watchEntries.some((w) => w.fullName === repo.full_name);
      if (exists) {
        persistWatch(watchEntries.filter((w) => w.fullName !== repo.full_name));
        return;
      }
      const now = new Date().toISOString();
      const entry: WatchEntry = {
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
      persistWatch([entry, ...watchEntries]);
    },
    [watchEntries, persistWatch],
  );
  const watchedFulls = useMemo(() => new Set(watchEntries.map((w) => w.fullName)), [watchEntries]);

  /* rate limit */
  const [rate, setRate] = useState<RateInfo | null>(null);
  useEffect(() => onRateLimit(setRate), []);

  /* browse state */
  const [view, setView] = useState<View>('browse');
  const [loginInput, setLoginInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<GHError | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pendingLogin, setPendingLogin] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>(readHistory);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'pushed' | 'stars' | 'created' | 'name'>('pushed');
  const [langFilter, setLangFilter] = useState('all');
  const [showForks, setShowForks] = useState(true);
  const [readmeFor, setReadmeFor] = useState<GHRepo | null>(null);

  const pushHistory = useCallback((login: string) => {
    setHistory((h) => {
      const next = [login, ...h.filter((x) => x !== login)].slice(0, 6);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  const load = useCallback(
    async (raw: string) => {
      const login = raw.trim().replace(/^@/, '');
      if (!login || busy) return;
      setBusy(true);
      setError(null);
      setPendingLogin(login);
      try {
        const [user, repos] = await Promise.all([fetchUser(login, null), fetchRepos(login, null)]);
        setProfile({ user, repos });
        setLoginInput(user.login);
        setQuery('');
        setSort('pushed');
        setLangFilter('all');
        setShowForks(true);
        pushHistory(user.login);
        window.location.hash = user.login;
      } catch (e) {
        setProfile(null);
        setError(e instanceof GHError ? e : new GHError(0, 'Network error — check your connection and try again.'));
      } finally {
        setBusy(false);
        setPendingLogin(null);
      }
    },
    [busy, pushHistory],
  );

  /* initial load: deep link #login or most recent */
  useEffect(() => {
    const hash = window.location.hash.replace(/^#\/?/, '');
    const initial = hash || readHistory()[0];
    if (initial) void load(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* keyboard: "/" focuses search */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setReadmeFor(null);
        return;
      }
      if (e.key === '/') {
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        const target =
          (document.getElementById('repo-search') as HTMLInputElement | null) ??
          (document.getElementById('login-input') as HTMLInputElement | null);
        if (target) {
          e.preventDefault();
          target.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openOwner = useCallback(
    (login: string) => {
      setView('browse');
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      void load(login);
    },
    [load],
  );

  const languages = useMemo(() => {
    if (!profile) return [];
    const s = new Set<string>();
    for (const r of profile.repos) if (r.language) s.add(r.language);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [profile]);

  const filtered = useMemo(() => {
    if (!profile) return [];
    let list = [...profile.repos];
    if (!showForks) list = list.filter((r) => !r.fork);
    if (langFilter !== 'all') list = list.filter((r) => r.language === langFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.description || '').toLowerCase().includes(q) ||
          r.topics.some((tp) => tp.toLowerCase().includes(q)),
      );
    }
    switch (sort) {
      case 'stars':
        list.sort((a, b) => b.stargazers_count - a.stargazers_count);
        break;
      case 'created':
        list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
        break;
      case 'name':
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        list.sort((a, b) => +new Date(b.pushed_at) - +new Date(a.pushed_at));
    }
    return list;
  }, [profile, showForks, langFilter, query, sort]);

  const totalStars = useMemo(
    () => (profile ? profile.repos.filter((r) => !r.fork).reduce((s, r) => s + r.stargazers_count, 0) : 0),
    [profile],
  );

  const exportJson = () => {
    if (!profile) return;
    const blob = new Blob(
      [JSON.stringify({ profile: profile.user.login, exported_at: new Date().toISOString(), user: profile.user, repositories: profile.repos }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${profile.user.login}-repositories.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const submitLogin = (e: FormEvent) => {
    e.preventDefault();
    void load(loginInput);
  };

  const navItems: Array<{ key: View; label: string; icon: ReactNode; badge?: number; tone: string }> = [
    { key: 'browse', label: t.nav.browse, icon: <IconBook size={13} />, tone: 'bg-amber/15 text-amber' },
    { key: 'search', label: t.nav.search, icon: <IconSearch size={13} />, tone: 'bg-sky/15 text-sky' },
    { key: 'discover', label: t.nav.discover, icon: <IconFlame size={13} />, tone: 'bg-coral/15 text-coral' },
    { key: 'orgs', label: t.nav.orgs, icon: <IconUsers size={13} />, tone: 'bg-mint/15 text-mint' },
    { key: 'compare', label: t.nav.compare, icon: <IconScale size={13} />, tone: 'bg-coral/15 text-coral' },
    { key: 'duel', label: t.nav.duel, icon: <IconRepoCompare size={13} />, tone: 'bg-sky/15 text-sky' },
    { key: 'collections', label: t.nav.collections, icon: <IconFolder size={13} />, tone: 'bg-amber/15 text-amber', badge: collections.length },
    { key: 'radar', label: t.nav.watchtower, icon: <IconRadar size={13} />, tone: 'bg-mint/15 text-mint', badge: watchEntries.length },
    { key: 'saved', label: 'saved', icon: <IconBookmark size={13} />, tone: 'bg-mint/15 text-mint', badge: bookmarks.length },
  ];

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="bg-grid" aria-hidden="true" />
      <div className="glow glow-a" aria-hidden="true" />
      <div className="glow glow-b" aria-hidden="true" />

      {/* header */}
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber/40 bg-amber/10 text-amber">
            <IconTerminal size={16} />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">gh-scope</span>
          <span className="hidden rounded border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-mut lg:inline">
            v8
          </span>

          <nav className="ml-2 flex items-center gap-1 overflow-x-auto rounded-lg border border-line bg-panel/70 p-1 sm:ml-4" aria-label="View">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setView(item.key)}
                aria-pressed={view === item.key}
                title={item.label}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-xs transition-all duration-200 sm:px-3 ${
                  view === item.key ? item.tone : 'text-mut hover:text-ink'
                }`}
              >
                {item.icon}
                <span className="hidden md:inline">{item.label}</span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className={`rounded-full px-1.5 font-mono text-[10px] tnum ${view === item.key ? 'bg-amber/20' : 'bg-raise text-mut'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {rate && <RateMeter rate={rate} />}
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'ru' : 'en')}
              title={t.chrome.langNote}
              aria-label={t.chrome.langNote}
              className="flex h-8 items-center rounded-lg border border-line px-2 font-mono text-[11px] font-semibold text-mut transition-all duration-200 hover:-translate-y-px hover:border-mint/60 hover:text-mint"
            >
              {lang === 'en' ? 'RU' : 'EN'}
            </button>
            <span className="hidden items-center gap-1.5 rounded-md border border-line px-2 py-1 font-mono text-[11px] text-mut xl:inline-flex">
              {t.chrome.publicApi}
            </span>
            <button
              type="button"
              onClick={() => setTheme((th) => (th === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? t.chrome.toLight : t.chrome.toDark}
              title={theme === 'dark' ? t.chrome.toLight : t.chrome.toDark}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-mut transition-all duration-300 hover:rotate-12 hover:border-amber/60 hover:text-amber"
            >
              {theme === 'dark' ? <IconSun size={15} /> : <IconMoon size={15} />}
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6">
        {view === 'search' && (
          <SearchView
            token={null}
            onOpenDetail={(full) => {
              window.open(`https://github.com/${full}`, '_blank', 'noreferrer');
            }}
            onOpenOwner={openOwner}
            bookmarkedIds={bookmarkedIds}
            onToggleBookmark={toggleBookmark}
            onReadme={setReadmeFor}
          />
        )}

        {view === 'discover' && (
          <DiscoverView
            onOpenDetail={(full) => window.open(`https://github.com/${full}`, '_blank', 'noreferrer')}
            onOpenOwner={openOwner}
            bookmarkedIds={bookmarkedIds}
            onToggleBookmark={toggleBookmark}
            onReadme={setReadmeFor}
          />
        )}

        {view === 'orgs' && (
          <OrgView
            token={null}
            onOpenDetail={(full) => window.open(`https://github.com/${full}`, '_blank', 'noreferrer')}
            onOpenOwner={openOwner}
            bookmarkedIds={bookmarkedIds}
            onToggleBookmark={toggleBookmark}
            onReadme={setReadmeFor}
          />
        )}

        {view === 'compare' && <CompareView onOpenOwner={openOwner} />}

        {view === 'duel' && <RepoDuelView />}

        {view === 'collections' && (
          <CollectionsView
            collections={collections}
            onCreate={createCollection}
            onDelete={deleteCollection}
            onRemoveItem={removeCollectionItem}
            onOpenDetail={(full) => window.open(`https://github.com/${full}`, '_blank', 'noreferrer')}
          />
        )}

        {view === 'radar' && (
          <WatchtowerView
            entries={watchEntries}
            onPersist={persistWatch}
            onRemove={(full) => persistWatch(watchEntries.filter((w) => w.fullName !== full))}
            onOpenDetail={(full) => window.open(`https://github.com/${full}`, '_blank', 'noreferrer')}
            onOpenOwner={openOwner}
          />
        )}

        {view === 'saved' && (
          <div className="flex flex-col gap-6">
            {bookmarks.length === 0 ? (
              <section className="rounded-xl border border-dashed border-line bg-panel/50 p-10 text-center sm:p-16">
                <div className="mx-auto flex max-w-md flex-col items-center gap-4">
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-panel text-mut">
                    <IconBookmark size={26} />
                  </span>
                  <h2 className="font-display text-2xl font-bold">{t.saved.emptyTitle}</h2>
                  <p className="font-mono text-sm leading-relaxed text-mut">{t.saved.emptyBody}</p>
                  <button
                    type="button"
                    onClick={() => setView('browse')}
                    className="mt-2 rounded-lg border border-amber/50 px-4 py-2 font-mono text-xs text-amber transition-all duration-200 hover:border-amber hover:bg-amber/10 active:translate-y-px"
                  >
                    {t.saved.go}
                  </button>
                </div>
              </section>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel/85 p-4">
                  <h2 className="font-display text-xl font-bold">
                    {t.saved.title}
                    <span className="ml-2 font-mono text-sm font-medium text-mut tnum">{bookmarks.length}</span>
                  </h2>
                  <span className="font-mono text-xs text-mut">{t.saved.note}</span>
                  <button
                    type="button"
                    onClick={() => persistBookmarks([])}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 font-mono text-xs text-mut transition-all duration-200 hover:border-coral/60 hover:text-coral"
                  >
                    <IconTrash size={13} />
                    {t.saved.clearAll}
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {bookmarks.map((r, i) => (
                    <RepoCard
                      key={r.id}
                      repo={r}
                      index={i}
                      onReadme={setReadmeFor}
                      bookmarked
                      onToggleBookmark={toggleBookmark}
                      onOpenOwner={openOwner}
                      onCollect={setPickFor}
                      watched={watchedFulls.has(r.full_name)}
                      onWatch={toggleWatch}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {view === 'browse' && (
          <div className="flex flex-col gap-6">
            {/* terminal hero */}
            <section className="overflow-hidden rounded-xl border border-line bg-panel/85 shadow-soft">
              <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-coral/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-mint/70" />
                <span className="ml-2 font-mono text-[11px] text-mut">
                  {t.browse.window}
                  {pendingLogin && <span className="ml-2 text-amber">{t.browse.fetching(pendingLogin)}</span>}
                </span>
                <span className="ml-auto hidden font-mono text-[11px] text-mut/70 md:inline">
                  {t.browse.slashA} <kbd>/</kbd> {t.browse.slashB}
                </span>
              </div>
              <div className="p-4 sm:p-5">
                <form
                  onSubmit={submitLogin}
                  className="flex items-center gap-2.5 rounded-xl border border-line bg-bg/60 px-4 py-3 transition-colors duration-300 focus-within:border-amber/60"
                >
                  <span className="hidden shrink-0 font-mono text-sm sm:inline">
                    <span className="text-mint">guest</span>
                    <span className="text-mut">@</span>
                    <span className="text-amber">gh-scope</span>
                    <span className="text-mut">:~$</span>
                  </span>
                  <span className="shrink-0 font-mono text-sm text-mint sm:hidden">❯</span>
                  <input
                    id="login-input"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    placeholder={t.browse.ph}
                    spellCheck={false}
                    autoCapitalize="none"
                    autoComplete="off"
                    aria-label="GitHub login"
                    className="w-full min-w-0 flex-1 bg-transparent font-mono text-[15px] text-amber caret-amber outline-none placeholder:text-mut/50"
                  />
                  <button
                    type="submit"
                    disabled={busy || !loginInput.trim()}
                    className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-amber/50 px-3.5 py-1.5 font-mono text-xs text-amber transition-all duration-200 hover:border-amber hover:bg-amber/10 active:translate-y-px disabled:cursor-not-allowed disabled:border-line disabled:text-mut/50"
                  >
                    {busy ? (
                      <>
                        <svg className="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
                          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                        {t.browse.request}
                      </>
                    ) : (
                      <>
                        {t.browse.open} <kbd>↵</kbd>
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {history.length > 0 && (
                    <>
                      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut/70">{t.browse.recent}</span>
                      {history.map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => void load(h)}
                          disabled={busy}
                          className="rounded-md border border-line px-2.5 py-1 font-mono text-xs text-mut transition-all duration-200 hover:-translate-y-px hover:border-mint/60 hover:text-mint disabled:opacity-50"
                        >
                          @{h}
                        </button>
                      ))}
                    </>
                  )}
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut/70">{t.browse.quick}</span>
                  {['torvalds', 'gaearon', 'sindresorhus'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void load(s)}
                      disabled={busy}
                      className="rounded-md border border-line px-2.5 py-1 font-mono text-xs text-mut transition-all duration-200 hover:-translate-y-px hover:border-mint/60 hover:text-mint disabled:opacity-50"
                    >
                      @{s}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {error && (
              <div className="flex flex-col items-start gap-3 rounded-xl border border-coral/40 bg-coral/10 p-5 sm:flex-row sm:items-center">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-coral/40 bg-coral/10 text-coral">
                  <IconAlert size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-semibold text-coral">{t.browse.errTitle}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-mut">{error.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => loginInput.trim() && void load(loginInput)}
                  className="shrink-0 rounded-lg border border-coral/50 px-3.5 py-2 font-mono text-xs text-coral transition-all duration-200 hover:border-coral hover:bg-coral/15"
                >
                  {t.browse.retry}
                </button>
              </div>
            )}

            {!profile && !error && !busy && (
              <section className="rounded-xl border border-dashed border-line bg-panel/50 p-8 sm:p-12">
                <div className="mx-auto max-w-xl font-mono text-sm leading-loose text-mut">
                  <p>
                    <span className="text-mint">$</span> <span className="text-amber">gh-scope</span>{' '}
                    <span className="text-mut/60">--explore</span>
                  </p>
                  <p className="mt-4 text-ink">{t.browse.emptyBody}</p>
                  <div className="mt-5 flex flex-col gap-1.5 text-[13px]">
                    <p>
                      <span className="text-mint">$</span> open <span className="text-sky">&lt;login&gt;</span>
                      <span className="text-mut/60"> # {t.browse.emptyL1}</span>
                    </p>
                  </div>
                  <p className="mt-5">
                    <span className="text-mint">{t.browse.ready}</span>
                    <span className="caret" aria-hidden="true" />
                  </p>
                </div>
              </section>
            )}

            {busy && !profile && (
              <section className="grid gap-6 lg:grid-cols-[330px_1fr]">
                <div className="flex flex-col gap-4 rounded-xl border border-line bg-panel/60 p-5">
                  <div className="flex items-center gap-4">
                    <div className="shimmer h-20 w-20 rounded-xl" />
                    <div className="flex flex-1 flex-col gap-2">
                      <div className="shimmer h-5 w-3/4 rounded" />
                      <div className="shimmer h-4 w-1/2 rounded" />
                    </div>
                  </div>
                  <div className="shimmer h-4 w-full rounded" />
                  <div className="shimmer h-16 w-full rounded-lg" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-3 rounded-xl border border-line bg-panel/60 p-4">
                      <div className="shimmer h-5 w-2/3 rounded" />
                      <div className="shimmer h-4 w-full rounded" />
                      <div className="shimmer mt-auto h-3 w-1/2 rounded" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {profile && (
              <section className="grid items-start gap-6 lg:grid-cols-[330px_1fr]">
                <aside className="flex flex-col gap-5 rounded-xl border border-line bg-panel/85 p-5 shadow-soft lg:sticky lg:top-20">
                  <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                      <div className="absolute -inset-1.5 rounded-2xl bg-amber/15 blur-md" aria-hidden="true" />
                      <img
                        src={profile.user.avatar_url}
                        alt={`${profile.user.login} avatar`}
                        loading="lazy"
                        className="relative h-20 w-20 rounded-xl border border-line object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <h2 className="break-words font-display text-2xl font-bold leading-tight">
                        {profile.user.name || profile.user.login}
                      </h2>
                      <a
                        href={profile.user.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-sm text-mint transition-colors hover:text-amber hover:underline"
                      >
                        @{profile.user.login}
                      </a>
                    </div>
                  </div>

                  {profile.user.bio && <p className="-mt-1 text-sm leading-relaxed text-mut">{profile.user.bio}</p>}

                  <div className="flex flex-col gap-2">
                    {profile.user.company && (
                      <div className="flex items-center gap-2.5 text-sm text-mut">
                        <IconBuilding size={14} className="shrink-0 text-mut/70" />
                        <span className="truncate">{profile.user.company}</span>
                      </div>
                    )}
                    {profile.user.location && (
                      <div className="flex items-center gap-2.5 text-sm text-mut">
                        <IconPin size={14} className="shrink-0 text-mut/70" />
                        <span className="truncate">{profile.user.location}</span>
                      </div>
                    )}
                    {profile.user.blog && (
                      <div className="flex items-center gap-2.5 text-sm text-mut">
                        <IconLink size={14} className="shrink-0 text-mut/70" />
                        <a
                          href={/^https?:\/\//i.test(profile.user.blog) ? profile.user.blog : `https://${profile.user.blog}`}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-sky transition-colors hover:text-amber"
                        >
                          {profile.user.blog}
                        </a>
                      </div>
                    )}
                    {profile.user.twitter_username && (
                      <div className="flex items-center gap-2.5 text-sm text-mut">
                        <IconAt size={14} className="shrink-0 text-mut/70" />
                        <span className="truncate">@{profile.user.twitter_username}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2.5 text-sm text-mut">
                      <IconCalendar size={14} className="shrink-0 text-mut/70" />
                      <span>
                        {t.profile.since} {monthYear(profile.user.created_at, locale)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 divide-x divide-line rounded-lg border border-line bg-bg/40">
                    {[
                      [profile.user.public_repos, t.profile.repos, 'text-amber'],
                      [profile.user.followers, t.profile.followers, 'text-mint'],
                      [profile.user.following, t.profile.following, 'text-sky'],
                    ].map(([v, l, c]) => (
                      <div key={l as string} className="px-2 py-3 text-center">
                        <div className={`font-mono text-lg font-semibold tnum ${c}`}>{fullNum(v as number)}</div>
                        <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-mut">{l}</div>
                      </div>
                    ))}
                  </div>

                  {profile.repos.length > 0 && (
                    <div className="flex flex-col gap-2.5">
                      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-mut">{t.profile.spread}</div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-raise">
                        {(() => {
                          const m = new Map<string, number>();
                          for (const r of profile.repos) if (r.language) m.set(r.language, (m.get(r.language) ?? 0) + 1);
                          return [...m.entries()]
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 8)
                            .map(([name, count], i) => (
                              <span
                                key={name}
                                className="lang-seg h-full"
                                style={{
                                  width: `${(count / profile.repos.length) * 100}%`,
                                  background: langColor(name),
                                  animationDelay: `${i * 70}ms`,
                                }}
                                title={`${name}: ${count}`}
                              />
                            ));
                        })()}
                      </div>
                    </div>
                  )}
                </aside>

                <div className="flex min-w-0 flex-col gap-4">
                  <div className="flex flex-col gap-3 rounded-xl border border-line bg-panel/85 p-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <h2 className="font-display text-xl font-bold">
                        {t.browse.repos}
                        <span className="ml-2 font-mono text-sm font-medium text-mut tnum">{filtered.length}</span>
                        {filtered.length !== profile.repos.length && (
                          <span className="font-mono text-sm font-medium text-mut/60 tnum"> / {profile.repos.length}</span>
                        )}
                      </h2>
                      <span className="font-mono text-xs text-mut">
                        <span className="text-amber tnum">{totalStars.toLocaleString('en-US')}</span> {t.browse.earned}
                      </span>
                      <button
                        type="button"
                        onClick={exportJson}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 font-mono text-[11px] text-mut transition-all duration-200 hover:-translate-y-px hover:border-sky/60 hover:text-sky"
                      >
                        <IconDownload size={13} /> {t.browse.exportJson}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-line bg-bg/50 px-3 py-2 transition-colors duration-300 focus-within:border-amber/60">
                        <IconSearch size={14} className="shrink-0 text-mut" />
                        <input
                          id="repo-search"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder={t.browse.filterPh}
                          aria-label={t.browse.filterPh}
                          className="w-full min-w-0 bg-transparent font-mono text-xs text-ink outline-none placeholder:text-mut/50"
                        />
                        {query && (
                          <button type="button" onClick={() => setQuery('')} className="font-mono text-[11px] text-mut hover:text-coral">
                            {t.browse.filterClear}
                          </button>
                        )}
                      </div>

                      <div className="relative">
                        <select
                          value={sort}
                          onChange={(e) => setSort(e.target.value as typeof sort)}
                          aria-label={t.browse.sortAria}
                          className="appearance-none rounded-lg border border-line bg-bg/50 py-2 pl-3 pr-8 font-mono text-xs text-mut outline-none transition-colors hover:border-amber/50 focus:border-amber/60"
                        >
                          <option value="pushed">{t.browse.sortPushed}</option>
                          <option value="stars">{t.browse.sortStars}</option>
                          <option value="created">{t.browse.sortCreated}</option>
                          <option value="name">{t.browse.sortName}</option>
                        </select>
                        <IconChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-mut" />
                      </div>

                      <div className="relative">
                        <select
                          value={langFilter}
                          onChange={(e) => setLangFilter(e.target.value)}
                          aria-label={t.browse.langAria}
                          className="appearance-none rounded-lg border border-line bg-bg/50 py-2 pl-3 pr-8 font-mono text-xs text-mut outline-none transition-colors hover:border-amber/50 focus:border-amber/60"
                        >
                          <option value="all">{t.browse.langAll}</option>
                          {languages.map((l) => (
                            <option key={l} value={l}>
                              {l}
                            </option>
                          ))}
                        </select>
                        <span
                          className="pointer-events-none absolute left-1.5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
                          style={{ background: langFilter === 'all' ? 'transparent' : langColor(langFilter) }}
                          aria-hidden="true"
                        />
                        <IconChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-mut" />
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowForks((v) => !v)}
                        aria-pressed={!showForks}
                        className={`rounded-lg border px-2.5 py-2 font-mono text-xs transition-all duration-200 ${
                          !showForks ? 'border-amber/60 bg-amber/10 text-amber' : 'border-line text-mut hover:border-amber/40 hover:text-ink'
                        }`}
                      >
                        {t.browse.hideForks}
                      </button>
                    </div>
                  </div>

                  {filtered.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line bg-panel/50 p-10 text-center">
                      <p className="font-mono text-sm text-mut">{t.browse.noMatch}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setQuery('');
                          setLangFilter('all');
                          setShowForks(true);
                        }}
                        className="rounded-lg border border-line px-3 py-1.5 font-mono text-xs text-mut transition-colors hover:border-amber/60 hover:text-amber"
                      >
                        {t.browse.reset}
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2" key={`${profile.user.login}-${sort}-${langFilter}-${showForks}`}>
                      {filtered.map((r, i) => (
                        <RepoCard
                          key={r.id}
                          repo={r}
                          index={i}
                          onReadme={setReadmeFor}
                          bookmarked={bookmarkedIds.has(r.id)}
                          onToggleBookmark={toggleBookmark}
                          onOpenOwner={openOwner}
                          onCollect={setPickFor}
                          watched={watchedFulls.has(r.full_name)}
                          onWatch={toggleWatch}
                        />
                      ))}
                    </div>
                  )}

                  {profile.repos.length >= 100 && (
                    <p className="text-center font-mono text-[11px] text-mut/70">{t.browse.apiCap}</p>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <footer className="relative z-10 border-t border-line py-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 font-mono text-[11px] text-mut/70 sm:px-6">
          <span>
            {t.footer.data} <span className="text-sky">api.github.com</span>
          </span>
          <span className="ml-auto">
            <kbd>/</kbd> {t.footer.kSearch} · <kbd>esc</kbd> {t.footer.kClose} · {t.footer.kStore}
          </span>
        </div>
      </footer>

      {readmeFor && <ReadmeModal repo={readmeFor} token={null} onClose={() => setReadmeFor(null)} />}

      {pickFor && (
        <CollectionPicker
          repo={pickFor}
          collections={collections}
          onClose={() => setPickFor(null)}
          onAdd={(colId) => {
            toggleInCollection(colId, pickFor);
            setPickFor(null);
          }}
          onCreateAndAdd={(name) => createAndAdd(name, pickFor)}
        />
      )}
    </div>
  );
}
