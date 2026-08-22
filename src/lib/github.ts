export interface GHUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  twitter_username: string | null;
  followers: number;
  following: number;
  public_repos: number;
  created_at: string;
}

export interface GHRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
  size: number;
  topics: string[];
  fork: boolean;
  archived: boolean;
  private: boolean;
  created_at: string;
  pushed_at: string;
  homepage: string | null;
  license?: { spdx_id: string | null; name: string | null } | null;
  owner?: { login: string; avatar_url: string };
  default_branch?: string;
}

export interface GHRelease {
  id: number;
  tag_name: string;
  name: string | null;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
  html_url: string;
}

export interface SearchResult {
  total_count: number;
  incomplete_results: boolean;
  items: GHRepo[];
}

export class GHError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const API = 'https://api.github.com';
const enc = encodeURIComponent;

function toError(res: Response, subject: string): GHError {
  if (res.status === 404) {
    return new GHError(404, `${subject} not found. Check the spelling — logins and paths are case-sensitive.`);
  }
  if (res.status === 403 || res.status === 429) {
    return new GHError(
      res.status,
      'GitHub rate limit hit (60 requests/hour without a token, 5 000 with one). Wait a moment and retry.',
    );
  }
  return new GHError(res.status, `Request failed (HTTP ${res.status}). Try again in a second.`);
}

export interface RateInfo {
  limit: number;
  remaining: number;
  reset: number;
  authenticated: boolean;
}

type RateListener = (r: RateInfo) => void;
const rateListeners = new Set<RateListener>();

export function onRateLimit(cb: RateListener): () => void {
  rateListeners.add(cb);
  return () => {
    rateListeners.delete(cb);
  };
}

function emitRate(res: Response, authenticated: boolean) {
  const limit = Number(res.headers.get('x-ratelimit-limit'));
  const remaining = Number(res.headers.get('x-ratelimit-remaining'));
  const reset = Number(res.headers.get('x-ratelimit-reset'));
  if (Number.isFinite(limit) && Number.isFinite(remaining) && limit > 0) {
    for (const cb of rateListeners) cb({ limit, remaining, reset, authenticated });
  }
}

async function ghFetch<T>(url: string, token: string | null, subject: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  } catch {
    throw new GHError(0, 'Network error — check your connection and try again.');
  }
  emitRate(res, Boolean(token));
  if (!res.ok) throw toError(res, subject);
  return (await res.json()) as T;
}

export const fetchUser = (login: string, token: string | null): Promise<GHUser> =>
  ghFetch<GHUser>(`${API}/users/${enc(login)}`, token, 'User');

export const fetchMe = (token: string): Promise<GHUser> => ghFetch<GHUser>(`${API}/user`, token, 'User');

export const fetchRepos = (login: string, token: string | null): Promise<GHRepo[]> =>
  ghFetch<GHRepo[]>(`${API}/users/${enc(login)}/repos?per_page=100&sort=pushed`, token, 'User');

export const fetchMyRepos = (token: string): Promise<GHRepo[]> =>
  ghFetch<GHRepo[]>(`${API}/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member`, token, 'User');

