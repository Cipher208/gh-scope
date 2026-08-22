import { useState, type FormEvent } from 'react';
import type { GHRepo, GHUser } from '../lib/github';
import { GHError, accountYears, fetchRepos, fetchUser, langColor } from '../lib/github';
import { Reveal, useCountUp } from '../lib/hooks';
import { useT } from '../lib/i18n';
import { IconAlert, IconScale } from './Icons';

interface Side {
  user: GHUser;
  repos: GHRepo[];
}

function langCount(repos: GHRepo[]): number {
  return new Set(repos.map((r) => r.language).filter(Boolean)).size;
}

function totalStars(repos: GHRepo[]): number {
  return repos.filter((r) => !r.fork).reduce((s, r) => s + r.stargazers_count, 0);
}

function totalForks(repos: GHRepo[]): number {
  return repos.reduce((s, r) => s + r.forks_count, 0);
}

function MetricBar({ label, a, b, fmt }: { label: string; a: number; b: number; fmt?: (n: number) => string }) {
  const max = Math.max(a, b, 1);
  const f = fmt ?? ((n: number) => n.toLocaleString('en-US'));
  return (
    <div>
      <div className="mb-1 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-mut">{label}</div>
      <div className="flex items-center gap-3">
        <span className={`w-20 text-right font-mono text-sm tnum ${a >= b ? 'text-amber' : 'text-mut'}`}>{f(a)}</span>
        <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-raise">
          <span
            className="lang-seg h-full"
            style={{ width: `${(a / max) * 50}%`, background: 'var(--color-amber)', marginLeft: 'auto', transformOrigin: 'right' }}
          />
          <span className="lang-seg h-full" style={{ width: `${(b / max) * 50}%`, background: 'var(--color-sky)' }} />
        </div>
        <span className={`w-20 font-mono text-sm tnum ${b >= a ? 'text-sky' : 'text-mut'}`}>{f(b)}</span>
      </div>
    </div>
  );
}

function SideHeader({ side, tone }: { side: Side; tone: string }) {
  return (
    <div className="flex items-center gap-3">
      <img src={side.user.avatar_url} alt={side.user.login} loading="lazy" className="h-14 w-14 rounded-xl border border-line object-cover" />
      <div className="min-w-0">
        <div className="truncate font-display text-lg font-bold">{side.user.name || side.user.login}</div>
        <a href={side.user.html_url} target="_blank" rel="noreferrer" className={`font-mono text-sm ${tone} hover:underline`}>
          @{side.user.login}
        </a>
      </div>
    </div>
  );
}

