import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { GHRelease, GHRepoDetail } from '../lib/github';
import { GHError, compactNum, fetchLatestRelease, fetchRepoDetail, langColor, relTime } from '../lib/github';
import { Reveal } from '../lib/hooks';
import { useT } from '../lib/i18n';
import { IconAlert, IconRadar, IconTag, IconTrash, IconTrophy } from './Icons';

export interface WatchEntry {
  fullName: string;
  name: string;
  owner: string;
  language: string | null;
  htmlUrl: string;
  addedAt: string;
  capturedAt: string;
  stars: number;
  forks: number;
  pushedAt: string;
  dStars: number | null;
  dForks: number | null;
  newPush: boolean;
  history: Array<{ t: string; stars: number }>;
}

interface LiveRelease {
  fullName: string;
  release: GHRelease | null;
}

export function WatchtowerView({
  entries,
  onPersist,
  onRemove,
  onOpenDetail,
  onOpenOwner,
}: {
  entries: WatchEntry[];
  onPersist: (next: WatchEntry[]) => void;
  onRemove: (fullName: string) => void;
  onOpenDetail: (fullName: string) => void;
  onOpenOwner: (login: string) => void;
}) {
  const t = useT();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<GHError | null>(null);
  const [releases, setReleases] = useState<Record<string, GHRelease | null>>({});
  const [sweeping, setSweeping] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  /* arm: add a repo to the watch list */
  const arm = async (e: FormEvent) => {
    e.preventDefault();
    const full = input.trim();
    if (!full.includes('/') || busy) return;
    setBusy(true);
    setError(null);
    try {
      const d = await fetchRepoDetail(full, null);
      const now = new Date().toISOString();
      const entry: WatchEntry = {
        fullName: d.full_name,
        name: d.name,
        owner: d.full_name.split('/')[0],
        language: d.language,
        htmlUrl: d.html_url,
        addedAt: now,
        capturedAt: now,
        stars: d.stargazers_count,
        forks: d.forks_count,
        pushedAt: d.pushed_at,
        dStars: null,
        dForks: null,
        newPush: false,
        history: [{ t: now, stars: d.stargazers_count }],
      };
      onPersist([entry, ...entries.filter((w) => w.fullName !== d.full_name)]);
      setInput('');
    } catch (err) {
      setError(err instanceof GHError ? err : new GHError(0, t.err.net));
    } finally {
      setBusy(false);
    }
  };

  /* rescan: refresh stats + latest releases, compute deltas */
  const scan = useCallback(async () => {
    if (entries.length === 0 || sweeping) return;
    setSweeping(true);
    setError(null);
    try {
      const details = await Promise.allSettled(entries.map((w) => fetchRepoDetail(w.fullName, null)));
      const rels = await Promise.allSettled(entries.map((w) => fetchLatestRelease(w.fullName, null)));
      const now = new Date().toISOString();
      const relMap: Record<string, GHRelease | null> = {};
      const next = entries.map((w, i) => {
        const dr = details[i];
        const rr = rels[i];
        relMap[w.fullName] = rr.status === 'fulfilled' ? rr.value : null;
        if (dr.status !== 'fulfilled') return w;
        const d = dr.value;
        const hist = [...w.history, { t: now, stars: d.stargazers_count }].slice(-40);
        return {
          ...w,
          capturedAt: now,
          stars: d.stargazers_count,
          forks: d.forks_count,
          dStars: d.stargazers_count - w.stars,
          dForks: d.forks_count - w.forks,
          newPush: Date.parse(d.pushed_at) > Date.parse(w.pushedAt),
          pushedAt: d.pushed_at,
          history: hist,
        };
      });
      if (aliveRef.current) {
        onPersist(next);
        setReleases(relMap);
      }
    } catch (err) {
      setError(err instanceof GHError ? err : new GHError(0, t.err.net));
    } finally {
      if (aliveRef.current) setSweeping(false);
    }
  }, [entries, sweeping, onPersist, t]);

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <section className="overflow-hidden rounded-xl border border-line bg-panel/85 shadow-soft">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-coral/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-mint/70" />
            <span className="ml-2 flex items-center gap-1.5 font-mono text-[11px] text-mut">
              <IconRadar size={13} className="pulse-dot rounded-full text-mint" /> {t.watchtower.title} · {t.watchtower.sub}
            </span>
          </div>
          <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:p-5">
            <form onSubmit={arm} className="flex flex-1 gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t.watchtower.ph}
                spellCheck={false}
                autoCapitalize="none"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-lg border border-line bg-bg/60 px-3 py-2.5 font-mono text-sm text-mint caret-mint outline-none transition-colors placeholder:text-mut/50 focus:border-mint/60"
              />
              <button
                type="submit"
                disabled={busy || !input.includes('/')}
                className="rounded-lg border border-mint/50 bg-mint/10 px-4 py-2.5 font-mono text-xs font-semibold text-mint transition-all duration-200 hover:border-mint hover:bg-mint/20 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? t.watchtower.arming : t.watchtower.arm}
              </button>
            </form>
            {entries.length > 0 && (
              <button
                type="button"
                onClick={() => void scan()}
                disabled={sweeping}
                className="rounded-lg border border-line px-4 py-2.5 font-mono text-xs text-mut transition-colors hover:border-sky/60 hover:text-sky disabled:opacity-50"
              >
                {sweeping ? t.watchtower.scanning : t.watchtower.scan}
              </button>
            )}
          </div>
        </section>
      </Reveal>

      {error && (
        <Reveal>
          <div className="flex items-center gap-3 rounded-xl border border-coral/40 bg-coral/10 p-4">
            <IconAlert size={18} className="shrink-0 text-coral" />
            <p className="flex-1 text-sm text-mut">{error.message}</p>
          </div>
        </Reveal>
      )}

      {entries.length === 0 && !error ? (
        <Reveal delay={100}>
          <p className="text-center font-mono text-sm text-mut/60">{t.watchtower.empty}</p>
        </Reveal>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {entries.map((w, i) => {
            const rel = releases[w.fullName];
            return (
              <Reveal key={w.fullName} delay={(i % 4) * 60}>
                <article className="card-lift group relative flex h-full flex-col gap-3 overflow-hidden rounded-xl border border-line bg-panel/70 p-4 pl-5 hover:border-mint/40">
                  <span
                    aria-hidden="true"
                    className="absolute bottom-3 left-0 top-3 w-[3px] rounded-full"
                    style={{ background: langColor(w.language) }}
                  />
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenDetail(w.fullName)}
                      className="min-w-0 flex-1 break-all text-left font-mono text-[15px] font-medium text-ink transition-colors hover:text-amber"
                    >
                      {w.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(w.fullName)}
                      aria-label={`${t.watchtower.remove}: ${w.fullName}`}
                      className="rounded-md border border-transparent p-1 text-mut transition-colors hover:border-coral/50 hover:bg-coral/10 hover:text-coral"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenOwner(w.owner)}
                    className="self-start font-mono text-xs text-mut/70 transition-colors hover:text-mint"
                  >
                    @{w.owner}
                  </button>

                  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-xs text-mut">
                    <span className="inline-flex items-center gap-1.5 tnum">
                      <IconTrophy size={13} className="text-amber" />
                      ★ {compactNum(w.stars)}
                      {w.dStars !== null && w.dStars !== 0 && (
                        <span className={w.dStars > 0 ? 'text-mint' : 'text-coral'}>
                          {w.dStars > 0 ? `+${w.dStars}` : w.dStars}
                        </span>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1.5 tnum">
                      <IconTag size={13} className="text-sky" />
                      {rel ? rel.tag_name : t.radar.noRel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between font-mono text-[10px] text-mut/60">
                    <span>{rel ? relTime(rel.published_at) : ''}</span>
                    {w.newPush && <span className="text-mint">{t.watchtower.new}</span>}
                  </div>

                  {/* mini sparkline of star history */}
                  {w.history.length > 1 && (
                    <Sparkline data={w.history.map((h) => h.stars)} />
                  )}
                </article>
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const W = 100;
  const H = 24;
  const pts = data
    .map((v, i) => `${((i / (data.length - 1)) * W).toFixed(1)},${(H - ((v - min) / range) * (H - 2) - 1).toFixed(1)}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-6 w-full" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="var(--color-amber)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
