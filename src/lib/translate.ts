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

async function translateChunk(text: string, target: string): Promise<string> {
  if (!text.trim()) return text;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
    target,
  )}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`translate failed (${res.status})`);
  const data = (await res.json()) as unknown;
  const segments = Array.isArray(data) && Array.isArray(data[0]) ? (data[0] as unknown[]) : [];
  let out = '';
  for (const seg of segments) {
    if (Array.isArray(seg) && typeof seg[0] === 'string') out += seg[0];
  }
  return out;
}

export interface Translator {
  translated: string | null;
  busy: boolean;
  failed: boolean;
  active: boolean;
  progress: [number, number];
  toggle: (md: string) => void;
  reset: () => void;
}

export function useTranslator(target = 'ru'): Translator {
  const [translated, setTranslated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
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
      (async () => {
        try {
          const { chunks, protectedBlocks } = splitChunks(md);
          setProgress([0, chunks.length]);
          const cache = readCache();
          const results: string[] = [];
          for (let i = 0; i < chunks.length; i += 1) {
            if (abortRef.current) return;
            const key = hashKey(`${target}|${chunks[i]}`);
            let out = cache[key];
            if (out === undefined) {
              const t = await translateChunk(chunks[i], target);
              out = restore(t, protectedBlocks);
              cache[key] = out;
              writeCache(cache);
            } else {
              out = restore(out, protectedBlocks);
            }
            results.push(out);
            if (abortRef.current) return;
            setProgress([i + 1, chunks.length]);
          }
          if (abortRef.current) return;
          setTranslated(results.join('\n'));
          setBusy(false);
        } catch {
          if (!abortRef.current) {
            setBusy(false);
            setFailed(true);
            activeRef.current = false;
            setActive(false);
          }
        }
      })();
    },
    [target, reset],
  );

  return { translated, busy, failed, active, progress, toggle, reset };
}
