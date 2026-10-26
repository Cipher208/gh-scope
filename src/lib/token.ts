/**
 * The token is a credential, so it gets the smallest storage that still works:
 * `sessionStorage` dies with the tab. `localStorage` would survive restarts and
 * be readable by any script that lands on this origin, which is why this module
 * exists instead of one `getItem` call inside App.
 *
 * The legacy read is deliberate and one-way: a visitor who already had a token
 * in `localStorage` keeps working, and the persistent copy is removed on the
 * first load rather than left behind.
 */
export const TOKEN_KEY = 'ghscope:token';

export interface TokenStore {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export function readToken(session: TokenStore, legacy?: TokenStore): string {
  try {
    const current = session.getItem(TOKEN_KEY);
    if (current) return current;
  } catch {
    return '';
  }
  if (!legacy) return '';
  try {
    const old = legacy.getItem(TOKEN_KEY);
    if (!old) return '';
    session.setItem(TOKEN_KEY, old);
    legacy.removeItem(TOKEN_KEY);
    return old;
  } catch {
    return '';
  }
}

export function writeToken(session: TokenStore, value: string): void {
  try {
    if (value) session.setItem(TOKEN_KEY, value);
    else session.removeItem(TOKEN_KEY);
  } catch {
    /* private mode: the token simply does not survive the click */
  }
}
