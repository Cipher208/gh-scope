import { useState, type FormEvent } from 'react';
import type { GHRelease, GHRepoDetail } from '../lib/github';
import { GHError, compactNum, fetchLatestRelease, fetchRepoDetail, langColor, relTime } from '../lib/github';
import { Reveal } from '../lib/hooks';
import { useT } from '../lib/i18n';
import { IconAlert, IconRepoCompare } from './Icons';

function daysSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 86400000));
}

function Row({ label, a, b, better }: { label: string; a: string; b: string; better: 'a' | 'b' | null }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-line/60 py-2 last:border-0">
      <span className={`text-right font-mono text-sm tnum ${better === 'a' ? 'font-semibold text-amber' : 'text-mut'}`}>{a}</span>
      <span className="min-w-24 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-mut/70">{label}</span>
      <span className={`font-mono text-sm tnum ${better === 'b' ? 'font-semibold text-sky' : 'text-mut'}`}>{b}</span>
    </div>
  );
}

function DuelCard({ r, rel, tone }: { r: GHRepoDetail; rel: GHRelease | null; tone: string }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-bg/40 p-4">
      <div className="min-w-0">
        <a href={r.html_url} target="_blank" rel="noreferrer" className={`break-all font-mono text-base font-semibold ${tone} hover:underline`}>
          {r.full_name}
        </a>
        {r.description && <p className="mt-1 line-clamp-2 text-sm text-mut">{r.description}</p>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {r.topics.slice(0, 5).map((tp) => (
          <span key={tp} className="rounded-full border border-sky/25 bg-sky/10 px-2 py-0.5 font-mono text-[11px] text-sky/90">
            {tp}
          </span>
        ))}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-mut">
        {r.language && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: langColor(r.language) }} />
            {r.language}
          </span>
        )}
        <span className="tnum">★ {compactNum(r.stargazers_count)}</span>
        <span className="tnum">{t.duel.license}: {r.license?.spdx_id && r.license.spdx_id !== 'NOASSERTION' ? r.license.spdx_id.toLowerCase() : '—'}</span>
      </div>
      <div className="font-mono text-[11px] text-mut/70">
        {t.duel.released}: {rel ? `${rel.tag_name} · ${relTime(rel.published_at)}` : t.duel.noRel}
      </div>
    </div>
  );
}

export function RepoDuelView() {
  const t = useT();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<GHError | null>(null);
  const [left, setLeft] = useState<GHRepoDetail | null>(null);
  const [right, setRight] = useState<GHRepoDetail | null>(null);
  const [relA, setRelA] = useState<GHRelease | null>(null);
  const [relB, setRelB] = useState<GHRelease | null>(null);

  const run = async (e: FormEvent) => {
    e.preventDefault();
    const fa = a.trim();
    const fb = b.trim();
    if (!fa.includes('/') || !fb.includes('/') || busy) return;
    setBusy(true);
    setError(null);
    setLeft(null);
    setRight(null);
    setRelA(null);
    setRelB(null);
    try {
      const [ra, rb] = await Promise.all([fetchRepoDetail(fa, null), fetchRepoDetail(fb, null)]);
      setLeft(ra);
      setRight(rb);
      const [la, lb] = await Promise.allSettled([fetchLatestRelease(fa, null), fetchLatestRelease(fb, null)]);
      setRelA(la.status === 'fulfilled' ? la.value : null);
      setRelB(lb.status === 'fulfilled' ? lb.value : null);
    } catch (err) {
      setError(err instanceof GHError ? err : new GHError(0, t.err.net));
    } finally {
      setBusy(false);
    }
  };

  const cmp = (x: number, y: number): 'a' | 'b' | null => (x === y ? null : x > y ? 'a' : 'b');

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <section className="overflow-hidden rounded-xl border border-line bg-panel/85 shadow-soft">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-coral/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-mint/70" />
            <span className="ml-2 flex items-center gap-1.5 font-mono text-[11px] text-mut">
              <IconRepoCompare size={13} className="text-sky" /> {t.duel.window}
            </span>
          </div>
          <form onSubmit={run} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:p-5">
            <input
              value={a}
              onChange={(e) => setA(e.target.value)}
              placeholder={t.duel.phA}
              spellCheck={false}
              autoCapitalize="none"
              autoComplete="off"
              className="flex-1 rounded-lg border border-line bg-bg/60 px-3 py-2.5 font-mono text-sm text-amber caret-amber outline-none transition-colors placeholder:text-mut/50 focus:border-amber/60"
            />
            <span className="self-center font-display text-lg font-bold text-mut/60">{t.duel.vs}</span>
            <input
              value={b}
              onChange={(e) => setB(e.target.value)}
              placeholder={t.duel.phB}
              spellCheck={false}
              autoCapitalize="none"
              autoComplete="off"
              className="flex-1 rounded-lg border border-line bg-bg/60 px-3 py-2.5 font-mono text-sm text-sky caret-sky outline-none transition-colors placeholder:text-mut/50 focus:border-sky/60"
            />
            <button
              type="submit"
              disabled={busy || !a.includes('/') || !b.includes('/')}
              className="rounded-lg border border-sky/50 bg-sky/10 px-4 py-2.5 font-mono text-xs font-semibold text-sky transition-all duration-200 hover:border-sky hover:bg-sky/20 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? t.duel.comparing : t.duel.run}
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

      {left && right && (
        <Reveal>
          <section className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <DuelCard r={left} rel={relA} tone="text-amber" />
              <DuelCard r={right} rel={relB} tone="text-sky" />
            </div>
            <div className="rounded-xl border border-line bg-panel/85 px-5 py-3 shadow-soft">
              <Row label={t.duel.mStars} a={compactNum(left.stargazers_count)} b={compactNum(right.stargazers_count)} better={cmp(left.stargazers_count, right.stargazers_count)} />
              <Row label={t.duel.mForks} a={compactNum(left.forks_count)} b={compactNum(right.forks_count)} better={cmp(left.forks_count, right.forks_count)} />
              <Row label={t.duel.mIssues} a={compactNum(left.open_issues_count)} b={compactNum(right.open_issues_count)} better={null} />
              <Row label={t.duel.mWatchers} a={compactNum(left.subscribers_count)} b={compactNum(right.subscribers_count)} better={cmp(left.subscribers_count, right.subscribers_count)} />
              <Row label={t.duel.mSize} a={`${Math.round(left.size / 1024)} MB`} b={`${Math.round(right.size / 1024)} MB`} better={null} />
              <Row label={t.duel.mPushed} a={`${daysSince(left.pushed_at)} d`} b={`${daysSince(right.pushed_at)} d`} better={cmp(daysSince(right.pushed_at), daysSince(left.pushed_at))} />
            </div>
          </section>
        </Reveal>
      )}

      {!left && !error && !busy && (
        <Reveal delay={100}>
          <p className="text-center font-mono text-sm text-mut/60">{t.duel.noData}</p>
        </Reveal>
      )}
    </div>
  );
}
