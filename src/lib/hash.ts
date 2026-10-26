/** Reading and watching the URL hash, which is this app's only routing. */

export interface HashHost {
  location: { hash: string };
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

export function loginFromHash(hash: string): string {
  const raw = hash.replace(/^#\/?/, '');
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

export function watchHash(win: HashHost, cb: (login: string) => void): () => void {
  const handler = () => cb(loginFromHash(win.location.hash));
  win.addEventListener('hashchange', handler);
  return () => win.removeEventListener('hashchange', handler);
}
