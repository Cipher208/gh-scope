import { useEffect, useState } from 'react';
import type { GHRepo } from '../lib/github';
import { GHError, fetchReadme } from '../lib/github';
import { Markdown } from '../lib/markdown';
import { useTranslator } from '../lib/translate';
import { useT } from '../lib/i18n';
import { IconAlert, IconArrow, IconExternal, IconTranslate, IconX } from './Icons';

interface Props {
  repo: GHRepo;
  token: string | null;
  onClose: () => void;
  onOpenDetail?: (fullName: string) => void;
}

export function ReadmeModal({ repo, token, onClose, onOpenDetail }: Props) {
  const t = useT();
  const [md, setMd] = useState<string | null>(null);
  const [error, setError] = useState<GHError | null>(null);
  const tr = useTranslator('ru');
  const branch = repo.default_branch ?? 'main';

  useEffect(() => {
    let alive = true;
    setMd(null);
    setError(null);
    tr.reset();
    fetchReadme(repo.full_name, branch, token)
      .then((text: string) => {
        if (alive) setMd(text);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof GHError ? e : new GHError(0, 'Could not load the README.'));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo.full_name, branch, token]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const imageBase = `https://raw.githubusercontent.com/${repo.full_name}/${branch}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bg/70 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`README — ${repo.full_name}`}
    >
      <div
        className="term-line relative my-auto w-full max-w-3xl overflow-hidden rounded-xl border border-line bg-panel shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-coral/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-mint/70" />
          <span className="ml-2 min-w-0 truncate font-mono text-xs text-mut">
            <span className="text-ink">{repo.full_name}</span> / README.md
            <span className="ml-2 text-mut/60">
              {t.readme.branch}: {branch}
            </span>
          </span>

          <span className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">
            {md && (
              <button
                type="button"
                onClick={() => tr.toggle(md)}
                disabled={tr.busy}
                title={t.readme.translateT}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[11px] transition-colors ${
                  tr.active ? 'border-mint/60 bg-mint/10 text-mint' : 'border-line text-mut hover:border-mint/60 hover:text-mint'
                }`}
              >
                <IconTranslate size={11} />
                {tr.busy ? t.readme.translating(tr.progress[0], tr.progress[1]) : tr.active ? t.readme.original : t.readme.translate}
              </button>
            )}
            {onOpenDetail && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenDetail(repo.full_name);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 font-mono text-[11px] text-mut transition-colors hover:border-amber/60 hover:text-amber"
              >
                {t.readme.fullCard} <IconArrow size={11} />
              </button>
            )}
            <a
              href={`https://deepwiki.com/${repo.full_name}`}
              target="_blank"
              rel="noreferrer"
              title={t.readme.deepwikiT}
              className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 font-mono text-[11px] text-mut transition-colors hover:border-sky/60 hover:text-sky"
            >
              {t.readme.deepwiki} <IconExternal size={11} />
            </a>
            <a
              href={`https://gitmcp.io/${repo.full_name}`}
              target="_blank"
              rel="noreferrer"
              title={t.readme.gitmcpT}
              className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 font-mono text-[11px] text-mut transition-colors hover:border-sky/60 hover:text-sky"
            >
              {t.readme.gitmcp} <IconExternal size={11} />
            </a>
            <a
              href={`https://gitdiagram.com/${repo.full_name}`}
              target="_blank"
              rel="noreferrer"
              title={t.readme.gitdiagramT}
              className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 font-mono text-[11px] text-mut transition-colors hover:border-sky/60 hover:text-sky"
            >
              {t.readme.gitdiagram} <IconExternal size={11} />
            </a>
            <a
              href={repo.html_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 font-mono text-[11px] text-mut transition-colors hover:border-amber/60 hover:text-amber"
            >
              {t.readme.raw} <IconArrow size={11} />
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.readme.closeAria}
              className="rounded-md border border-line p-1.5 text-mut transition-colors hover:border-coral/60 hover:text-coral"
            >
              <IconX size={12} />
            </button>
          </span>
        </div>

        {tr.active && (
          <div className="border-b border-line px-4 py-1.5 font-mono text-[11px] text-mut/80">
            {tr.failed ? t.readme.fail(tr.failedChunks) : t.readme.machineNote(tr.via ?? 'mixed transports')}
          </div>
        )}

        <div className="max-h-[72vh] overflow-y-auto p-5 sm:p-6">
          {error && (
            <div className="flex items-center gap-2.5 rounded-lg border border-coral/40 bg-coral/10 px-3 py-2.5">
              <IconAlert size={15} className="shrink-0 text-coral" />
              <p className="text-xs text-mut">{error.message}</p>
            </div>
          )}
          {!md && !error && <div className="shimmer h-56 w-full rounded-lg" aria-label={t.readme.loading} />}
          {md && (
            <Markdown
              source={tr.translated ?? md}
              imageBase={imageBase}
              truncatedNotice={
                <a href={repo.html_url} target="_blank" rel="noreferrer" className="text-sky underline">
                  open on github ↗
                </a>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
