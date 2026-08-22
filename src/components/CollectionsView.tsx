import { useState, type FormEvent } from 'react';
import type { GHRepo } from '../lib/github';
import { downloadFile, langColor, relTime } from '../lib/github';
import { Reveal } from '../lib/hooks';
import { useT } from '../lib/i18n';
import { IconDownload, IconFolder, IconTrash, IconX } from './Icons';

export interface CollectionItem {
  fullName: string;
  repo: GHRepo;
  addedAt: string;
}

export interface Collection {
  id: string;
  name: string;
  items: CollectionItem[];
  createdAt: string;
}

function collectionToMarkdown(c: Collection): string {
  const lines: string[] = [`# ${c.name}`, ''];
  for (const it of c.items) {
    const r = it.repo;
    const desc = r.description ? ` — ${r.description}` : '';
    lines.push(`- [${r.full_name}](${r.html_url}) ★${r.stargazers_count}${desc}`);
  }
  lines.push('', `_exported by gh-scope_`);
  return lines.join('\n');
}

export function CollectionsView({
  collections,
  onCreate,
  onDelete,
  onRemoveItem,
  onOpenDetail,
}: {
  collections: Collection[];
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
  onRemoveItem: (id: string, fullName: string) => void;
  onOpenDetail: (fullName: string) => void;
}) {
  const t = useT();
  const [name, setName] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    onCreate(n);
    setName('');
  };

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <section className="overflow-hidden rounded-xl border border-line bg-panel/85 shadow-soft">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-coral/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-mint/70" />
            <span className="ml-2 flex items-center gap-1.5 font-mono text-[11px] text-mut">
              <IconFolder size={13} className="text-amber" /> {t.collections.title} · {t.collections.sub}
            </span>
          </div>
          <form onSubmit={submit} className="flex gap-2 p-4 sm:p-5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.collections.newPh}
              spellCheck={false}
              className="flex-1 rounded-lg border border-line bg-bg/60 px-3 py-2.5 font-mono text-sm text-amber caret-amber outline-none transition-colors placeholder:text-mut/50 focus:border-amber/60"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded-lg border border-amber/50 bg-amber/10 px-4 py-2.5 font-mono text-xs font-semibold text-amber transition-all duration-200 hover:border-amber hover:bg-amber/20 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t.collections.create}
            </button>
          </form>
        </section>
      </Reveal>

      {collections.length === 0 ? (
        <Reveal delay={100}>
          <p className="text-center font-mono text-sm text-mut/60">{t.collections.empty}</p>
        </Reveal>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {collections.map((c, i) => (
            <Reveal key={c.id} delay={(i % 4) * 60}>
              <section className="card-lift flex h-full flex-col gap-3 rounded-xl border border-line bg-panel/70 p-4 hover:border-amber/40">
                <div className="flex items-center gap-2">
                  <IconFolder size={16} className="shrink-0 text-amber" />
                  <h3 className="min-w-0 flex-1 truncate font-display text-base font-bold">{c.name}</h3>
                  <span className="font-mono text-[11px] text-mut tnum">{t.collections.items(c.items.length)}</span>
                  <button
                    type="button"
                    onClick={() => downloadFile(`${c.name.replace(/\s+/g, '-').toLowerCase() || 'collection'}.md`, collectionToMarkdown(c), 'text/markdown;charset=utf-8')}
                    title={t.collections.exportMd}
                    aria-label={t.collections.exportMd}
                    className="rounded-md border border-transparent p-1 text-mut transition-colors hover:border-line hover:bg-raise hover:text-sky"
                  >
                    <IconDownload size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(c.id)}
                    title={t.collections.del}
                    aria-label={t.collections.del}
                    className="rounded-md border border-transparent p-1 text-mut transition-colors hover:border-coral/50 hover:bg-coral/10 hover:text-coral"
                  >
                    <IconTrash size={14} />
                  </button>
                </div>

                {c.items.length === 0 ? (
                  <p className="py-6 text-center font-mono text-xs text-mut/50">{t.collections.emptyCol}</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {c.items.map((it) => (
                      <li key={it.fullName} className="group flex items-center gap-2 rounded-lg border border-line/60 bg-bg/40 px-3 py-2 transition-colors hover:border-line">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: langColor(it.repo.language) }} />
                        <button
                          type="button"
                          onClick={() => onOpenDetail(it.fullName)}
                          className="min-w-0 flex-1 truncate text-left font-mono text-xs text-ink transition-colors hover:text-amber"
                        >
                          {it.fullName}
                        </button>
                        <span className="font-mono text-[10px] text-mut/60 tnum">★{it.repo.stargazers_count}</span>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(c.id, it.fullName)}
                          aria-label={`${t.collections.del}: ${it.fullName}`}
                          className="rounded p-0.5 text-mut/40 opacity-0 transition-all hover:text-coral group-hover:opacity-100"
                        >
                          <IconX size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

export function CollectionPicker({
  repo,
  collections,
  onClose,
  onAdd,
  onCreateAndAdd,
}: {
  repo: GHRepo;
  collections: Collection[];
  onClose: () => void;
  onAdd: (colId: string) => void;
  onCreateAndAdd: (name: string) => void;
}) {
  const t = useT();
  const [name, setName] = useState('');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t.collections.pickerTitle}
    >
      <div className="term-line w-full max-w-sm overflow-hidden rounded-xl border border-line bg-panel shadow-soft" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <IconFolder size={15} className="text-amber" />
          <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{t.collections.pickerTitle}</span>
          <button type="button" onClick={onClose} aria-label={t.readme.closeAria} className="rounded-md border border-line p-1 text-mut transition-colors hover:border-coral/60 hover:text-coral">
            <IconX size={12} />
          </button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-3">
          <p className="mb-2 truncate px-1 font-mono text-[11px] text-mut">{repo.full_name}</p>
          {collections.length === 0 && <p className="px-1 py-2 font-mono text-xs text-mut/50">{t.collections.empty}</p>}
          <ul className="flex flex-col gap-1">
            {collections.map((c) => {
              const inCol = c.items.some((it) => it.fullName === repo.full_name);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onAdd(c.id)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left font-mono text-xs transition-colors ${
                      inCol ? 'border-amber/50 bg-amber/10 text-amber' : 'border-line text-mut hover:border-amber/40 hover:text-ink'
                    }`}
                  >
                    <IconFolder size={13} className={inCol ? 'text-amber' : 'text-mut/60'} />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="text-[10px] text-mut/60 tnum">{t.collections.items(c.items.length)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 border-t border-line/60 pt-3">
            <p className="mb-1.5 px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-mut/70">{t.collections.newCol}</p>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.collections.newPh}
                spellCheck={false}
                className="min-w-0 flex-1 rounded-lg border border-line bg-bg/60 px-3 py-2 font-mono text-xs text-ink outline-none placeholder:text-mut/50 focus:border-amber/60"
              />
              <button
                type="button"
                disabled={!name.trim()}
                onClick={() => onCreateAndAdd(name.trim())}
                className="rounded-lg border border-amber/50 px-3 py-2 font-mono text-xs text-amber transition-colors hover:bg-amber/10 disabled:opacity-50"
              >
                {t.collections.add}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
