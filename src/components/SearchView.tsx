import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { GHRepo } from '../lib/github';
import { GHError, LANG_COLORS, fullNum, searchRepos } from '../lib/github';
import { useT } from '../lib/i18n';
import { RepoCard } from './RepoCard';
import { IconAlert, IconCheck, IconChevronDown, IconCopy, IconSearch } from './Icons';

const PER_PAGE = 24;

interface Filters {
  text: string;
  lang: string;
  minStars: string;
  updated: string;
  created: string;
  license: string;
  topic: string;
  owner: string;
  sort: string;
  order: 'desc' | 'asc';
  hideForks: boolean;
  hideArchived: boolean;
}

const DEFAULTS: Filters = {
  text: '',
  lang: '',
  minStars: '',
  updated: '',
  created: '',
  license: '',
  topic: '',
  owner: '',
  sort: '',
  order: 'desc',
  hideForks: true,
  hideArchived: true,
};

const LICENSES = ['mit', 'apache-2.0', 'gpl-3.0', 'bsd-3-clause', 'mpl-2.0', 'lgpl-3.0', 'agpl-3.0', 'unlicense', 'cc0-1.0'];

function dateAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function buildQuery(f: Filters): string {
  const parts: string[] = [];
  const text = f.text.trim();
  if (text) parts.push(text);
  if (f.lang) parts.push(`language:${f.lang}`);
  if (f.minStars) parts.push(`stars:>=${f.minStars}`);
  if (f.updated) parts.push(`pushed:>${dateAgo(Number(f.updated))}`);
  if (f.created) parts.push(`created:>${dateAgo(Number(f.created))}`);
  if (f.license) parts.push(`license:${f.license}`);
  if (f.topic.trim()) parts.push(`topic:${f.topic.trim()}`);
  if (f.owner.trim()) parts.push(`user:${f.owner.trim()}`);
  if (f.hideArchived) parts.push('archived:false');
  return parts.join(' ') || 'stars:>0';
}

interface Result {
  total: number;
  items: GHRepo[];
  page: number;
  q: string;
}

interface Props {
  token: string | null;
  onOpenDetail: (fullName: string) => void;
  onOpenOwner: (login: string) => void;
  bookmarkedIds: Set<number>;
  onToggleBookmark: (repo: GHRepo) => void;
  onReadme: (repo: GHRepo) => void;
}

const labelCls = 'block font-mono text-[10px] uppercase tracking-[0.14em] text-mut/70 mb-1';
const fieldCls =
  'w-full rounded-lg border border-line bg-bg/60 px-3 py-2 font-mono text-xs text-ink outline-none transition-colors placeholder:text-mut/40 focus:border-amber/60';
const selectCls =
  'w-full appearance-none rounded-lg border border-line bg-bg/60 px-3 py-2 pr-8 font-mono text-xs text-mut outline-none transition-colors hover:border-amber/50 focus:border-amber/60';