export function CompareView({ onOpenOwner }: { onOpenOwner: (login: string) => void }) {
  const t = useT();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<GHError | null>(null);
  const [left, setLeft] = useState<Side | null>(null);
  const [right, setRight] = useState<Side | null>(null);

  const run = async (e: FormEvent) => {
    e.preventDefault();
    const la = a.trim().replace(/^@/, '');
    const lb = b.trim().replace(/^@/, '');
    if (!la || !lb || busy) return;
    setBusy(true);
    setError(null);
    setLeft(null);
    setRight(null);
    try {
      const [ua, ra, ub, rb] = await Promise.all([fetchUser(la, null), fetchRepos(la, null), fetchUser(lb, null), fetchRepos(lb, null)]);
      setLeft({ user: ua, repos: ra });
      setRight({ user: ub, repos: rb });
    } catch (err) {
      setError(err instanceof GHError ? err : new GHError(0, t.err.net));
    } finally {
      setBusy(false);
    }
  };

  const score = () => {
    if (!left || !right) return null;
    const rows: Array<[number, number]> = [
      [left.repos.length, right.repos.length],
      [totalStars(left.repos), totalStars(right.repos)],
      [totalForks(left.repos), totalForks(right.repos)],
      [left.user.followers, right.user.followers],
      [accountYears(left.user.created_at), accountYears(right.user.created_at)],
      [langCount(left.repos), langCount(right.repos)],
    ];
    let aw = 0;
    let bw = 0;
    for (const [x, y] of rows) {
      if (x > y) aw += 1;
      else if (y > x) bw += 1;
    }
    return { aw, bw };
  };

  const s = score();
  const verdict =
    s && left && right
      ? s.aw === s.bw
        ? t.compare.tie
        : s.aw > s.bw
          ? t.compare.leads(left.user.login, `${s.aw}–${s.bw}`)
          : t.compare.leads(right.user.login, `${s.bw}–${s.aw}`)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <section className="overflow-hidden rounded-xl border border-line bg-panel/85 shadow-soft">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-coral/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-mint/70" />
            <span className="ml-2 flex items-center gap-1.5 font-mono text-[11px] text-mut">
              <IconScale size={13} className="text-coral" /> {t.compare.window}
            </span>
          </div>
          <form onSubmit={run} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:p-5">
            <label className="flex flex-1 flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mut/70">A</span>
              <input
                value={a}
                onChange={(e) => setA(e.target.value)}
                placeholder={t.compare.phA}
                spellCheck={false}
                autoCapitalize="none"
                autoComplete="off"
                className="rounded-lg border border-line bg-bg/60 px-3 py-2.5 font-mono text-sm text-amber caret-amber outline-none transition-colors placeholder:text-mut/50 focus:border-amber/60"
              />
            </label>
            <span className="self-center font-display text-lg font-bold text-mut/60">{t.compare.vs}</span>
            <label className="flex flex-1 flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-mut/70">B</span>
              <input
                value={b}
                onChange={(e) => setB(e.target.value)}
                placeholder={t.compare.phB}
                spellCheck={false}
                autoCapitalize="none"
                autoComplete="off"
                className="rounded-lg border border-line bg-bg/60 px-3 py-2.5 font-mono text-sm text-sky caret-sky outline-none transition-colors placeholder:text-mut/50 focus:border-sky/60"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !a.trim() || !b.trim()}
              className="rounded-lg border border-coral/50 bg-coral/10 px-4 py-2.5 font-mono text-xs font-semibold text-coral transition-all duration-200 hover:border-coral hover:bg-coral/20 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? t.compare.comparing : t.compare.run}
            </button>
          </form>
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

      {left && right && s && (
        <Reveal>
          <section className="rounded-xl border border-line bg-panel/85 p-5 shadow-soft">
            <div className="mb-6 flex items-center justify-between gap-3">
              <SideHeader side={left} tone="text-amber" />
              <div className="text-center">
                <div className="font-display text-2xl font-extrabold">
                  <span className="text-amber tnum">{s.aw}</span>
                  <span className="mx-1 text-mut/50">:</span>
                  <span className="text-sky tnum">{s.bw}</span>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-mut">{verdict}</div>
              </div>
              <SideHeader side={right} tone="text-sky" />
            </div>

            <div className="flex flex-col gap-5">
              <MetricBar label={t.compare.mRepos} a={left.repos.length} b={right.repos.length} />
              <MetricBar label={t.compare.mStars} a={totalStars(left.repos)} b={totalStars(right.repos)} />
              <MetricBar label={t.compare.mForks} a={totalForks(left.repos)} b={totalForks(right.repos)} />
              <MetricBar label={t.compare.mFollowers} a={left.user.followers} b={right.user.followers} />
              <MetricBar label={t.compare.mYears} a={accountYears(left.user.created_at)} b={accountYears(right.user.created_at)} />
              <MetricBar label={t.compare.mLangs} a={langCount(left.repos)} b={langCount(right.repos)} />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                { side: left, tone: 'text-amber', key: 'l' },
                { side: right, tone: 'text-sky', key: 'r' },
              ].map(({ side, tone, key }) => (
                <div key={key} className="rounded-lg border border-line bg-bg/40 p-4">
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-mut">{t.compare.topRepos}</div>
                  <ul className="flex flex-col gap-1.5">
                    {side.repos
                      .filter((r) => !r.fork)
                      .sort((x, y) => y.stargazers_count - x.stargazers_count)
                      .slice(0, 5)
                      .map((r) => (
                        <li key={r.id} className="flex items-center gap-2 font-mono text-xs">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: langColor(r.language) }} />
                          <button
                            type="button"
                            onClick={() => onOpenOwner(side.user.login)}
                            className="min-w-0 flex-1 truncate text-left text-ink transition-colors hover:text-amber"
                          >
                            {r.name}
                          </button>
                          <span className={`tnum ${tone}`}>★ {r.stargazers_count.toLocaleString('en-US')}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </Reveal>
      )}

      {!left && !error && !busy && (
        <Reveal delay={100}>
          <p className="text-center font-mono text-sm text-mut/60">{t.compare.noData}</p>
        </Reveal>
      )}
    </div>
  );
}
