import { useEffect, useMemo, useRef, useState } from 'react';
import type { GHRepo } from '../lib/github';
import { GHError, compactNum, langColor, searchRepos } from '../lib/github';
import { Reveal } from '../lib/hooks';
import { useT } from '../lib/i18n';
import { RepoCard } from './RepoCard';
import { IconAlert, IconFlame } from './Icons';

const PER_PAGE = 18;
const LANGS = ['Python', 'TypeScript', 'JavaScript', 'Rust', 'Go', 'Java', 'Kotlin', 'C++', 'C#', 'Shell', 'Ruby', 'PHP', 'Dart', 'Swift'];

function dateAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function ageDays(iso: string): number {
  return Math.max(1, (Date.now() - Date.parse(iso)) / 86400000);
}

export function DiscoverView({
  onOpenDetail,
  onOpenOwner,
  bookmarkedIds,
  onToggleBookmark,
  onReadme,
}: {
  onOpenDetail: (fullName: string) => void;
  onOpenOwner: (login: string) => void;
  bookmarkedIds: Set<number>;
  onToggleBookmark: (repo: GHRepo) => void;
  onReadme: (repo: GHRepo) => void;
}) {
  const t = useT();
  const [mode, setMode] = useState<'rising' | 'hot'>('rising');
  const [span, setSpan] = useState('7');
  const [lang, setLang] = useState('');
  const [minStars, setMinStars] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<GHError | null>(null);
  const [items, setItems] = useState<GHRepo[] | null>(null);
  const pageRef = useRef(1);
  const debRef = useRef<number | null>(null);
  const firstRun = useRef(true);

  const query = useMemo(() => {
    const parts: string[] = [];
    if (lang) parts.push(`language:${lang}`);
    if (minStars) parts.push(`stars:>=${minStars}`);
    parts.push(mode === 'rising' ? `created:>${dateAgo(Number(span))}` : `pushed:>${dateAgo(Number(span))}`);
    return parts.join(' ');
  }, [mode, span, lang, minStars]);

  const scan = async (page: number, append: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const res = await searchRepos(query, mode === 'rising' ? 'stars' : '', 'desc', page, PER_PAGE, null);
      pageRef.current = page;
      setItems((prev) => (append && prev ? [...prev, ...res.items] : res.items));
    } catch (err) {
      setError(err instanceof GHError ? err : new GHError(0, t.err.net));
      if (!append) setItems(null);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      void scan(1, false);
      return;
    }
    if (debRef.current) window.clearTimeout(debRef.current);
    debRef.current = window.setTimeout(() => void scan(1, false), 500);
    return () => {
      if (debRef.current) window.clearTimeout(debRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const ranked = useMemo(() => {
    if (!items) return [];
    return [...items]
      .map((r) => ({ r, vel: r.stargazers_count / ageDays(r.created_at) }))
      .sort((a, b) => b.vel - a.vel);
  }, [items]);

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <section className="overflow-hidden rounded-xl border border-line bg-panel/85 shadow-soft">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-coral/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-mint/70" />
            <span className="ml-2 flex items-center gap-1.5 font-mono text-[11px] text-mut">
              <IconFlame size={13} className="text-coral" /> {t.discover.title} · {t.discover.sub}
            </span>
            {busy && <span className="ml-auto font-mono text-[11px] text-amber">{t.discover.scanning}</span>}
          </div>
          <div className="flex flex-col gap-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-line bg-bg/50 p-1">
                {(['rising', 'hot'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    aria-pressed={mode === m}
                    className={`rounded-md px-3 py-1.5 font-mono text-xs transition-colors ${mode === m ? 'bg-coral/15 text-coral' : 'text-mut hover:text-ink'}`}
                  >
                    {m === 'rising' ? t.discover.modeRising : t.discover.modeHot}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-line bg-bg/50 p-1">
                {['1', '7', '30'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSpan(d)}
                    aria-pressed={span === d}
                    className={`rounded-md px-2.5 py-1.5 font-mono text-xs transition-colors ${span === d ? 'bg-mint/15 text-mint' : 'text-mut hover:text-ink'}`}
                  >
                    {d === '1' ? t.discover.d1 : d === '7' ? t.discover.d7 : t.discover.d30}
                  </button>
                ))}
              </div>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                aria-label={t.discover.langAria}
                className="rounded-lg border border-line bg-bg/50 px-3 py-2 font-mono text-xs text-mut outline-none focus:border-amber/60"
              >
                <option value="">{t.discover.langAny}</option>
                {LANGS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <select
                value={minStars}
                onChange={(e) => setMinStars(e.target.value)}
                aria-label={t.discover.minStars}
                className="rounded-lg border border-line bg-bg/50 px-3 py-2 font-mono text-xs text-mut outline-none focus:border-amber/60"
              >
                <option value="">{t.discover.minStars}: {t.discover.any}</option>
                {['50', '250', '1000', '5000'].map((s) => (
                  <option key={s} value={s}>★ ≥ {s}</option>
                ))}
              </select>
            </div>
            <p className="font-mono text-[11px] text-mut/70">
              <span className="text-mint">$</span> search <span className="text-sky">“{query}”</span>
            </p>
          </div>
        </section>
      </Reveal>

      {error && (
        <Reveal>
          <div className="flex items-center gap-3 rounded-xl border border-coral/40 bg-coral/10 p-4">
            <IconAlert size={18} className="shrink-0 text-coral" />
            <p className="flex-1 text-sm text-mut">{error.message}</p>
            <button type="button" onClick={() => void scan(1, false)} className="rounded-lg border border-coral/50 px-3 py-1.5 font-mono text-xs text-coral hover:bg-coral/15">
              {t.discover.retry}
            </button>
          </div>
        </Reveal>
      )}

      {busy && !items ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-xl border border-line bg-panel/60 p-4">
              <div className="shimmer h-5 w-2/3 rounded" />
              <div className="shimmer h-4 w-full rounded" />
              <div className="shimmer h-4 w-1/2 rounded" />
            </div>
          ))}
        </div>
      ) : ranked.length === 0 ? (
        <Reveal delay={100}>
          <div className="text-center">
            <p className="font-mono text-sm text-mut">{t.discover.none}</p>
            <p className="mt-1 font-mono text-xs text-mut/60">{t.discover.noneHint}</p>
          </div>
        </Reveal>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {ranked.map(({ r, vel }, i) => (
              <div key={r.id} className="relative">
                <span className="absolute -top-2 left-3 z-10 inline-flex items-center gap-1 rounded-md border border-coral/40 bg-bg px-2 py-0.5 font-mono text-[10px] font-semibold text-coral">
                  <IconFlame size={10} /> {t.discover.vel(compactNum(Math.round(vel)))}
                </span>
                <RepoCard
                  repo={r}
                  index={i}
                  onReadme={onReadme}
                  bookmarked={bookmarkedIds.has(r.id)}
                  onToggleBookmark={onToggleBookmark}
                  onOpenOwner={onOpenOwner}
                  onOpenDetail={onOpenDetail}
                />
              </div>
            ))}
          </div>
          {items && items.length >= PER_PAGE * pageRef.current && (
            <button
              type="button"
              onClick={() => void scan(pageRef.current + 1, true)}
              disabled={busy}
              className="rounded-lg border border-line py-2.5 font-mono text-xs text-mut transition-colors hover:border-amber/60 hover:text-amber disabled:opacity-50"
            >
              {busy ? t.discover.loadingMore : t.discover.more}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
