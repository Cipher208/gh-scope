import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type { GHOrg, GHRepo } from '../lib/github';
import { GHError, fetchOrg, fetchOrgRepos, fullNum, langColor, monthYear } from '../lib/github';
import { Reveal, useCountUp, useScramble } from '../lib/hooks';
import { useLocale, useT } from '../lib/i18n';
import { RepoCard } from './RepoCard';
import { IconAlert, IconAt, IconCalendar, IconChevronDown, IconLink, IconMail, IconPin, IconVerified } from './Icons';

const QUICK = ['vercel', 'facebook', 'rust-lang', 'tailwindlabs'];

interface Props {
  token: string | null;
  bookmarkedIds: Set<number>;
  onToggleBookmark: (repo: GHRepo) => void;
  onReadme: (repo: GHRepo) => void;
  onOpenOwner: (login: string) => void;
  onOpenDetail: (fullName: string) => void;
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  const v = useCountUp(value);
  return (
    <div className="px-2 py-3 text-center">
      <div className={`font-mono text-lg font-semibold tnum ${tone}`}>{fullNum(v)}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-mut">{label}</div>
    </div>
  );
}

function MetaRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-mut">
      <span className="shrink-0 text-mut/70">{icon}</span>
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

export function OrgView({ token, bookmarkedIds, onToggleBookmark, onReadme, onOpenOwner, onOpenDetail }: Props) {
  const t = useT();
  const locale = useLocale();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<GHError | null>(null);
  const [org, setOrg] = useState<GHOrg | null>(null);
  const [repos, setRepos] = useState<GHRepo[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [orgSort, setOrgSort] = useState<'pushed' | 'stars' | 'name'>('pushed');

  const load = async (raw: string) => {
    const name = raw.trim().replace(/^@/, '');
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    setPending(name);
    try {
      const [o, r] = await Promise.all([fetchOrg(name, token), fetchOrgRepos(name, token)]);
      setOrg(o);
      setRepos(r);
    } catch (e) {
      setOrg(null);
      setRepos([]);
      setError(e instanceof GHError ? e : new GHError(0, 'Network error.'));
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void load(input);
  };

  const orgName = useScramble(org?.name || org?.login || '');

  const sortedRepos = useMemo(() => {
    const list = [...repos];
    if (orgSort === 'stars') list.sort((a, b) => b.stargazers_count - a.stargazers_count);
    else if (orgSort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else list.sort((a, b) => +new Date(b.pushed_at) - +new Date(a.pushed_at));
    return list;
  }, [repos, orgSort]);

  const langs = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of repos) if (r.language) m.set(r.language, (m.get(r.language) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [repos]);

  const stars = useMemo(() => repos.filter((r) => !r.fork).reduce((s, r) => s + r.stargazers_count, 0), [repos]);

  const blogUrl =
    org?.blog && org.blog.trim()
      ? /^https?:\/\//i.test(org.blog)
        ? org.blog
        : `https://${org.blog}`
      : null;

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <section className="overflow-hidden rounded-xl border border-line bg-panel/85 shadow-soft">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-coral/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-mint/70" />
            <span className="ml-2 font-mono text-[11px] text-mut">
              {t.orgs.window}
              {pending && <span className="ml-2 text-amber">· fetching @{pending}…</span>}
            </span>
          </div>
          <div className="flex flex-col gap-3 p-4 sm:p-5">
            <form
              onSubmit={submit}
              className="flex items-center gap-2.5 rounded-xl border border-line bg-bg/60 px-4 py-3 transition-colors duration-300 focus-within:border-amber/60"
            >
              <span className="hidden shrink-0 font-mono text-sm sm:inline">
                <span className="text-mint">guest</span>
                <span className="text-mut">@</span>
                <span className="text-amber">gh-scope</span>
                <span className="text-mut">:~/orgs$</span>
              </span>
              <span className="shrink-0 font-mono text-sm text-mint sm:hidden">❯</span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t.orgs.ph}
                spellCheck={false}
                autoCapitalize="none"
                autoComplete="off"
                aria-label="Organization login"
                className="w-full min-w-0 flex-1 bg-transparent font-mono text-[15px] text-amber caret-amber outline-none placeholder:text-mut/50"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-amber/50 px-3.5 py-1.5 font-mono text-xs text-amber transition-all duration-200 hover:border-amber hover:bg-amber/10 active:translate-y-px disabled:cursor-not-allowed disabled:border-line disabled:text-mut/50"
              >
                {t.orgs.open} <kbd>↵</kbd>
              </button>
            </form>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mut/70">{t.orgs.tryLbl}</span>
              {QUICK.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void load(s)}
                  disabled={busy}
                  className="rounded-md border border-line px-2.5 py-1 font-mono text-xs text-mut transition-all duration-200 hover:-translate-y-px hover:border-mint/60 hover:text-mint disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {error && (
        <Reveal>
          <div className="flex flex-col items-start gap-3 rounded-xl border border-coral/40 bg-coral/10 p-5 sm:flex-row sm:items-center">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-coral/40 bg-coral/10 text-coral">
              <IconAlert size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm font-semibold text-coral">{t.orgs.errTitle}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-mut">{error.message}</p>
            </div>
            <button
              type="button"
              onClick={() => input.trim() && void load(input)}
              className="shrink-0 rounded-lg border border-coral/50 px-3.5 py-2 font-mono text-xs text-coral transition-all duration-200 hover:border-coral hover:bg-coral/15"
            >
              {t.orgs.retry}
            </button>
          </div>
        </Reveal>
      )}

      {!org && !error && !busy && (
        <Reveal delay={100}>
          <section className="rounded-xl border border-dashed border-line bg-panel/50 p-8 sm:p-12">
            <div className="mx-auto max-w-xl font-mono text-sm leading-loose text-mut">
              <p>
                <span className="text-mint">$</span> <span className="text-amber">gh-scope orgs</span>{' '}
                <span className="text-mut/60">--list</span>
              </p>
              <p className="mt-4 text-ink">{t.orgs.emptyBody}</p>
              <p className="mt-5">
                <span className="text-mint">{t.orgs.ready}</span>
                <span className="caret" aria-hidden="true" />
              </p>
            </div>
          </section>
        </Reveal>
      )}

      {busy && !org && (
        <section className="grid gap-6 lg:grid-cols-[330px_1fr]">
          <div className="flex flex-col gap-4 rounded-xl border border-line bg-panel/60 p-5">
            <div className="flex items-center gap-4">
              <div className="shimmer h-20 w-20 rounded-xl" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="shimmer h-5 w-3/4 rounded" />
                <div className="shimmer h-4 w-1/2 rounded" />
              </div>
            </div>
            <div className="shimmer h-16 w-full rounded-lg" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3 rounded-xl border border-line bg-panel/60 p-4">
                <div className="shimmer h-5 w-2/3 rounded" />
                <div className="shimmer h-4 w-full rounded" />
                <div className="shimmer mt-auto h-3 w-1/2 rounded" />
              </div>
            ))}
          </div>
        </section>
      )}

      {org && (
        <section className="grid items-start gap-6 lg:grid-cols-[330px_1fr]">
          <Reveal className="lg:sticky lg:top-20">
            <aside className="flex flex-col gap-5 rounded-xl border border-line bg-panel/85 p-5 shadow-soft">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="absolute -inset-1.5 rounded-2xl bg-mint/15 blur-md" aria-hidden="true" />
                  <img src={org.avatar_url} alt={`${org.login} avatar`} loading="lazy" className="relative h-20 w-20 rounded-xl border border-line object-cover" />
                </div>
                <div className="min-w-0">
                  <h2 className="flex flex-wrap items-center gap-1.5 break-words font-display text-2xl font-bold leading-tight">
                    {orgName}
                    {org.is_verified && <IconVerified size={18} className="shrink-0 text-mint" />}
                  </h2>
                  <a href={org.html_url} target="_blank" rel="noreferrer" className="font-mono text-sm text-mint transition-colors hover:text-amber hover:underline">
                    @{org.login}
                  </a>
                </div>
              </div>

              {org.description && <p className="-mt-1 text-sm leading-relaxed text-mut">{org.description}</p>}

              <div className="flex flex-col gap-2">
                {org.location && <MetaRow icon={<IconPin size={14} />}>{org.location}</MetaRow>}
                {blogUrl && (
                  <MetaRow icon={<IconLink size={14} />}>
                    <a href={blogUrl} target="_blank" rel="noreferrer" className="text-sky transition-colors hover:text-amber">
                      {org.blog}
                    </a>
                  </MetaRow>
                )}
                {org.email && <MetaRow icon={<IconMail size={14} />}>{org.email}</MetaRow>}
                {org.twitter_username && (
                  <MetaRow icon={<IconAt size={14} />}>
                    <a href={`https://x.com/${org.twitter_username}`} target="_blank" rel="noreferrer" className="text-sky transition-colors hover:text-amber">
                      @{org.twitter_username}
                    </a>
                  </MetaRow>
                )}
                <MetaRow icon={<IconCalendar size={14} />}>
                  {t.orgs.since} {monthYear(org.created_at, locale)}
                </MetaRow>
              </div>

              <div className="grid grid-cols-3 divide-x divide-line rounded-lg border border-line bg-bg/40">
                <Stat value={org.public_repos} label={t.orgs.repos} tone="text-amber" />
                <Stat value={stars} label={t.orgs.stars} tone="text-mint" />
                <Stat value={org.followers} label={t.orgs.followers} tone="text-sky" />
              </div>

              {langs.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-mut">{t.orgs.langSpread}</div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-raise">
                    {langs.slice(0, 8).map(([name, count], i) => (
                      <span
                        key={name}
                        className="lang-seg h-full"
                        style={{ width: `${(count / repos.length) * 100}%`, background: langColor(name), animationDelay: `${i * 70}ms` }}
                        title={`${name}: ${count}`}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                    {langs.slice(0, 5).map(([name, count]) => (
                      <span key={name} className="inline-flex items-center gap-1.5 font-mono text-[11px] text-mut">
                        <span className="h-2 w-2 rounded-full" style={{ background: langColor(name) }} />
                        {name} <span className="text-mut/60 tnum">{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </Reveal>

          <div className="flex min-w-0 flex-col gap-4">
            <Reveal delay={80}>
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel/85 p-4">
                <h3 className="font-display text-xl font-bold">
                  {t.orgs.fleet}
                  <span className="ml-2 font-mono text-sm font-medium text-mut tnum">{repos.length}</span>
                </h3>
                <div className="relative ml-auto">
                  <select
                    value={orgSort}
                    onChange={(e) => setOrgSort(e.target.value as 'pushed' | 'stars' | 'name')}
                    aria-label="Sort fleet"
                    className="appearance-none rounded-lg border border-line bg-bg/50 py-1.5 pl-3 pr-8 font-mono text-xs text-mut outline-none transition-colors hover:border-amber/50 focus:border-amber/60"
                  >
                    <option value="pushed">{t.orgs.sortPushed}</option>
                    <option value="stars">{t.orgs.sortStars}</option>
                    <option value="name">{t.orgs.sortName}</option>
                  </select>
                  <IconChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-mut" />
                </div>
              </div>
            </Reveal>

            {repos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-panel/50 p-10 text-center font-mono text-sm text-mut">{t.orgs.noRepos}</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2" key={`${org.login}-${orgSort}`}>
                {sortedRepos.map((r, i) => (
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
            {repos.length >= 100 && <p className="text-center font-mono text-[11px] text-mut/70">{t.orgs.fleetNote}</p>}
          </div>
        </section>
      )}
    </div>
  );
}
