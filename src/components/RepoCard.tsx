import { useEffect, useRef, useState } from 'react';
import type { GHRepo } from '../lib/github';
import { compactNum, langColor, relTime } from '../lib/github';
import { useLocale, useT } from '../lib/i18n';
import {
  IconArrow,
  IconBookmark,
  IconCheck,
  IconClock,
  IconCopy,
  IconEye,
  IconFile,
  IconFolder,
  IconFork,
  IconIssue,
  IconLock,
  IconRadar,
  IconStar,
} from './Icons';

/** GitHub returns repo size in KB. */
const sizeLabel = (kb: number): string =>
  kb < 1024 ? `${kb} KB` : kb < 1024 * 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${(kb / 1024 / 1024).toFixed(1)} GB`;

interface Props {
  repo: GHRepo;
  index?: number;
  onReadme: (repo: GHRepo) => void;
  bookmarked?: boolean;
  onToggleBookmark?: (repo: GHRepo) => void;
  onOpenOwner?: (login: string) => void;
  onOpenDetail?: (fullName: string) => void;
  animate?: boolean;
  onCollect?: (repo: GHRepo) => void;
  watched?: boolean;
  onWatch?: (repo: GHRepo) => void;
}

export function RepoCard({
  repo,
  index = 0,
  onReadme,
  bookmarked,
  onToggleBookmark,
  onOpenOwner,
  onOpenDetail,
  animate = true,
  onCollect,
  watched,
  onWatch,
}: Props) {
  const t = useT();
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`https://github.com/${repo.full_name}.git`);
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const topics = repo.topics.slice(0, 4);
  const extraTopics = repo.topics.length - topics.length;
  const owner = repo.owner?.login;
  const ownerName = repo.full_name.split('/')[0];

  return (
    <article
      className="card-lift group relative flex h-full flex-col gap-3 overflow-hidden rounded-xl border border-line bg-panel/70 p-4 pl-5 hover:border-mint/40 hover:bg-panel"
      style={animate ? { animation: `card-in 0.5s cubic-bezier(0.22,0.61,0.36,1) both`, animationDelay: `${Math.min(index % 8, 8) * 55}ms` } : undefined}
    >
      <span
        aria-hidden="true"
        className="absolute bottom-3 left-0 top-3 w-[3px] rounded-full opacity-60 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: langColor(repo.language) }}
      />

      <div className="flex items-start gap-2">
        <div className="inline-flex min-w-0 items-baseline gap-1.5">
          {onOpenDetail ? (
            <button
              type="button"
              onClick={() => onOpenDetail(repo.full_name)}
              title={t.search.openDetailT}
              className="min-w-0 break-all text-left font-mono text-[15px] font-medium leading-snug text-ink transition-colors hover:text-amber"
            >
              {repo.name}
            </button>
          ) : (
            <a
              href={repo.html_url}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 break-all font-mono text-[15px] font-medium leading-snug text-ink transition-colors hover:text-amber"
            >
              {repo.name}
            </a>
          )}
          <a
            href={repo.html_url}
            target="_blank"
            rel="noreferrer"
            title={repo.html_url}
            aria-label="Open on GitHub"
            className="shrink-0 self-center text-mut transition-all duration-300 hover:text-amber group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          >
            <IconArrow size={13} />
          </a>
        </div>

        <span className="ml-auto flex shrink-0 items-center gap-1">
          {repo.private && (
            <span
              className="inline-flex items-center gap-1 rounded border border-coral/40 bg-coral/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-coral"
              title={t.card.privateB}
            >
              <IconLock size={10} /> {t.card.privateB}
            </span>
          )}
          {repo.archived && (
            <span className="rounded border border-line bg-raise px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-mut">
              {t.card.archived}
            </span>
          )}
          {repo.fork && (
            <span className="rounded border border-line bg-raise px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-mut">
              {t.card.fork}
            </span>
          )}
          {onToggleBookmark && (
            <button
              type="button"
              onClick={() => onToggleBookmark(repo)}
              title={bookmarked ? t.card.bmDel : t.card.bmAdd}
              aria-label={bookmarked ? t.card.bmDel : t.card.bmAdd}
              aria-pressed={bookmarked}
              className={`rounded-md border border-transparent p-1 transition-all duration-200 hover:border-line hover:bg-raise active:scale-90 ${
                bookmarked ? 'text-amber' : 'text-mut hover:text-amber'
              }`}
            >
              <IconBookmark size={14} {...(bookmarked ? { fill: 'currentColor' } : {})} />
            </button>
          )}
          {onWatch && (
            <button
              type="button"
              onClick={() => onWatch(repo)}
              title={watched ? t.card.watchDel : t.card.watchAdd}
              aria-label={watched ? t.card.watchDel : t.card.watchAdd}
              aria-pressed={watched}
              className={`rounded-md border border-transparent p-1 transition-all duration-200 hover:border-line hover:bg-raise active:scale-90 ${
                watched ? 'text-mint' : 'text-mut hover:text-mint'
              }`}
            >
              <IconRadar size={14} />
            </button>
          )}
          {onCollect && (
            <button
              type="button"
              onClick={() => onCollect(repo)}
              title={t.card.collectT}
              aria-label={t.card.collectT}
              className="rounded-md border border-transparent p-1 text-mut transition-all duration-200 hover:border-line hover:bg-raise hover:text-amber active:scale-90"
            >
              <IconFolder size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onReadme(repo)}
            title={t.card.readmeT}
            aria-label={t.card.readmeT}
            className="rounded-md border border-transparent p-1 text-mut transition-all duration-200 hover:border-line hover:bg-raise hover:text-sky"
          >
            <IconFile size={14} />
          </button>
          <button
            type="button"
            onClick={() => void copy()}
            title={t.card.copyAria}
            aria-label={t.card.copyAria}
            className="rounded-md border border-transparent p-1 text-mut transition-all duration-200 hover:border-line hover:bg-raise hover:text-ink"
          >
            {copied ? <IconCheck size={14} className="text-mint" /> : <IconCopy size={14} />}
          </button>
        </span>
      </div>

      {repo.description ? (
        <p className="line-clamp-2 text-sm leading-relaxed text-mut">{repo.description}</p>
      ) : (
        <p className="text-sm italic text-mut/50">{t.card.noDesc}</p>
      )}

      {repo.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {topics.map((tp) => (
            <span
              key={tp}
              className="rounded-full border border-sky/25 bg-sky/10 px-2 py-0.5 font-mono text-[11px] text-sky/90 transition-colors duration-200 hover:border-sky/60"
            >
              {tp}
            </span>
          ))}
          {extraTopics > 0 && (
            <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-mut">+{extraTopics}</span>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 font-mono text-xs text-mut">
        {onOpenOwner && owner && (
          <button
            type="button"
            onClick={() => onOpenOwner(owner)}
            title={t.card.ownerT}
            className="rounded border border-transparent px-1 py-0.5 text-mut/80 transition-all duration-200 hover:border-line hover:bg-raise hover:text-ink"
          >
            {ownerName}
          </button>
        )}
        {repo.language && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: langColor(repo.language) }} />
            {repo.language}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 tnum" title={t.card.starsT}>
          <IconStar size={12} className="text-amber" />
          {compactNum(repo.stargazers_count)}
        </span>
        <span className="inline-flex items-center gap-1.5 tnum" title={t.card.forksT}>
          <IconFork size={13} className="text-sky" />
          {compactNum(repo.forks_count)}
        </span>
        {repo.open_issues_count > 0 && (
          <span className="inline-flex items-center gap-1.5 tnum" title={t.card.issuesT}>
            <IconIssue size={13} className="text-coral" />
            {compactNum(repo.open_issues_count)}
          </span>
        )}
        {repo.license?.spdx_id && repo.license.spdx_id !== 'NOASSERTION' && (
          <span
            className="inline-flex items-center rounded border border-line bg-raise px-1.5 py-0.5 text-[10px] uppercase tracking-wide"
            title={`${t.card.licenseT}: ${repo.license.name ?? repo.license.spdx_id}`}
          >
            {repo.license.spdx_id.toLowerCase()}
          </span>
        )}
        {repo.size > 0 && (
          <span className="inline-flex items-center gap-1 text-mut/70" title={t.card.sizeT}>
            {sizeLabel(repo.size)}
          </span>
        )}
        {repo.watchers_count > 0 && (
          <span className="inline-flex items-center gap-1.5 tnum" title={t.card.watchersT}>
            <IconEye size={12} className="text-mint" />
            {compactNum(repo.watchers_count)}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5 text-mut/80" title={t.card.activeT}>
          <IconClock size={12} />
          {relTime(repo.pushed_at, locale)}
        </span>
      </div>
    </article>
  );
}
