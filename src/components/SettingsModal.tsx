import { useEffect, useState } from 'react';
import { loadTranslateConfig, saveTranslateConfig } from '../lib/translate';
import { useT } from '../lib/i18n';
import { IconCheck, IconKey, IconTranslate, IconX } from './Icons';

interface Props {
  token: string;
  onTokenChange: (value: string) => void;
  onClose: () => void;
}

/**
 * Everything a visitor can decide for themselves, in one place: the GitHub
 * token that raises the API limit, and the translation endpoint that replaces
 * the undocumented public transport.
 *
 * Both live in localStorage and nowhere else. That is not a shortcut — this is
 * a static site, so there is no server that could hold a key on the visitor's
 * behalf, and anything baked into the bundle would be public by construction.
 * The honest design for static hosting is: the visitor supplies their own keys,
 * or they get the anonymous tier.
 */
export function SettingsModal({ token, onTokenChange, onClose }: Props) {
  const t = useT();
  const [tokenDraft, setTokenDraft] = useState(token);
  const [trCfg, setTrCfg] = useState(() => loadTranslateConfig());
  const [savedFlash, setSavedFlash] = useState<'token' | 'translate' | null>(null);

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

  const flash = (which: 'token' | 'translate') => {
    setSavedFlash(which);
    window.setTimeout(() => setSavedFlash(null), 1600);
  };

  const field =
    'w-full rounded-md border border-line bg-raise/60 px-2.5 py-1.5 font-mono text-[11px] text-ink outline-none transition-colors focus:border-mint/60';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-bg/70 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t.settings.title}
    >
      <div
        className="term-line my-auto w-full max-w-2xl overflow-hidden rounded-xl border border-line bg-panel shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-coral/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-mint/70" />
          <span className="ml-2 font-mono text-xs text-ink">{t.settings.title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.settings.close}
            className="ml-auto rounded-md border border-line p-1.5 text-mut transition-colors hover:border-coral/60 hover:text-coral"
          >
            <IconX size={12} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <p className="font-mono text-[11px] leading-relaxed text-mut/80">{t.settings.stored}</p>

          {/* GitHub token */}
          <section className="rounded-lg border border-line p-3">
            <h3 className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-ink">
              <IconKey size={12} /> {t.settings.tokenTitle}
              <span className={`ml-auto font-normal ${token ? 'text-mint' : 'text-mut/70'}`}>
                {token ? t.settings.tokenSet : t.settings.tokenUnset}
              </span>
            </h3>
            <p className="mt-1.5 text-[11px] leading-relaxed text-mut/80">{t.settings.tokenNote}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <input
                type="password"
                value={tokenDraft}
                onChange={(e) => setTokenDraft(e.target.value)}
                placeholder={t.settings.tokenPlaceholder}
                spellCheck={false}
                autoComplete="off"
                className={`${field} min-w-0 flex-1`}
              />
              <button
                type="button"
                onClick={() => {
                  onTokenChange(tokenDraft.trim());
                  flash('token');
                }}
                className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 font-mono text-[11px] text-mut transition-colors hover:border-mint/60 hover:text-mint"
              >
                {savedFlash === 'token' ? <IconCheck size={11} /> : null}
                {t.settings.tokenSave}
              </button>
              {token && (
                <button
                  type="button"
                  onClick={() => {
                    setTokenDraft('');
                    onTokenChange('');
                  }}
                  className="rounded-md border border-line px-2.5 py-1.5 font-mono text-[11px] text-mut transition-colors hover:border-coral/60 hover:text-coral"
                >
                  {t.settings.tokenClear}
                </button>
              )}
            </div>
          </section>

          {/* Translation endpoint */}
          <section className="rounded-lg border border-line p-3">
            <h3 className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-ink">
              <IconTranslate size={12} /> {t.settings.translateTitle}
              <span className="ml-auto font-normal text-mut/70">
                {trCfg.endpoint ? t.settings.translateUsing : t.settings.translatePublicOnly}
              </span>
            </h3>
            <p className="mt-1.5 text-[11px] leading-relaxed text-mut/80">{t.settings.translateNote}</p>
            <div className="mt-2.5 space-y-1.5">
              <input
                type="url"
                value={trCfg.endpoint}
                onChange={(e) => setTrCfg((c) => ({ ...c, endpoint: e.target.value }))}
                placeholder={t.settings.translateUrlPlaceholder}
                spellCheck={false}
                aria-label={t.settings.translateUrl}
                className={field}
              />
              <input
                type="password"
                value={trCfg.apiKey}
                onChange={(e) => setTrCfg((c) => ({ ...c, apiKey: e.target.value }))}
                placeholder={t.settings.translateKey}
                spellCheck={false}
                autoComplete="off"
                aria-label={t.settings.translateKey}
                className={field}
              />
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    saveTranslateConfig({ endpoint: trCfg.endpoint.trim(), apiKey: trCfg.apiKey.trim() });
                    setTrCfg(loadTranslateConfig());
                    flash('translate');
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 font-mono text-[11px] text-mut transition-colors hover:border-mint/60 hover:text-mint"
                >
                  {savedFlash === 'translate' ? <IconCheck size={11} /> : null}
                  {t.settings.translateSave}
                </button>
                {trCfg.endpoint && (
                  <button
                    type="button"
                    onClick={() => {
                      saveTranslateConfig({ endpoint: '', apiKey: '' });
                      setTrCfg({ endpoint: '', apiKey: '' });
                    }}
                    className="rounded-md border border-line px-2.5 py-1.5 font-mono text-[11px] text-mut transition-colors hover:border-coral/60 hover:text-coral"
                  >
                    {t.settings.translateClear}
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