export function SearchView({ token, onOpenDetail, onOpenOwner, bookmarkedIds, onToggleBookmark, onReadme }: Props) {
  const t = useT();
  const [filters, setFilters] = useState<Filters>(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<GHError | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  const run = async (f: Filters, p: number) => {
    setBusy(true);
    setError(null);
    try {
      const q = buildQuery(f);
      const res = await searchRepos(q, f.sort, f.order, p, PER_PAGE, token);
      const items = f.hideForks ? res.items.filter((r) => !r.fork) : res.items;
      setResult({ total: res.total_count, items, page: p, q });
      setPage(p);
    } catch (e) {
      setError(e instanceof GHError ? e : new GHError(0, 'Network error.'));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(filters, 1);
  };

  const query = buildQuery(filters);

  const copyQuery = async () => {
    try {
      await navigator.clipboard.writeText(query);
      setCopied(true);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* noop */
    }
  };

  useEffect(
    () => () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    },
    [],
  );

  const langs = useMemo(() => Object.keys(LANG_COLORS).sort(), []);
  const totalPages = result ? Math.min(Math.ceil(result.total / PER_PAGE), Math.floor(1000 / PER_PAGE)) : 0;

  const presets: Array<{ label: string; patch: Partial<Filters> }> = [
    { label: 'Python CLI ★≥1k', patch: { ...DEFAULTS, text: 'cli', lang: 'Python', minStars: '1000', sort: 'stars' } },
    { label: 'fresh TypeScript', patch: { ...DEFAULTS, lang: 'TypeScript', updated: '7', sort: 'updated' } },
    { label: 'ML ★≥5k', patch: { ...DEFAULTS, text: 'machine learning', minStars: '5000', sort: 'stars' } },
    { label: 'Rust this year', patch: { ...DEFAULTS, lang: 'Rust', created: '365', sort: 'stars' } },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* query builder */}
      <section className="overflow-hidden rounded-xl border border-line bg-panel/85 shadow-soft">
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-coral/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-mint/70" />
          <span className="ml-2 font-mono text-[11px] text-mut">{t.search.window}</span>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4 p-4 sm:p-5">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight">
              {t.search.title}
              <span className="caret ml-2" aria-hidden="true" />
            </h1>
            <p className="mt-1 text-sm text-mut">{t.search.sub}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-2">
              <label className={labelCls} htmlFor="sq-text">
                {t.search.textLbl}
              </label>
              <input
                id="sq-text"
                value={filters.text}
                onChange={(e) => set({ text: e.target.value })}
                placeholder={t.search.textPh}
                className={fieldCls}
                autoComplete="off"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="sq-lang">
                {t.search.langLbl}
              </label>
              <div className="relative">
                <input
                  id="sq-lang"
                  list="sq-langs"
                  value={filters.lang}
                  onChange={(e) => set({ lang: e.target.value })}
                  placeholder={t.search.any}
                  className={fieldCls}
                  autoComplete="off"
                />
                <datalist id="sq-langs">
                  {langs.map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </div>
            </div>
            <div>
              <label className={labelCls} htmlFor="sq-stars">
                {t.search.starsLbl}
              </label>
              <input
                id="sq-stars"
                value={filters.minStars}
                onChange={(e) => set({ minStars: e.target.value.replace(/[^\d]/g, '') })}
                placeholder={t.search.starsPh}
                className={fieldCls}
                inputMode="numeric"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="sq-updated">
                {t.search.updatedLbl}
              </label>
              <div className="relative">
                <select id="sq-updated" value={filters.updated} onChange={(e) => set({ updated: e.target.value })} className={selectCls}>
                  <option value="">{t.search.presetAny}</option>
                  <option value="7">{t.search.presetWeek}</option>
                  <option value="30">{t.search.presetMonth}</option>
                  <option value="365">{t.search.presetYear}</option>
                </select>
                <IconChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-mut" />
              </div>
            </div>
            <div>
              <label className={labelCls} htmlFor="sq-created">
                {t.search.createdLbl}
              </label>
              <div className="relative">
                <select id="sq-created" value={filters.created} onChange={(e) => set({ created: e.target.value })} className={selectCls}>
                  <option value="">{t.search.presetAny}</option>
                  <option value="7">{t.search.presetWeek}</option>
                  <option value="30">{t.search.presetMonth}</option>
                  <option value="365">{t.search.presetYear}</option>
                </select>
                <IconChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-mut" />
              </div>
            </div>
            <div>
              <label className={labelCls} htmlFor="sq-lic">
                {t.search.licLbl}
              </label>
              <div className="relative">
                <select id="sq-lic" value={filters.license} onChange={(e) => set({ license: e.target.value })} className={selectCls}>
                  <option value="">{t.search.any}</option>
                  {LICENSES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
                <IconChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-mut" />
              </div>
            </div>
            <div>
              <label className={labelCls} htmlFor="sq-topic">
                {t.search.topicLbl}
              </label>
              <input
                id="sq-topic"
                value={filters.topic}
                onChange={(e) => set({ topic: e.target.value })}
                placeholder={t.search.topicPh}
                className={fieldCls}
                autoComplete="off"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="sq-owner">
                {t.search.ownerLbl}
              </label>
              <input
                id="sq-owner"
                value={filters.owner}
                onChange={(e) => set({ owner: e.target.value })}
                placeholder={t.search.ownerPh}
                className={fieldCls}
                autoComplete="off"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="sq-sort">
                {t.search.sortLbl}
              </label>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <select id="sq-sort" value={filters.sort} onChange={(e) => set({ sort: e.target.value })} className={selectCls}>
                    <option value="">{t.search.sortBest}</option>
                    <option value="stars">{t.search.sortStars}</option>
                    <option value="forks">{t.search.sortForks}</option>
                    <option value="updated">{t.search.sortUpdated}</option>
                  </select>
                  <IconChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-mut" />
                </div>
                <button
                  type="button"
                  onClick={() => set({ order: filters.order === 'desc' ? 'asc' : 'desc' })}
                  title={filters.order === 'desc' ? t.search.desc : t.search.asc}
                  className={`shrink-0 rounded-lg border px-2 py-2 font-mono text-[10px] transition-colors ${
                    filters.order === 'asc' ? 'border-amber/60 bg-amber/10 text-amber' : 'border-line text-mut hover:text-ink'
                  }`}
                >
                  {filters.order === 'desc' ? '↓' : '↑'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 font-mono text-xs text-mut">
              <input
                type="checkbox"
                checked={filters.hideForks}
                onChange={(e) => set({ hideForks: e.target.checked })}
                className="h-3.5 w-3.5 accent-amber"
              />
              {t.search.hideForks}
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 font-mono text-xs text-mut">
              <input
                type="checkbox"
                checked={filters.hideArchived}
                onChange={(e) => set({ hideArchived: e.target.checked })}
                className="h-3.5 w-3.5 accent-amber"
              />
              {t.search.hideArchived}
            </label>
            <span className="mx-1 hidden h-4 w-px bg-line sm:block" />
            {presets.map((p, i) => (
              <button
                key={i}
                type="button"
                disabled={busy}
                onClick={() => setFilters({ ...DEFAULTS, ...p.patch })}
                className="rounded-md border border-line px-2.5 py-1 font-mono text-[11px] text-mut transition-all duration-200 hover:-translate-y-px hover:border-mint/60 hover:text-mint disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* generated query */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line/70 bg-bg/50 px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mut/70">{t.search.queryLbl}</span>
            <code className="min-w-0 flex-1 break-all font-mono text-xs text-sky">{query}</code>
            <button
              type="button"
              onClick={() => void copyQuery()}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line px-2 py-1 font-mono text-[10px] text-mut transition-colors hover:border-mint/60 hover:text-mint"
            >
              {copied ? <IconCheck size={11} className="text-mint" /> : <IconCopy size={11} />}
              {copied ? t.search.copied : t.search.copyQ}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-amber/50 bg-amber/10 px-4 py-2 font-mono text-xs font-semibold text-amber transition-all duration-200 hover:border-amber hover:bg-amber/20 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
            >
              <IconSearch size={13} />
              {busy ? t.search.searching : t.search.run}
              <kbd>↵</kbd>
            </button>
            <button
              type="button"
              onClick={() => {
                setFilters(DEFAULTS);
                setResult(null);
              }}
              className="rounded-lg border border-line px-3 py-2 font-mono text-xs text-mut transition-colors hover:border-coral/60 hover:text-coral"
            >
              {t.search.reset}
            </button>
            <span className="ml-auto font-mono text-[10px] text-mut/60">{t.search.rateNote}</span>
          </div>
        </form>
      </section>

      {error && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-coral/40 bg-coral/10 p-5 sm:flex-row sm:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-coral/40 bg-coral/10 text-coral">
            <IconAlert size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-sm font-semibold text-coral">{t.search.errTitle}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-mut">
              {error.status === 403 || error.status === 429 ? t.search.rateLimited : error.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void run(filters, page)}
            className="shrink-0 rounded-lg border border-coral/50 px-3.5 py-2 font-mono text-xs text-coral transition-all duration-200 hover:border-coral hover:bg-coral/15"
          >
            {t.search.retry}
          </button>
        </div>
      )}

      {busy && (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-xl border border-line bg-panel/60 p-4">
              <div className="shimmer h-5 w-2/3 rounded" />
              <div className="shimmer h-4 w-full rounded" />
              <div className="shimmer mt-auto h-3 w-1/2 rounded" />
            </div>
          ))}
        </div>
      )}

      {result && !busy && (
        <div className="flex flex-col gap-4">
          <p className="font-mono text-xs text-mut">
            <span className="text-amber tnum">{fullNum(Math.min(result.total, 1000))}</span> {t.search.results}
            {result.total > 1000 && <span className="ml-2 text-mut/60">· {t.search.tooMany}</span>}
          </p>

          {result.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-panel/50 p-10 text-center font-mono text-sm text-mut">
              {t.search.none}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {result.items.map((r, i) => (
                <RepoCard
                  key={r.id}
                  repo={r}
                  index={i}
                  onReadme={onReadme}
                  bookmarked={bookmarkedIds.has(r.id)}
                  onToggleBookmark={onToggleBookmark}
                  onOpenOwner={onOpenOwner}
                  onOpenDetail={onOpenDetail}
                />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => void run(filters, page - 1)}
                className="rounded-lg border border-line px-3 py-1.5 font-mono text-xs text-mut transition-colors hover:border-amber/60 hover:text-amber disabled:opacity-40"
              >
                {t.search.prev}
              </button>
              <span className="font-mono text-xs text-mut tnum">
                {t.search.page} {page}/{totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => void run(filters, page + 1)}
                className="rounded-lg border border-line px-3 py-1.5 font-mono text-xs text-mut transition-colors hover:border-amber/60 hover:text-amber disabled:opacity-40"
              >
                {t.search.next}
              </button>
            </div>
          )}
        </div>
      )}

      {!result && !busy && !error && (
        <section className="rounded-xl border border-dashed border-line bg-panel/50 p-8 sm:p-12">
          <div className="mx-auto max-w-xl font-mono text-sm leading-loose text-mut">
            <p>
              <span className="text-mint">$</span> <span className="text-amber">gh-scope search</span>{' '}
              <span className="text-mut/60">--build-query</span>
            </p>
            <p className="mt-4 text-ink">
              language:python + stars:&gt;=1000 + pushed:&gt;last-year — all at once. Combine any filters and watch the
              query assemble itself.
            </p>
            <p className="mt-5">
              <span className="text-mint">ready</span>
              <span className="caret" aria-hidden="true" />
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
