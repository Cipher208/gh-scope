import { useCallback, useRef, useState } from 'react';

const CACHE_KEY = 'ghscope:translations';

interface CacheMap {
  [key: string]: string;
}

function readCache(): CacheMap {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const obj = raw ? (JSON.parse(raw) as unknown) : {};
    return typeof obj === 'object' && obj !== null ? (obj as CacheMap) : {};
  } catch {
    return {};
  }
}

function writeCache(map: CacheMap) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch {
    /* private mode */
  }
}

function hashKey(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${h}`;
}

/**
 * Split markdown into translatable chunks, keeping fenced code blocks and
 * inline code / links as protected placeholders.
 */
function splitChunks(md: string): { chunks: string[]; protectedBlocks: string[] } {
  const protectedBlocks: string[] = [];
  let text = md;
  // protect fenced code
  text = text.replace(/```[\s\S]*?```/g, (m) => {
    protectedBlocks.push(m);
    return `\u0000${protectedBlocks.length - 1}\u0000`;
  });
  // protect inline code & links
  text = text.replace(/(`[^`\n]+`|!\[[^\]\n]*\]\([^)\n]+\)|\[[^\]\n]+\]\([^)\n]+\))/g, (m) => {
    protectedBlocks.push(m);
    return `\u0000${protectedBlocks.length - 1}\u0000`;
  });

  // split remaining prose into sentences-ish chunks of reasonable size
  const chunks: string[] = [];
  const lines = text.split('\n');
  let buf = '';
  for (const line of lines) {
    if (buf.length + line.length > 900 && buf) {
      chunks.push(buf);
      buf = '';
    }
    buf += (buf ? '\n' : '') + line;
  }
  if (buf) chunks.push(buf);
  return { chunks, protectedBlocks };
}

function restore(text: string, protectedBlocks: string[]): string {
  return text.replace(/\u0000(\d+)\u0000/g, (_, idx) => protectedBlocks[Number(idx)] ?? '');
}

/* ------------------------------------------------------------------ *
 * Transports
 *
 * Translation is the one feature here that talks to a third party, so it is
 * the one feature that can break for reasons this project does not control.
 * The public endpoint used below (`translate_a/single?client=gtx`) is not a
 * documented API — it is what the Google Translate web widget calls, and
 * Google may close it whenever they like.
 *
 * So translation goes through a chain instead of one hardcoded call. A user
 * who supplies their own endpoint gets that first; everyone else gets the
 * public one; and if neither answers, the README falls back to the original
 * text with a visible note. What it must never do is present a partial
 * translation as if it were the whole document — see `toggle` below.
 * ------------------------------------------------------------------ */

export interface TranslateConfig {
  /** A LibreTranslate-compatible `/translate` URL. Empty means "not set". */
  endpoint: string;
  /** Optional key for that endpoint. Never sent to the public transport. */
  apiKey: string;
}

const CONFIG_KEY = 'ghscope:translate';

export function loadTranslateConfig(): TranslateConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    const obj = raw ? (JSON.parse(raw) as Partial<TranslateConfig>) : {};
    return {
      endpoint: typeof obj.endpoint === 'string' ? obj.endpoint : '',
      apiKey: typeof obj.apiKey === 'string' ? obj.apiKey : '',
    };
  } catch {
    return { endpoint: '', apiKey: '' };
  }
}

export function saveTranslateConfig(cfg: TranslateConfig) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    /* private mode */
  }
}

export type TransportName = 'endpoint' | 'google';

/** A LibreTranslate-shaped endpoint: POST JSON, read `translatedText`. */
async function translateViaEndpoint(
  text: string,
  target: string,
  cfg: TranslateConfig,
): Promise<string> {
  const body: Record<string, string> = { q: text, source: 'auto', target, format: 'text' };
  if (cfg.apiKey) body.api_key = cfg.apiKey;
  const res = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`endpoint ${res.status}`);
  const data = (await res.json()) as unknown;
  if (data && typeof data === 'object') {
    const one = (data as { translatedText?: unknown }).translatedText;
    if (typeof one === 'string' && one) return one;
    const many = (data as { translations?: unknown }).translations;
    if (Array.isArray(many) && many[0]) {
      const m = (many[0] as { translatedText?: unknown }).translatedText;
      if (typeof m === 'string' && m) return m;
    }
  }
  throw new Error('endpoint returned an unrecognised shape');
}

async function translateViaGoogle(text: string, target: string): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
    target,
  )}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`google ${res.status}`);
  const data = (await res.json()) as unknown;
  const segments = Array.isArray(data) && Array.isArray(data[0]) ? (data[0] as unknown[]) : [];
  let out = '';
  for (const seg of segments) {
    if (Array.isArray(seg) && typeof seg[0] === 'string') out += seg[0];
  }
  if (!out) throw new Error('google returned no segments');
  return out;
}

