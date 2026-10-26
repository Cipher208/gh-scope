/**
 * The app is client-only, and one place in it reads `sessionStorage` as a bare
 * identifier (`readToken(sessionStorage, ...)`), which throws before
 * readToken's own try/catch can help. Static rendering of the shell therefore
 * needs the two storages to exist. In-memory maps are enough: tests only need
 * the storage contract, not persistence.
 *
 * Import this file before anything that renders App — ESM executes imports in
 * order, so a bare side-effect import at the top is the whole trick.
 */
interface Store {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

function memoryStore(): Store {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    clear: () => map.clear(),
  };
}

const g = globalThis as typeof globalThis & { localStorage?: Store; sessionStorage?: Store };
g.localStorage ??= memoryStore();
g.sessionStorage ??= memoryStore();