export async function searchRepos(
  q: string,
  sort: string,
  order: 'desc' | 'asc',
  page: number,
  perPage: number,
  token: string | null,
): Promise<SearchResult> {
  const params = new URLSearchParams({ q, per_page: String(perPage), page: String(page) });
  if (sort) {
    params.set('sort', sort);
    params.set('order', order);
  }
  let res: Response;
  try {
    res = await fetch(`${API}/search/repositories?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch {
    throw new GHError(0, 'Network error — check your connection and try again.');
  }
  emitRate(res, Boolean(token));
  if (res.status === 403 || res.status === 429) throw new GHError(res.status, 'SEARCH_RATE');
  if (res.status === 422) throw new GHError(422, 'GitHub rejected the query — check the filters.');
  if (!res.ok) throw toError(res, 'Search');
  return (await res.json()) as SearchResult;
}

export const fetchRepo = (full: string, token: string | null): Promise<GHRepo> =>
  ghFetch<GHRepo>(`${API}/repos/${full}`, token, 'Repository');

export async function fetchReadme(fullName: string, branch: string, token: string | null): Promise<string> {
  const res = await fetch(`${API}/repos/${fullName}/readme?ref=${enc(branch)}`, {
    headers: { Accept: 'application/vnd.github.raw', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  emitRate(res, Boolean(token));
  if (res.status === 404) throw new GHError(404, 'No README found in this repository.');
  if (!res.ok) throw toError(res, 'README');
  return res.text();
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

export const LANG_COLORS: Record<string, string> = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572a5',
  Go: '#00add8',
  Rust: '#dea584',
  Java: '#b07219',
  Kotlin: '#a97bff',
  Swift: '#f05138',
  Ruby: '#701516',
  PHP: '#4f5d95',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  Dart: '#00b4ab',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#663399',
  SCSS: '#c6538c',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Lua: '#4b6db3',
  Haskell: '#5e5086',
  Elixir: '#6e4a7e',
  Scala: '#c22d40',
  R: '#198ce7',
  Julia: '#a270ba',
  'Objective-C': '#438eff',
  Zig: '#ec915c',
  Nix: '#7e7eff',
  Dockerfile: '#384d54',
  Makefile: '#427819',
  'Jupyter Notebook': '#da5b0b',
  Astro: '#ff5a03',
  Solidity: '#aa6746',
  Clojure: '#db5855',
  Perl: '#0298c3',
};

export const langColor = (language: string | null | undefined): string =>
  (language && LANG_COLORS[language]) || '#8b98a9';

export function compactNum(n: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function fullNum(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

export function monthYear(iso: string, locale = 'en-GB'): string {
  return new Date(iso).toLocaleDateString(locale, { month: 'short', year: 'numeric' });
}

export function relTime(iso: string, locale = 'en-GB'): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'always', style: 'narrow' });
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return rtf.format(-min, 'minute');
  const h = Math.round(min / 60);
  if (h < 24) return rtf.format(-h, 'hour');
  const d = Math.round(h / 24);
  if (d < 31) return rtf.format(-d, 'day');
  const mo = Math.round(d / 30.44);
  if (mo < 12) return rtf.format(-mo, 'month');
  return rtf.format(-Math.max(1, Math.round(mo / 12)), 'year');
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* ------------------------------------------------------------------ */
/* Organizations                                                       */
/* ------------------------------------------------------------------ */

export interface GHOrg {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  description: string | null;
  blog: string | null;
  email: string | null;
  location: string | null;
  twitter_username: string | null;
  public_repos: number;
  followers: number;
  is_verified: boolean;
  created_at: string;
}

export const fetchOrg = (login: string, token: string | null): Promise<GHOrg> =>
  ghFetch<GHOrg>(`${API}/orgs/${enc(login)}`, token, 'Organization');

export const fetchOrgRepos = (login: string, token: string | null): Promise<GHRepo[]> =>
  ghFetch<GHRepo[]>(`${API}/orgs/${enc(login)}/repos?per_page=100&sort=pushed`, token, 'Organization');

/* ------------------------------------------------------------------ */
/* Single repo detail + latest release                                 */
/* ------------------------------------------------------------------ */

export interface GHRepoDetail extends GHRepo {
  license: { spdx_id: string | null; name: string | null } | null;
  default_branch: string;
  subscribers_count: number;
}

export const fetchRepoDetail = (fullName: string, token: string | null): Promise<GHRepoDetail> =>
  ghFetch<GHRepoDetail>(`${API}/repos/${fullName}`, token, 'Repository');

export const fetchLatestRelease = (fullName: string, token: string | null): Promise<GHRelease> =>
  ghFetch<GHRelease>(`${API}/repos/${fullName}/releases/latest`, token, 'Release');