/**
 * The configured endpoint first, then the public one. Both are allowed to
 * fail; the caller decides what a total failure looks like, and it never
 * decides that a partial document is a whole one.
 */
async function translateChunk(
  text: string,
  target: string,
  cfg: TranslateConfig,
): Promise<{ text: string; via: TransportName }> {
  if (!text.trim()) return { text, via: 'google' };
  const attempts: { name: TransportName; run: () => Promise<string> }[] = [];
  if (cfg.endpoint) {
    attempts.push({ name: 'endpoint', run: () => translateViaEndpoint(text, target, cfg) });
  }
  attempts.push({ name: 'google', run: () => translateViaGoogle(text, target) });

  let last: unknown = null;
  for (const a of attempts) {
    try {
      return { text: await a.run(), via: a.name };
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error('no transport succeeded');
}

export interface Translator {
  translated: string | null;
  busy: boolean;
  failed: boolean;
  active: boolean;
  progress: [number, number];
  /** Which transport produced the current text; null before the first chunk. */
  via: TransportName | null;
  /** How many chunks failed, so a failure can be reported honestly. */
  failedChunks: number;
  toggle: (md: string) => void;
  reset: () => void;
}

export function useTranslator(target = 'ru'): Translator {
  const [translated, setTranslated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [failedChunks, setFailedChunks] = useState(0);
  const [via, setVia] = useState<TransportName | null>(null);
  const [progress, setProgress] = useState<[number, number]>([0, 0]);
  const abortRef = useRef(false);
  const activeRef = useRef(false);
  const [active, setActive] = useState(false);

  const reset = useCallback(() => {
    abortRef.current = true;
    activeRef.current = false;
    setActive(false);
    setTranslated(null);
    setBusy(false);
    setFailed(false);
    setFailedChunks(0);
    setVia(null);
    setProgress([0, 0]);
  }, []);

  const toggle = useCallback(
    (md: string) => {
      if (activeRef.current) {
        reset();
        return;
      }
      abortRef.current = false;
      activeRef.current = true;
      setActive(true);
      setBusy(true);
      setFailed(false);
      setFailedChunks(0);
      setVia(null);
      (async () => {
        try {
          const { chunks, protectedBlocks } = splitChunks(md);
          setProgress([0, chunks.length]);
          const cache = readCache();
          const cfg = loadTranslateConfig();
          const chain: TransportName[] = cfg.endpoint ? ['endpoint', 'google'] : ['google'];
          const results: string[] = [];
          let misses = 0;
          let seen: TransportName | null = null;
          let mixed = false;

          for (let i = 0; i < chunks.length; i += 1) {
            if (abortRef.current) return;

            // Cache entries are keyed by the transport that produced them. The
            // text is not interchangeable between transports: a chunk cached
            // from the public endpoint must not be served, silently, as if the
            // visitor's own endpoint had translated it.
            let got: { text: string; via: TransportName } | null = null;
            for (const name of chain) {
              const key = hashKey(`${target}|${name}|${chunks[i]}`);
              const hit = cache[key];
              if (hit !== undefined) {
                got = { text: restore(hit, protectedBlocks), via: name };
                break;
              }
            }

            if (!got) {
              try {
                const fresh = await translateChunk(chunks[i], target, cfg);
                got = { text: restore(fresh.text, protectedBlocks), via: fresh.via };
                cache[hashKey(`${target}|${fresh.via}|${chunks[i]}`)] = restore(
                  fresh.text,
                  protectedBlocks,
                );
                writeCache(cache);
              } catch {
                // One dead chunk is enough to make the whole document a
                // partial one. Keep going so the rest lands in the cache and
                // a second attempt is cheap, but remember the miss.
                misses += 1;
                results.push(chunks[i]);
                setProgress([i + 1, chunks.length]);
                continue;
              }
            }

            if (seen === null) seen = got.via;
            else if (seen !== got.via) mixed = true;
            results.push(got.text);

            if (abortRef.current) return;
            setProgress([i + 1, chunks.length]);
          }

          if (abortRef.current) return;
          if (misses > 0) {
            // Never present a partial translation as a whole one: show the
            // original and say so. The chunks that did succeed are cached, so
            // pressing the button again only retries the ones that failed.
            setFailed(true);
            setFailedChunks(misses);
            setTranslated(null);
          } else {
            setTranslated(results.join('\n'));
            setVia(mixed ? null : seen);
          }
          setBusy(false);
        } catch {
          if (!abortRef.current) {
            setBusy(false);
            setFailed(true);
            setFailedChunks(0);
            activeRef.current = false;
            setActive(false);
          }
        }
      })();
    },
    [target, reset],
  );

  return { translated, busy, failed, active, progress, via, failedChunks, toggle, reset };
}
